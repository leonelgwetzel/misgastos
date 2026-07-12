const express = require('express');
const divisaController = require('../controllers/divisa.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', divisaController.list);
router.post('/', divisaController.create);
router.post('/tarifas', divisaController.updateTarifa);

module.exports = router;
