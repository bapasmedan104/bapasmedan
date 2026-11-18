const { isProfilClientLengkap } = require('../models/db');
const { getFileUrl } = require('../utils/helpers');

function setLocals(req, res, next) {
  res.locals.user = req.session.user || null;
  res.locals.userType = req.session.userType || null;
  res.locals.isLoggedIn = Boolean(req.session.isLoggedIn);
  res.locals.successMessage = req.session.successMessage || null;
  res.locals.errorMessage = req.session.errorMessage || null;
  res.locals.warningMessage = req.session.warningMessage || null;
  res.locals.getFileUrl = getFileUrl;

  // Clear flash messages once consumed
  delete req.session.successMessage;
  delete req.session.errorMessage;
  delete req.session.warningMessage;

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.isLoggedIn || req.session.userType !== 'admin') {
    return res.redirect('/login?tipe=admin&pesan=login_required');
  }
  next();
}

function requireClient(req, res, next) {
  if (!req.session.isLoggedIn || req.session.userType !== 'client') {
    return res.redirect('/login?tipe=client&pesan=login_required');
  }
  next();
}

async function requireProfilLengkap(req, res, next) {
  if (!req.session.isLoggedIn || req.session.userType !== 'client') {
    return res.redirect('/login');
  }
  const isLengkap = await isProfilClientLengkap(req.session.user.id);
  if (!isLengkap) {
    req.session.warningMessage = 'Silakan lengkapi profil Anda terlebih dahulu sebelum mengakses layanan wajib lapor.';
    return res.redirect('/client/profil?belum_lengkap=1');
  }
  next();
}

module.exports = {
  setLocals,
  requireAdmin,
  requireClient,
  requireProfilLengkap
};
