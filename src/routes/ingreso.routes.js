const express = require('express');
const ingresoController = require('../controllers/ingreso.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', ingresoController.list);
router.post('/', ingresoController.create);
router.post('/:id/actualizar', ingresoController.update);
router.post('/:id/eliminar', ingresoController.remove);

module.exports = router;
