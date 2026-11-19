const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { requireAdmin } = require('../middlewares/auth');

// Semua rute admin mewajibkan login admin
router.use(requireAdmin);

// Dashboard & Overview
router.get('/dashboard', adminController.getDashboard);

// Riwayat Lapor & Advanced Multi-Filter
router.get('/riwayat-lapor', adminController.getRiwayatLapor);
router.get('/riwayat-lapor/export-csv', adminController.getExportLaporCsv);

// Kelola Client
router.get('/kelola-client', adminController.getKelolaClient);
router.get('/kelola-client/export-csv', adminController.getExportClientsCsv);
router.post('/client/create', adminController.postCreateClient);
router.post('/client/update', adminController.postUpdateClient);
router.post('/client/reset-password', adminController.postResetClientPassword);
router.post('/client/delete', adminController.postDeleteClient);

// Reset Password Administrator
router.post('/reset-password', adminController.postResetAdminPassword);

// Tindakan Verifikasi Laporan
router.post('/lapor/terima', adminController.postTerimaLapor);
router.post('/lapor/tolak', adminController.postTolakLapor);
router.post('/lapor/batalkan', adminController.postBatalkanLapor);
router.post('/lapor/delete', adminController.postDeleteLapor);
router.get('/lapor/detail/:id', adminController.getDetailLaporJson);

// Konfigurasi Sistem
router.post('/konfigurasi/update', adminController.postUpdateKonfigurasi);

module.exports = router;
