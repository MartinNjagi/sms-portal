const express = require('express');
const router = express.Router();
const notificationsController = require('./notification.controller');
const { requireAuth } = require('../../middlewares/requireAuth');

router.use(requireAuth);

// Page render — admin sees all users, client sees own
router.get('/', notificationsController.renderNotificationsPage);

// API proxy to Go WS service
router.get('/api',                    notificationsController.getNotifications);
router.patch('/api/:id/read',         notificationsController.markRead);
router.patch('/api/read-all',         notificationsController.markAllRead);

module.exports = router;