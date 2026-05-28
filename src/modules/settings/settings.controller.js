// src/modules/settings/settings.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const settingsController = {};

settingsController.renderSettingsPage = async (req, res, next) => {
    try {
        // BFF Pattern: Fetch multiple resources concurrently to keep page load fast
        const [senderIds, devSettings] = await Promise.all([
            goEngineWrapper.getSenderIds(req),
            goEngineWrapper.getDeveloperSettings(req.token)
        ]);

        res.render('configuration/index.njk', {
            title: 'Account Settings',
            alias: 'settings',
            senderIds: senderIds,
            devSettings: devSettings,
            // Pass user info stored from the auth token
            user: req.user 
        });
    } catch (error) {
        next(error);
    }
};

// API Endpoint to request a new Sender ID
settingsController.requestSenderId = async (req, res, next) => {
    try {
        const { senderId, justification } = req.body;
        
        if (!senderId || senderId.length > 11) {
            return res.status(400).json({ error: 'Sender ID must be between 1 and 11 characters.' });
        }

        // Relay the request to the Go Engine
        // await goEngineWrapper.requestNewSenderId(req.token, { senderId, justification });

        res.status(201).json({ success: true, message: 'Sender ID requested successfully. Pending approval.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = settingsController;