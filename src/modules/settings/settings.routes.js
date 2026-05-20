// src/modules/settings/settings.routes.js
const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { requireAuth } = require('../../middlewares/requireAuth');

router.use(requireAuth);

// Page Render
router.get('/', settingsController.renderSettingsPage);

// API Actions
router.post('/api/sender-ids', settingsController.requestSenderId);
// router.put('/api/webhooks', settingsController.updateWebhook);

module.exports = router;