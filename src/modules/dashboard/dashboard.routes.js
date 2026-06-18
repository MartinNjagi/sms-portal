// src/modules/dashboard/dashboard.routes.js
const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const { requireAuth } = require('../../middlewares/requireAuth');

// Apply the auth middleware to ALL routes in this file
router.use(requireAuth); 

 router.get('/', dashboardController.renderDashboard);

module.exports = router;