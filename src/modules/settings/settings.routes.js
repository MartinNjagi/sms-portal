const express = require('express');
const router = express.Router();
const settingsController = require('./settings.controller');
const { requireAuth,requireAdmin } = require('../../middlewares/requireAuth');

router.use(requireAuth);

// Page View
router.get('/', settingsController.renderSettingsPage);

// Sender IDs (Client Actions)
router.post('/api/sender-ids', settingsController.requestSenderId);
router.delete('/api/sender-ids/:id', settingsController.deleteSenderId);

// Templates (Client Actions)
router.post('/api/templates', settingsController.createTemplate);
router.put('/api/templates/:id', settingsController.updateTemplate);
router.delete('/api/templates/:id', settingsController.deleteTemplate);

// Admin Approvals (Should be protected by an Admin middleware)
router.put('/api/admin/sender-ids/:id/approve',requireAdmin, settingsController.adminApproveSenderId);
router.put('/api/admin/templates/:id/approve', requireAdmin,settingsController.adminApproveTemplate);

module.exports = router;