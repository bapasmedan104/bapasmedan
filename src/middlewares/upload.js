const multer = require('multer');

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

// Gunakan MemoryStorage agar aman di Serverless & Cloudflare Workers (tanpa ketergantungan filesystem)
const memoryStorage = multer.memoryStorage();

const uploadWajibLapor = multer({
  storage: memoryStorage,
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB (mendukung foto & video)
  fileFilter: fileFilter
});

const uploadProfil = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: fileFilter
});

module.exports = {
  uploadWajibLapor,
  uploadProfil
};
