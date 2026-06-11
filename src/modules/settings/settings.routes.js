const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth'); 
const goEngineWrapper = require('../../services/goEngineWrapper');

router.use(requireAuth);

// 1. PAGE VIEW
router.get('/', settingsController.renderSettingsPage);

// 2. NEW ADMIN BILLING ENDPOINTS (Protected by requireAdmin)
router.post('/api/admin/wallet-adjust', requireAdmin, settingsController.manualWalletAdjustment);

router.put('/api/admin/billing-config/:id', requireAdmin, settingsController.updateBillingConfig);

module.exports = router;