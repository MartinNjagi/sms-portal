// src/services/goEngineWrapper.js
const axios  = require('axios');
const crypto = require('crypto');

// =============================================================================
// 1. SERVICE REGISTRY
// =============================================================================
const services = {
    identity: { baseURL: process.env.IDENTITY_SERVICE_URL || 'http://localhost:4848' },
    billing:  { baseURL: process.env.BILLING_SERVICE_URL  || 'http://localhost:4849' },
    sms:      { baseURL: process.env.SMS_SERVICE_URL      || 'http://localhost:4850' },
    websocket:{ baseURL: process.env.WEBSOCKET_SERVICE_URL|| 'http://localhost:8088' },
};

// =============================================================================
// 2. AXIOS FACTORY
// Clean instances — no request-time data baked in at module load.
// Per-request concerns (IP, JWT, signature) are injected at call time via withContext().
// =============================================================================
const createServiceClient = (serviceName) => {
    const client = axios.create({
        baseURL: services[serviceName].baseURL,
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' },
    });

    // Request Interceptor
    client.interceptors.request.use(reqConfig => {
        console.log(`[${serviceName.toUpperCase()} Outgoing] ${reqConfig.method.toUpperCase()} -> ${client.getUri(reqConfig)}`);
        return reqConfig;
    });

    // Response Interceptor
    client.interceptors.response.use(
        (response) => {
            // The Go engine returns the standardized APIResponse struct.
            // Axios puts this in `response.data`.
            // Expected shape: { status: int, message: string, data: any, pagination?: any }
            return response;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    return client;
};

const clients = {
    identity: createServiceClient('identity'),
    billing:  createServiceClient('billing'),
    sms:      createServiceClient('sms'),
    websocket:createServiceClient('websocket'),
};

// =============================================================================
// 3. SECURITY HELPERS
// =============================================================================

/**
 * Extracts the real client IP from an Express request.
 * Relies on nginx setting X-Real-IP before the request reaches Node.
 */
const extractIP = (req) =>
    req?.headers?.['x-real-ip']
    || req?.headers?.['x-forwarded-for']?.split(',')[0].trim()
    || req?.socket?.remoteAddress;

/**
 * HMAC-SHA256 signs timestamp + body, matching Go's VerifySignature middleware.
 * Format: "<unix_seconds>.<body>" — both sides must agree on this exactly.
 */
const signPayload = (body = '', timestamp) => {
  if (typeof body !== 'string') {
    throw new TypeError('HMAC body must be a string');
  }
  if (!process.env.INTERNAL_SERVICE_TOKEN) {
    throw new Error('INTERNAL_SERVICE_TOKEN missing');
  }
  if (!timestamp) {
    throw new Error('Timestamp is required for HMAC signing');
  }

  const payload = `${timestamp}.${body}`;

  return crypto
    .createHmac('sha256', process.env.INTERNAL_SERVICE_TOKEN)
    .update(payload)
    .digest('hex');
};

/**
 * Builds the header block for every internal service call.
 */
const withContext = (req, extraHeaders = {}, payload = null) => {
  let body = '';
  try {
    body = payload ? JSON.stringify(payload) : '';
  } catch (err) {
    throw new Error(`Failed to serialize request payload for HMAC signing: ${err.message}`);
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signPayload(body, timestamp);

  if (!signature) {
    throw new Error('Failed to generate HMAC signature');
  }

  const headers = {
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    ...(extractIP(req) && { 'X-Real-IP': extractIP(req) }),
    ...extraHeaders,
  };

  const auth = headers.Authorization;
  if (auth) {
    if (!auth.startsWith('Bearer ')) {
      throw new Error('Malformed Authorization header');
    }
    const token = auth.slice(7).trim();
    if (!token || token === 'undefined' || token === 'null') {
      throw new Error('Invalid bearer token');
    }
  }

  return { headers };
};

const getJWT = (req) => {
  return (
    req.token ||
    req.session?.token ||
    req.session?.user?.token ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '')
  );
};

// =============================================================================
// 4. CENTRALIZED ERROR HANDLER
// =============================================================================
const handleEngineError = (error, context) => {
    if (error.response) {
        // Parse the new standardized Go APIResponse struct
        const apiResponse = error.response.data;
        
        // Extract the standardized message (fallback to .error for legacy, then a default string)
        const errorMessage = apiResponse?.message || apiResponse?.error || 'The engine rejected the request.';
        const engineStatus = apiResponse?.status || error.response.status;

        console.error(`[Engine Error - ${context}] Status: ${engineStatus} | Message:`, errorMessage);
        throw new Error(errorMessage);
    } else if (error.request) {
        console.error(`[Engine Unreachable - ${context}]: No response received.`);
        throw new Error('A processing engine is currently unreachable. Please try again in a moment.');
    } else {
        console.error(`[Internal Error - ${context}]:`, error.message);
        throw new Error('An internal error occurred while contacting the engine.');
    }
};

// =============================================================================
// 5. API METHODS
// =============================================================================

// ----------------------------------------------------------------------------
// IDENTITY SERVICE
// ----------------------------------------------------------------------------

const requestOtp = async (msisdn, password, req) => {
    console.log('[Engine] requestOTP stage');
    const payload = { msisdn, password };
    try {
        const response = await clients.identity.post(
            '/api/v1/login',
            payload,
            withContext(req, {}, payload),
        );
        return response.data; // Returns the full standard APIResponse struct
    } catch (error) {
        handleEngineError(error, 'requestOtp');
    }
};

const verifyOtp = async (msisdn, code, req) => {
    const payload = { msisdn, code };
    try {
        const response = await clients.identity.post(
            '/api/v1/verify',
            payload,
            withContext(req, {}, payload),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'verifyOtp');
    }
};

const createUser = async (req) => {
    try {
        const payload = req.body;
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');
    
        const response = await clients.identity.post(
            '/api/v1/users',
            payload,
            withContext(req, { Authorization: `Bearer ${token}` }, payload),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'createUser');
    }
};

const getAllClients = async (req) => {
    try {
        const token = getJWT(req); 
        if (!token) throw new Error('Missing JWT token on request context');

        const response = await clients.identity.get(
            '/api/v1/clients',
            withContext(req, { Authorization: `Bearer ${token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getAllClients');
    }
};

const getRoles = async (req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        const response = await clients.identity.get(
            '/api/v1/roles',
            withContext(req, { Authorization: `Bearer ${token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getRoles');
    }
};

const listAvailablePermissions = async (req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        const response = await clients.identity.get(
            '/api/v1/roles/permissions',
            withContext(req, { Authorization: `Bearer ${token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'listAvailablePermissions');
    }
};

const getRolePermissions = async (req, roleId) => {
    try {
        const response = await clients.identity.get(
            `/api/v1/roles/${roleId}/permissions`,
            withContext(req, { Authorization: `Bearer ${req.token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, `getRolePermissions (${roleId})`);
    }
};

const createRole = async (req) => {
     try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');
        const payload = req.body;
   
        const response = await clients.identity.post(
            '/api/v1/roles',
            payload,
            withContext(req, { Authorization: `Bearer ${token}` }, payload),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'createRole');
    }
};

const getUsers = async (req, clientId = null) => {
    try {
        const url = clientId ? `/api/v1/users?client_id=${clientId}` : '/api/v1/users';
        const response = await clients.identity.get(
            url,
            withContext(req, { Authorization: `Bearer ${req.token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getUsers');
    }
};

const getDeveloperSettings = async (req) => {
    try {
        const response = await clients.identity.get(
            '/api/v1/settings/developer',
            withContext(req, { Authorization: `Bearer ${req.token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getDeveloperSettings');
    }
};

const assignRolePermissions = async (req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');
        const payload = req.body;
        
        const response = await clients.identity.put(
            '/api/v1/roles/assign',
            payload,
            withContext(req, { Authorization: `Bearer ${token}` }, payload)
        );
        
        return response.data;
    } catch (error) {
        handleEngineError(error, 'assignRolePermissions');
    }
};

const deleteRole = async (req, roleId) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');
        
        const response = await clients.identity.delete(
            `/api/v1/roles/${roleId}`,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        
        return response.data;
    } catch (error) {
        handleEngineError(error, 'deleteRole');
    }
};


// ----------------------------------------------------------------------------
// BILLING SERVICE
// ----------------------------------------------------------------------------

const getClientBalance = async (req) => {
    const clientId = req.user.id;
    try {
        const response = await clients.billing.get(
            `/api/v1/billing/balance/${clientId}`,
            withContext(req),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getClientBalance');
    }
};

const getWalletHistory = async (req) => {
    const targetId = req.params.clientId;
    try {
        const response = await clients.billing.get(
            `/api/v1/wallet/history/${targetId}`,
            withContext(req, { Authorization: `Bearer ${req.token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getWalletHistory');
    }
};

// WIP: Replace mock with real billing call
// Now conforms to the Go APIResponse standard
const getWalletData = async (req) => {
    const clientId = req.user?.clientId || 'MOCK_ID';
    console.log(`[Wrapper WIP] Returning mock wallet data for client ${clientId}`);
    return {
        status: 200,
        message: "Wallet data retrieved successfully",
        data: {
            balance: 4500.50,
            currency: 'USD',
            transactions: [
                { id: 'TX-9942', date: '2026-05-24', type: 'Credit', amount: 1000.00,  description: 'Stripe Top-Up',       status: 'Completed'  },
                { id: 'TX-9941', date: '2026-05-22', type: 'Debit',  amount: -45.50,   description: 'Campaign: Q4 Promo',  status: 'Completed'  },
                { id: 'TX-9940', date: '2026-05-20', type: 'Debit',  amount: -12.00,   description: 'Campaign: Test Run',  status: 'Completed'  },
                { id: 'TX-9939', date: '2026-05-18', type: 'Credit', amount: 500.00,   description: 'Bank Transfer',       status: 'Processing' },
            ],
        }
    };
};

// ----------------------------------------------------------------------------
// SMS / CAMPAIGN SERVICE
// ----------------------------------------------------------------------------

// WIP: Replace mock with real SMS engine call
// Now conforms to the Go APIResponse standard
const getDashboardStats = async (req) => {
    console.log('[Wrapper WIP] Returning mock dashboard stats...');
    return {
        status: 200,
        message: "Dashboard stats retrieved successfully",
        data: {
            summary:         { totalSent: 1250, pending: 25, failed: 3, balance: 4500.50 },
            recentCampaigns: [
                { id: 1, name: 'Q4 Promo',   status: 'Completed',  sent: 500 },
                { id: 2, name: 'Easter Sale', status: 'Processing', sent: 120 },
            ],
        }
    };
};

const getRecentCampaigns = async (req, options = { limit: 5 }) => {
    const clientId = req.user.id;
    try {
        const response = await clients.sms.get(
            `/api/v1/campaigns/${clientId}`,
            { ...withContext(req), params: { limit: options.limit } },
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getRecentCampaigns');
    }
};

const startBulkCampaign = async (payload, req) => {
    try {
        const response = await clients.sms.post(
            '/api/v1/campaigns/process',
            payload,
            withContext(req, {}, payload),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'startBulkCampaign');
    }
};

const getContactGroups = async (req) => {
    try {
        const response = await clients.sms.get(
            '/api/v1/contacts/groups',
            withContext(req, { Authorization: `Bearer ${req.token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getContactGroups');
    }
};

const createContactGroup = async (groupData, req) => {
    try {
        const response = await clients.sms.post(
            '/api/v1/contacts/groups',
            groupData,
            withContext(req, { Authorization: `Bearer ${req.token}` }, groupData),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'createContactGroup');
    }
};

const getSenderIds = async (req) => {
    try {
        const response = await clients.sms.get(
            '/api/v1/settings/sender-ids',
            withContext(req, { Authorization: `Bearer ${req.token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getSenderIds');
    }
};

// WIP: Replace mock with real SMS engine call
// Now conforms to the Go APIResponse standard
const getTemplates = async (req) => {
    const clientId = req.user?.id || 'MOCK_ID';
    console.log(`[Wrapper WIP] Returning mock templates for client ${clientId}`);
    return {
        status: 200,
        message: "Templates retrieved successfully",
        data: [
            { id: 'TPL-001', name: 'Payment Reminder', content: 'Dear [Name], your bill of [Amount] is due on [Date].', status: 'Approved' },
            { id: 'TPL-002', name: 'OTP Verification',  content: 'Your verification code is [Code]. Do not share this.', status: 'Approved' },
            { id: 'TPL-003', name: 'Marketing Promo',   content: 'Flash Sale! Get 20% off using code [PromoCode].',      status: 'Pending'   },
        ],
        pagination: { total: 3, page: 1, limit: 10 }
    };
};

const startCampaign = async (payload, req) => {
    try {
        const response = await clients.sms.post(    
            '/api/v1/campaigns/launch',
            payload,
            withContext(req, { Authorization: `Bearer ${req.token}` }, payload),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'startCampaign');
    }
};

// V2 Start a standard or scheduled campaign
const launchCampaign = async (payload, req) => {
    try {
        const response = await clients.sms.post(
            '/api/v1/campaigns/launch',
            payload,
            withContext(req, { Authorization: `Bearer ${req.token}` }, payload)
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'campaignService.launch');
    }
};

const createGroup = async (groupData, req) => {
    try {
        const response = await clients.sms.post(
            '/api/v1/contact/group/update',
            groupData,
            withContext(req, { Authorization: `Bearer ${req.token}` })
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'addressBookService.createGroup');
    }
};

const addContacts = async (payload, req) => {
    try {
        const response = await clients.sms.post(
            '/api/v1/contact/create',
            payload,
            withContext(req, { Authorization: `Bearer ${req.token}` })
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'addressBookService.addContacts');
    }
};

// ============================================================================
// Notification Stubs
// ============================================================================

// Notifications — Go side handles admin vs client differentiation
const getNotifications = (req, params = {}) =>
    goGet(req.token, '/notifications', { params });

const markNotificationRead = (req, id) =>
    goPatch(req.token, `/notifications/${id}/read`);

const markAllNotificationsRead = (req) =>
    goPatch(req.token, '/notifications/read-all');



// =============================================================================
// EXPORTS
// =============================================================================
module.exports = {
    // Identity
    requestOtp,    verifyOtp,
    getAllClients,
    getUsers, createUser,
    getRoles, createRole, deleteRole,
    getRolePermissions, assignRolePermissions,
    listAvailablePermissions, 
    getDeveloperSettings,

    // Billing
    getClientBalance,
    getWalletHistory,
    getWalletData,

    // SMS / Campaigns
    getDashboardStats,
    getRecentCampaigns, startBulkCampaign, startCampaign, launchCampaign,
    getContactGroups, createContactGroup, createGroup, addContacts,
    getSenderIds,
    getTemplates,
    
    // Notification
    markAllNotificationsRead,markNotificationRead,
    getNotifications,


    // Direct client access (if needed by other modules)
    clients,
};