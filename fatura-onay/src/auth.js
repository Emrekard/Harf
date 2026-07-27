const { db } = require('./db');

function currentUser(req) {
  if (!req.session || !req.session.userId) return null;
  return db.prepare(`
    SELECT u.id, u.username, u.full_name, u.role, u.department_id, d.name AS department_name
    FROM users u
    LEFT JOIN departments d ON d.id = u.department_id
    WHERE u.id = ?
  `).get(req.session.userId) || null;
}

function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Oturum açmanız gerekiyor.' });
  req.user = user;
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
    }
    next();
  };
}

// Muhasebe kendi yüklediğini, müdür kendi departmanını, admin hepsini görür.
function canViewInvoice(user, invoice) {
  if (!invoice) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'accounting') return true;
  return user.role === 'approver' && user.department_id === invoice.department_id;
}

// Sadece ilgili departmanın müdürü (veya admin) karar verebilir.
function canDecideInvoice(user, invoice) {
  if (!invoice) return false;
  if (user.role === 'admin') return true;
  return user.role === 'approver' && user.department_id === invoice.department_id;
}

module.exports = { currentUser, requireAuth, requireRole, canViewInvoice, canDecideInvoice };
