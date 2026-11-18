const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');
const { requireClient, requireProfilLengkap } = require('../middlewares/auth');
const { uploadWajibLapor, uploadProfil } = require('../middlewares/upload');

// Semua rute client mewajibkan login client
router.use(requireClient);

// Profil dapat diakses meski profil belum lengkap
router.get('/profil', clientController.getProfil);
router.post('/profil', uploadProfil.single('foto_profil'), clientController.postProfil);

// Rute lainnya mewajibkan profil lengkap terlebih dahulu
router.get('/dashboard', requireProfilLengkap, clientController.getDashboard);
router.post('/lapor', requireProfilLengkap, clientController.postLaporBaru);
router.post('/upload-foto', requireProfilLengkap, uploadWajibLapor.single('foto'), clientController.postUploadFoto);
router.get('/riwayat', requireProfilLengkap, clientController.getRiwayatLapor);
router.get('/jadwal', requireProfilLengkap, clientController.getJadwalLapor);

module.exports = router;
