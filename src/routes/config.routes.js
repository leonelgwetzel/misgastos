const express = require('express');
const configController = require('../controllers/config.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', configController.index);
router.post('/telegram/codigo', configController.crearCodigoTelegram);
router.post('/telegram/:id/desvincular', configController.desvincularTelegram);

module.exports = router;
