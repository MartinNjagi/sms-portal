// src/middlewares/requireAuth.js
const jwt = require('jsonwebtoken'); 

const requireAuth = (req, res, next) => {
    const token = req.cookies.access_token;
    if (!token) return res.redirect('/auth/login');

    try {
        // Decode the JWT (use the same secret as your Go service)
        // If you don't have the secret in Node, you can also fetch the 
        // user profile from the Go service using an internal call here.
        const decoded = jwt.decode(token); 

        // Attach user data to req.user
        req.user = {
            id: decoded.username || "System Admin",
            clientId: decoded.client_id || "1",
            role: "ADMIN" // Or map from decoded.permissions
        };
        
        // Pass the token along for engine calls
        req.token = token; 
        
        next();
    } catch (err) {
        console.error("Auth middleware error:", err);
        res.redirect('/auth/login');
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'ADMIN') {
        next();
    } else {
        res.status(403).render('errors/403.njk', { message: 'Access Denied. Admins only.' });
    }
};

module.exports = { requireAuth, requireAdmin };