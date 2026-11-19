const { loginAdmin, loginClient } = require('../models/db');

async function getLoginPage(req, res) {
  if (req.session && req.session.isLoggedIn) {
    if (req.session.userType === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/client/dashboard');
  }

  const tipe = req.query.tipe || 'client';
  const pesan = req.query.pesan || '';

  // Jika ada permintaan admin ke /login, alihkan ke /administrator
  if (tipe === 'admin') {
    return res.redirect('/administrator' + (pesan ? '?pesan=' + encodeURIComponent(pesan) : ''));
  }

  let error = '';
  if (pesan === 'login_required') {
    error = 'Silakan login terlebih dahulu untuk mengakses halaman tersebut.';
  } else if (pesan === 'logout_sukses') {
    req.session.successMessage = 'Anda telah berhasil logout.';
  }

  res.render('auth/login', {
    pageTitle: 'Login Klien - Wajib Lapor BAPAS Medan',
    tipe: 'client',
    error,
    username: '',
    siteKey: process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-'
  });
}

async function getAdminLoginPage(req, res) {
  if (req.session && req.session.isLoggedIn) {
    if (req.session.userType === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/client/dashboard');
  }

  const pesan = req.query.pesan || '';
  let error = '';
  if (pesan === 'login_required') {
    error = 'Akses Terbatas: Silakan login sebagai Administrator terlebih dahulu.';
  } else if (pesan === 'logout_sukses') {
    req.session.successMessage = 'Anda telah berhasil logout dari Panel Admin.';
  } else if (pesan === 'timeout') {
    error = 'Sesi Admin telah berakhir otomatis karena tidak ada aktivitas selama 2 menit. Silakan login kembali.';
  }

  res.render('auth/admin_login', {
    pageTitle: 'Login Administrator - BAPAS Kelas I Medan',
    error,
    username: '',
    siteKey: process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-'
  });
}

async function postAdminLogin(req, res) {
  const { username, password } = req.body;
  const siteKey = process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-';
  const turnstileSecret = process.env.TURNSTILE_SECRET || '0x4AAAAAAGIsSpJ6pa_yXPy88IQ-mdEIHqs';
  const turnstileToken = req.body['cf-turnstile-response'];
  const expectedAction = 'login';
  const expectedHostnames = new Set(
    (process.env.TURNSTILE_HOSTNAMES || 'bapas1medan.com,bapasmedan.bapasmedan104.workers.dev,localhost,127.0.0.1')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean)
  );

  // 1. Validasi Turnstile
  if (typeof turnstileToken !== 'string' || turnstileToken.length === 0 || turnstileToken.length > 2048) {
    return res.render('auth/admin_login', {
      pageTitle: 'Login Administrator - BAPAS Kelas I Medan',
      error: 'Mohon selesaikan verifikasi keamanan Cloudflare terlebih dahulu.',
      username: username || '',
      siteKey
    });
  }

  try {
    const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '';
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: turnstileToken,
        remoteip: clientIp
      })
    });

    if (!verifyRes.ok) throw new Error(`siteverify HTTP ${verifyRes.status}`);
    const verifyData = await verifyRes.json();
    if (!verifyData.success || (verifyData.action && verifyData.action !== expectedAction) || (verifyData.hostname && !expectedHostnames.has(verifyData.hostname.toLowerCase()))) {
      return res.render('auth/admin_login', {
        pageTitle: 'Login Administrator - BAPAS Kelas I Medan',
        error: 'Verifikasi keamanan Cloudflare gagal atau kedaluwarsa. Silakan centang kembali verifikasi.',
        username: username || '',
        siteKey
      });
    }
  } catch (verifyErr) {
    return res.render('auth/admin_login', {
      pageTitle: 'Login Administrator - BAPAS Kelas I Medan',
      error: 'Terjadi kendala saat memvalidasi verifikasi Cloudflare. Silakan coba kembali.',
      username: username || '',
      siteKey
    });
  }

  if (!username || !password) {
    return res.render('auth/admin_login', {
      pageTitle: 'Login Administrator - BAPAS Kelas I Medan',
      error: 'Username dan Password admin tidak boleh kosong',
      username: username || '',
      siteKey
    });
  }

  try {
    const adminUser = await loginAdmin(username.trim(), password);
    if (!adminUser) {
      return res.render('auth/admin_login', {
        pageTitle: 'Login Administrator - BAPAS Kelas I Medan',
        error: 'Username atau Password admin salah, atau akun nonaktif.',
        username,
        siteKey
      });
    }

    req.session.isLoggedIn = true;
    req.session.userType = 'admin';
    req.session.lastAdminActivity = Date.now();
    req.session.user = {
      id: adminUser.id,
      username: adminUser.username,
      nama_lengkap: adminUser.nama_lengkap,
      email: adminUser.email
    };
    req.session.successMessage = `Selamat datang kembali, ${adminUser.nama_lengkap}!`;
    return res.redirect('/admin/dashboard');
  } catch (err) {
    console.error('Admin login error:', err);
    return res.render('auth/admin_login', {
      pageTitle: 'Login Administrator - BAPAS Kelas I Medan',
      error: 'Terjadi kesalahan sistem saat proses autentikasi: ' + err.message,
      username,
      siteKey
    });
  }
}

async function postLogin(req, res) {
  const { username, password, tipe } = req.body;
  const loginType = parseInt(tipe, 10);

  // Jika mencoba login Admin melalui halaman /login, alihkan paksa ke /administrator
  if (loginType === 1 || req.query.tipe === 'admin') {
    return res.redirect('/administrator');
  }

  const siteKey = process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-';
  const turnstileSecret = process.env.TURNSTILE_SECRET || '0x4AAAAAAGIsSpJ6pa_yXPy88IQ-mdEIHqs';
  const turnstileToken = req.body['cf-turnstile-response'];
  const expectedAction = 'login';
  const expectedHostnames = new Set(
    (process.env.TURNSTILE_HOSTNAMES || 'bapas1medan.com,bapasmedan.bapasmedan104.workers.dev,localhost,127.0.0.1')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean)
  );

  // 1. Validasi Token Turnstile dari Client
  if (typeof turnstileToken !== 'string' || turnstileToken.length === 0 || turnstileToken.length > 2048) {
    return res.render('auth/login', {
      pageTitle: 'Login Klien - Wajib Lapor BAPAS Medan',
      tipe: 'client',
      error: 'Mohon selesaikan verifikasi keamanan Cloudflare terlebih dahulu.',
      username: username || '',
      siteKey
    });
  }

  // 2. Canonical Server-Side Siteverify ke Cloudflare API
  try {
    const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '';
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        secret: turnstileSecret,
        response: turnstileToken,
        remoteip: clientIp
      })
    });

    if (!verifyRes.ok) {
      throw new Error(`siteverify HTTP ${verifyRes.status}`);
    }

    const verifyData = await verifyRes.json();
    if (!verifyData.success || (verifyData.action && verifyData.action !== expectedAction) || (verifyData.hostname && !expectedHostnames.has(verifyData.hostname.toLowerCase()))) {
      console.warn('Turnstile verification rejected:', verifyData);
      return res.render('auth/login', {
        pageTitle: 'Login Klien - Wajib Lapor BAPAS Medan',
        tipe: 'client',
        error: 'Verifikasi keamanan Cloudflare gagal atau kedaluwarsa. Silakan centang kembali verifikasi.',
        username: username || '',
        siteKey
      });
    }
  } catch (verifyErr) {
    console.error('Turnstile verification error:', verifyErr);
    return res.render('auth/login', {
      pageTitle: 'Login Klien - Wajib Lapor BAPAS Medan',
      tipe: 'client',
      error: 'Terjadi kendala saat memvalidasi verifikasi Cloudflare. Silakan coba kembali.',
      username: username || '',
      siteKey
    });
  }

  if (!username || !password) {
    return res.render('auth/login', {
      pageTitle: 'Login Klien - Wajib Lapor BAPAS Medan',
      tipe: 'client',
      error: 'Nomor WhatsApp / Register dan Password tidak boleh kosong',
      username: username || '',
      siteKey
    });
  }

  try {
    // Login Khusus Klien Pemasyarakatan
    const clientUser = await loginClient(username.trim(), password);
    if (!clientUser) {
      return res.render('auth/login', {
        pageTitle: 'Login Klien - Wajib Lapor BAPAS Medan',
        tipe: 'client',
        error: 'Nomor WhatsApp atau kata sandi klien salah, atau status akun belum aktif.',
        username,
        siteKey
      });
    }

    req.session.isLoggedIn = true;
    req.session.userType = 'client';
    req.session.user = {
      id: clientUser.id,
      username: clientUser.username,
      nama_lengkap: clientUser.nama_lengkap,
      no_register: clientUser.no_register,
      email: clientUser.email,
      foto_profil: (clientUser.foto_profil && !clientUser.foto_profil.startsWith('data:')) ? clientUser.foto_profil : (clientUser.foto_profil ? 'has_photo' : null),
      profil_lengkap: clientUser.profil_lengkap
    };

    if (!clientUser.profil_lengkap) {
      req.session.warningMessage = 'Selamat datang! Silakan lengkapi profil Anda terlebih dahulu.';
      return res.redirect('/client/profil?belum_lengkap=1');
    }

    req.session.successMessage = `Selamat datang, ${clientUser.nama_lengkap}!`;
    return res.redirect('/client/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    return res.render('auth/login', {
      pageTitle: 'Login Klien - Wajib Lapor BAPAS Medan',
      tipe: 'client',
      error: 'Terjadi kesalahan sistem saat proses autentikasi: ' + err.message,
      username,
      siteKey
    });
  }
}

async function logout(req, res) {
  const pesan = req.query.pesan || 'logout_sukses';
  const isAdmin = (req.session && req.session.userType === 'admin') || req.query.tipe === 'admin';
  
  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(err => {
      if (err) console.error('Logout error:', err);
      res.redirect(isAdmin ? `/administrator?pesan=${pesan}` : `/login?pesan=${pesan}`);
    });
  } else {
    req.session = null;
    res.redirect(isAdmin ? `/administrator?pesan=${pesan}` : `/login?pesan=${pesan}`);
  }
}

module.exports = {
  getLoginPage,
  postLogin,
  getAdminLoginPage,
  postAdminLogin,
  logout
};
