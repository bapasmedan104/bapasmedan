const express = require('express');
const path = require('path');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const cors = require('cors');
const dotenv = require('dotenv');
const ejs = require('ejs');

dotenv.config();

const { setLocals } = require('./src/middlewares/auth');
const publicRoutes = require('./src/routes/publicRoutes');
const authRoutes = require('./src/routes/authRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const clientRoutes = require('./src/routes/clientRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

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
    secret: process.env.SESSION_SECRET || 'bapas_medan_secret_key_2026',
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
