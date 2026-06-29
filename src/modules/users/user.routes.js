// src/modules/users/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth');

// 1. Apply requireAuth globally so all routes below are protected
router.use(requireAuth);

// --- PAGE ROUTES (View in browser) ---
router.get('/my-team', userController.viewMyTeam);

// 2. Apply requireAdmin ONLY to the specific route that needs it
router.get('/client/:id', requireAdmin, userController.viewClientUsers);

// --- API ROUTES (Called via Axios) ---
// Note: We don't need to repeat 'requireAuth' here because router.use() handles it.
router.get('/api/roles', userController.getRoles);
router.post('/api/create', userController.createUser);
router.get('/api/:id', userController.getUser);
router.put('/api/:id', userController.updateUser);
router.delete('/api/:id', userController.deleteUser);

module.exports = router;