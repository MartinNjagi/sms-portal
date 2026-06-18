const goEngineWrapper = require('../../services/goEngineWrapper');

const settingsController = {};

// ==========================================
// 1. VIEWS
// ==========================================

settingsController.renderSettingsPage = async (req, res, next) => {
    try {
        // Enforce Admin Override Scope
        const targetClientId = (req.user.role === 'ADMIN' && req.query.client_id) 
            ? req.query.client_id 
            : null;

        // Fetch all context concurrently, scoped to the target client if specified
        const [
            apiKeysResponse,
            clientResponse,
            billingConfigResponse
        ] = await Promise.all([
            goEngineWrapper.getAPIKeys(req, targetClientId).catch(() => ({ data: [] })),
            goEngineWrapper.getAllClients(req).catch(() => ({ data: [] })), // Global list for the switcher
            // If viewing a specific client, fetch their custom billing config
            targetClientId 
                ? goEngineWrapper.getClientBillingConfig(targetClientId, req).catch(() => ({ data: {} }))
                : Promise.resolve({ data: {} }) 
        ]);

        res.render('settings/index.njk', {
            title: 'Account & Billing Settings',
            alias: 'settings',
            user: req.user,
            targetClientId: targetClientId, // Let the frontend know we are in override mode
            clients: clientResponse.data,
            apiKeys: apiKeysResponse.data,
            billingConfig: billingConfigResponse.data
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 2. ADMIN WALLET & BILLING ACTIONS
// ==========================================

settingsController.manualWalletAdjustment = async (req, res) => {
    try {
        await goEngineWrapper.manualWalletAdjustment(req.body, req);
        res.status(200).json({ success: true, message: 'Wallet adjusted successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

settingsController.updateBillingConfig = async (req, res) => {
    try {
        const targetClientId = req.params.id;
        await goEngineWrapper.updateBillingConfig(targetClientId, req.body, req);
        res.status(200).json({ success: true, message: 'Billing config updated.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// 3. API KEY MANAGEMENT
// ==========================================

settingsController.generateAPIKey = async (req, res) => {
    try {
        // Allow Admin to generate keys for a specific client, fallback to self
        const targetClientId = (req.user.role === 'ADMIN' && req.body.client_id) 
            ? req.body.client_id 
            : null;

        const result = await goEngineWrapper.generateAPIKey(req.body, targetClientId, req);
        res.status(201).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

settingsController.revokeAPIKey = async (req, res) => {
    try {
        const keyId = req.params.id;
        const targetClientId = (req.user.role === 'ADMIN' && req.body.client_id) 
            ? req.body.client_id 
            : null;

        await goEngineWrapper.revokeAPIKey(keyId, targetClientId, req);
        res.status(200).json({ success: true, message: 'API Key revoked.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ==========================================
// 4. CLIENT MANAGEMENT (ADMIN ONLY)
// ==========================================

settingsController.updateClientStatus = async (req, res) => {
    try {
        const targetClientId = req.params.id;
        const { status } = req.body; // e.g., 'ACTIVE', 'SUSPENDED'
        
        await goEngineWrapper.updateClientStatus(targetClientId, status, req);
        res.status(200).json({ success: true, message: `Client status updated to ${status}.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


settingsController.updateMyWebhook = async (req, res) => {
    try {
        const payload = { webhook_url: req.body.webhook_url };
        // Safely force the target to be the logged-in user's own client ID
        await goEngineWrapper.updateBillingConfig(req.user.client_id, payload, req);
        res.status(200).json({ success: true, message: 'Webhook updated.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports = settingsController;