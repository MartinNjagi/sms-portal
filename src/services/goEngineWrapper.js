// src/services/goEngineWrapper.js
const axios = require('axios');

// 1. Service Registry Mapping
// Defines the base URLs for your separated microservices.
const services = {
    identity: { baseURL: process.env.IDENTITY_SERVICE_URL || 'http://localhost:4848' },
    billing:  { baseURL: process.env.BILLING_SERVICE_URL || 'http://localhost:4849' },
    sms:      { baseURL: process.env.SMS_SERVICE_URL || 'http://localhost:4850' }
};

// 2. Factory to create clients
// Generates an Axios instance with standard timeouts, headers, and interceptors.
const createServiceClient = (serviceName) => {
    const config = services[serviceName];
    const client = axios.create({
        baseURL: config.baseURL,
        timeout: 10000, // 10 seconds. Don't let Node hang forever!
        headers: {
            'Content-Type': 'application/json',
            // Internal security: Always authenticate internal microservice calls
            'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN}`
        }
    });

    // Attach request interceptor for logging
    client.interceptors.request.use(reqConfig => {
        const fullUrl = client.getUri(reqConfig);
        console.log(`[${serviceName.toUpperCase()} Outgoing] ${reqConfig.method.toUpperCase()} -> ${fullUrl}`);
        return reqConfig;
    });

    return client;
};

// Instantiate the microservice clients
const clients = {
    identity: createServiceClient('identity'),
    billing: createServiceClient('billing'),
    sms: createServiceClient('sms')
};

// 3. Centralized Error Handler
// Formats errors nicely so your controllers don't have to guess what broke.
const handleEngineError = (error, context) => {
    if (error.response) {
        console.error(`[Engine Error - ${context}]:`, error.response.data);
        throw new Error(error.response.data.message || 'The engine rejected the request.');
    } else if (error.request) {
        console.error(`[Engine Unreachable - ${context}]: No response received.`);
        throw new Error('A processing engine is currently unreachable. Please try again in a moment.');
    } else {
        console.error(`[Internal Error - ${context}]:`, error.message);
        throw new Error('An internal error occurred while contacting the engine.');
    }
};

// --- 4. The API Methods ---

// ==========================================
// IDENTITY SERVICE CALLS
// ==========================================

const requestOtp = async (msisdn, password) => {
    console.log("requestOTP stage");
    try {
        const response = await clients.identity.post('/api/v1/login', { msisdn, password });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'requestOtp');
    }
};

const verifyOtp = async (msisdn, code) => {
    try {
        const response = await clients.identity.post('/api/v1/verify', { msisdn, code });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'verifyOtp');
    }
};

const getAllClients = async (token) => {
    try {
        const response = await clients.identity.get('/api/v1/clients', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getAllClients');
    }
};

const getUsers = async (token, clientId = null) => {
    try {
        let url = '/api/v1/users';
        
        // Build the query string if a clientId is passed
        // The Go backend will securely decide whether to respect or ignore this
        if (clientId) {
            url += `?client_id=${clientId}`;
        }

        const response = await clients.identity.get(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getUsers');
    }
};

const getDeveloperSettings = async (token) => {
    try {
        const response = await clients.identity.get('/api/v1/settings/developer', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getDeveloperSettings');
    }
};

// ==========================================
// BILLING SERVICE CALLS
// ==========================================

const getWalletData = async (token, clientId) => {
    console.log(`[Wrapper Debug] Fetching mock wallet data for client ${clientId}`);
    
    // WIP: Replace this return block with an actual axios call later
    return {
        balance: 4500.50,
        currency: 'USD',
        transactions: [
            { id: 'TX-9942', date: '2026-05-24', type: 'Credit', amount: 1000.00, description: 'Stripe Top-Up', status: 'Completed' },
            { id: 'TX-9941', date: '2026-05-22', type: 'Debit', amount: -45.50, description: 'Campaign: Q4 Promo', status: 'Completed' },
            { id: 'TX-9940', date: '2026-05-20', type: 'Debit', amount: -12.00, description: 'Campaign: Test Run', status: 'Completed' },
            { id: 'TX-9939', date: '2026-05-18', type: 'Credit', amount: 500.00, description: 'Bank Transfer', status: 'Processing' }
        ]
    };
};

const getClientBalance = async (clientId) => {
    try {
        const response = await clients.billing.get(`/api/v1/billing/balance/${clientId}`);
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getClientBalance');
    }
};

const getWalletHistory = async (token, targetClientId) => {
    try {
        const response = await clients.billing.get(`/api/v1/wallet/history/${targetClientId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getWalletHistory');
    }
};

// ==========================================
// SMS / CAMPAIGN SERVICE CALLS
// ==========================================
const getDashboardStats = async (token) => {
    console.log("[Wrapper Debug] Returning mocked dashboard data...");

    // This structure matches what renderDashboard expects
    return {
        summary: {
            totalSent: 1250,
            pending: 25,
            failed: 3,
            balance: 4500.50
        },
        recentCampaigns: [
            { id: 1, name: 'Q4 Promo', status: 'Completed', sent: 500 },
            { id: 2, name: 'Easter Sale', status: 'Processing', sent: 120 }
        ]
    };
};

const getRecentCampaigns = async (clientId, options = { limit: 5 }) => {
    try {
        const response = await clients.sms.get(`/api/v1/campaigns/${clientId}`, {
            params: { limit: options.limit }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getRecentCampaigns');
    }
};

const startBulkCampaign = async (payload) => {
    try {
        const response = await clients.sms.post('/api/v1/campaigns/process', payload);
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'startBulkCampaign');
    }
};

const getContactGroups = async (token) => {
    try {
        const response = await clients.sms.get('/api/v1/contacts/groups', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getContactGroups');
    }
};

const createContactGroup = async (token, groupData) => {
    try {
        const response = await clients.sms.post('/api/v1/contacts/groups', groupData, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'createContactGroup');
    }
};

const getSenderIds = async (token) => {
    try {
        const response = await clients.sms.get('/api/v1/settings/sender-ids', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        return response.data; 
    } catch (error) {
        handleEngineError(error, 'getSenderIds');
    }
};

const getTemplates = async (token, clientId) => {
    console.log(`[Wrapper Debug] Fetching templates for client ${clientId}`);
    // WIP: Replace with actual Go SMS Engine API call
    return [
        { id: 'TPL-001', name: 'Payment Reminder', content: 'Dear [Name], your bill of [Amount] is due on [Date].', status: 'Approved' },
        { id: 'TPL-002', name: 'OTP Verification', content: 'Your verification code is [Code]. Do not share this.', status: 'Approved' },
        { id: 'TPL-003', name: 'Marketing Promo', content: 'Flash Sale! Get 20% off using code [PromoCode].', status: 'Pending' }
    ];
};

const startCampaign = async (token, payload) => {
    try {
        // This hits your Go service to actually queue the SMS batch
        const response = await clients.identity.post('/api/v1/campaigns/launch', payload, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Expecting Go to return something like { campaignId: "CMP-998" }
        return response.data;
    } catch (error) {
        handleEngineError(error, 'startCampaign');
    }
};

module.exports = {
    // Identity
    requestOtp, 
    verifyOtp,
    getAllClients,
    getUsers,
    getDeveloperSettings,
    
    // Billing
    getClientBalance,
    getWalletHistory,
    getWalletData,
    
    // SMS / Campaigns
    getDashboardStats,
    getRecentCampaigns,
    startBulkCampaign,
    getContactGroups,
    createContactGroup,
    getSenderIds,
    getTemplates,startCampaign,
    
    // Direct Access to Clients (if needed elsewhere)
    identity: clients.identity,
    billing: clients.billing,
    sms: clients.sms
};