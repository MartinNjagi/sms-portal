// src/modules/sse/sse.routes.js
const express = require('express');
const router = express.Router();
const sseController = require('./sse.controller');
const { requireAuth } = require('../../middlewares/requireAuth');

router.use(requireAuth);

router.get('/events', requireAuth, sseController.handleSSE);

module.exports = router;