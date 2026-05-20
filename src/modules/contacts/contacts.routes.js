const express = require('express');
const router = express.Router();
const contactsController = require('./contacts.controller');
const { requireAuth } = require('../../middlewares/requireAuth');

router.use(requireAuth); // Protect all routes

// Page View
router.get('/', contactsController.renderIndex);

// API Action
router.post('/api/groups', contactsController.createGroup);

module.exports = router;