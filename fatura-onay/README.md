# Fatura Onay Sistemi

Muhasebe departmanının fatura (PDF / JPEG) yükleyip ilgili departman yöneticisinden
onay aldığı web tabanlı onay sistemi. Yönetici her fatura için **onaylayabilir**,
**reddedebilir** veya **soru sorup muhasebeye geri gönderebilir**.

## Kurulum ve Çalıştırma

```bash
cd fatura-onay
npm install
npm start
```

Tarayıcıdan: <http://localhost:3000>

Veritabanı ve yüklenen dosyalar ilk çalıştırmada `data/` klasöründe otomatik oluşur.
Sıfırdan başlamak için: `npm run reset-db`

## Demo Hesapları

| Kullanıcı adı | Şifre        | Rol              | Departman           |
| ------------- | ------------ | ---------------- | ------------------- |
| `muhasebe`    | muhasebe123  | Muhasebe         | –                   |
| `muhasebe2`   | muhasebe123  | Muhasebe         | –                   |
| `satinalma`   | onay123      | Onaylayan Müdür  | Satın Alma          |
| `uretim`      | onay123      | Onaylayan Müdür  | Üretim              |
| `bt`          | onay123      | Onaylayan Müdür  | Bilgi Teknolojileri |
| `ik`          | onay123      | Onaylayan Müdür  | İnsan Kaynakları    |
| `lojistik`    | onay123      | Onaylayan Müdür  | Lojistik            |
| `admin`       | admin123     | Sistem Yöneticisi| –                   |

> Bu şifreler yalnızca demo içindir. Gerçek kullanımda `src/db.js` içindeki
> başlangıç kullanıcılarını değiştirin ve `SESSION_SECRET` ortam değişkenini ayarlayın.

## İş Akışı

```
Muhasebe fatura yükler ─────────────► Onay Bekliyor
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ▼                     ▼                     ▼
                Onayla                Reddet              Soru Sor
                    │                     │                     │
                    ▼                     ▼                     ▼
              Onaylandı ✔           Reddedildi ✘        Bilgi Bekleniyor
                (kesin)               (kesin)                   │
                                                Muhasebe cevaplar
                                                                │
                                                                ▼
                                                          Onay Bekliyor
```

**Durumlar:** `Onay Bekliyor` · `Bilgi Bekleniyor` · `Onaylandı` · `Reddedildi`

- Fatura yüklenirken seçilen departman, onayı verecek müdürü belirler.
- Soru–cevap döngüsü sınırsız tekrarlanabilir; her adım işlem geçmişine yazılır.
- Onaylanan veya reddedilen fatura kesinleşir, kararı değiştirilemez.
- Red ve soru işlemlerinde gerekçe/soru metni zorunludur.

## Roller ve Yetkiler

| Yetki                              | Muhasebe | Onaylayan Müdür        | Admin |
| ---------------------------------- | :------: | :--------------------: | :---: |
| Fatura yükleme                     |    ✔     |           –            |   ✔   |
| Faturaları görüntüleme             |  Tümü    | Yalnızca kendi departmanı | Tümü |
| Onaylama / reddetme / soru sorma   |    –     | Kendi departmanı       |   ✔   |
| Soruyu cevaplama                   |    ✔     |           –            |   ✔   |

Bir müdür başka departmanın faturasını listede göremez, detayına ve dosyasına
erişemez, karar veremez.

## Teknik Yapı

- **Sunucu:** Node.js + Express 5, oturum çerezi (`express-session`), `bcryptjs` ile şifre saklama
- **Veritabanı:** SQLite (`better-sqlite3`), WAL modu
- **Dosya yükleme:** `multer` — yalnızca PDF / JPEG / PNG, en fazla 15 MB
- **Arayüz:** Bağımlılıksız HTML + CSS + JavaScript (tek sayfa)

```
fatura-onay/
├── server.js               Express uygulaması
├── src/
│   ├── db.js               Şema + başlangıç verileri
│   ├── auth.js             Oturum ve yetki kontrolleri
│   └── routes/
│       ├── auth.js         Giriş / çıkış / departmanlar
│       └── invoices.js     Fatura CRUD, karar ve cevap uçları
├── public/                 Arayüz (index.html, app.js, style.css)
├── scripts/reset-db.js     Veritabanını sıfırlar
└── data/                   SQLite dosyası + yüklenen faturalar (git'e dahil değil)
```

### Veri Modeli

- `departments` — departmanlar
- `users` — kullanıcı, rol (`accounting` / `approver` / `admin`), bağlı departman
- `invoices` — fatura bilgileri, dosya referansı, durum, karar veren ve tarihi
- `invoice_events` — tam denetim izi: yükleme, soru, cevap, onay, red

### API Uçları

| Yöntem | Uç                          | Açıklama                                |
| ------ | --------------------------- | --------------------------------------- |
| POST   | `/api/auth/login`           | Giriş                                   |
| POST   | `/api/auth/logout`          | Çıkış                                   |
| GET    | `/api/auth/me`              | Oturumdaki kullanıcı                    |
| GET    | `/api/auth/departments`     | Departman listesi                       |
| GET    | `/api/invoices`             | Fatura listesi (`status`, `department_id`, `q` filtreleri) |
| GET    | `/api/invoices/summary`     | Durum bazlı sayaçlar                    |
| POST   | `/api/invoices`             | Fatura yükle (multipart)                |
| GET    | `/api/invoices/:id`         | Fatura detayı + işlem geçmişi           |
| GET    | `/api/invoices/:id/file`    | Fatura dosyası (`?download=1` indirir)  |
| POST   | `/api/invoices/:id/decision`| `approve` / `reject` / `question`       |
| POST   | `/api/invoices/:id/answer`  | Muhasebenin soruya cevabı               |

## Güvenlik Notları

- Yüklenen dosyalar statik olarak sunulmaz; yalnızca yetki kontrolünden geçen
  `/api/invoices/:id/file` ucu üzerinden erişilir.
- Dosya adları sunucuda rastgele üretilir, kullanıcının gönderdiği ad yalnızca
  görüntüleme ve indirme için saklanır.
- Şifreler `bcrypt` ile saklanır; oturum çerezi `httpOnly` ve `sameSite=lax`.
- Üretim ortamı için `SESSION_SECRET` ayarlayın ve HTTPS arkasında çalıştırıp
  çerez `secure` seçeneğini açın.

## Sonraki Adımlar (isteğe bağlı)

- Tutar limitine göre çok kademeli onay (müdür → direktör → CFO)
- E-posta bildirimleri
- Excel / CSV dışa aktarım ve raporlama
- Yönetici arayüzünden kullanıcı ve departman yönetimi
