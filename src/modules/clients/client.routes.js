// src/modules/clients/client.routes.js
const express = require('express');
const router = express.Router();
const clientController = require('./client.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth');

router.use(requireAuth, requireAdmin);

router.get('/', clientController.renderIndex);
router.get('/:clientId/wallet', clientController.renderWalletReport); // New reporting route
router.post('/api/:clientId/activate', clientController.activateClient);

module.exports = router;