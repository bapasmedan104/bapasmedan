const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.get('/login', authController.getLoginPage);
router.post('/login', authController.postLogin);

// Dedicated Administrator Login Routes
router.get('/administrator', authController.getAdminLoginPage);
router.post('/administrator', authController.postAdminLogin);
router.get('/administrator/login', (req, res) => res.redirect('/administrator'));
router.get('/administrator/logout', authController.logout);

// Administrator Forgot & Reset Password Routes
router.get('/administrator/lupa-sandi', authController.getAdminLupaSandiPage);
router.post('/administrator/lupa-sandi', authController.postAdminLupaSandi);
router.get('/administrator/reset-sandi', authController.getAdminResetSandiPage);
router.post('/administrator/reset-sandi', authController.postAdminResetSandi);

router.get('/logout', authController.logout);

module.exports = router;
