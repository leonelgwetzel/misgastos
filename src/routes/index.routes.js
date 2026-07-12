const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const cicloController = require('../controllers/ciclo.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, dashboardController.index);
router.post('/ciclos', requireAuth, cicloController.upsert);

module.exports = router;
