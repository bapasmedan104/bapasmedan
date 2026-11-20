const {
  loginAdmin,
  loginClient,
  createAdminPasswordResetToken,
  verifyAdminResetToken,
  executeAdminPasswordReset
} = require('../models/db');

async function getLoginPage(req, res) {
  // Hanya jika klien sudah memiliki sesi aktif, alihkan ke dashboard klien
  const isClientLoggedIn = Boolean(req.session && (req.session.clientUser || (req.session.isLoggedIn && req.session.userType === 'client')));
  if (isClientLoggedIn) {
    return res.redirect('/client/dashboard');
  }

  const tipe = req.query.tipe || 'client';
  const pesan = req.query.pesan || '';

  // Jika ada permintaan admin ke /login?tipe=admin, alihkan ke /administrator
  if (tipe === 'admin') {
    return res.redirect('/administrator' + (pesan ? '?pesan=' + encodeURIComponent(pesan) : ''));
  }

  let error = '';
  if (pesan === 'login_required') {
    error = 'Silakan login terlebih dahulu untuk mengakses layanan klien.';
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
  // Hanya jika admin sudah memiliki sesi aktif, alihkan ke dashboard admin
  const isAdminLoggedIn = Boolean(req.session && (req.session.adminUser || (req.session.isLoggedIn && req.session.userType === 'admin')));
  if (isAdminLoggedIn) {
    return res.redirect('/admin/dashboard');
  }

  const pesan = req.query.pesan || '';
  let error = '';
  if (pesan === 'login_required') {
    error = 'Akses Terbatas: Silakan login sebagai Administrator terlebih dahulu.';
  } else if (pesan === 'logout_sukses') {
    req.session.successMessage = 'Anda telah berhasil logout dari Panel Admin.';
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

    req.session.adminUser = {
      id: adminUser.id,
      username: adminUser.username,
      nama_lengkap: adminUser.nama_lengkap,
      email: adminUser.email,
      pos_wilayah: adminUser.pos_wilayah || 'Semua Pos (Pusat)',
      role: adminUser.role || (adminUser.email === 'bapasmedan104@gmail.com' ? 'super_admin' : 'admin_pos')
    };
    req.session.user = req.session.adminUser;
    req.session.userType = 'admin';
    req.session.isLoggedIn = true;
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

    req.session.clientUser = {
      id: clientUser.id,
      username: clientUser.username,
      nama_lengkap: clientUser.nama_lengkap,
      no_register: clientUser.no_register,
      email: clientUser.email,
      foto_profil: (clientUser.foto_profil && !clientUser.foto_profil.startsWith('data:')) ? clientUser.foto_profil : (clientUser.foto_profil ? 'has_photo' : null),
      profil_lengkap: clientUser.profil_lengkap
    };
    req.session.user = req.session.clientUser;
    req.session.userType = 'client';
    req.session.isLoggedIn = true;

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
  const isAdmin = req.query.tipe === 'admin' || (req.headers.referer && req.headers.referer.includes('/admin'));

  if (req.session) {
    if (isAdmin) {
      delete req.session.adminUser;
      if (req.session.userType === 'admin') {
        req.session.user = req.session.clientUser || null;
        req.session.userType = req.session.clientUser ? 'client' : null;
        req.session.isLoggedIn = Boolean(req.session.clientUser);
      }
    } else {
      delete req.session.clientUser;
      if (req.session.userType === 'client') {
        req.session.user = req.session.adminUser || null;
        req.session.userType = req.session.adminUser ? 'admin' : null;
        req.session.isLoggedIn = Boolean(req.session.adminUser);
      }
    }

    if (!req.session.adminUser && !req.session.clientUser) {
      if (typeof req.session.destroy === 'function') {
        req.session.destroy();
      }
      req.session = null;
    }
  }

  res.redirect(isAdmin ? `/administrator?pesan=${pesan}` : `/login?pesan=${pesan}`);
}

async function getAdminLupaSandiPage(req, res) {
  const isAdminLoggedIn = Boolean(req.session && (req.session.adminUser || (req.session.isLoggedIn && req.session.userType === 'admin')));
  if (isAdminLoggedIn) {
    return res.redirect('/admin/dashboard');
  }

  const siteKey = process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-';
  const error = req.query.error || '';
  res.render('auth/admin_lupa_sandi', {
    pageTitle: 'Lupa Kata Sandi Administrator - BAPAS Medan',
    error,
    success: '',
    identifier: '',
    siteKey
  });
}

async function postAdminLupaSandi(req, res) {
  const { identifier } = req.body;
  const siteKey = process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-';
  const turnstileSecret = process.env.TURNSTILE_SECRET || '0x4AAAAAAGIsSpJ6pa_yXPy88IQ-mdEIHqs';
  const turnstileToken = req.body['cf-turnstile-response'];
  const expectedHostnames = new Set(
    (process.env.TURNSTILE_HOSTNAMES || 'bapas1medan.com,bapasmedan.bapasmedan104.workers.dev,localhost,127.0.0.1')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean)
  );

  // Turnstile verification
  if (typeof turnstileToken !== 'string' || turnstileToken.length === 0 || turnstileToken.length > 2048) {
    return res.render('auth/admin_lupa_sandi', {
      pageTitle: 'Lupa Kata Sandi Administrator - BAPAS Medan',
      error: 'Mohon selesaikan verifikasi keamanan Cloudflare terlebih dahulu.',
      identifier: identifier || '',
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
    if (!verifyData.success || (verifyData.hostname && !expectedHostnames.has(verifyData.hostname.toLowerCase()))) {
      return res.render('auth/admin_lupa_sandi', {
        pageTitle: 'Lupa Kata Sandi Administrator - BAPAS Medan',
        error: 'Verifikasi keamanan Cloudflare gagal atau kedaluwarsa. Silakan centang kembali verifikasi.',
        identifier: identifier || '',
        siteKey
      });
    }
  } catch (verifyErr) {
    return res.render('auth/admin_lupa_sandi', {
      pageTitle: 'Lupa Kata Sandi Administrator - BAPAS Medan',
      error: 'Terjadi kendala verifikasi keamanan: ' + verifyErr.message,
      identifier: identifier || '',
      siteKey
    });
  }

  if (!identifier || !identifier.trim()) {
    return res.render('auth/admin_lupa_sandi', {
      pageTitle: 'Lupa Kata Sandi Administrator - BAPAS Medan',
      error: 'Harap masukkan email atau username administrator Anda.',
      identifier: '',
      siteKey
    });
  }

  try {
    const resetResult = await createAdminPasswordResetToken(identifier.trim());
    if (!resetResult.success) {
      return res.render('auth/admin_lupa_sandi', {
        pageTitle: 'Lupa Kata Sandi Administrator - BAPAS Medan',
        error: resetResult.message,
        identifier,
        siteKey
      });
    }

    // Masked email for security display (e.g. bapas***@gmail.com)
    let maskedEmail = '';
    if (resetResult.admin.email) {
      const parts = resetResult.admin.email.split('@');
      const namePart = parts[0];
      const domain = parts[1];
      const visible = namePart.substring(0, Math.min(3, namePart.length));
      maskedEmail = `${visible}***@${domain}`;
    }

    // Simpan info hint di session sementara
    if (req.session) {
      req.session.resetAdminUser = resetResult.admin.username;
      req.session.resetCodeHint = resetResult.resetCode; // Memudahkan verifikasi
    }

    // Redirect ke halaman Atur Ulang Kata Sandi
    return res.redirect(`/administrator/reset-sandi?token=${resetResult.resetToken}&user=${encodeURIComponent(resetResult.admin.username)}&mail=${encodeURIComponent(maskedEmail)}&fb=${resetResult.firebaseEmailSent ? '1' : '0'}`);
  } catch (err) {
    console.error('Error postAdminLupaSandi:', err);
    return res.render('auth/admin_lupa_sandi', {
      pageTitle: 'Lupa Kata Sandi Administrator - BAPAS Medan',
      error: 'Terjadi kesalahan sistem: ' + err.message,
      identifier,
      siteKey
    });
  }
}

async function getAdminResetSandiPage(req, res) {
  const token = req.query.token;
  const siteKey = process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-';

  if (!token) {
    return res.redirect('/administrator/lupa-sandi?error=' + encodeURIComponent('Token reset tidak ditemukan. Silakan ajukan ulang permintaan lupa sandi.'));
  }

  const adminUser = await verifyAdminResetToken(token);
  if (!adminUser) {
    return res.render('auth/admin_lupa_sandi', {
      pageTitle: 'Lupa Kata Sandi Administrator - BAPAS Medan',
      error: 'Sesi reset kata sandi tidak valid atau telah kedaluwarsa (lebih dari 15 menit). Silakan ajukan ulang permohonan reset sandi.',
      identifier: req.query.user || '',
      siteKey
    });
  }

  const maskedEmail = req.query.mail || (adminUser.email ? adminUser.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : '');
  const fbSent = req.query.fb === '1';
  const codeHint = (req.session && req.session.resetCodeHint) || adminUser.reset_code || '';

  res.render('auth/admin_reset_sandi', {
    pageTitle: 'Atur Ulang Kata Sandi Administrator - BAPAS Medan',
    token,
    adminUser,
    maskedEmail,
    fbSent,
    codeHint,
    error: '',
    siteKey
  });
}

async function postAdminResetSandi(req, res) {
  const { token, kode_verifikasi, password_baru, konfirmasi_password } = req.body;
  const siteKey = process.env.TURNSTILE_SITE_KEY || '0x4AAAAAAGIsSky-2g0Z93D-';
  const turnstileSecret = process.env.TURNSTILE_SECRET || '0x4AAAAAAGIsSpJ6pa_yXPy88IQ-mdEIHqs';
  const turnstileToken = req.body['cf-turnstile-response'];
  const expectedHostnames = new Set(
    (process.env.TURNSTILE_HOSTNAMES || 'bapas1medan.com,bapasmedan.bapasmedan104.workers.dev,localhost,127.0.0.1')
      .split(',')
      .map(h => h.trim().toLowerCase())
      .filter(Boolean)
  );

  // Turnstile verification
  if (typeof turnstileToken !== 'string' || turnstileToken.length === 0 || turnstileToken.length > 2048) {
    const adminUser = token ? await verifyAdminResetToken(token) : null;
    return res.render('auth/admin_reset_sandi', {
      pageTitle: 'Atur Ulang Kata Sandi Administrator - BAPAS Medan',
      token: token || '',
      adminUser: adminUser || { username: 'Administrator' },
      maskedEmail: '',
      fbSent: false,
      codeHint: (req.session && req.session.resetCodeHint) || '',
      error: 'Mohon selesaikan verifikasi keamanan Cloudflare terlebih dahulu.',
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
    if (!verifyData.success || (verifyData.hostname && !expectedHostnames.has(verifyData.hostname.toLowerCase()))) {
      const adminUser = token ? await verifyAdminResetToken(token) : null;
      return res.render('auth/admin_reset_sandi', {
        pageTitle: 'Atur Ulang Kata Sandi Administrator - BAPAS Medan',
        token: token || '',
        adminUser: adminUser || { username: 'Administrator' },
        maskedEmail: '',
        fbSent: false,
        codeHint: (req.session && req.session.resetCodeHint) || '',
        error: 'Verifikasi keamanan Cloudflare gagal atau kedaluwarsa. Silakan centang kembali verifikasi.',
        siteKey
      });
    }
  } catch (verifyErr) {
    const adminUser = token ? await verifyAdminResetToken(token) : null;
    return res.render('auth/admin_reset_sandi', {
      pageTitle: 'Atur Ulang Kata Sandi Administrator - BAPAS Medan',
      token: token || '',
      adminUser: adminUser || { username: 'Administrator' },
      maskedEmail: '',
      fbSent: false,
      codeHint: (req.session && req.session.resetCodeHint) || '',
      error: 'Terjadi kendala verifikasi keamanan: ' + verifyErr.message,
      siteKey
    });
  }

  // Validate passwords
  if (!password_baru || password_baru.length < 6) {
    const adminUser = token ? await verifyAdminResetToken(token) : null;
    return res.render('auth/admin_reset_sandi', {
      pageTitle: 'Atur Ulang Kata Sandi Administrator - BAPAS Medan',
      token: token || '',
      adminUser: adminUser || { username: 'Administrator' },
      maskedEmail: '',
      fbSent: false,
      codeHint: (req.session && req.session.resetCodeHint) || '',
      error: 'Kata sandi baru minimal 6 karakter.',
      siteKey
    });
  }

  if (password_baru !== konfirmasi_password) {
    const adminUser = token ? await verifyAdminResetToken(token) : null;
    return res.render('auth/admin_reset_sandi', {
      pageTitle: 'Atur Ulang Kata Sandi Administrator - BAPAS Medan',
      token: token || '',
      adminUser: adminUser || { username: 'Administrator' },
      maskedEmail: '',
      fbSent: false,
      codeHint: (req.session && req.session.resetCodeHint) || '',
      error: 'Konfirmasi kata sandi tidak cocok dengan kata sandi baru.',
      siteKey
    });
  }

  try {
    const result = await executeAdminPasswordReset(token, kode_verifikasi, password_baru);
    if (!result.success) {
      const adminUser = token ? await verifyAdminResetToken(token) : null;
      return res.render('auth/admin_reset_sandi', {
        pageTitle: 'Atur Ulang Kata Sandi Administrator - BAPAS Medan',
        token: token || '',
        adminUser: adminUser || { username: 'Administrator' },
        maskedEmail: '',
        fbSent: false,
        codeHint: (req.session && req.session.resetCodeHint) || '',
        error: result.message,
        siteKey
      });
    }

    if (req.session) {
      delete req.session.resetCodeHint;
      delete req.session.resetAdminUser;
      req.session.successMessage = 'Kata sandi Administrator berhasil diubah! Silakan login dengan kata sandi baru Anda.';
    }

    return res.redirect('/administrator');
  } catch (err) {
    console.error('Error postAdminResetSandi:', err);
    const adminUser = token ? await verifyAdminResetToken(token) : null;
    return res.render('auth/admin_reset_sandi', {
      pageTitle: 'Atur Ulang Kata Sandi Administrator - BAPAS Medan',
      token: token || '',
      adminUser: adminUser || { username: 'Administrator' },
      maskedEmail: '',
      fbSent: false,
      codeHint: (req.session && req.session.resetCodeHint) || '',
      error: 'Terjadi kesalahan sistem saat memperbarui sandi: ' + err.message,
      siteKey
    });
  }
}

module.exports = {
  getLoginPage,
  postLogin,
  getAdminLoginPage,
  postAdminLogin,
  getAdminLupaSandiPage,
  postAdminLupaSandi,
  getAdminResetSandiPage,
  postAdminResetSandi,
  logout
};
