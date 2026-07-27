const path = require('path');
const express = require('express');
const session = require('express-session');

const authRoutes = require('./src/routes/auth');
const invoiceRoutes = require('./src/routes/invoices');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'fatura.sid',
  secret: process.env.SESSION_SECRET || 'gelistirme-ortami-icin-gizli-anahtar',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000, // 8 saat
  },
}));

app.use('/api/auth', authRoutes);
app.use('/api/invoices', invoiceRoutes);

app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res) => res.status(404).json({ error: 'Bulunamadı.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

app.listen(PORT, () => {
  console.log(`Fatura Onay Sistemi çalışıyor: http://localhost:${PORT}`);
});
