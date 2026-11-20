const bcrypt = require('bcryptjs');

const NAMA_BULAN = [
  '',
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember'
];

const NAMA_HARI = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu'
];

function getNamaBulan(bulan) {
  const b = parseInt(bulan, 10);
  return NAMA_BULAN[b] || '';
}

/**
 * Konversi tanggal ke representasi Waktu Indonesia Barat (WIB = UTC+7)
 * Selalu konsisten dan akurat di semua environment server (Cloudflare Workers, Node.js, Linux, V8)
 */
function toWibDate(tanggal) {
  if (!tanggal) return null;
  const d = (tanggal instanceof Date) ? tanggal : new Date(tanggal);
  if (isNaN(d.getTime())) return null;
  // Offset pasti WIB adalah UTC+7 (7 * 3600 * 1000 milidetik)
  return new Date(d.getTime() + (7 * 3600 * 1000));
}

/**
 * Mengambil waktu saat ini dalam format kalender WIB
 */
function getWibNow() {
  const wib = toWibDate(new Date());
  return {
    year: wib.getUTCFullYear(),
    month: wib.getUTCMonth() + 1,
    date: wib.getUTCDate(),
    day: wib.getUTCDay(),
    hours: wib.getUTCHours(),
    minutes: wib.getUTCMinutes(),
    seconds: wib.getUTCSeconds()
  };
}

function formatTanggal(tanggal) {
  if (!tanggal) return '-';
  const wib = toWibDate(tanggal);
  if (!wib) return '-';
  const hari = NAMA_HARI[wib.getUTCDay()];
  const tgl = wib.getUTCDate();
  const bln = NAMA_BULAN[wib.getUTCMonth() + 1];
  const thn = wib.getUTCFullYear();
  return `${hari}, ${tgl} ${bln} ${thn}`;
}

function formatTanggalWaktu(tanggal) {
  if (!tanggal) return '-';
  const wib = toWibDate(tanggal);
  if (!wib) return '-';
  const tgl = String(wib.getUTCDate()).padStart(2, '0');
  const bln = String(wib.getUTCMonth() + 1).padStart(2, '0');
  const thn = wib.getUTCFullYear();
  const jam = String(wib.getUTCHours()).padStart(2, '0');
  const mnt = String(wib.getUTCMinutes()).padStart(2, '0');
  return `${tgl}/${bln}/${thn} ${jam}:${mnt} WIB`;
}

async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

async function verifyPassword(plainPassword, hashedPassword) {
  if (!hashedPassword) return false;
  // Dukung perbandingan langsung jika tersimpan plain-text
  if (plainPassword === hashedPassword) return true;
  // Support both bcrypt hashes ($2a$, $2b$, $2y$)
  const normalizedHash = hashedPassword.replace(/^\$2y\$/, '$2a$');
  try {
    return await bcrypt.compare(plainPassword, normalizedHash);
  } catch {
    return false;
  }
}

/**
 * Normalisasi URL file (Cloudinary http/https, data URI base64, vs path lokal /uploads/)
 */
function getFileUrl(pathOrUrl, defaultSubdir = '') {
  if (!pathOrUrl) return '';
  // Mendukung Base64 Data URI langsung atau link http/https eksternal
  if (pathOrUrl.startsWith('data:') || pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  // Jika path sudah memiliki prefix /uploads/
  if (pathOrUrl.startsWith('/uploads/')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('uploads/')) {
    return `/${pathOrUrl}`;
  }
  const cleanSubdir = defaultSubdir ? defaultSubdir.replace(/^\/+|\/+$/g, '') + '/' : '';
  const cleanPath = pathOrUrl.replace(/^\/+/, '');
  return `/uploads/${cleanSubdir}${cleanPath}`;
}

module.exports = {
  NAMA_BULAN,
  NAMA_HARI,
  getNamaBulan,
  toWibDate,
  getWibNow,
  formatTanggal,
  formatTanggalWaktu,
  hashPassword,
  verifyPassword,
  getFileUrl
};
