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
        // ✅ 'on' now references the destructured function
        on(event, handlers[event]); 
    });

    // Clean up when browser closes the tab/logs out
    req.on('close', () => {
        events.forEach(event => WSE.off(event, handlers[event]));
        console.log('SSE client disconnected');
    });
};

module.exports = { handleSSE };