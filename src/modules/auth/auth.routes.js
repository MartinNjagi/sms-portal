// src/modules/auth/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');


// Notice these are relative to how we mount them in server.js
router.get('/login', authController.renderLogin);
router.post('/api/auth/login', authController.processLogin);
router.get('/logout', authController.logout);

module.exports = router;