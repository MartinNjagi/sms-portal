// src/modules/auth/auth.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const authController = {};

/**
 * Render the Nunjucks Login View
 */
authController.renderLogin = (req, res) => {
    // If they already have a valid session cookie, send them to the dashboard
    if (req.cookies.session_token) {
        return res.redirect('/dashboard');
    }
    res.render('login/index.njk', { title: 'Login - SMS Platform' });
};

/**
 * Handle the Login POST request from the browser
 */
authController.processLogin = async (req, res, next) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required.' });
        }

        // 1. Send credentials to the Go Identity Service
        // The Go service verifies the DB and returns a user object and a JWT token
        const authResult = await goEngineWrapper.authenticateUser(username, password);

        // 2. Set the HTTP-Only Cookie
        // This is the magic of the BFF pattern. The browser gets a cookie, not a raw token.
        res.cookie('session_token', authResult.token, {
            httpOnly: true,       // JavaScript CANNOT access this (prevents XSS)
            secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
            sameSite: 'strict',   // Prevents CSRF attacks
            maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
        });

        // 3. Respond with success so the frontend script can redirect
        res.status(200).json({
            success: true,
            redirectUrl: '/dashboard'
        });

    } catch (error) {
        // If Go rejects the login, send the error back to the UI
        res.status(401).json({ error: error.message || 'Invalid credentials' });
    }
};

/**
 * Handle Logout
 */
authController.logout = (req, res) => {
    res.clearCookie('session_token');
    res.redirect('/login');
};

module.exports = authController;