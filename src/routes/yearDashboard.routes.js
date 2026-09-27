const express = require('express');
const yearDashboardController = require('../controllers/yearDashboard.controller');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, yearDashboardController.index);

module.exports = router;
