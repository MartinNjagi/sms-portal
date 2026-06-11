// src/modules/settings/settings.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const settingsController = {};

// --- VIEWS ---

settingsController.renderSettingsPage = async (req, res, next) => {
    try {

        const targetClientId = (req.user.role === 'ADMIN' && req.query.client_id) 
        ? req.query.client_id 
        : null; // Or undefined, depending on your wrapper signature

        // Fetch sender IDs and dev settings concurrently
        const [senderIdsResponse, apiKeysResponse,templatesResponse] = await Promise.all([
            goEngineWrapper.getSenderIds(req,targetClientId).catch(() => ({ data: [] })), // Graceful fallback
            goEngineWrapper.getAPIKeys(req).catch(() => ({ data: {} })),
            goEngineWrapper.getTemplates(req,targetClientId).catch(() => ({ data: {} }))
        ]);

        res.render('settings/index.njk', {
            title: 'Account Settings',
            alias: 'settings',
            senderIds: senderIdsResponse.data,
            apiKeys: apiKeysResponse.data,
            templates:templatesResponse.data,
            user: req.user 
        });
    } catch (error) {
        next(error);
    }
};

// API controller
settingsController.manualWalletAdjustment = async (req, res) => {
    try {
        await goEngineWrapper.manualWalletAdjustment(req.body, req);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

settingsController.updateBillingConfig = async (req, res) => {
    try {
        await goEngineWrapper.updateBillingConfig(req.params.id, req.body, req);
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



module.exports = settingsController;