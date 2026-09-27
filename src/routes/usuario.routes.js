const express = require('express');
const usuarioController = require('../controllers/usuario.controller');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/', usuarioController.list);
router.post('/', usuarioController.create);
router.post('/:id/actualizar', usuarioController.update);
router.post('/:id/habilitar', usuarioController.habilitar);
router.post('/:id/deshabilitar', usuarioController.deshabilitar);
router.post('/:id/eliminar', usuarioController.remove);

module.exports = router;
