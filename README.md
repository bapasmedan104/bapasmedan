# Sistem Wajib Lapor Online BAPAS Kelas I Medan (Node.js & Firebase)

Aplikasi migrasi dari PHP ke **Node.js** dengan **Database Firebase (Firestore)** dan fitur **Filter Lengkap** untuk Balai Pemasyarakatan (BAPAS) Kelas I Medan.

---

## 🚀 Fitur Unggulan

1. **Stack Modern Node.js**:
   - Backend menggunakan Express.js, MVC Architecture, EJS Template Engine.
   - Keamanan dengan Session Cookies & Bcrypt Password Hashing.
   - Upload foto bukti & foto profil dengan Multer (dukungan JPG, PNG, WebP).
   - Pengambilan foto langsung melalui Kamera Web (WebRTC / HTML5 Canvas).

2. **Database Firebase (Firestore)**:
   - Terintegrasi resmi dengan `firebase-admin` Cloud Firestore.
   - **Dual-Mode Adapter**: Jika credential Firebase belum dimasukkan, sistem otomatis menjalankan emulator lokal (`data/firestore_local.json`), sehingga aplikasi dapat langsung berjalan tanpa error.
   - Begitu file `serviceAccountKey.json` ditaruh di root project atau environment variables diset, sistem otomatis terhubung ke cloud Firestore.

3. **Sistem Filter Sangat Lengkap (Admin Riwayat Lapor)**:
   - **Filter Status**: Semua, Menunggu Verifikasi, Diterima, Ditolak, Dibatalkan, Draft.
   - **Pencarian Bebas**: Pencarian nama klien, nomor register, atau username.
   - **Filter Periode Bulan**: Dropdown bulan Januari s/d Desember (1-12).
   - **Filter Periode Tahun**: Pilihan tahun pelaporan.
   - **Filter Rentang Tanggal**: Tanggal Submit Dari (`date_start`) s/d Sampai (`date_end`).
   - **Filter Foto Bukti**: Semua, Hanya yang memiliki foto bukti, Tanpa foto bukti.
   - **Pengurutan (Sort)**: Tanggal Submit Terbaru/Terlama, Nama Klien A-Z / Z-A, Periode Terbaru/Terlama.
   - **Live Counter & Breakdown**: Chip counter hasil filter aktif (Menunggu, Diterima, Ditolak, dsb).
   - **Ekspor ke CSV / Excel**: Unduh langsung file CSV dari seluruh baris data yang sedang terfilter.
   - **Cetak / Print Laporan**: Fitur cetak bersih dengan format resmi kop BAPAS Medan.

4. **Kelola Klien (Admin)**:
   - CRUD lengkap (Tambah Klien, Edit Klien, Hapus Klien, Reset Password).
   - Perhitungan total bulan wajib lapor otomatis dari rentang bulan/tahun mulai dan akhir.
   - Filter status klien (Aktif, Selesai, Nonaktif) dan status kelengkapan profil.
   - Ekspor seluruh daftar klien ke CSV.

5. **Portal Klien**:
   - Wajib melengkapi profil saat login pertama kali (nama, no HP/WhatsApp, alamat domisili saat ini, masa wajib lapor, foto profil).
   - Pelaporan wajib lapor bulanan dengan batasan jadwal (buka tgl 1 - 15).
   - Integrasi kamera selfie live dan upload file bukti.
   - Simpan sebagai draft atau kirim langsung untuk verifikasi admin.
   - Monitoring riwayat dan progress durasi wajib lapor (progress bar).

---

## 📦 Panduan Instalasi & Menjalankan

### 1. Prasyarat
- Node.js versi 18+ atau 20+ sudah terpasang di komputer.

### 2. Instalasi Dependensi
Buka terminal di folder project ini:
```bash
npm install
```

### 3. Inisialisasi Data Default (Seed Database)
Jalankan perintah berikut untuk membuat akun default Admin dan contoh Klien:
```bash
npm run seed
```

Data default yang dibuat:
- **Admin**:
  - Username: `admin`
  - Password: `admin123`
- **Klien Contoh**:
  - Username: `budi_santoso` | Password: `client123` (Profil Lengkap)
  - Username: `joko_susilo` | Password: `client123` (Profil Belum Lengkap)

### 4. Menjalankan Server
```bash
npm start
```
Atau mode development (auto-reload):
```bash
npm run dev
```
Akses aplikasi melalui browser di: **`http://localhost:3000`**

---

## ⚙️ Menghubungkan ke Firebase Cloud Firestore

1. Buka [Firebase Console](https://console.firebase.google.com/).
2. Buat project baru atau pilih project yang sudah ada.
3. Masuk ke menu **Firestore Database** dan klik **Create Database**.
4. Buka **Project Settings** (ikon roda gigi) > tab **Service accounts**.
5. Klik tombol **Generate new private key**.
6. Simpan file JSON yang didownload dan ganti namanya menjadi:
   ```
   serviceAccountKey.json
   ```
   kemudian letakkan di folder root project `bapas_medan_node/`.
7. Jalankan kembali seeder ke Firebase Cloud:
   ```bash
   npm run seed
   ```
8. Jalankan aplikasi:
   ```bash
   npm start
   ```
   Server akan menampilkan:
   `✅ Terhubung ke Firebase Cloud Firestore (via serviceAccountKey.json)`

---

## 🗂️ Struktur Direktori Proyek

```
bapas_medan_node/
├── data/                       # Penyimpanan lokal Firestore emulator
├── public/                     # Asset statis (CSS, JS, logo, uploads)
│   ├── css/                    # Stylesheet (style.css, responsive.css)
│   ├── js/                     # JavaScript frontend
│   └── uploads/
│       ├── profil/             # Foto profil klien
│       └── wajib_lapor/        # Foto bukti wajib lapor bulanan
├── scripts/
│   └── seed.js                 # Script seeder data awal Firebase
├── src/
│   ├── config/
│   │   └── firebase.js         # Koneksi & adapter Firestore Cloud/Local
│   ├── controllers/
│   │   ├── adminController.js  # Controller dashboard & filter riwayat admin
│   │   ├── authController.js   # Autentikasi login admin & client
│   │   ├── clientController.js # Pelaporan, upload foto, kamera, profil
│   │   └── publicController.js # Halaman beranda, profil, informasi, berita
│   ├── middlewares/
│   │   ├── auth.js             # Proteksi session & verifikasi profil
│   │   └── upload.js           # Penanganan upload gambar dengan Multer
│   ├── models/
│   │   └── db.js               # Query CRUD data Firestore
│   ├── routes/                 # Routing Express.js
│   ├── utils/
│   │   └── helpers.js          # Format tanggal Indonesia & Bcrypt hash
│   └── views/                  # Tampilan EJS
│       ├── admin/              # Dashboard, Riwayat Lapor (Filter Lengkap), Kelola Klien
│       ├── auth/               # Halaman Login
│       ├── client/             # Dashboard klien, Form Lapor, Profil, Jadwal
│       ├── partials/           # Header, Footer, Alert Flash Messages
│       └── public/             # Beranda, Profil, Informasi, Berita, 404, 500
├── .env                        # Environment variables
├── package.json
└── server.js                   # Entry point aplikasi
```
