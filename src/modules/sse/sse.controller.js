const { on, off } = require('../../services/webSocketService');

// ==========================================
// 1. SSE Controller
// ==========================================
const handleSSE = (req, res) => {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Forward every WS event to this browser connection
    const forward = (event) => (payload) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const events = ['campaign.completed', 'campaign.progress', 'system.alert'];
    const handlers = {};

    events.forEach(event => {
        handlers[event] = forward(event);
        // Bind the event listener
        on(event, handlers[event]); 
    });

    // Clean up when browser closes the tab/logs out
    req.on('close', () => {
        // ✅ Changed WSE.off to just off() since it was destructured at the top
        events.forEach(event => off(event, handlers[event]));
        console.log('SSE client disconnected');
    });
};

module.exports = { handleSSE };