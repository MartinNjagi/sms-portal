const express = require('express');
const router = express.Router();
const contactsController = require('./contacts.controller');
const { requireAuth } = require('../../middlewares/requireAuth');

router.use(requireAuth); // Protect all routes

// Page View
router.get('/', contactsController.renderIndex);

// Group Management
router.post('/api/groups', contactsController.createGroup);
router.put('/api/groups/:id', contactsController.updateGroup);
router.delete('/api/groups/:id', contactsController.deleteGroup);

// Contact Management
router.get('/api/groups/:id/contacts', contactsController.getGroupContacts);
router.post('/api/contacts', contactsController.addContacts);
router.delete('/api/contacts/:phone_id', contactsController.deleteContact);

module.exports = router;