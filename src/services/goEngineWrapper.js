// src/services/goEngineWrapper.js
const axios = require('axios');

// 1. Configure the Base Axios Instance
// This ensures every request to the Go engine uses the same rules.
const goEngineClient = axios.create({
    baseURL: process.env.GO_ENGINE_URL|| 'http://localhost:4848',
    timeout: 10000, // 10 seconds. Don't let Node hang forever if Go is restarting!
    headers: {
        'Content-Type': 'application/json',
        // Internal security: Always authenticate internal microservice calls
        'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}` 
    }
});

// Add this right after configuring goEngineClient

goEngineClient.interceptors.request.use(config => {
    // This safely combines your baseURL and the route path
    const fullUrl = goEngineClient.getUri(config);
    
    console.log(`[Go Engine Outgoing] ${config.method.toUpperCase()} -> ${fullUrl}`);
    
    // Optional: If you want to see exactly what data Node is sending to Go
    // console.log(`[Go Engine Payload]`, config.data);
    
    return config;
});

// 2. Centralized Error Handler
// Formats errors nicely so your controllers don't have to guess what broke.
const handleEngineError = (error, context) => {
    if (error.response) {
        // The Go engine responded with a status code that falls out of the range of 2xx
        console.error(`[Go Engine Error - ${context}]:`, error.response.data);
        throw new Error(error.response.data.message || 'The SMS engine rejected the request.');
    } else if (error.request) {
        // The request was made but no response was received (Go engine is down/unreachable)
        console.error(`[Go Engine Unreachable - ${context}]: No response received.`);
        throw new Error('The SMS processing engine is currently unreachable. Please try again in a moment.');
    } else {
        // Something happened in setting up the request
        console.error(`[Internal Error - ${context}]:`, error.message);
        throw new Error('An internal error occurred while contacting the SMS engine.');
    }
};

// --- 3. The API Methods ---

/**
 * Fetch the current credit balance for a specific client.
 */
const getClientBalance = async (clientId) => {
    try {
        const response = await goEngineClient.get(`/api/v1/billing/balance/${clientId}`);
        return response.data; // Expected format: { balance: 5000, currency: 'USD' }
    } catch (error) {
        handleEngineError(error, 'getClientBalance');
    }
};

/**
 * Fetch the most recent campaigns to display on the dashboard.
 */
const getRecentCampaigns = async (clientId, options = { limit: 5 }) => {
    try {
        const response = await goEngineClient.get(`/api/v1/campaigns/${clientId}`, {
            params: { limit: options.limit }
        });
        return response.data; // Expected format: [{ id: 'camp_1', status: 'completed', ... }]
    } catch (error) {
        handleEngineError(error, 'getRecentCampaigns');
    }
};

/**
 * Trigger the Go Engine to start processing an uploaded CSV file.
 * @param {Object} payload - Details of the campaign and the S3 file location
 */
const startBulkCampaign = async (payload) => {
    try {
        /*
          Payload expects:
          {
             clientId: 'client_123',
             campaignName: 'Promo Q4',
             senderId: 'InfoSMS',
             s3FileKey: 'campaigns/client_123/16843920_file.csv',
             callbackRoom: 'campaign_client_123'
          }
        */
        const response = await goEngineClient.post('/api/v1/campaigns/process', payload);
        return response.data; // Expected format: { campaignId: 'camp_999', status: 'queued' }
    } catch (error) {
        handleEngineError(error, 'startBulkCampaign');
    }
};


/**
 * Fetch all contact groups for a specific user
 */
const getContactGroups = async (token) => {
    try {
        const response = await goEngineClient.get('/api/v1/contacts/groups', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; // e.g., [{ id: 1, name: 'VIP Customers', count: 450 }]
    } catch (error) {
        handleEngineError(error, 'getContactGroups');
    }
};

/**
 * Tell Go to create a new contact group
 */
const createContactGroup = async (token, groupData) => {
    try {
        const response = await goEngineClient.post('/api/v1/contacts/groups', groupData, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'createContactGroup');
    }
};

// Add these to your existing goEngineWrapper.js

/**
 * Fetch the user's approved and pending Sender IDs
 */
const getSenderIds = async (token) => {
    try {
        const response = await goEngineClient.get('/api/v1/settings/sender-ids', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; // e.g., [{ id: 'InfoSMS', status: 'approved' }, { id: 'PromoBrand', status: 'pending' }]
    } catch (error) {
        handleEngineError(error, 'getSenderIds');
    }
};

/**
 * Fetch the user's API keys and Webhook configs
 */
const getDeveloperSettings = async (token) => {
    try {
        const response = await goEngineClient.get('/api/v1/settings/developer', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; // e.g., { apiKey: 'sk_live_123...', webhookUrl: 'https://...' }
    } catch (error) {
        handleEngineError(error, 'getDeveloperSettings');
    }
};

/**
 * Fetch all clients and their current READ-ONLY balances
 */
const getAllClients = async (token) => {
    try {
        const response = await goEngineClient.get('/api/v1/clients', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getAllClients');
    }
};


/**
 * Unified endpoint for fetching wallet history.
 * Security (Admin override vs Self-fetch) is strictly handled by the Go Engine.
 */
const getWalletHistory = async (token, targetClientId) => {
    try {
        const response = await goEngineClient.get(`/api/v1/wallet/history/${targetClientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getWalletHistory');
    }
};

/**
 * Step 1: Request OTP (Validates password via Go Identity)
 */
const requestOtp = async (msisdn, password) => {
    console.log("requestOTP stage");
    try {
        const response = await goEngineClient.post('/api/v1/login', {
            msisdn,
            password
        });
        return response.data; // e.g., { message: "2FA code sent" }
    } catch (error) {
        handleEngineError(error, 'requestOtp');
    }
};

/**
 * Step 2: Verify OTP and get JWT
 */
const verifyOtp = async (msisdn, code) => {
    try {
        const response = await goEngineClient.post('/api/v1/verify', {
            msisdn,
            code
        });
        // Go returns the JWT, User object, and Permissions here
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'verifyOtp');
    }
};

module.exports = {
    requestOtp, verifyOtp,
    getClientBalance,
    getRecentCampaigns,
    startBulkCampaign,
    getContactGroups,
    createContactGroup,
    getSenderIds,
    getDeveloperSettings,
    getAllClients,
    getWalletHistory
};