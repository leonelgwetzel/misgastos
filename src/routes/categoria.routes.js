const express = require('express');
const categoriaController = require('../controllers/categoria.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', categoriaController.list);
router.post('/', categoriaController.create);
router.post('/:id/actualizar', categoriaController.update);
router.post('/:id/eliminar', categoriaController.remove);

module.exports = router;
