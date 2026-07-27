const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { db, DATA_DIR } = require('../db');
const { requireAuth, requireRole, canViewInvoice, canDecideInvoice } = require('../auth');

const router = express.Router();

const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = ALLOWED_MIME[file.mimetype] || path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) return cb(null, true);
    cb(new Error('Sadece PDF, JPEG veya PNG dosyaları yüklenebilir.'));
  },
});

const INVOICE_SELECT = `
  SELECT i.*,
         d.name  AS department_name,
         up.full_name AS uploaded_by_name,
         dec.full_name AS decided_by_name,
         (SELECT COUNT(*) FROM invoice_events e WHERE e.invoice_id = i.id) AS event_count
  FROM invoices i
  JOIN departments d ON d.id = i.department_id
  JOIN users up      ON up.id = i.uploaded_by
  LEFT JOIN users dec ON dec.id = i.decided_by
`;

function getInvoice(id) {
  return db.prepare(`${INVOICE_SELECT} WHERE i.id = ?`).get(id);
}

function addEvent(invoiceId, userId, action, comment) {
  db.prepare(`
    INSERT INTO invoice_events (invoice_id, user_id, action, comment)
    VALUES (?, ?, ?, ?)
  `).run(invoiceId, userId, action, comment || null);
}

function touch(invoiceId) {
  db.prepare("UPDATE invoices SET updated_at = datetime('now') WHERE id = ?").run(invoiceId);
}

// --- Fatura listesi -------------------------------------------------------
// Muhasebe tüm faturaları, müdür sadece kendi departmanını, admin hepsini görür.
router.get('/', requireAuth, (req, res) => {
  const where = [];
  const params = {};

  if (req.user.role === 'approver') {
    where.push('i.department_id = @dept');
    params.dept = req.user.department_id;
  }

  const { status, department_id, q } = req.query;
  if (status && status !== 'all') {
    where.push('i.status = @status');
    params.status = status;
  }
  if (department_id && req.user.role !== 'approver') {
    where.push('i.department_id = @department_id');
    params.department_id = Number(department_id);
  }
  if (q) {
    where.push('(i.invoice_no LIKE @q OR i.supplier LIKE @q OR i.description LIKE @q)');
    params.q = `%${q}%`;
  }

  const sql = `${INVOICE_SELECT}
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY CASE i.status WHEN 'pending' THEN 0 WHEN 'info_requested' THEN 1 ELSE 2 END,
             i.created_at DESC`;

  res.json({ invoices: db.prepare(sql).all(params) });
});

// --- Özet sayaçlar --------------------------------------------------------
router.get('/summary', requireAuth, (req, res) => {
  const scoped = req.user.role === 'approver';
  const rows = db.prepare(`
    SELECT status, COUNT(*) AS n FROM invoices
    ${scoped ? 'WHERE department_id = @dept' : ''}
    GROUP BY status
  `).all(scoped ? { dept: req.user.department_id } : {});

  const summary = { pending: 0, approved: 0, rejected: 0, info_requested: 0, total: 0 };
  for (const r of rows) {
    summary[r.status] = r.n;
    summary.total += r.n;
  }
  res.json({ summary });
});

// --- Fatura yükleme (muhasebe) -------------------------------------------
router.post('/', requireAuth, requireRole('accounting', 'admin'), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Fatura dosyası (PDF/JPEG) zorunludur.' });

    const cleanup = () => fs.unlink(req.file.path, () => {});
    const { invoice_no, supplier, amount, currency, invoice_date, description, department_id } = req.body || {};

    if (!invoice_no || !supplier || !amount || !department_id) {
      cleanup();
      return res.status(400).json({ error: 'Fatura no, tedarikçi, tutar ve departman zorunludur.' });
    }

    const parsedAmount = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      cleanup();
      return res.status(400).json({ error: 'Tutar geçerli ve sıfırdan büyük olmalıdır.' });
    }

    const dept = db.prepare('SELECT id FROM departments WHERE id = ?').get(Number(department_id));
    if (!dept) {
      cleanup();
      return res.status(400).json({ error: 'Geçersiz departman seçildi.' });
    }

    const info = db.prepare(`
      INSERT INTO invoices
        (invoice_no, supplier, amount, currency, invoice_date, description,
         department_id, uploaded_by, stored_name, original_name, mime_type, file_size)
      VALUES (@invoice_no, @supplier, @amount, @currency, @invoice_date, @description,
              @department_id, @uploaded_by, @stored_name, @original_name, @mime_type, @file_size)
    `).run({
      invoice_no: String(invoice_no).trim(),
      supplier: String(supplier).trim(),
      amount: parsedAmount,
      currency: (currency || 'TRY').toUpperCase(),
      invoice_date: invoice_date || null,
      description: description ? String(description).trim() : null,
      department_id: dept.id,
      uploaded_by: req.user.id,
      stored_name: req.file.filename,
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
    });

    addEvent(info.lastInsertRowid, req.user.id, 'uploaded', description ? String(description).trim() : null);
    res.status(201).json({ invoice: getInvoice(info.lastInsertRowid) });
  });
});

// --- Fatura detayı + işlem geçmişi ---------------------------------------
router.get('/:id', requireAuth, (req, res) => {
  const invoice = getInvoice(Number(req.params.id));
  if (!canViewInvoice(req.user, invoice)) {
    return res.status(404).json({ error: 'Fatura bulunamadı.' });
  }

  const events = db.prepare(`
    SELECT e.id, e.action, e.comment, e.created_at, u.full_name AS user_name, u.role AS user_role
    FROM invoice_events e
    JOIN users u ON u.id = e.user_id
    WHERE e.invoice_id = ?
    ORDER BY e.created_at ASC, e.id ASC
  `).all(invoice.id);

  res.json({ invoice, events });
});

// --- Fatura dosyasını görüntüle ------------------------------------------
router.get('/:id/file', requireAuth, (req, res) => {
  const invoice = getInvoice(Number(req.params.id));
  if (!canViewInvoice(req.user, invoice)) {
    return res.status(404).json({ error: 'Fatura bulunamadı.' });
  }

  const filePath = path.join(UPLOAD_DIR, path.basename(invoice.stored_name));
  if (!fs.existsSync(filePath)) {
    return res.status(410).json({ error: 'Dosya sunucuda bulunamadı.' });
  }

  res.type(invoice.mime_type);
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(invoice.original_name)}`);
  fs.createReadStream(filePath).pipe(res);
});

// --- Karar: onayla / reddet / soru sor -----------------------------------
router.post('/:id/decision', requireAuth, (req, res) => {
  const invoice = getInvoice(Number(req.params.id));
  if (!canViewInvoice(req.user, invoice)) {
    return res.status(404).json({ error: 'Fatura bulunamadı.' });
  }
  if (!canDecideInvoice(req.user, invoice)) {
    return res.status(403).json({ error: 'Bu fatura için karar verme yetkiniz yok.' });
  }
  if (invoice.status === 'approved' || invoice.status === 'rejected') {
    return res.status(409).json({ error: 'Bu fatura zaten sonuçlandırılmış.' });
  }

  const { action, comment } = req.body || {};
  const map = { approve: 'approved', reject: 'rejected', question: 'info_requested' };
  const newStatus = map[action];
  if (!newStatus) {
    return res.status(400).json({ error: 'Geçersiz işlem. (approve / reject / question)' });
  }

  const text = comment ? String(comment).trim() : '';
  if ((action === 'reject' || action === 'question') && !text) {
    return res.status(400).json({
      error: action === 'reject' ? 'Red gerekçesi zorunludur.' : 'Sormak istediğiniz soruyu yazınız.',
    });
  }

  db.transaction(() => {
    if (action === 'question') {
      db.prepare(`
        UPDATE invoices SET status = 'info_requested', updated_at = datetime('now') WHERE id = ?
      `).run(invoice.id);
    } else {
      db.prepare(`
        UPDATE invoices
        SET status = @status, decided_by = @user, decided_at = datetime('now'), updated_at = datetime('now')
        WHERE id = @id
      `).run({ status: newStatus, user: req.user.id, id: invoice.id });
    }
    addEvent(invoice.id, req.user.id, action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'question', text);
  })();

  res.json({ invoice: getInvoice(invoice.id) });
});

// --- Muhasebenin soruya cevabı -------------------------------------------
router.post('/:id/answer', requireAuth, requireRole('accounting', 'admin'), (req, res) => {
  const invoice = getInvoice(Number(req.params.id));
  if (!invoice) return res.status(404).json({ error: 'Fatura bulunamadı.' });
  if (invoice.status !== 'info_requested') {
    return res.status(409).json({ error: 'Bu fatura için bekleyen bir soru yok.' });
  }

  const text = req.body && req.body.comment ? String(req.body.comment).trim() : '';
  if (!text) return res.status(400).json({ error: 'Cevap metni zorunludur.' });

  db.transaction(() => {
    addEvent(invoice.id, req.user.id, 'answer', text);
    db.prepare("UPDATE invoices SET status = 'pending', updated_at = datetime('now') WHERE id = ?").run(invoice.id);
  })();

  res.json({ invoice: getInvoice(invoice.id) });
});

module.exports = router;
