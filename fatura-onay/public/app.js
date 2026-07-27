/* Fatura Onay Sistemi - istemci tarafı */

const STATUS_LABELS = {
  pending: 'Onay Bekliyor',
  info_requested: 'Bilgi Bekleniyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

const ROLE_LABELS = {
  accounting: 'Muhasebe',
  approver: 'Onaylayan Müdür',
  admin: 'Sistem Yöneticisi',
};

const ACTION_LABELS = {
  uploaded: 'Fatura yüklendi',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  question: 'Soru soruldu',
  answer: 'Muhasebe cevapladı',
};

const state = {
  user: null,
  invoices: [],
  selectedId: null,
  departments: [],
};

const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- yardımcılar
async function api(url, options = {}) {
  const res = await fetch(url, { credentials: 'same-origin', ...options });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : null;
  if (!res.ok) throw new Error((data && data.error) || 'Beklenmeyen bir hata oluştu.');
  return data;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function money(amount, currency) {
  try {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: currency || 'TRY' }).format(amount);
  } catch {
    return `${Number(amount).toFixed(2)} ${currency || ''}`.trim();
  }
}

function dateTime(value) {
  if (!value) return '-';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}

function dateOnly(value) {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('tr-TR');
}

function showError(elId, message) {
  const el = $(elId);
  el.textContent = message;
  el.classList.remove('hidden');
}

function clearError(elId) {
  $(elId).classList.add('hidden');
}

function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }

document.addEventListener('click', (e) => {
  const target = e.target.getAttribute && e.target.getAttribute('data-close');
  if (target) closeModal(target);
});

// ---------------------------------------------------------------- oturum
$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('loginError');
  $('loginBtn').disabled = true;
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: $('username').value, password: $('password').value }),
    });
    state.user = data.user;
    await enterApp();
  } catch (err) {
    showError('loginError', err.message);
  } finally {
    $('loginBtn').disabled = false;
  }
});

$('logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null;
  state.selectedId = null;
  $('appScreen').classList.add('hidden');
  $('loginScreen').classList.remove('hidden');
  $('password').value = '';
});

async function enterApp() {
  $('loginScreen').classList.add('hidden');
  $('appScreen').classList.remove('hidden');

  $('userName').textContent = state.user.full_name;
  $('userRole').textContent = state.user.department_name
    ? `${ROLE_LABELS[state.user.role]} · ${state.user.department_name}`
    : ROLE_LABELS[state.user.role];

  const canUpload = state.user.role === 'accounting' || state.user.role === 'admin';
  $('uploadOpenBtn').classList.toggle('hidden', !canUpload);

  const { departments } = await api('/api/auth/departments');
  state.departments = departments;

  $('departmentSelect').innerHTML =
    '<option value="">Seçiniz...</option>' +
    departments.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');

  if (state.user.role !== 'approver') {
    $('deptFilter').classList.remove('hidden');
    $('deptFilter').innerHTML =
      '<option value="">Tüm departmanlar</option>' +
      departments.map((d) => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  } else {
    $('deptFilter').classList.add('hidden');
  }

  await refresh();
}

// ---------------------------------------------------------------- liste
let searchTimer;
$('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(refresh, 300);
});
$('statusFilter').addEventListener('change', refresh);
$('deptFilter').addEventListener('change', refresh);

async function refresh() {
  const params = new URLSearchParams();
  params.set('status', $('statusFilter').value);
  if ($('deptFilter').value) params.set('department_id', $('deptFilter').value);
  if ($('searchInput').value.trim()) params.set('q', $('searchInput').value.trim());

  const [{ invoices }, { summary }] = await Promise.all([
    api(`/api/invoices?${params.toString()}`),
    api('/api/invoices/summary'),
  ]);

  state.invoices = invoices;
  renderSummary(summary);
  renderList();

  if (state.selectedId) await showDetail(state.selectedId);
}

function renderSummary(summary) {
  const cards = [
    { key: 'pending', label: 'Onay Bekleyen' },
    { key: 'info_requested', label: 'Bilgi Bekleyen' },
    { key: 'approved', label: 'Onaylanan' },
    { key: 'rejected', label: 'Reddedilen' },
    { key: 'total', label: 'Toplam' },
  ];
  $('summary').innerHTML = cards.map((c) => `
    <div class="stat ${c.key}">
      <div class="n">${summary[c.key] || 0}</div>
      <div class="l">${c.label}</div>
    </div>
  `).join('');
}

function renderList() {
  const list = $('invoiceList');
  $('listCount').textContent = `${state.invoices.length} kayıt`;

  if (!state.invoices.length) {
    list.innerHTML = '<div class="empty">Bu filtrelere uyan fatura bulunamadı.</div>';
    return;
  }

  list.innerHTML = state.invoices.map((inv) => `
    <div class="invoice-item ${inv.id === state.selectedId ? 'active' : ''}" data-id="${inv.id}">
      <div>
        <div class="no">${esc(inv.invoice_no)}</div>
        <div class="meta">${esc(inv.supplier)}</div>
        <div class="meta">${esc(inv.department_name)} · ${dateTime(inv.created_at)}</div>
      </div>
      <div class="right">
        <div class="amount">${money(inv.amount, inv.currency)}</div>
        <span class="badge ${inv.status}">${STATUS_LABELS[inv.status]}</span>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.invoice-item').forEach((el) => {
    el.addEventListener('click', async () => {
      state.selectedId = Number(el.dataset.id);
      renderList();
      await showDetail(state.selectedId);
      // Mobilde detay panosu listenin altında kaldığı için oraya kaydır.
      if (window.matchMedia('(max-width: 768px)').matches) {
        $('detailPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

// ---------------------------------------------------------------- detay
async function showDetail(id) {
  const panel = $('detailPanel');
  try {
    const { invoice, events } = await api(`/api/invoices/${id}`);
    const isImage = invoice.mime_type.startsWith('image/');
    const canDecide =
      (state.user.role === 'admin' ||
        (state.user.role === 'approver' && state.user.department_id === invoice.department_id)) &&
      (invoice.status === 'pending' || invoice.status === 'info_requested');
    const canAnswer =
      (state.user.role === 'accounting' || state.user.role === 'admin') &&
      invoice.status === 'info_requested';

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px;">
        <div>
          <div style="font-size:19px;font-weight:700;">${esc(invoice.invoice_no)}</div>
          <div style="color:var(--muted);">${esc(invoice.supplier)}</div>
        </div>
        <span class="badge ${invoice.status}">${STATUS_LABELS[invoice.status]}</span>
      </div>

      <div class="detail-grid">
        <div><div class="k">Tutar</div><div class="v">${money(invoice.amount, invoice.currency)}</div></div>
        <div><div class="k">Fatura Tarihi</div><div class="v">${dateOnly(invoice.invoice_date)}</div></div>
        <div><div class="k">Departman</div><div class="v">${esc(invoice.department_name)}</div></div>
        <div><div class="k">Yükleyen</div><div class="v">${esc(invoice.uploaded_by_name)}</div></div>
        <div><div class="k">Yüklenme</div><div class="v">${dateTime(invoice.created_at)}</div></div>
        ${invoice.decided_by_name ? `
          <div><div class="k">Karar Veren</div><div class="v">${esc(invoice.decided_by_name)}</div></div>
          <div><div class="k">Karar Tarihi</div><div class="v">${dateTime(invoice.decided_at)}</div></div>` : ''}
      </div>

      ${invoice.description ? `
        <div class="field">
          <label>Açıklama</label>
          <div style="white-space:pre-wrap;">${esc(invoice.description)}</div>
        </div>` : ''}

      ${isImage ? `
        <div class="preview">
          <img src="/api/invoices/${invoice.id}/file" alt="Fatura görseli">
        </div>` : `
        <div class="preview pdf-preview">
          <iframe src="/api/invoices/${invoice.id}/file" title="Fatura PDF"></iframe>
        </div>
        <a class="open-file-mobile" href="/api/invoices/${invoice.id}/file" target="_blank" rel="noopener">
          <button type="button">Faturayı Görüntüle (PDF)</button>
        </a>`}

      <a href="/api/invoices/${invoice.id}/file?download=1" download>
        <button type="button" class="secondary">Dosyayı İndir (${esc(invoice.original_name)})</button>
      </a>

      ${canDecide ? `
        <div class="actions">
          <button class="approve" data-act="approve">Onayla</button>
          <button class="reject" data-act="reject">Reddet</button>
          <button class="question" data-act="question">Soru Sor / Geri Gönder</button>
        </div>` : ''}

      ${canAnswer ? `
        <div class="actions">
          <button data-act="answer">Soruyu Cevapla</button>
        </div>` : ''}

      <h3 style="margin:24px 0 10px;font-size:15px;">İşlem Geçmişi</h3>
      <ul class="timeline">
        ${events.map((ev) => `
          <li class="${ev.action}">
            <div class="head">${ACTION_LABELS[ev.action]} — ${esc(ev.user_name)}</div>
            <div class="when">${dateTime(ev.created_at)}</div>
            ${ev.comment ? `<div class="comment">${esc(ev.comment)}</div>` : ''}
          </li>
        `).join('')}
      </ul>
    `;

    panel.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => openCommentModal(invoice.id, btn.dataset.act));
    });
  } catch (err) {
    panel.innerHTML = `<div class="empty">${esc(err.message)}</div>`;
  }
}

// ---------------------------------------------------------------- karar / cevap
const COMMENT_CONFIG = {
  approve: { title: 'Faturayı Onayla', label: 'Onay notu (isteğe bağlı)', button: 'Onayla', required: false },
  reject: { title: 'Faturayı Reddet', label: 'Red gerekçesi *', button: 'Reddet', required: true },
  question: { title: 'Soru Sor / Muhasebeye Geri Gönder', label: 'Sorunuz *', button: 'Gönder', required: true },
  answer: { title: 'Soruyu Cevapla', label: 'Cevabınız *', button: 'Cevabı Gönder', required: true },
};

let pending = { id: null, action: null };

function openCommentModal(invoiceId, action) {
  pending = { id: invoiceId, action };
  const cfg = COMMENT_CONFIG[action];
  $('commentTitle').textContent = cfg.title;
  $('commentLabel').textContent = cfg.label;
  $('commentSubmitBtn').textContent = cfg.button;
  $('commentText').value = '';
  clearError('commentError');
  openModal('commentModal');
  $('commentText').focus();
}

$('commentForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('commentError');

  const cfg = COMMENT_CONFIG[pending.action];
  const comment = $('commentText').value.trim();
  if (cfg.required && !comment) {
    return showError('commentError', 'Bu alan zorunludur.');
  }

  $('commentSubmitBtn').disabled = true;
  try {
    if (pending.action === 'answer') {
      await api(`/api/invoices/${pending.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment }),
      });
    } else {
      await api(`/api/invoices/${pending.id}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: pending.action, comment }),
      });
    }
    closeModal('commentModal');
    await refresh();
  } catch (err) {
    showError('commentError', err.message);
  } finally {
    $('commentSubmitBtn').disabled = false;
  }
});

// ---------------------------------------------------------------- yükleme
$('uploadOpenBtn').addEventListener('click', () => {
  $('uploadForm').reset();
  clearError('uploadError');
  openModal('uploadModal');
});

$('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError('uploadError');

  const fd = new FormData();
  fd.append('invoice_no', $('invoiceNo').value.trim());
  fd.append('supplier', $('supplier').value.trim());
  fd.append('amount', $('amount').value);
  fd.append('currency', $('currency').value);
  fd.append('invoice_date', $('invoiceDate').value);
  fd.append('description', $('description').value.trim());
  fd.append('department_id', $('departmentSelect').value);
  fd.append('file', $('fileInput').files[0]);

  $('uploadSubmitBtn').disabled = true;
  try {
    const { invoice } = await api('/api/invoices', { method: 'POST', body: fd });
    closeModal('uploadModal');
    state.selectedId = invoice.id;
    await refresh();
  } catch (err) {
    showError('uploadError', err.message);
  } finally {
    $('uploadSubmitBtn').disabled = false;
  }
});

// ---------------------------------------------------------------- başlangıç
(async function init() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    await enterApp();
  } catch {
    $('loginScreen').classList.remove('hidden');
  }
})();
