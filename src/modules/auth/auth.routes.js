const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

// API Routes called by your frontend JS (SweetAlert / Axios)
router.post('/login/request-otp', authController.handleRequestOtp);
router.post('/login/verify-otp', authController.handleVerifyOtp);

// Logout Route
router.get('/logout', authController.logout);

module.exports = router;