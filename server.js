const express = require('express');
const path = require('path');
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

// View engine setup
app.engine('ejs', (filePath, data, cb) => {
  const opts = {
    views: data.settings && data.settings.views,
    cache: Boolean(data.settings && data.settings['view cache']),
    filename: filePath,
    client: false
  };
  ejs.renderFile(filePath, data, opts, cb);
});
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

// HTTP Logger & Security
app.use(morgan('dev'));
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

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'public')));

// Uploads Handler (Serverless & Disk Fallback)
const os = require('os');
const isServerless = Boolean(
  process.env.NETLIFY || 
  process.env.AWS_LAMBDA_FUNCTION_NAME || 
  process.env.LAMBDA_TASK_ROOT ||
  (process.env.NODE_ENV === 'production' && !process.env.LOCAL_ENV)
);
const serverlessUploadsDir = path.join(os.tmpdir(), 'bapas_uploads');
const localUploadsDir = path.join(__dirname, 'public', 'uploads');

app.use('/uploads', express.static(serverlessUploadsDir));
app.use('/uploads', express.static(localUploadsDir));

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
  res.status(500).render('public/500', {
    pageTitle: '500 - Kesalahan Server',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Terjadi kesalahan internal pada server.',
    activePage: '500'
  });
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
