const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');

// API Routes called by your frontend JS (SweetAlert / Axios)
router.post('/login/request-otp', authController.handleRequestOtp);
router.post('/login/verify-otp', authController.handleVerifyOtp);

// ── Password Reset Flow ───────────────────────────────────────────────────────
router.post('/password/forgot-send', authController.handleForgotPasswordSend);
router.post('/password/forgot-verify', authController.handleForgotPasswordVerify);
router.post('/password/reset', authController.handleResetPassword);

// ── Passkeys (WebAuthn) ───────────────────────────────────────────────────────
router.post('/passkey/login/begin', authController.passkeyLoginBegin);
router.post('/passkey/login/finish', authController.passkeyLoginFinish);
router.post('/passkey/register/begin', authController.passkeyRegisterBegin);
router.post('/passkey/register/finish', authController.passkeyRegisterFinish);

// Logout Route
router.get('/logout', authController.logout);

module.exports = router;