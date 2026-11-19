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

router.get('/logout', authController.logout);

module.exports = router;
