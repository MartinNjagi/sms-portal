// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const nunjucks = require('nunjucks'); // 1. Import Nunjucks
const cookieParser = require('cookie-parser'); // Assuming you added this earlier for auth
const path = require('path');
const morgan = require('morgan');

// Initialize Express
const app = express();
app.use(morgan('dev'));

app.use(express.static(path.join(__dirname, 'public')));

// --- CONFIGURE NUNJUCKS ---
const env = nunjucks.configure(path.join(__dirname, 'views'), { 
    autoescape: true,
    express: app,
    watch: process.env.NODE_ENV !== 'production' 
});// Register the custom filter
env.addFilter('intcomma', function(val) {
    if (val === null || val === undefined) return '';
    return val.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
});


app.set('view engine', 'njk'); // Tells Express that .njk is the default view engine
// -----------------------------

// Create HTTP server wrapping Express
const server = http.createServer(app);

// Initialize Socket.io attached to the HTTP server
const io = new Server(server, {
    cors: {
        origin: process.env.FRONTEND_URL || '*', //TODO Update this for production security
        methods: ['GET', 'POST']
    }
});

// --- Middlewares ---
// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://unpkg.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            mediaSrc: ["'self'", "data:"], 
            connectSrc: ["'self'", "ws:", "wss:"] 
        }
    }
}));
// Cross-Origin Resource Sharing
app.use(cors());
// Parse JSON bodies (Keep limits reasonable, large files go to Cloud Storage now!)
app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());

// --- WebSocket Handling (The Overwatch) ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Example: User joins a specific "room" based on their Client ID or Campaign ID
    // so they only get DLR (Delivery) updates meant for them.
    socket.on('join_campaign_room', (campaignId) => {
        socket.join(`campaign_${campaignId}`);
        console.log(`Socket ${socket.id} joined room: campaign_${campaignId}`);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
    });
});

// --- Attach IO to request object (Dependency Injection) ---
// This allows your controllers to emit websocket events if needed
app.use((req, res, next) => {
    req.io = io;
    next();
});

// --- Feature Modules (BFF Routes) ---
// Instead of one giant routes/index.js, we mount modular feature routes
const { requireAuth } = require('./src/middlewares/requireAuth');
const authController = require('./src/modules/auth/auth.controller');
const dashboardController = require('./src/modules/dashboard/dashboard.controller');
const contactsController = require('./src/modules/contacts/contacts.controller');
const authRoutes = require('./src/modules/auth/auth.routes');
const dashboardRoutes = require('./src/modules/dashboard/dashboard.routes');
const messageRoutes = require('./src/modules/messages/message.routes');
const clientRoutes = require('./src/modules/clients/client.routes');
const contactsRoutes = require('./src/modules/contacts/contacts.routes');
const userRoutes = require('./src/modules/users/user.routes');
const roleRoutes = require('./src/modules/roles/role.routes');
const settingsRoutes = require('./src/modules/settings/settings.routes');
const billingRoutes = require('./src/modules/billing/billing.routes');
const renderError = require('./src/services/renderError');

// --- Feature Modules (BFF Routes) ---
app.get('/login', authController.renderLogin);
app.get('/logout', authController.logout);
app.get('/dashboard', requireAuth, dashboardController.renderDashboard);
app.get('/contacts', requireAuth, contactsController.renderAddressBook);
app.use('/api/auth', authRoutes);             // Handles /login, /logout
//app.use('/dashboard', dashboardRoutes); // Handles /dashboard
app.use('/messages', messageRoutes); 
app.use('/contacts', contactsRoutes);    
app.use('/clients', clientRoutes);       
app.use('/settings', settingsRoutes);
app.use('/accounts', billingRoutes);
app.use('/users', userRoutes);   
app.use('/roles', roleRoutes);   

// 👉 ADD THIS LINE RIGHT HERE:
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});


// Catch-all 404
app.use((req, res) => {
    renderError(res,404)
});

// Global error handler (must be last)
app.use((err, req, res, next) => {
    console.error(err.stack);

    renderError(res,500,{
        message: process.env.NODE_ENV === 'development'
            ? err.message
            : 'An unexpected error occurred.',
    });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SMS Dashboard Overwatch running on port ${PORT}`);
});