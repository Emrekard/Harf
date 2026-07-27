const path = require('path');
const express = require('express');
const session = require('express-session');
const rateLimit = require('express-rate-limit');

const SqliteStore = require('./src/session-store');
const authRoutes = require('./src/routes/auth');
const invoiceRoutes = require('./src/routes/invoices');

const app = express();
const PORT = process.env.PORT || 3000;
const PRODUCTION = process.env.NODE_ENV === 'production';

// Üretimde zayıf/varsayılan oturum anahtarı ile başlatmayı engelle.
const SESSION_SECRET = process.env.SESSION_SECRET;
if (PRODUCTION && (!SESSION_SECRET || SESSION_SECRET.length < 32)) {
  console.error(
    'HATA: Üretim ortamında en az 32 karakterlik SESSION_SECRET zorunludur.\n' +
    'Oluşturmak için: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
  process.exit(1);
}

// Ters vekil (nginx / Caddy / Cloudflare) arkasında doğru protokol ve IP bilgisi için.
if (PRODUCTION) app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'fatura.sid',
  store: new SqliteStore(),
  secret: SESSION_SECRET || 'gelistirme-ortami-icin-gizli-anahtar',
  resave: false,
  saveUninitialized: false,
  rolling: true, // her istekte süreyi uzat
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: PRODUCTION, // HTTPS zorunlu (üretimde)
    maxAge: 8 * 60 * 60 * 1000, // 8 saat
  },
}));

// Şifre denemelerini sınırla (kaba kuvvet saldırısına karşı).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.' },
});
app.use('/api/auth/login', loginLimiter);

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
  if (!PRODUCTION) console.log('Geliştirme modu (NODE_ENV=production ile üretim modunda başlatın).');
});
