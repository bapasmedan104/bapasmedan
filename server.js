const express = require('express');
const path = require('path');
const fs = require('fs');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const cors = require('cors');
const dotenv = require('dotenv');
const ejs = require('ejs');

dotenv.config();

const { PORT, SESSION_SECRET } = require('./src/config/envConfig');
const { setLocals } = require('./src/middlewares/auth');
const publicRoutes = require('./src/routes/publicRoutes');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const clientRoutes = require('./src/routes/clientRoutes');

const app = express();

// Diagnostic ping langsung di level teratas sebelum middleware apapun
app.get('/ping', (req, res) => {
  res.type('text/plain').send('PONG - BAPAS CLOUDFLARE IS LIVE!');
});

// Base root directory aman untuk runtime Node.js lokal maupun ESM Cloudflare Workers
const appDir = (typeof process !== 'undefined' && typeof process.cwd === 'function') ? process.cwd() : '/';

let rawViews = null;
const inMemoryCompiled = {};

try {
  rawViews = require('./src/views/rawViews');
  // Dukungan runtime Cloudflare Workers tanpa akses filesystem disk
  ejs.fileLoader = function (filePath) {
    const norm = filePath.replace(/\\/g, '/');
    for (const [k, v] of Object.entries(rawViews)) {
      if (norm.endsWith(k)) return v;
    }
    throw new Error('Not found in rawViews: ' + filePath);
  };
  ejs.resolveInclude = function(name, filename, isDir) {
    const dir = path.posix.dirname(filename.replace(/\\/g, '/'));
    let target = path.posix.normalize(path.posix.join(dir, name));
    if (!target.endsWith('.ejs')) target += '.ejs';
    return target;
  };

  // Kompilasi template saat startup worker (dengan cache: true agar include tidak memanggil new Function di runtime)
  for (const [k, content] of Object.entries(rawViews)) {
    if (k.startsWith('src/views/')) continue;
    try {
      const fn = ejs.compile(content, { filename: 'src/views/' + k, cache: true });
      inMemoryCompiled[k] = fn;
      inMemoryCompiled[k.replace(/\.ejs$/, '')] = fn;
      ejs.cache.set('src/views/' + k, fn);
      ejs.cache.set('src/views/' + k.replace(/\.ejs$/, ''), fn);
    } catch (e) {
      console.warn('Compile error at startup for ' + k + ':', e.message);
    }
  }

  // Override ejs.cache.get agar include child template langsung mengambil template yang sudah terkompilasi
  ejs.cache.get = function (filename) {
    if (!filename) return null;
    const norm = filename.replace(/\\/g, '/');
    for (const [k, fn] of Object.entries(inMemoryCompiled)) {
      if (norm.endsWith(k) || norm.endsWith(k + '.ejs')) return fn;
    }
    return inMemoryCompiled[norm] || inMemoryCompiled[norm.replace(/\.ejs$/, '')] || null;
  };
} catch (e) {
  console.warn('rawViews not loaded, using ejs.renderFile fallback.');
}

// View engine setup
app.engine('ejs', (filePath, data, cb) => {
  let rel = filePath.replace(/\\/g, '/');
  if (rel.includes('/src/views/')) {
    rel = rel.substring(rel.indexOf('/src/views/') + '/src/views/'.length);
  } else if (rel.startsWith('src/views/')) {
    rel = rel.substring('src/views/'.length);
  }
  rel = rel.replace(/\.ejs$/, '');

  let fn = inMemoryCompiled[rel] || inMemoryCompiled[rel + '.ejs'];
  if (!fn) {
    for (const [k, v] of Object.entries(inMemoryCompiled)) {
      if (k.endsWith(rel) || k.endsWith(rel + '.ejs')) {
        fn = v;
        break;
      }
    }
  }

  if (fn) {
    try {
      const html = fn(data);
      return cb(null, html);
    } catch (err) {
      console.error('In-memory render error for ' + rel + ':', err);
      return cb(err);
    }
  }

  return cb(new Error('Template view not found in memory: ' + rel));
});

// Custom View class untuk Express agar tidak memeriksa disk dengan fs.statSync di Cloudflare Workers
function CloudflareView(name, options) {
  this.name = name;
  this.ext = path.extname(name) || ('.' + options.defaultEngine);
  this.path = name.endsWith('.ejs') ? name : (name + '.ejs');
  this.engine = options.engines[this.ext];
  this.render = function (renderOpts, callback) {
    this.engine(this.path, renderOpts, callback);
  };
}
app.set('view', CloudflareView);
app.set('views', path.join(appDir, 'src', 'views'));
app.set('view engine', 'ejs');
app.set('view cache', true);

// Nilai default untuk global template locals
app.locals.activePage = 'beranda';
app.locals.pageTitle = 'BAPAS Kelas I Medan';
app.locals.tipe = 'client';
app.locals.username = '';
app.locals.error = null;
app.locals.pesan = null;
app.locals.isLoggedIn = false;
app.locals.user = null;
app.locals.userType = null;
app.locals.successMessage = null;
app.locals.errorMessage = null;
app.locals.warningMessage = null;
app.locals.getFileUrl = (p) => p || '';

// HTTP Logger (Hanya aktif di lokal dev)
if (process.env.NODE_ENV === 'development' && !process.env.CF_PAGES) {
  try {
    app.use(morgan('dev'));
  } catch (e) {}
}
app.use(cors());

// Body Parsers
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// Session Management
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 jam
      httpOnly: true
    }
  })
);

// Global Template Variables & Flash Messages
app.use(setLocals);

// Uploads Handler (Serverless & Disk Fallback)
const os = require('os');
const isServerless = Boolean(
  process.env.NETLIFY || 
  process.env.AWS_LAMBDA_FUNCTION_NAME || 
  process.env.LAMBDA_TASK_ROOT ||
  (process.env.NODE_ENV === 'production' && !process.env.LOCAL_ENV)
);
const serverlessUploadsDir = path.join(os.tmpdir(), 'bapas_uploads');
const localUploadsDir = path.join(appDir, 'public', 'uploads');

// Static Assets (Hanya jika filesystem fisik tersedia, di Cloudflare Workers ditangani edge binding ASSETS)
let hasPhysicalFs = false;
try {
  if (typeof fs.statSync === 'function') {
    fs.statSync(appDir);
    hasPhysicalFs = true;
  }
} catch (e) {
  hasPhysicalFs = false;
}

if (hasPhysicalFs) {
  app.use(express.static(path.join(appDir, 'public')));
  app.use('/assets', express.static(path.join(appDir, 'public')));
  app.use('/uploads', express.static(serverlessUploadsDir));
  app.use('/uploads', express.static(localUploadsDir));
}

// Media Streaming Endpoint (Mencegah browser Chromium memblokir data: URI di tab baru)
const { getLaporById, getClientById } = require('./src/models/db');

app.get('/media/foto-lapor/:id', async (req, res) => {
  try {
    const lapor = await getLaporById(req.params.id);
    if (!lapor || !lapor.foto_bukti) {
      return res.redirect('/logo_pemasyarakatan-removebg-preview.png');
    }
    const foto = lapor.foto_bukti;
    if (foto.startsWith('http://') || foto.startsWith('https://')) {
      return res.redirect(foto);
    }
    if (foto.startsWith('data:')) {
      const match = foto.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        res.set('Content-Type', mime);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      }
    }
    const clean = foto.replace(/^\/+/, '');
    const sPath = path.join(serverlessUploadsDir, 'wajib_lapor', clean);
    if (fs.existsSync(sPath)) return res.sendFile(sPath);
    const lPath = path.join(localUploadsDir, 'wajib_lapor', clean);
    if (fs.existsSync(lPath)) return res.sendFile(lPath);
    return res.redirect('/logo_pemasyarakatan-removebg-preview.png');
  } catch (err) {
    console.error('Error serve media foto lapor:', err);
    return res.redirect('/logo_pemasyarakatan-removebg-preview.png');
  }
});

app.get('/media/foto-profil/:id', async (req, res) => {
  try {
    const client = await getClientById(req.params.id);
    if (!client || !client.foto_profil) {
      return res.redirect('/logo_pemasyarakatan-removebg-preview.png');
    }
    const foto = client.foto_profil;
    if (foto.startsWith('http://') || foto.startsWith('https://')) {
      return res.redirect(foto);
    }
    if (foto.startsWith('data:')) {
      const match = foto.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buffer = Buffer.from(match[2], 'base64');
        res.set('Content-Type', mime);
        res.set('Cache-Control', 'public, max-age=86400');
        return res.send(buffer);
      }
    }
    const clean = foto.replace(/^\/+/, '');
    const sPath = path.join(serverlessUploadsDir, 'profil', clean);
    if (fs.existsSync(sPath)) return res.sendFile(sPath);
    const lPath = path.join(localUploadsDir, 'profil', clean);
    if (fs.existsSync(lPath)) return res.sendFile(lPath);
    return res.redirect('/logo_pemasyarakatan-removebg-preview.png');
  } catch (err) {
    console.error('Error serve media foto profil:', err);
    return res.redirect('/logo_pemasyarakatan-removebg-preview.png');
  }
});

app.get('/uploads/*', (req, res) => {
  const relPath = req.params[0];
  const sPath = path.join(serverlessUploadsDir, relPath);
  if (fs.existsSync(sPath)) return res.sendFile(sPath);
  const lPath = path.join(localUploadsDir, relPath);
  if (fs.existsSync(lPath)) return res.sendFile(lPath);
  res.redirect('/logo_pemasyarakatan-removebg-preview.png');
});

// Mounting Routes
app.use('/', publicRoutes);
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/client', clientRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('public/404', {
    pageTitle: '404 - Halaman Tidak Ditemukan',
    activePage: '404'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Application Error:', err);
  if (res.headersSent) return next(err);
  res.status(500).type('text/plain').send('SERVER ERROR:\n' + (err.stack || err.message));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 BAPAS Kelas I Medan - Sistem Wajib Lapor (Node.js)`);
    console.log(`📡 Server berjalan di http://localhost:${PORT}`);
    console.log(`⏰ Waktu Server: ${new Date().toLocaleString('id-ID')}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
module.exports.default = app;
