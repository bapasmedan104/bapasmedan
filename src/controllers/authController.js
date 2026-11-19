const { loginAdmin, loginClient } = require('../models/db');

async function getLoginPage(req, res) {
  if (req.session.isLoggedIn) {
    if (req.session.userType === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/client/dashboard');
  }

  const tipe = req.query.tipe || 'client';
  const pesan = req.query.pesan || '';

  let error = '';
  if (pesan === 'login_required') {
    error = 'Silakan login terlebih dahulu untuk mengakses halaman tersebut.';
  } else if (pesan === 'logout_sukses') {
    req.session.successMessage = 'Anda telah berhasil logout.';
  }

  res.render('auth/login', {
    pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
    tipe,
    error,
    username: '',
    siteKey: process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-'
  });
}

async function postLogin(req, res) {
  const { username, password, tipe } = req.body;
  const loginType = parseInt(tipe, 10); // 1 = Admin, 2 = Client
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
      pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
      tipe: loginType === 1 ? 'admin' : 'client',
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
        pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
        tipe: loginType === 1 ? 'admin' : 'client',
        error: 'Verifikasi keamanan Cloudflare gagal atau kedaluwarsa. Silakan centang kembali verifikasi.',
        username: username || '',
        siteKey
      });
    }
  } catch (verifyErr) {
    console.error('Turnstile verification error:', verifyErr);
    return res.render('auth/login', {
      pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
      tipe: loginType === 1 ? 'admin' : 'client',
      error: 'Terjadi kendala saat memvalidasi verifikasi Cloudflare. Silakan coba kembali.',
      username: username || '',
      siteKey
    });
  }

  if (!username || !password) {
    return res.render('auth/login', {
      pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
      tipe: loginType === 1 ? 'admin' : 'client',
      error: 'Username dan Password tidak boleh kosong',
      username: username || '',
      siteKey
    });
  }

  try {
    if (loginType === 1) {
      // Login Admin
      const adminUser = await loginAdmin(username.trim(), password);
      if (!adminUser) {
        return res.render('auth/login', {
          pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
          tipe: 'admin',
          error: 'Username atau Password admin salah, atau akun nonaktif.',
          username,
          siteKey
        });
      }

      req.session.isLoggedIn = true;
      req.session.userType = 'admin';
      req.session.user = {
        id: adminUser.id,
        username: adminUser.username,
        nama_lengkap: adminUser.nama_lengkap,
        email: adminUser.email
      };
      req.session.successMessage = `Selamat datang kembali, ${adminUser.nama_lengkap}!`;
      return res.redirect('/admin/dashboard');

    } else if (loginType === 2) {
      // Login Client
      const clientUser = await loginClient(username.trim(), password);
      if (!clientUser) {
        return res.render('auth/login', {
          pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
          tipe: 'client',
          error: 'Username atau Password client salah, atau status akun belum aktif.',
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
        foto_profil: clientUser.foto_profil,
        profil_lengkap: clientUser.profil_lengkap
      };

      if (!clientUser.profil_lengkap) {
        req.session.warningMessage = 'Selamat datang! Silakan lengkapi profil Anda terlebih dahulu.';
        return res.redirect('/client/profil?belum_lengkap=1');
      }

      req.session.successMessage = `Selamat datang, ${clientUser.nama_lengkap}!`;
      return res.redirect('/client/dashboard');
    } else {
      return res.render('auth/login', {
        pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
        tipe: 'client',
        error: 'Tipe login tidak valid.',
        username,
        siteKey
      });
    }
  } catch (err) {
    console.error('Login error:', err);
    return res.render('auth/login', {
      pageTitle: 'Login - Sistem Wajib Lapor BAPAS Medan',
      tipe: loginType === 1 ? 'admin' : 'client',
      error: 'Terjadi kesalahan sistem saat proses autentikasi: ' + err.message,
      username,
      siteKey
    });
  }
}

async function logout(req, res) {
  if (req.session && typeof req.session.destroy === 'function') {
    req.session.destroy(err => {
      if (err) console.error('Logout error:', err);
      res.redirect('/login?pesan=logout_sukses');
    });
  } else {
    req.session = null;
    res.redirect('/login?pesan=logout_sukses');
  }
}

module.exports = {
  getLoginPage,
  postLogin,
  logout
};
