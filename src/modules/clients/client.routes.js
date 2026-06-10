// src/modules/clients/client.routes.js
const express = require('express');
const router = express.Router();
const clientController = require('./client.controller');
const userController = require('../users/user.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth');

router.use(requireAuth);

router.get('/',clientController.renderIndex);
router.get('/:clientId/wallet',clientController.renderWalletReport); // New reporting route
router.post('/api/:clientId/activate', requireAdmin ,clientController.activateClient);
router.get('/my-team', userController.viewMyTeam);
router.get('/:id/users', userController.viewClientUsers);
module.exports = router;