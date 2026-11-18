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
  // Support both bcrypt hashes ($2a$, $2b$, $2y$)
  const normalizedHash = hashedPassword.replace(/^\$2y\$/, '$2a$');
  return bcrypt.compare(plainPassword, normalizedHash);
}

/**
 * Normalisasi URL file (Cloudinary http/https vs path lokal /uploads/)
 */
function getFileUrl(pathOrUrl, defaultSubdir = '') {
  if (!pathOrUrl) return '';
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
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
