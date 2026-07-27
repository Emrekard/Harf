const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'fatura.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS departments (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('accounting', 'approver', 'admin')),
  department_id INTEGER REFERENCES departments(id),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no    TEXT NOT NULL,
  supplier      TEXT NOT NULL,
  amount        REAL NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'TRY',
  invoice_date  TEXT,
  description   TEXT,
  department_id INTEGER NOT NULL REFERENCES departments(id),
  uploaded_by   INTEGER NOT NULL REFERENCES users(id),
  stored_name   TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  file_size     INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'rejected', 'info_requested')),
  decided_by    INTEGER REFERENCES users(id),
  decided_at    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS invoice_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  action     TEXT NOT NULL CHECK (action IN ('uploaded', 'approved', 'rejected', 'question', 'answer')),
  comment    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_dept   ON invoices(department_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_events_invoice  ON invoice_events(invoice_id);
`);

function seed() {
  const already = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (already > 0) return;

  const insertDept = db.prepare('INSERT INTO departments (name) VALUES (?)');
  const insertUser = db.prepare(`
    INSERT INTO users (username, password_hash, full_name, role, department_id)
    VALUES (@username, @password_hash, @full_name, @role, @department_id)
  `);

  db.transaction(() => {
    const deptIds = {};
    for (const name of ['Satın Alma', 'Üretim', 'Bilgi Teknolojileri', 'İnsan Kaynakları', 'Lojistik']) {
      deptIds[name] = insertDept.run(name).lastInsertRowid;
    }

    const hash = (plain) => bcrypt.hashSync(plain, 10);
    const people = [
      { username: 'muhasebe',  full_name: 'Ayşe Muhasebe',  role: 'accounting', department_id: null,                          password: 'muhasebe123' },
      { username: 'muhasebe2', full_name: 'Kerem Muhasebe', role: 'accounting', department_id: null,                          password: 'muhasebe123' },
      { username: 'satinalma', full_name: 'Deniz Satın Alma Müdürü', role: 'approver', department_id: deptIds['Satın Alma'],   password: 'onay123' },
      { username: 'uretim',    full_name: 'Selin Üretim Müdürü',     role: 'approver', department_id: deptIds['Üretim'],       password: 'onay123' },
      { username: 'bt',        full_name: 'Emre BT Müdürü',          role: 'approver', department_id: deptIds['Bilgi Teknolojileri'], password: 'onay123' },
      { username: 'ik',        full_name: 'Zeynep İK Müdürü',        role: 'approver', department_id: deptIds['İnsan Kaynakları'],    password: 'onay123' },
      { username: 'lojistik',  full_name: 'Murat Lojistik Müdürü',   role: 'approver', department_id: deptIds['Lojistik'],     password: 'onay123' },
      { username: 'admin',     full_name: 'Sistem Yöneticisi',       role: 'admin',    department_id: null,                    password: 'admin123' },
    ];

    for (const p of people) {
      insertUser.run({
        username: p.username,
        password_hash: hash(p.password),
        full_name: p.full_name,
        role: p.role,
        department_id: p.department_id,
      });
    }
  })();

  console.log('Başlangıç verileri oluşturuldu (departmanlar ve kullanıcılar).');
}

seed();

module.exports = { db, DATA_DIR };
