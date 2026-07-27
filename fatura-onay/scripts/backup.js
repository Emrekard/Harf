#!/usr/bin/env node
// Veritabanının tutarlı bir yedeğini ve yüklenen fatura dosyalarını kopyalar.
// Günlük çalıştırmak için (örn. her gece 02:00) crontab'a ekleyin:
//   0 2 * * * cd /opt/fatura-onay && /usr/bin/node scripts/backup.js >> /var/log/fatura-yedek.log 2>&1
//
// Yedek dizini BACKUP_DIR ile değiştirilebilir. Saklama süresi: KEEP_DAYS (varsayılan 30 gün).
// ÖNEMLİ: Yedekleri düzenli olarak sunucu dışına da kopyalayın ve geri yüklemeyi test edin.

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP_DAYS = Number(process.env.KEEP_DAYS || 30);

const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const target = path.join(BACKUP_DIR, stamp);

async function main() {
  const dbFile = path.join(DATA_DIR, 'fatura.db');
  if (!fs.existsSync(dbFile)) {
    console.error(`Veritabanı bulunamadı: ${dbFile}`);
    process.exit(1);
  }

  fs.mkdirSync(target, { recursive: true });

  // SQLite'ın kendi backup API'si: sunucu çalışırken bile tutarlı kopya alır.
  const db = new Database(dbFile, { readonly: true });
  await db.backup(path.join(target, 'fatura.db'));
  db.close();
  console.log('Veritabanı yedeklendi.');

  const uploads = path.join(DATA_DIR, 'uploads');
  if (fs.existsSync(uploads)) {
    fs.cpSync(uploads, path.join(target, 'uploads'), { recursive: true });
    console.log(`Fatura dosyaları kopyalandı: ${fs.readdirSync(uploads).length} adet`);
  }

  // Eski yedekleri temizle.
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const entry of fs.readdirSync(BACKUP_DIR)) {
    const dir = path.join(BACKUP_DIR, entry);
    if (dir === target) continue;
    if (fs.statSync(dir).mtimeMs < cutoff) {
      fs.rmSync(dir, { recursive: true, force: true });
      removed++;
    }
  }

  console.log(`Yedek tamamlandı: ${target}${removed ? ` (${removed} eski yedek silindi)` : ''}`);
}

main().catch((err) => {
  console.error('Yedekleme başarısız:', err);
  process.exit(1);
});
