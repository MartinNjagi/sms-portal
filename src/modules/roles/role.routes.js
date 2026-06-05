const express = require('express');
const router = express.Router();
const roleController = require('./role.controller');
const { requireAuth, requireAdmin } = require('../../middlewares/requireAuth');

router.use(requireAuth, requireAdmin);

// --- PAGE ROUTES (View in browser) ---
router.get('/', roleController.viewRoles);

// --- API ROUTES (Called via Axios) ---
router.get('/api/permissions', requireAuth, roleController.getPermissions);
router.get('/api/:id/permissions', requireAuth, roleController.viewRolePermissions);
router.post('/api/create', requireAuth, roleController.createRole);

// --- NEW API ROUTES ---
router.post('/api/assign', requireAuth, roleController.assignRolePermissions);
router.delete('/api/:id/delete', requireAuth, roleController.deleteRole);

module.exports = router;