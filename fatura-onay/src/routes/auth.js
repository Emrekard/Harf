const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { currentUser, requireAuth } = require('../auth');

const router = express.Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
  }

  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!row || !bcrypt.compareSync(String(password), row.password_hash)) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
  }

  req.session.userId = row.id;
  res.json({ user: currentUser(req) });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

router.get('/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ error: 'Oturum açık değil.' });
  res.json({ user });
});

router.get('/departments', requireAuth, (req, res) => {
  res.json({ departments: db.prepare('SELECT id, name FROM departments ORDER BY name').all() });
});

module.exports = router;
