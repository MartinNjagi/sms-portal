// src/services/websocket.service.js
const WebSocket = require('ws');

const initializeWebSocketRelay = (io) => {
    const GO_WS_URL = process.env.GO_ENGINE_WS_URL || 'ws://localhost:8080/internal/events';
    let goWsClient;

    const connectToGoEngine = () => {
        console.log(`🔗 Attempting to connect to Go Engine WS at ${GO_WS_URL}...`);
        goWsClient = new WebSocket(GO_WS_URL, {
            // Pass the internal security token so Go knows it's the Node Dashboard connecting
            headers: {
                'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`
            }
        });

        goWsClient.on('open', () => {
            console.log('✅ Connected directly to Go Engine WebSocket Broadcasts');
        });

        goWsClient.on('message', (message) => {
            try {
                // Parse the broadcast from Go
                const data = JSON.parse(message);

                // Ensure the data has the required routing info
                if (data.clientId && data.campaignId) {
                    const roomName = `campaign_${data.clientId}`;
                    
                    // Relay ONLY to the specific user's browser room
                    io.to(roomName).emit('campaign_progress', data);
                }
            } catch (error) {
                console.error('Failed to parse WS message from Go Engine:', error);
            }
        });

        goWsClient.on('close', () => {
            console.warn('⚠️ Lost connection to Go Engine WS. Reconnecting in 5 seconds...');
            setTimeout(connectToGoEngine, 5000);
        });

        goWsClient.on('error', (err) => {
            console.error('❌ Go Engine WS Error:', err.message);
            goWsClient.close(); // Triggers the close event to attempt reconnection
        });
    };

    // Initialize the connection
    connectToGoEngine();
};

module.exports = { initializeWebSocketRelay };