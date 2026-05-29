// src/modules/users/user.routes.js
const express = require('express');
const router = express.Router();
const userController = require('./user.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth');

router.use(requireAuth, requireAdmin);

// --- PAGE ROUTES (View in browser) ---
router.get('/my-team', userController.viewMyTeam);
router.get('/client/:id', userController.viewClientUsers);

// --- API ROUTES (Called via Axios) ---
router.get('/api/roles',requireAuth, userController.getRoles);
router.post('/api/create',requireAuth, userController.createUser);

module.exports = router;