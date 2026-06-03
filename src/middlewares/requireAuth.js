// src/middlewares/requireAuth.js
const jwt = require('jsonwebtoken'); 
const renderError = require('../services/renderError');

const requireAuth = (req, res, next) => {
    const token = req.cookies.access_token;

    if (!token) {
        return renderError(res,401);
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // ADD THIS LINE so goEngineWrapper can access it later
        req.token = token; 

        req.user = {
            id: decoded.user_id,
            username: decoded.username,
            client_id: decoded.client_id,
            permission_ids: decoded.PermissionIDs || [],
            role: decoded.client_id === 1 ? 'ADMIN' : 'Client'
        };

        next();
    } catch (error) {
        console.error("JWT Verification failed:", error.message);
        res.clearCookie('access_token');
        return res.redirect('/login');
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        return res.status(403).render('errors/index.njk', {
        code: 403,
        title: 'Access Denied',
        message: 'You do not have permission to access this page.',
        icon: 'bi-shield-lock'
    });    }
};

module.exports = { requireAuth, requireAdmin };