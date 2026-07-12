const express = require('express');
const cuentaController = require('../controllers/cuenta.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

router.get('/', cuentaController.list);
router.post('/', cuentaController.create);
router.get('/:id/movimientos', cuentaController.movimientos);
router.post('/:id/movimientos', cuentaController.createMovimiento);
router.post('/:id/ajustar', cuentaController.ajustar);
router.post('/:id/eliminar', cuentaController.remove);

module.exports = router;
