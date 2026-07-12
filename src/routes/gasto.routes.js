const express = require('express');
const gastoController = require('../controllers/gasto.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);
router.get('/', gastoController.list);
router.post('/', gastoController.create);

module.exports = router;
