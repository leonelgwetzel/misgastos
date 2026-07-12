const express = require('express');
const authController = require('../controllers/auth.controller');
const { redirectIfAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/login', redirectIfAuth, authController.renderLogin);
router.post('/login', redirectIfAuth, authController.postLogin);
router.get('/register', redirectIfAuth, authController.renderRegister);
router.post('/register', redirectIfAuth, authController.postRegister);
router.post('/logout', authController.postLogout);

module.exports = router;
