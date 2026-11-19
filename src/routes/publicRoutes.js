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

module.exports = router;
