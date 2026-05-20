// server.js (or app.js)
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');

// Initialize Express
const app = express();

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
app.use(helmet()); 
// Cross-Origin Resource Sharing
app.use(cors());
// Parse JSON bodies (Keep limits reasonable, large files go to Cloud Storage now!)
app.use(express.json({ limit: '1mb' })); 
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(require('cookie-parser')());

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
const dashboardRoutes = require('./src/modules/dashboard/dashboard.routes');
const messageRoutes = require('./src/modules/messages/message.routes');
const clientRoutes = require('./src/modules/clients/client.routes');
const contactsRoutes = require('./src/modules/contacts/contacts.routes');

app.use('/api/dashboard', dashboardRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/clients', clientRoutes);
app.use('/contacts', contactsRoutes)


// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

// --- Start Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`SMS Dashboard Overwatch running on port ${PORT}`);
});