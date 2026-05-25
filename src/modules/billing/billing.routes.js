const express = require('express');
const router = express.Router();
const billingController = require('./billing.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth');


router.use(requireAuth, requireAdmin);

// Ensure requireAuth is protecting the route
router.get('/billing', requireAuth, billingController.renderWallet);


module.exports = router;