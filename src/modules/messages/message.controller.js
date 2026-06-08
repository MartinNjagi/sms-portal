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
            goEngineWrapper.getClientBalance(req),
            goEngineWrapper.getRecentCampaigns(req, { limit: 5 })
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
        const account = await goEngineWrapper.getClientBalance(req);
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
        }, req);

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
        const templates = await goEngineWrapper.getTemplates(req);
        
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

// Serves the HTML view for the unified campaign dashboard
messageController.renderBulkDashboard = async (req, res, next) => {
    try {
        res.render('message/bulk.njk', {
            title: 'Messaging Dashboard',
            alias: 'messages', // Highlights the sidebar tab
            user: req.user
        });
    } catch (error) {
        next(error);
    }
};

messageController.processCampaign = async (req, res, next) => {
    try {
        const { 
            campaignName, 
            senderId, 
            messageContent, 
            fileKey, 
            groupId, 
            scheduledFor // Frontend can optionally pass an ISO date string
        } = req.body;

        // 1. Convert S3 Key to a fully resolvable URL for Go's http.Get()
        let fileUrl = null;
        if (fileKey) {
            fileUrl = await s3Service.generatePresignedGetUrl(fileKey);
        }

        // 2. Prepare the Go struct payload
        // Maps directly to data.BulkCampaignRequest / data.ScheduleCampaignRequest
        const goPayload = {
            Name: campaignName,
            SenderID: senderId,
            ContactGroup: groupId ? parseInt(groupId, 10) : null,
            FileURL: fileUrl,
            // Assuming Go accepts the raw message body under 'TemplateName' if no strict template is used
            // If your Go engine has a separate 'Message' field, map it there instead.
            TemplateName: messageContent 
        };

        let result;

        // 3. Route to the correct Go engine endpoint
        if (scheduledFor) {
            goPayload.ScheduledFor = scheduledFor;
            result = await goEngineWrapper.scheduleCampaign(goPayload, req);
        } else {
            result = await goEngineWrapper.launchBulkCampaign(goPayload, req);
        }

        // 4. Respond to the frontend
        res.status(202).json({
            success: true,
            message: result.message || 'Campaign queued successfully',
            data: {
                clientId: req.user.clientId // Passed back so UI can join the right Socket room
            }
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Also expose an endpoint for the UI to poll the live stats
messageController.getCampaignStats = async (req, res, next) => {
    try {
        const { id } = req.params;
        const stats = await goEngineWrapper.getCampaignStats(id, req);
        res.status(200).json({ success: true, data: stats.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = messageController;