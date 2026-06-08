// src/modules/messages/message.routes.js
const express = require('express');
const router = express.Router();
const messageController = require('./message.controller');
const { requireAuth } = require('../../middlewares/requireAuth');

// Enforce authentication on all messaging routes
router.use(requireAuth);

// ==========================================
// 1. PAGE VIEWS (HTML)
// ==========================================

// Main Messaging Dashboard (Launch Campaign & Outbox)
router.get('/', messageController.renderBulkDashboard);

// Message Templates Management View
router.get('/templates', messageController.renderTemplates);


// ==========================================
// 2. BFF API ENDPOINTS (JSON)
// ==========================================

// Dashboard initialization data (Fetches balance and recent campaigns)
router.get('/api/dashboard-data', messageController.getMessageDashboardData);

// Generates Pre-signed GET/PUT URLs for Cloud Storage (bypasses server memory)
router.get('/api/upload-url', messageController.getUploadUrl);

// Unified Campaign Trigger (Handles Instant, Scheduled, Group, and CSV payloads)
router.post('/api/process-campaign', messageController.processCampaign);

// Live Stats for Outbox polling (Fetches PENDING, DELIVERED, FAILED counts)
router.get('/api/campaigns/:id/stats', messageController.getCampaignStats);


module.exports = router;