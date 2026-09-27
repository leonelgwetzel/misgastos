const express = require('express');
const ingresoFijoController = require('../controllers/ingresoFijo.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', ingresoFijoController.list);
router.post('/', ingresoFijoController.create);
router.post('/:id/historial', ingresoFijoController.addHistorial);
router.post('/:id/override', ingresoFijoController.setOverride);
router.post('/:id/eliminar', ingresoFijoController.remove);

module.exports = router;
