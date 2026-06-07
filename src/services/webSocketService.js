// src/services/webSocketService.js
const WebSocket = require('ws');

// ==========================================
// 1. Shared Module State
// ==========================================
let socket = null;
let handlers = {};
let currentToken = null;
let wsUrl = null;

// ==========================================
// 2. Connection Management
// ==========================================
const connect = (token) => {
    currentToken = token;
    wsUrl = process.env.GO_WS_URL || 'wss://ws.yourdomain.com/ws';

    socket = new WebSocket(wsUrl, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    });

    socket.on('open', () => {
        console.log('✅ Connected to WS service');
    });

    socket.on('message', (data) => {
        try {
            const { event, payload } = JSON.parse(data);
            handlers[event]?.forEach(fn => fn(payload));
        } catch (err) {
            console.error('❌ Failed to parse WS message:', err.message);
        }
    });

    socket.on('close', () => {
        console.warn('⚠️ WS closed, reconnecting in 3s...');
        setTimeout(() => connect(currentToken), 3000);
    });

    socket.on('error', (err) => {
        console.error('❌ WS error:', err.message);
        socket.close();
    });
};

const disconnect = () => {
    socket?.close();
    socket = null;
};

// ==========================================
// 3. Application Helpers (Event Emitters)
// ==========================================
const on = (event, handler) => {
    if (!handlers[event]) handlers[event] = [];
    handlers[event].push(handler);
};

const off = (event, handler) => {
    if (!handlers[event]) return;
    handlers[event] = handlers[event].filter(fn => fn !== handler);
};

module.exports = {
    connect,
    disconnect,
    on,
    off
};