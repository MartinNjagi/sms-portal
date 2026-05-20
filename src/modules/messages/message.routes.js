// src/modules/messages/message.routes.js
const express = require('express');
const router = express.Router();
const messageController = require('./message.controller');

// Fast client-side validation middleware can be injected here later
// router.post('/bulk', fastValidationMiddleware, messageController.initiateBulkSend);

// BFF Route: Get data for the messages view
router.get('/', messageController.getMessageDashboardData);

// BFF Route: Generate Pre-signed URL for CSV upload
router.get('/upload-url', messageController.getUploadUrl);

// BFF Route: Tell Go Engine to start processing the uploaded file
router.post('/process-campaign', messageController.triggerGoEngine);

module.exports = router;