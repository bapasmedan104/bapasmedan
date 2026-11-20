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

function isSuperAdmin(adminUser) {
  if (!adminUser) return false;
  if (adminUser.role === 'super_admin') return true;
  const pos = (adminUser.pos_wilayah || '').trim().toLowerCase();
  if (pos === 'semua wilayah (pusat)' || pos === 'semua pos (pusat)' || pos === 'pusat' || pos.includes('semua wilayah') || pos.includes('semua pos')) {
    return true;
  }
  const username = (adminUser.username || '').toLowerCase();
  const email = (adminUser.email || '').toLowerCase();
  if (username === 'admin' || username === 'bapasmedan104' || email === 'bapasmedan104@gmail.com') {
    return true;
  }
  return false;
}

function normalizePosName(pos) {
  if (!pos) return '';
  return String(pos).trim().toLowerCase();
}

function isClientInAdminPos(client, adminUser) {
  if (!adminUser) return false;
  if (isSuperAdmin(adminUser)) return true;

  let adminPos = normalizePosName(adminUser.pos_wilayah);
  // Jika pos_wilayah kosong tapi username mengandung pos (misal: 'pos2', 'adminpos2', 'admin2', 'posdua')
  if (!adminPos) {
    const uMatch = (adminUser.username || '').match(/(?:pos|admin)\s*([0-9]+|[a-z]+)/i);
    if (uMatch) {
      adminPos = 'pos ' + uMatch[1];
    }
  }

  // Jika bukan Super Admin dan tidak punya Pos Wilayah yang valid, tolak akses ke data klien
  if (!adminPos) {
    return false;
  }

  const clientPos = normalizePosName(client ? client.pos_wilayah : '');
  if (!clientPos) {
    // Klien legacy/lama yang belum memiliki data pos_wilayah hanya milik Super Admin / Pusat
    return false;
  }

  if (clientPos === adminPos) return true;

  // Kamus konversi kata angka ke digit
  const wordToNum = {
    '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
    '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
    'satu': '1', 'dua': '2', 'tiga': '3', 'empat': '4', 'lima': '5',
    'enam': '6', 'tujuh': '7', 'delapan': '8', 'sembilan': '9', 'sepuluh': '10'
  };

  const extractPosNumber = (str) => {
    const m = str.match(/(?:pos|admin)\s*([0-9]+|[a-z]+)/i);
    if (!m) return null;
    const val = m[1].toLowerCase();
    return wordToNum[val] || (/^[0-9]+$/.test(val) ? val : null);
  };

  const numAdmin = extractPosNumber(adminPos);
  const numClient = extractPosNumber(clientPos);

  // Jika kedua pihak memiliki nomor Pos (misal: Pos 2 vs Pos 3 atau Pos 2 vs Pos 2 (Tebing Tinggi))
  if (numAdmin && numClient) {
    return numAdmin === numClient;
  }

  // Cek kata kunci wilayah
  const wilayahKeywords = [
    'tebing tinggi', 'kabanjahe', 'lubuk pakam', 'langkat', 'binjai',
    'medan', 'siantar', 'tanjung balai', 'sibolga'
  ];
  for (const kw of wilayahKeywords) {
    if (adminPos.includes(kw) && clientPos.includes(kw)) {
      return true;
    }
  }

  return false;
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
  getFileUrl,
  isSuperAdmin,
  normalizePosName,
  isClientInAdminPos
};
