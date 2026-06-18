// src/modules/messages/message.routes.js
const express = require('express');
const router = express.Router();
const messageController = require('./message.controller');
const { requireAuth } = require('../../middlewares/requireAuth');

router.use(requireAuth);

// --- VIEWS ---
router.get('/', messageController.renderBulkDashboard);
router.get('/single', messageController.renderSingleDashboard);
router.get('/templates', messageController.renderTemplates);
router.post('/templates', messageController.createTemplateSync); // Handle Modal Form POST

// --- BFF API (Called by bulk-upload.js) ---
router.get('/api/dashboard-data', messageController.getMessageDashboardData);
router.get('/api/upload-url', messageController.getUploadUrl);
router.post('/api/trigger', messageController.triggerCampaign);       // Group Flow
router.post('/api/trigger-bulk', messageController.triggerBulkCampaign); // CSV Flow
router.post('/api/single', messageController.sendSingle);
router.post('/api/campaigns/:id', messageController.editCampaign);
router.post('/api/campaigns/:id/stats', messageController.getCampaignStats);
router.post('/api/sender-ids', messageController.requestSenderId);
router.post('/api/templates', messageController.createTemplateAsync);
router.put('/api/sender-ids/:id/review', messageController.reviewSenderId);
router.put('/api/templates/:id/review', messageController.reviewTemplate);

module.exports = router;