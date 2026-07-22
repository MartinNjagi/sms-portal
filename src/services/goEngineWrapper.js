// src/services/goEngineWrapper.js
const axios  = require('axios');
const crypto = require('crypto');

// =============================================================================
// 1. SERVICE REGISTRY
// =============================================================================
const services = {
    identity: { baseURL: process.env.IDENTITY_SERVICE_URL || 'http://localhost:4848' },
    wallet:  { baseURL: process.env.WALLET_SERVICE_URL  || 'http://localhost:4849' },
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
    wallet:  createServiceClient('wallet'),
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
 * HMAC-SHA256 signs timestamp+nonce+body, matching Go's VerifySignature middleware.
 * Format: "<unix_seconds>.<nonce>.<body>" — both sides must agree on this exactly.
 */
const signPayload = (body, timestamp, nonce) => {
    const secret = process.env.INTERNAL_SERVICE_TOKEN;
    
    // Format must match Go exactly: timestamp.nonce.body
    const dataToSign = `${timestamp}.${nonce}.${body}`;
    
    return crypto.createHmac('sha256', secret).update(dataToSign).digest('hex');
};

const withContext = (req, extraHeaders = {}, payload = null) => {
    let body = '';
    try {
        body = payload ? JSON.stringify(payload) : '';
    } catch (err) {
        throw new Error(`Failed to serialize request payload: ${err.message}`);
    }

    // 1. Clean, accurate timestamp (No offsets!)
    const timestamp = Math.floor(Date.now() / 1000).toString();
    
    // 2. Generate a secure, unique Nonce
    const nonce = crypto.randomUUID();

    // 3. Generate Signature
    const signature = signPayload(body, timestamp, nonce);

    if (!signature) {
        throw new Error('Failed to generate HMAC signature');
    }

    const headers = {
        'X-Signature': signature,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce, // Send the nonce to Go!
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
            '/api/v1/login/send',
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
            '/api/v1/login/verify',
            payload,
            withContext(req, {}, payload),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'verifyOtp');
    }
};

// ----------------------------------------------------------------------------
// PASSWORD RESET FLOW
// ----------------------------------------------------------------------------

const forgotPasswordSend = async (msisdn, req) => {
    const payload = { msisdn };
    try {
        const response = await clients.identity.post(
            '/api/v1/password/forgot/send', // Update with your exact Go route
            payload,
            withContext(req, {}, payload)
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'forgotPasswordSend');
    }
};

const forgotPasswordVerify = async (msisdn, code, req) => {
    const payload = { msisdn, code };
    try {
        const response = await clients.identity.post(
            '/api/v1/password/forgot/verify', 
            payload,
            withContext(req, {}, payload)
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'forgotPasswordVerify');
    }
};

const resetPassword = async (msisdn, resetToken, newPassword, req) => {
    const payload = { 
        msisdn, 
        reset_token: resetToken, 
        new_password: newPassword 
    };
    try {
        const response = await clients.identity.post(
            '/api/v1/password/reset',
            payload,
            withContext(req, {}, payload)
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'resetPassword');
    }
};


const getClient = async (req, clientId) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token');

        const response = await clients.identity.get(
            `/api/v1/clients/${clientId}`, // Ensure this matches your Go router
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { 
        handleEngineError(error, 'getClient'); 
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

const createClient = async (payload, req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        const rawBodyString = JSON.stringify(payload);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = signPayload(rawBodyString, timestamp, nonce);

        const response = await clients.identity.post(
            '/api/v1/clients',
            rawBodyString,
            {
                headers: {
                    'X-Signature': signature,
                    'X-Timestamp': timestamp,
                    'X-Nonce': nonce,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'createClient'); }
};

const updateClient = async (id, payload, req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        const rawBodyString = JSON.stringify(payload);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = signPayload(rawBodyString, timestamp, nonce);

        const response = await clients.identity.put(
            `/api/v1/clients/${id}`,
            rawBodyString,
            {
                headers: {
                    'X-Signature': signature,
                    'X-Timestamp': timestamp,
                    'X-Nonce': nonce,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'updateClient'); }
};

const updateClientStatus = async (targetClientId, status, req) => {
    try {
        const payload = { status };
        const response = await clients.identity.patch(
            `/api/v1/clients/${targetClientId}/status`,
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'updateClientStatus'); }
};

const suspendClient = async (targetClientId, req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        const response = await clients.identity.post(
            `/api/v1/clients/${targetClientId}/suspend`,
            null, 
            withContext(req, { Authorization: `Bearer ${token}` }, null)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'suspendClient'); }
};

const reinstateClient = async (targetClientId, req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        const response = await clients.identity.post(
            `/api/v1/clients/${targetClientId}/reinstate`,
            null, 
            withContext(req, { Authorization: `Bearer ${token}` }, null)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'reinstateClient'); }
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

// --- USER MANAGEMENT WRAPPERS ---

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

const getUser = async (req, userId) => {
    try {
        const response = await clients.identity.get(
            `/api/v1/users/${userId}`,
            withContext(req, { Authorization: `Bearer ${req.token}` })
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getUser');
    }
};

const createUser = async (req) => {
    try {
        const response = await clients.identity.post(
            `/api/v1/users`,
            req.body,
            withContext(req, { Authorization: `Bearer ${req.token}` })
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'createUser');
    }
};

const updateUser = async (req, userId) => {
    try {
        const response = await clients.identity.put(
            `/api/v1/users/${userId}`,
            req.body,
            withContext(req, { Authorization: `Bearer ${req.token}` })
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'updateUser');
    }
};

const deleteUser = async (req, userId) => {
    try {
        const response = await clients.identity.delete(
            `/api/v1/users/${userId}`,
            withContext(req, { Authorization: `Bearer ${req.token}` })
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'deleteUser');
    }
};

const assignRole = async (req, userId) => {
    try {
        const response = await clients.identity.put(
            `/api/v1/users/${userId}/role`,
            req.body,
            withContext(req, { Authorization: `Bearer ${req.token}` })
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'assignRole');
    }
};

const getAPIKeys = async (req, clientId = null) => {
    try {
        const url = clientId ? `/api/v1/api-keys?client_id=${clientId}` : '/api/v1/api-keys';
        const response = await clients.identity.get(
            url,
            withContext(req, { Authorization: `Bearer ${req.token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getAPIKeys');
    }
};

const generateAPIKey = async (payload, targetClientId = null, req) => {
    try {
        let url = '/api/v1/keys';
        if (targetClientId) url += `?client_id=${targetClientId}`;

        const response = await clients.identity.post(
            url,
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'generateAPIKey'); }
};

const revokeAPIKey = async (keyId, targetClientId = null, req) => {
    try {
        let url = `/api/v1/keys/${keyId}`;
        if (targetClientId) url += `?client_id=${targetClientId}`;

        const response = await clients.identity.delete(
            url,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'revokeAPIKey'); }
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

// ─── PASSKEYS (WEBAUTHN) ───────────────────────────────────────────────────

const passkeyLoginBegin = async (msisdn, req) => {
    try {
        const payload = { msisdn: msisdn || "" };
        const rawBodyString = JSON.stringify(payload);

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = signPayload(rawBodyString, timestamp, nonce);

        const response = await clients.identity.post(
            '/api/v1/passkey/login/begin',
            rawBodyString,
            {
                headers: {
                    'X-Signature': signature,
                    'X-Timestamp': timestamp,
                    'X-Nonce': nonce,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'passkeyLoginBegin'); }
};

const passkeyLoginFinish = async (payload, req) => {
    try {
        const rawBodyString = JSON.stringify(payload);

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = signPayload(rawBodyString, timestamp, nonce);

        const response = await clients.identity.post(
            '/api/v1/passkey/login/finish',
            rawBodyString,
            {
                headers: {
                    'X-Signature': signature,
                    'X-Timestamp': timestamp,
                    'X-Nonce': nonce,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'passkeyLoginFinish'); }
};

const passkeyRegisterBegin = async (req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        // Your clever workaround: Force a predictable JSON object
        const payload = { msisdn: "" }; 
        const rawBodyString = JSON.stringify(payload);

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = signPayload(rawBodyString, timestamp, nonce);

        const response = await clients.identity.post(
            '/api/v1/passkey/register/begin',
            rawBodyString,
            {
                headers: {
                    'X-Signature': signature,
                    'X-Timestamp': timestamp,
                    'X-Nonce': nonce,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'passkeyRegisterBegin');
    }
};

const passkeyRegisterFinish = async (payload, req) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        // FIX FOR DEEP NESTED WEBAUTHN OBJECTS:
        // We stringify the payload exactly once. We sign this exact string, 
        // and we send this exact string. This prevents Axios or Go from 
        // reordering the JSON keys and breaking the HMAC signature.
        const rawBodyString = JSON.stringify(payload);

        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto.randomUUID();
        const signature = signPayload(rawBodyString, timestamp, nonce);

        const headers = {
            'X-Signature': signature,
            'X-Timestamp': timestamp,
            'X-Nonce': nonce,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const response = await clients.identity.post(
            '/api/v1/passkey/register/finish',
            rawBodyString, 
            { headers }
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'passkeyRegisterFinish');
    }
};

const getPasskeys = async (req, clientId = null) => {
    try {
        const url = clientId ? `/api/v1/passkey?client_id=${clientId}` : '/api/v1/passkey';
        const response = await clients.identity.get(
            url,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'getPasskeys'); }
};

const deletePasskey = async (id, req) => {
    try {
        const response = await clients.identity.delete(
            `/api/v1/passkey/${id}`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'deletePasskey'); }
};


// ----------------------------------------------------------------------------
// WALLET SERVICE
// ----------------------------------------------------------------------------

// --- WALLET / BILLING SERVICE ---

const getClientBalance = async (req, targetClientId = null) => {
    try {
        const token = getJWT(req);
        let url = '/api/v1/wallet/balance';
        
        // Append query param if performing an Admin lookup
        if (targetClientId) url += `?client_id=${targetClientId}`;

        const response = await clients.wallet.get(
            url,
            withContext(req, { Authorization: `Bearer ${token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getClientBalance');
    }
};

const getWalletHistory = async (req, targetClientId = null, page = 1, pageSize = 10) => {
    try {
        const token = getJWT(req);
        
        // Use the proper Go route and support pagination
        let url = `/api/v1/wallet/ledger?page=${page}&pageSize=${pageSize}`;
        
        // Append query param if performing an Admin lookup
        if (targetClientId) url += `&client_id=${targetClientId}`;

        const response = await clients.wallet.get(
            url,
            withContext(req, { Authorization: `Bearer ${token}` }),
        );
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getWalletHistory');
    }
};

const getWalletData = async (req, targetClientId = null) => {
    try {
        const token = getJWT(req);
        if (!token) throw new Error('Missing JWT token on request context');

        let balanceUrl = '/api/v1/wallet/balance';
        let ledgerUrl = '/api/v1/wallet/ledger';

        if (targetClientId) {
            balanceUrl += `?client_id=${targetClientId}`;
            ledgerUrl += `?client_id=${targetClientId}`;
        }

        // Fetch balance and ledger history concurrently
        const [balanceRes, ledgerRes] = await Promise.all([
            clients.wallet.get(balanceUrl, withContext(req, { Authorization: `Bearer ${token}` })),
            clients.wallet.get(ledgerUrl, withContext(req, { Authorization: `Bearer ${token}` }))
        ]);

        return {
            status: 200,
            message: "Wallet data retrieved successfully",
            data: {
                // Handle Go's JSON shape (GetBalance doesn't wrap in "data", ListLedger does)
                balance: balanceRes.data?.balance ?? 0, 
                currency: balanceRes.data?.currency ?? 'KES',
                payment_ref: balanceRes.data?.payment_ref ?? 'PENDING',
                transactions: ledgerRes.data?.data || [],
                pagination: ledgerRes.data?.pagination || null
            }
        };
    } catch (error) {
        handleEngineError(error, 'getWalletData');
    }
};

const manualWalletAdjustment = async (payload, req) => {
    try {
        const response = await clients.wallet.post(
            '/api/v1/admin/wallet/adjust', // Check your Go router for the exact path!
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'manualWalletAdjustment'); }
};

const getClientBillingConfig = async (targetClientId, req) => {
    try {
        const response = await clients.wallet.get(
            `/api/v1/admin/wallet/config/${targetClientId}`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'getClientBillingConfig'); }
};

const updateBillingConfig = async (targetClientId, payload, req) => {
    try {
        const response = await clients.wallet.put(
            `/api/v1/wallet/config/${targetClientId}`, // Check your Go router for the exact path!
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'updateBillingConfig'); }
};


const initiateMpesaTopUp = async (payload, req) => {
    try {
        const response = await clients.wallet.post(
            '/api/v1/wallet/topup',
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'initiateMpesaTopUp'); }
};

const initiateCardTopUp = async (payload, req) => {
    try {
        const response = await clients.wallet.post(
            '/api/v1/wallet/stripe-topup',
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'initiateCardTopUp'); }
};

const submitBankTransfer = async (payload, req) => {
    try {
        const response = await clients.wallet.post(
            '/api/v1/wallet/bank-transfer',
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'submitBankTransfer'); }
};

const approveBankTransfer = async (id, payload, req) => {
    try {
        const response = await clients.wallet.post(
            `/api/v1/admin/wallet/bank-transfer/${id}/approve`,
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'approveBankTransfer'); }
};
const getBankTransfers = async (req, status = '') => {
    try {
        const response = await clients.wallet.get(
            `/api/v1/admin/wallet/bank-transfers?status=${status}`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data; // returns the APIResponse object containing Data and Pagination
    } catch (error) { 
        handleEngineError(error, 'getBankTransfers'); 
    }
};
// ----------------------------------------------------------------------------
// SMS / CAMPAIGN SERVICE
// ----------------------------------------------------------------------------

// --- CAMPAIGN MANAGEMENT ---

const listCampaigns = async (req, page = 1, limit = 10) => {
    try {
        const response = await clients.sms.get(
            `/api/v1/campaigns?page=${page}&page_size=${limit}`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'listCampaigns'); }
};

const launchBulkCampaign = async (payload, req) => {
    try {
        const response = await clients.sms.post(
            '/api/v1/campaigns/launch',
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'launchBulkCampaign'); }
};

const scheduleCampaign = async (payload, req) => {
    try {
        const response = await clients.sms.post(
            '/api/v1/campaigns/schedule',
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'scheduleCampaign'); }
};

const editCampaign = async (id, payload, req) => {
    try {
        const response = await clients.sms.patch(
            `/api/v1/campaigns/${id}`,
            payload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'editCampaign'); }
};

const deleteCampaign = async (id, req) => {
    try {
        const response = await clients.sms.delete(
            `/api/v1/campaigns/${id}`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'deleteCampaign'); }
};

const triggerScheduledCampaign = async (id, req) => {
    try {
        // Based on your Go controller: TriggerProcessing handles POST /api/v1/campaigns/:id
        const response = await clients.sms.post(
            `/api/v1/campaigns/${id}`, 
            {}, 
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'triggerScheduledCampaign'); }
};

const getCampaignStats = async (id, req) => {
    try {
        const response = await clients.sms.get(
            `/api/v1/campaigns/${id}/stats`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'getCampaignStats'); }
};

// Single SMS sending
const sendSingleSMS = async (payload, req) => {
    try {
        // 1. Determine the correct Go Engine endpoint
        const endpoint = payload.priority === 'priority' 
            ? '/api/v1/sms/priority' 
            : '/api/v1/sms/send';

        // 2. Clone payload and strip the 'priority' flag so Go doesn't reject unknown JSON fields
        const goPayload = { ...payload };
        delete goPayload.priority;

        // 3. Dispatch to the selected endpoint
        const response = await clients.sms.post(
            endpoint,
            goPayload,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` }, goPayload)
        );
        return response.data;
    } catch (error) { 
        handleEngineError(error, 'sendSingleSMS'); 
    }
};

// --- CONTACTS & ADDRESS BOOK ---

const getContactGroups = async (req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.get(
            '/api/v1/contacts/groups',
            withContext(req, { Authorization: `Bearer ${token}` }),
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'getContactGroups'); }
};

const createContactGroup = async (groupData, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.post(
            '/api/v1/contacts/groups',
            groupData,
            withContext(req, { Authorization: `Bearer ${token}` }, groupData),
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'createContactGroup'); }
};

const updateContactGroup = async (groupId, groupData, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.put(
            `/api/v1/contacts/groups/${groupId}`,
            groupData,
            withContext(req, { Authorization: `Bearer ${token}` }, groupData)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'updateContactGroup'); }
};

const deleteContactGroup = async (groupId, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.delete(
            `/api/v1/contacts/groups/${groupId}`,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'deleteContactGroup'); }
};

const getContactsByGroup = async (groupId, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.get(
            `/api/v1/contacts/groups/${groupId}/contacts`,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'getContactsByGroup'); }
};

const listContacts = async (req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.get(
            '/api/v1/contacts',
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'listContacts'); }
};

const addContacts = async (payload, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.post(
            '/api/v1/contacts/create', 
            payload, 
            withContext(req, { Authorization: `Bearer ${token}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'addContacts'); }
};

const updateGroupContacts = async (payload, req) => {
    try {
        const token = getJWT(req);
        const { id, contacts } = payload;
        const response = await clients.sms.put(
            `/api/v1/contacts/group/${id}`,
            { contacts },
            withContext(req, { Authorization: `Bearer ${token}` }, { contacts })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'updateGroupContacts'); }
};

const uploadContactsCSV = async (payload, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.post(
            '/api/v1/contacts/upload-csv',
            payload, // { GroupID: int, FileURL: "string" }
            withContext(req, { Authorization: `Bearer ${token}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'uploadContactsCSV'); }
};

const updateContact = async (phoneId, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.put(
            `/api/v1/contacts/${phoneId}`,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'deleteContact'); }
};

const deleteContact = async (phoneId, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.delete(
            `/api/v1/contacts/${phoneId}`,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'deleteContact'); }
};

// --- SENDER IDS ---
const getSenderIds = async (req, clientId = null) => {
    try {
        const token = getJWT(req);
        const url = clientId ? `/api/v1/settings/sender-ids?client_id=${clientId}` : '/api/v1/settings/sender-ids';
        const response = await clients.sms.get(
            url,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'getSenderIds'); }
};

const createSenderId = async (payload, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.post(
            '/api/v1/settings/sender-ids',
            payload,
            withContext(req, { Authorization: `Bearer ${token}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'createSenderId'); }
};

const deleteSenderId = async (id, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.delete(
            `/api/v1/settings/sender-ids/${id}`,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'deleteSenderId'); }
};

const approveSenderId = async (id, payload, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.put(
            `/api/v1/admin/sender-ids/${id}/approve`,
            payload, // e.g., { status: 'approved' } or { status: 'rejected', reason: '...' }
            withContext(req, { Authorization: `Bearer ${token}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'approveSenderId'); }
};


// --- TEMPLATES ---

const getTemplates = async (req, clientId = null) => {
    try {
        const token = getJWT(req);
        const url = clientId ? `/api/v1/settings/templates?client_id=${clientId}` : '/api/v1/settings/templates';
        if (!token) throw new Error('Missing JWT token on request context');

        const response = await clients.sms.get(
            url,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        
        return response.data;
    } catch (error) {
        handleEngineError(error, 'getTemplates');
    }
};

const createTemplate = async (payload, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.post(
            '/api/v1/settings/templates',
            payload,
            withContext(req, { Authorization: `Bearer ${token}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'createTemplate'); }
};

const updateTemplate = async (id, payload, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.put(
            `/api/v1/settings/templates/${id}`,
            payload,
            withContext(req, { Authorization: `Bearer ${token}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'updateTemplate'); }
};

const deleteTemplate = async (id, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.delete(
            `/api/v1/settings/templates/${id}`,
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'deleteTemplate'); }
};

const approveTemplate = async (id, payload, req) => {
    try {
        const token = getJWT(req);
        const response = await clients.sms.put(
            `/api/v1/admin/templates/${id}/approve`,
            payload,
            withContext(req, { Authorization: `Bearer ${token}` }, payload)
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'approveTemplate'); }
};


const getUnifiedOutbox = async (req, page = 1, limit = 50) => {
    try {
        const response = await clients.sms.get(
            `/api/v1/admin/outbox?page=${page}&page_size=${limit}`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { 
        handleEngineError(error, 'getUnifiedOutbox'); 
    }
};


const getDashboardAnalytics = async (req, startDate,endDate) => {
    try {
        const response = await clients.sms.get(
            `/api/v1/analytics?start_date=${startDate}&end_date=${endDate}`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) {
        console.error('Error fetching analytics from Go engine:', error);
        throw error; // Or return fallback empty data
    }
};
// ============================================================================
// Notification Stubs
// ============================================================================

// Notifications — Go side handles admin vs client differentiation
// Find this inside src/services/goEngineWrapper.js
const getNotifications = async (req) => {
    try {
        const token = getJWT(req);
        // Replace the old goGet() call with the proper Axios client.
        // (Assuming notifications are handled by the identity or sms service)
        const response = await clients.websocket.get(
            '/notifications', 
            withContext(req, { Authorization: `Bearer ${token}` })
        );
        return response.data;
    } catch (error) { 
        handleEngineError(error, 'getNotifications'); 
    }
};

const markNotificationRead = async (id, req) => {
    try {
        const response = await clients.websocket.patch(
            `/notifications/${id}/read`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'markNotificationRead'); }
};
const markAllNotificationsRead = async (req) => {
    try {
        const response = await clients.websocket.patch(
            `/notifications/read-all`,
            withContext(req, { Authorization: `Bearer ${getJWT(req)}` })
        );
        return response.data;
    } catch (error) { handleEngineError(error, 'markAllNotificationsRead'); }
};


// =============================================================================
// EXPORTS
// =============================================================================
module.exports = {
    // Identity
    requestOtp,    verifyOtp,
    forgotPasswordSend, forgotPasswordVerify, resetPassword,
    getAllClients,createClient,updateClient,getClient,
    reinstateClient,suspendClient,
    getUsers,getUser,
    createUser,updateUser,deleteUser,
    assignRole,
    getRoles, createRole, deleteRole,
    getRolePermissions, assignRolePermissions,
    listAvailablePermissions, 
    getAPIKeys,
    passkeyLoginBegin,
    passkeyLoginFinish,
    passkeyRegisterBegin,
    passkeyRegisterFinish,
    getPasskeys, deletePasskey,


    // wallet
    getClientBalance,
    getWalletHistory,
    getWalletData,
    manualWalletAdjustment,
    getClientBillingConfig,updateBillingConfig,
    initiateCardTopUp, initiateMpesaTopUp,
    submitBankTransfer, approveBankTransfer,getBankTransfers,

    // SMS / Campaigns
    
    listCampaigns, getCampaignStats, launchBulkCampaign,deleteCampaign,
    scheduleCampaign,triggerScheduledCampaign,editCampaign,
    sendSingleSMS,
    getSenderIds,createSenderId,deleteSenderId,approveSenderId,
    getTemplates,createTemplate,updateTemplate,deleteTemplate,approveTemplate,
    getContactGroups,createContactGroup,updateContactGroup,deleteContactGroup,
    getContactsByGroup,listContacts,addContacts,updateContact,deleteContact,
    updateGroupContacts,
    getUnifiedOutbox,
    getDashboardAnalytics,
    // Notification
    markAllNotificationsRead,markNotificationRead,
    getNotifications,


    // Direct client access (if needed by other modules)
    clients,
};