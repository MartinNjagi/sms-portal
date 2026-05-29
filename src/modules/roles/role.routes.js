// src/modules/roles/role.routes.js
const express = require('express');
const router = express.Router();
const roleController = require('./role.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth');

router.use(requireAuth, requireAdmin);

// --- PAGE ROUTES (View in browser) ---
router.get('/', roleController.viewRoles);

// --- API ROUTES (Called via Axios) ---
router.get('/api/permissions',requireAuth, roleController.getPermissions);
router.get('/api/:id/permissions',requireAuth, roleController.viewRolePermissions);
router.post('/api/create',requireAuth,roleController.createRole);

module.exports = router;