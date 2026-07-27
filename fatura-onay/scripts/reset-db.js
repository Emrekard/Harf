// Veritabanını ve yüklenen dosyaları siler; sunucu tekrar başlatıldığında
// başlangıç verileri (departmanlar ve demo kullanıcılar) yeniden oluşur.
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

if (fs.existsSync(DATA_DIR)) {
  fs.rmSync(DATA_DIR, { recursive: true, force: true });
  console.log(`Silindi: ${DATA_DIR}`);
} else {
  console.log('Silinecek veri bulunamadı.');
}

console.log('Yeniden oluşturmak için: npm start');
