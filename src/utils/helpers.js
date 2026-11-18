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

function formatTanggal(tanggal) {
  if (!tanggal) return '-';
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return '-';
  const hari = NAMA_HARI[d.getDay()];
  const tgl = d.getDate();
  const bln = NAMA_BULAN[d.getMonth() + 1];
  const thn = d.getFullYear();
  return `${hari}, ${tgl} ${bln} ${thn}`;
}

function formatTanggalWaktu(tanggal) {
  if (!tanggal) return '-';
  const d = new Date(tanggal);
  if (isNaN(d.getTime())) return '-';
  const tgl = String(d.getDate()).padStart(2, '0');
  const bln = String(d.getMonth() + 1).padStart(2, '0');
  const thn = d.getFullYear();
  const jam = String(d.getHours()).padStart(2, '0');
  const mnt = String(d.getMinutes()).padStart(2, '0');
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
  formatTanggal,
  formatTanggalWaktu,
  hashPassword,
  verifyPassword,
  getFileUrl
};
