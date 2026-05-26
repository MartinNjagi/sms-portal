// src/modules/messages/message.controller.js

// Mocking dependencies that you will create in your /src/services folder
const s3Service = require('../../services/cloudStorage'); 
const goEngineWrapper = require('../../services/goEngineWrapper');

const messageController = {};

/**
 * 1. The BFF View Aggregator
 * Gathers everything the frontend needs to render the bulk SMS page.
 */
messageController.getMessageDashboardData = async (req, res, next) => {
    try {
        // In a BFF, we aggregate data from multiple services for the initial load
        const [accountStatus, recentCampaigns] = await Promise.all([
            goEngineWrapper.getClientBalance(req.user.id),
            goEngineWrapper.getRecentCampaigns(req.user.id, { limit: 5 })
        ]);

        res.status(200).json({
            success: true,
            data: {
                balance: accountStatus.balance,
                recentCampaigns,
                uploadRequirements: {
                    maxSizeMb: 100, // Enforced on frontend
                    allowedTypes: ['text/csv', 'application/vnd.ms-excel']
                }
            }
        });
    } catch (error) {
        next(error); // Passes to global error handler
    }
};

/**
 * 2. Validation & Signing (Pre-signed URL)
 * Called BY the frontend AFTER it does fast client-side CSV parsing (checking for headers).
 */
messageController.getUploadUrl = async (req, res, next) => {
    try {
        const { fileName, fileType, estimatedRows } = req.query;

        // --- VALIDATION ---
        if (!fileName || !fileType) {
            return res.status(400).json({ error: 'Missing file details.' });
        }

        // Example: Block if user doesn't have enough balance for estimated rows
        const account = await goEngineWrapper.getClientBalance(req.user.id);
        if (account.balance < estimatedRows) {
             return res.status(402).json({ error: 'Insufficient balance for this campaign size.' });
        }

        // --- SIGNING ---
        // Generate a unique key for storage to prevent overwrites
        const uniqueFileKey = `campaigns/${req.user.clientId}/${Date.now()}_${fileName}`;
        
        // Ask AWS/MinIO for a temporary URL where the frontend can safely PUT the file
        const signedUrl = await s3Service.generatePresignedPutUrl(uniqueFileKey, fileType);

        res.status(200).json({
            success: true,
            data: {
                uploadUrl: signedUrl,
                fileKey: uniqueFileKey // The frontend will pass this back to us in step 3
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * 3. The Trigger
 * Called by the frontend AFTER it successfully uploads the CSV to Cloud Storage.
 */
messageController.triggerGoEngine = async (req, res, next) => {
    try {
        const { fileKey, campaignName, senderId } = req.body;

        // --- FINAL VALIDATION ---
        if (!fileKey || !senderId) {
            return res.status(400).json({ error: 'Missing required campaign parameters.' });
        }

        // --- TRIGGER GO ENGINE ---
        // We pass the location of the file, NOT the file itself. 
        // The Go engine will download it directly from S3/MinIO and start queuing.
        const goResponse = await goEngineWrapper.startBulkCampaign({
            clientId: req.user.clientId,
            campaignName,
            senderId,
            s3FileKey: fileKey,
            callbackRoom: `campaign_${req.user.clientId}` // Tells Go where to send WebSockets
        });

        // --- RESPOND TO FRONTEND ---
        // We reply immediately. The frontend will now listen on WebSockets for DLRs and progress.
        res.status(202).json({
            success: true,
            message: 'Campaign accepted and processing started.',
            data: {
                campaignId: goResponse.campaignId,
                status: 'pending'
            }
        });

    } catch (error) {
        // If Go engine is down, we catch it here and inform the user cleanly
        next(error);
    }
};

messageController.renderTemplates = async (req, res, next) => {
    try {
        const clientId = req.user.clientId;
        const templates = await goEngineWrapper.getTemplates(req.token, clientId);
        
        res.render('messages/templates.njk', { 
            title: 'Message Templates',
            alias: 'templates', // Will use this to highlight a new sidebar link
            user: req.user,
            templates
        });
    } catch (error) {
        next(error);
    }
};

messageController.triggerCampaign = async (req, res, next) => {
    try {
        const { campaignName, senderId, messageContent, fileKey, groupId } = req.body;
        
        // Securely extract the Client ID from the JWT session
        const clientId = req.user.clientId;

        // Construct the payload for the Go Engine
        const enginePayload = {
            clientId,
            campaignName,
            senderId,
            messageContent,
            fileKey: fileKey || null, // Will be null if using a Group
            groupId: groupId || null  // Will be null if using a CSV
        };

        // Forward the command to your Go microservice
        const result = await goEngineWrapper.startCampaign(req.token, enginePayload);

        // Respond to the browser so the Socket.io UI can start listening
        res.status(200).json({
            success: true,
            message: "Campaign queued successfully.",
            data: {
                campaignId: result.campaignId, // Returned from Go
                clientId: clientId
            }
        });

    } catch (error) {
        console.error("[BFF] Campaign Trigger Error:", error.message);
        res.status(500).json({ error: error.message || 'Failed to trigger campaign.' });
    }
};

module.exports = messageController;