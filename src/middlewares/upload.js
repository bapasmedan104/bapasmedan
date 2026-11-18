const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Storage untuk Foto/Video Bukti Wajib Lapor
const wajibLaporStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const now = new Date();
    const year = String(req.body.tahun || now.getFullYear());
    const month = String(req.body.bulan || now.getMonth() + 1).padStart(2, '0');
    const dir = path.join(process.cwd(), 'public', 'uploads', 'wajib_lapor', year, month);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const clientId = req.session.user ? req.session.user.id : 'unknown';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `lapor_${clientId}_${Date.now()}_${random}${ext}`;
    cb(null, filename);
  }
});

// Storage untuk Foto Profil Client
const profilStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const clientId = req.session.user ? req.session.user.id : 'temp';
    const dir = path.join(process.cwd(), 'public', 'uploads', 'profil', clientId);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const clientId = req.session.user ? req.session.user.id : 'user';
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const random = Math.random().toString(36).substring(2, 8);
    const filename = `profil_${clientId}_${Date.now()}_${random}${ext}`;
    cb(null, filename);
  }
});

function fileFilter(req, file, cb) {
  const allowedMimes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo'
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipe file tidak didukung! Harap unggah gambar (JPG, PNG, WebP) atau video (MP4, WebM).'), false);
  }
}

const uploadWajibLapor = multer({
  storage: wajibLaporStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (mendukung video)
  fileFilter: fileFilter
});

const uploadProfil = multer({
  storage: profilStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

module.exports = {
  uploadWajibLapor,
  uploadProfil
};
