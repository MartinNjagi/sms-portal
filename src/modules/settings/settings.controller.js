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

        res.render('configuration/index.njk', {
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

// --- SENDER ID API ACTIONS ---

settingsController.requestSenderId = async (req, res, next) => {
    try {
        const { senderId, justification } = req.body;
        
        if (!senderId || senderId.length > 11) {
            return res.status(400).json({ error: 'Sender ID must be between 1 and 11 characters.' });
        }

        const goPayload = {
            sender_id: senderId,        // Change this if your Go struct expects "SenderID"
            justification: justification // Change this if your Go struct expects "Justification"
        };

        const result = await goEngineWrapper.createSenderId(goPayload, req);        res.status(201).json({ success: true, message: 'Sender ID requested successfully. Pending approval.', data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

settingsController.deleteSenderId = async (req, res, next) => {
    try {
        await goEngineWrapper.deleteSenderId(req.params.id, req);
        res.status(200).json({ success: true, message: 'Sender ID deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- TEMPLATE API ACTIONS ---

settingsController.createTemplate = async (req, res, next) => {
    try {
        const result = await goEngineWrapper.createTemplate(req.body, req);
        res.status(201).json({ success: true, message: 'Template created successfully.', data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

settingsController.updateTemplate = async (req, res, next) => {
    try {
        const result = await goEngineWrapper.updateTemplate(req.params.id, req.body, req);
        res.status(200).json({ success: true, message: 'Template updated successfully.', data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

settingsController.deleteTemplate = async (req, res, next) => {
    try {
        await goEngineWrapper.deleteTemplate(req.params.id, req);
        res.status(200).json({ success: true, message: 'Template deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- ADMIN APPROVAL ACTIONS ---

settingsController.adminApproveSenderId = async (req, res, next) => {
    try {
        const { status, reason } = req.body; // e.g., 'approved' or 'rejected'
        const result = await goEngineWrapper.approveSenderId(req.params.id, { status, reason }, req);
        res.status(200).json({ success: true, message: `Sender ID ${status}.`, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

settingsController.adminApproveTemplate = async (req, res, next) => {
    try {
        const { status, reason } = req.body; 
        const result = await goEngineWrapper.approveTemplate(req.params.id, { status, reason }, req);
        res.status(200).json({ success: true, message: `Template ${status}.`, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = settingsController;