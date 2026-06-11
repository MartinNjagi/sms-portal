const { on, off } = require('../../services/webSocketService');

const handleSSE = (req, res) => {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 👉 THE FIX: Send a silent keep-alive comment every 30 seconds
    const heartbeatId = setInterval(() => {
        res.write(': keepalive\n\n');
    }, 30000);

    // Forward every WS event to this browser connection
    const forward = (event) => (payload) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    const events = ['campaign.completed', 'campaign.progress', 'system.alert'];
    const handlers = {};

    events.forEach(event => {
        handlers[event] = forward(event);
        on(event, handlers[event]); 
    });

    // Clean up when browser closes the tab
    req.on('close', () => {
        // 👉 CRITICAL: Clear the interval so you don't create a memory leak!
        clearInterval(heartbeatId);
        
        events.forEach(event => off(event, handlers[event]));
        console.log('SSE client disconnected');
    });
};

module.exports = { handleSSE };