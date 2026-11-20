const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/', publicController.getHomePage);
router.get('/berita', publicController.getBeritaPage);
router.get('/profil', publicController.getProfilPage);
router.get('/informasi', publicController.getInformasiPage);
router.get('/privasi', publicController.getPrivasiPage);
router.get('/syarat-ketentuan', publicController.getSyaratKetentuanPage);

// SEO Routes
router.get('/robots.txt', publicController.getRobotsTxt);
router.get('/sitemap.xml', publicController.getSitemapXml);

// Pusat Bantuan & CS Real-Time API
router.post('/api/pusat-bantuan/cek-registrasi', publicController.postCekRegistrasiClient);
router.post('/api/pusat-bantuan/kirim', publicController.postKirimPesanBantuan);
router.post('/api/pusat-bantuan/bot', publicController.postKirimBotBantuan);
router.post('/api/pusat-bantuan/akhiri', publicController.postAkhiriSesiBantuan);
router.get('/api/pusat-bantuan/pesan/:sessionId', publicController.getPesanBantuanJson);
router.get('/api/pusat-bantuan/pesan', publicController.getPesanBantuanJson);

module.exports = router;
