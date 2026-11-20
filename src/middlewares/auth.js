const { isProfilClientLengkap, getKonfigurasi } = require('../models/db');
const { getFileUrl } = require('../utils/helpers');

let cachedConfig = null;
let lastConfigFetch = 0;

async function getCachedConfig() {
  const now = Date.now();
  if (cachedConfig && (now - lastConfigFetch < 15000)) { // Cache 15 detik
    return cachedConfig;
  }
  try {
    cachedConfig = await getKonfigurasi();
    lastConfigFetch = now;
  } catch (e) {
    if (!cachedConfig) {
      cachedConfig = {
        tanggal_mulai_input: 1,
        tanggal_akhir_input: 15,
        teks_pengumuman: '',
        notifikasi_tertutup: 'Periode pengisian wajib lapor telah ditutup.'
      };
    }
  }
  return cachedConfig;
}

function invalidateConfigCache() {
  cachedConfig = null;
  lastConfigFetch = 0;
}

function setLocals(req, res, next) {
  const sess = req.session || {};
  const isReqAdmin = req.path.startsWith('/admin') || req.path.startsWith('/administrator');
  const isReqClient = req.path.startsWith('/client');

  let currentUser = null;
  let currentUserType = null;

  if (isReqAdmin && sess.adminUser) {
    currentUser = sess.adminUser;
    currentUserType = 'admin';
  } else if (isReqClient && sess.clientUser) {
    currentUser = sess.clientUser;
    currentUserType = 'client';
  } else {
    currentUser = sess.user || sess.clientUser || sess.adminUser || null;
    currentUserType = sess.userType || (sess.clientUser ? 'client' : (sess.adminUser ? 'admin' : null));
  }

  res.locals.user = currentUser;
  res.locals.userType = currentUserType;
  res.locals.isLoggedIn = Boolean(currentUser);
  res.locals.successMessage = sess.successMessage || null;
  res.locals.errorMessage = sess.errorMessage || null;
  res.locals.warningMessage = sess.warningMessage || null;
  res.locals.getFileUrl = getFileUrl;

  // Clear flash messages once consumed
  if (req.session) {
    delete req.session.successMessage;
    delete req.session.errorMessage;
    delete req.session.warningMessage;
  }

  getCachedConfig().then(cfg => {
    res.locals.konfigurasi = cfg;
    next();
  }).catch(() => {
    res.locals.konfigurasi = {
      tanggal_mulai_input: 1,
      tanggal_akhir_input: 15,
      teks_pengumuman: '',
      notifikasi_tertutup: 'Periode pengisian wajib lapor telah ditutup.'
    };
    next();
  });
}

function requireAdmin(req, res, next) {
  const admin = req.session && (req.session.adminUser || (req.session.isLoggedIn && req.session.userType === 'admin' ? req.session.user : null));
  if (!admin) {
    return res.redirect('/administrator?pesan=login_required');
  }

  // Sinkronkan session context admin
  req.session.adminUser = admin;
  req.session.user = admin;
  req.session.userType = 'admin';
  req.session.isLoggedIn = true;
  next();
}

function requireClient(req, res, next) {
  const client = req.session && (req.session.clientUser || (req.session.isLoggedIn && req.session.userType === 'client' ? req.session.user : null));
  if (!client) {
    return res.redirect('/login?tipe=client&pesan=login_required');
  }
  // Sinkronkan session context client
  req.session.clientUser = client;
  req.session.user = client;
  req.session.userType = 'client';
  req.session.isLoggedIn = true;
  next();
}

async function requireProfilLengkap(req, res, next) {
  const client = req.session && (req.session.clientUser || (req.session.isLoggedIn && req.session.userType === 'client' ? req.session.user : null));
  if (!client) {
    return res.redirect('/login?tipe=client&pesan=login_required');
  }
  const isLengkap = await isProfilClientLengkap(client.id);
  if (!isLengkap) {
    req.session.warningMessage = 'Silakan lengkapi profil Anda terlebih dahulu sebelum mengakses layanan wajib lapor.';
    return res.redirect('/client/profil?belum_lengkap=1');
  }
  req.session.clientUser = client;
  req.session.user = client;
  req.session.userType = 'client';
  req.session.isLoggedIn = true;
  next();
}

module.exports = {
  setLocals,
  requireAdmin,
  requireClient,
  requireProfilLengkap,
  invalidateConfigCache
};
