const express = require('express');
const movimientosController = require('../controllers/movimientos.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', movimientosController.index);

module.exports = router;
