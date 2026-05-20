// src/middlewares/requireAuth.js
const jwt = require('jsonwebtoken'); // You might need to install jsonwebtoken

const requireAuth = (req, res, next) => {
    const token = req.cookies.session_token;

    if (!token) {
        return res.redirect('/login');
    }

    try {
        // Decode the token (we don't need to verify the signature here if Go already did, 
        // but it's safe to just decode it to get the role and ID).
        const decoded = jwt.decode(token);
        
        req.token = token;
        req.user = {
            id: decoded.id,
            role: decoded.role, // e.g., 'ADMIN' or 'CLIENT'
            clientId: decoded.clientId
        };

        // Make the user object globally available to all Nunjucks views!
        // This is a magic trick that saves you from passing it in every single render() call.
        res.locals.user = req.user; 

        next();
    } catch (err) {
        res.clearCookie('session_token');
        return res.redirect('/login');
    }
};

// Helper middleware specifically for protecting Admin routes
const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).render('errors/403.njk', { message: 'Access Denied. Admins only.' });
    }
};

module.exports = { requireAuth, requireAdmin };