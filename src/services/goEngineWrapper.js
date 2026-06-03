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

    client.interceptors.request.use(reqConfig => {
        console.log(`[${serviceName.toUpperCase()} Outgoing] ${reqConfig.method.toUpperCase()} -> ${client.getUri(reqConfig)}`);
        return reqConfig;
    });

    return client;
};

const clients = {
    identity: createServiceClient('identity'),
    billing:  createServiceClient('billing'),
    sms:      createServiceClient('sms'),
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
 * HMAC-SHA256 signs a payload using the shared internal service secret.
 * The Go middleware recomputes this and rejects any request where it doesn't match.
 * Cost: <1ms even for large payloads — negligible.
 */
const signPayload = (body = '') => {
  if (typeof body !== 'string') {
    throw new TypeError('HMAC body must be a string');
  }

  if (!process.env.INTERNAL_SERVICE_TOKEN) {
    throw new Error('INTERNAL_SERVICE_TOKEN missing');
  }

  return crypto
    .createHmac('sha256', process.env.INTERNAL_SERVICE_TOKEN)
    .update(body)
    .digest('hex');
};

const withContext = (req, extraHeaders = {}, payload = null) => {
  let body = '';

  try {
    body = payload ? JSON.stringify(payload) : '';
  } catch (err) {
    throw new Error(`Failed to serialize request payload for HMAC signing: ${err.message}`);
  }

  const signature = signPayload(body);

  if (!signature) {
    throw new Error('Failed to generate HMAC signature');
  }

  const headers = {
    'X-Signature': signature,
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
/**
 * Builds the header block for every internal service call.
 *
 * @param {object} req         - Express request object (for IP extraction)
 * @param {object} extraHeaders - e.g. { Authorization: 'Bearer <jwt>' }
 * @param {object|null} payload - Request body being sent, used for HMAC signing.
 *                                Pass null for GET requests (signs an empty object).
 *
 * Security model:
 *   X-Signature  → proves this request originated from our dashboard (not a random caller)
 *   X-Real-IP    → forwarded original client IP for audit logging in Go
 *   Authorization → user JWT, forwarded only on user-context routes
 */

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
        console.error(`[Engine Error - ${context}]:`, error.response.data);
        throw new Error(error.response.data?.error || 'The engine rejected the request.');
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
//
// Signature pattern:
//   - Service-only calls  → (args, req)              — no JWT, signed only
//   - User-context calls  → (token, args..., req)    — JWT forwarded + signed
//
// Every call passes req so IP and signature are always forwarded.
// =============================================================================

// ----------------------------------------------------------------------------
// IDENTITY SERVICE
// ----------------------------------------------------------------------------

/**
 * Login — no user context yet, but still signed to prove caller is our dashboard.
 */
const requestOtp = async (msisdn, password, req) => {
    console.log('[Engine] requestOTP stage');
    const payload = { msisdn, password };
    try {
        const response = await clients.identity.post(
            '/api/v1/login',
            payload,
            withContext(req, {}, payload),
        );
        return response.data;
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
            if (!req.token) {
                throw new Error('Missing JWT token on request context');
            }
    
        const response = await clients.identity.post(
            '/api/v1/users',
            payload,
            withContext(req, {
                Authorization: `Bearer ${token}`,
            }, payload),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'verifyOtp');
    }
};

const getAllClients = async (req) => {
    try {
        const token = getJWT(req); 
        
        if (!token) {
            throw new Error('Missing JWT token on request context');
        }

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
        if (!req.token) {
            throw new Error('Missing JWT token on request context');
        }

        const response = await clients.identity.get(
            '/api/v1/roles',
            withContext(req, {
                Authorization: `Bearer ${token}`,
            }),
        );

        return response.data;
    } catch (error) {
        handleEngineError(error, 'getRoles');
    }
};

const listAvailablePermissions = async (req) => {
    try {
        const token = getJWT(req);
        if (!req.token) {
            throw new Error('Missing JWT token on request context');
        }

        const response = await clients.identity.get(
            '/api/v1/roles/permissions',
            withContext(req, {
                Authorization: `Bearer ${token}`,
            }),
        );

        return response.data;
    } catch (error) {
        handleEngineError(error, 'getRoles');
    }
};

const getRolePermissions = async (req, roleId) => {
    try {
        const response = await clients.identity.get(
            `/api/v1/roles/${roleId}/permissions`,
            withContext(req, {
                Authorization: `Bearer ${req.token}`,
            }),
        );
        return response.data;
    } catch (error) {
        console.error(`Error fetching permissions for role ${roleId} from Go Engine:`, error.message);
        throw error;
    }
};

const createRole = async (req) => {
     try {
    const token = getJWT(req);
        if (!req.token) {
            throw new Error('Missing JWT token on request context');
        }
    const payload = req.body;
   
        const response = await clients.identity.post(
            '/api/v1/roles',
            payload,
            withContext(req, {
                Authorization: `Bearer ${token}`,
            }, payload),
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

// ----------------------------------------------------------------------------
// BILLING SERVICE
// ----------------------------------------------------------------------------

/**
 * Service-only call — no JWT needed, signature is sufficient proof of origin.
 */
const getClientBalance = async (req) => {
    clientId = req.user.id
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
            `/api/v1/wallet/history/${targetClientId}`,
            withContext(req, { Authorization: `Bearer ${req.token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getWalletHistory');
    }
};

// WIP: Replace mock with real billing call
const getWalletData = async (req) => {

    const clientId = req.user.clientId;

    console.log(`[Wrapper WIP] Returning mock wallet data for client ${clientId}`);
    return {
        balance: 4500.50,
        currency: 'USD',
        transactions: [
            { id: 'TX-9942', date: '2026-05-24', type: 'Credit', amount: 1000.00,  description: 'Stripe Top-Up',       status: 'Completed'  },
            { id: 'TX-9941', date: '2026-05-22', type: 'Debit',  amount: -45.50,   description: 'Campaign: Q4 Promo',  status: 'Completed'  },
            { id: 'TX-9940', date: '2026-05-20', type: 'Debit',  amount: -12.00,   description: 'Campaign: Test Run',  status: 'Completed'  },
            { id: 'TX-9939', date: '2026-05-18', type: 'Credit', amount: 500.00,   description: 'Bank Transfer',       status: 'Processing' },
        ],
    };
};

// ----------------------------------------------------------------------------
// SMS / CAMPAIGN SERVICE
// ----------------------------------------------------------------------------

// WIP: Replace mock with real SMS engine call
const getDashboardStats = async ( req) => {
    console.log('[Wrapper WIP] Returning mock dashboard stats...');
    return {
        summary:         { totalSent: 1250, pending: 25, failed: 3, balance: 4500.50 },
        recentCampaigns: [
            { id: 1, name: 'Q4 Promo',   status: 'Completed',  sent: 500 },
            { id: 2, name: 'Easter Sale', status: 'Processing', sent: 120 },
        ],
    };
};

const getRecentCampaigns = async ( req, options = { limit: 5 }) => {
    clientId = req.user.id
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

const getContactGroups = async ( req) => {
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

const createContactGroup = async ( groupData, req) => {
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
const getTemplates = async (req) => {
    clientId = req.user.id
    console.log(`[Wrapper WIP] Returning mock templates for client ${clientId}`);
    return [
        { id: 'TPL-001', name: 'Payment Reminder', content: 'Dear [Name], your bill of [Amount] is due on [Date].', status: 'Approved' },
        { id: 'TPL-002', name: 'OTP Verification',  content: 'Your verification code is [Code]. Do not share this.', status: 'Approved' },
        { id: 'TPL-003', name: 'Marketing Promo',   content: 'Flash Sale! Get 20% off using code [PromoCode].',      status: 'Pending'   },
    ];
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

// =============================================================================
// EXPORTS
// =============================================================================
module.exports = {
    // Identity
    requestOtp,
    verifyOtp,
    getAllClients,
    getUsers,
    getRoles,
    getRolePermissions,
    listAvailablePermissions,
    createRole,
    createUser,
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
    getTemplates,
    startCampaign,

    // Direct client access (if needed by other modules)
    clients,
};