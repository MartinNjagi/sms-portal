// src/modules/settings/settings.routes.js
const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth'); 

router.use(requireAuth);

// 1. PAGE VIEW
router.get('/', settingsController.renderSettingsPage);

// 2. API KEYS & WEBHOOKS (Newly Added)
router.post('/api/keys', settingsController.generateAPIKey);
router.delete('/api/keys/:id', settingsController.revokeAPIKey);
router.put('/api/webhook', settingsController.updateMyWebhook); // New Webhook Route

// 3. ADMIN BILLING ENDPOINTS
router.post('/api/admin/wallet-adjust', requireAdmin, settingsController.manualWalletAdjustment);
router.put('/api/admin/billing-config/:id', requireAdmin, settingsController.updateBillingConfig);


router.delete('/api/passkeys/:id',settingsController.deletePasskey);
module.exports = router;