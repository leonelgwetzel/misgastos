const express = require('express');
const tarjetaController = require('../controllers/tarjeta.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', tarjetaController.list);
router.post('/', tarjetaController.create);
router.post('/:id/actualizar', tarjetaController.update);
router.post('/:id/eliminar', tarjetaController.remove);

module.exports = router;
