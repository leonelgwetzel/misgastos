const express = require('express');
const gastoFijoController = require('../controllers/gastoFijo.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', gastoFijoController.list);
router.post('/', gastoFijoController.create);
router.post('/:id/historial', gastoFijoController.addHistorial);
router.post('/:id/override', gastoFijoController.setOverride);
router.post('/:id/eliminar', gastoFijoController.remove);

module.exports = router;
