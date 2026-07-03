// src/modules/clients/client.routes.js
const express = require('express');
const router = express.Router();
const clientController = require('./client.controller');
const userController = require('../users/user.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth');

router.use(requireAuth);

router.get('/',clientController.renderIndex);
router.get('/:clientId/wallet',clientController.renderWalletReport);
router.post('/clients', requireAdmin,clientController.createClientAction);
router.put('/clients/:id',requireAdmin, clientController.updateClientAction);
router.post('/api/:clientId/activate', requireAdmin ,clientController.activateClient);
router.post('/clients/:id/suspend', requireAdmin, clientController.suspendClientAction);
router.post('/clients/:id/reinstate', requireAdmin, clientController.reinstateClientAction);
router.get('/my-team', userController.viewMyTeam);
router.get('/:id/users', userController.viewClientUsers);
module.exports = router;