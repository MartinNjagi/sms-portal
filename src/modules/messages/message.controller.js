const goEngineWrapper = require('../../services/goEngineWrapper');
const s3Service = require('../../services/cloudStorage');

const messageController = {};

// ==========================================
// 1. HTML VIEW RENDERERS
// ==========================================

messageController.renderBulkDashboard = async (req, res, next) => {
    try {
        res.render('message/bulk.njk', {
            title: 'Messaging Dashboard',
            alias: 'messages', 
            user: req.user
        });
    } catch (error) {
        next(error);
    }
};

messageController.renderSingleDashboard = async (req, res, next) => {
    try {
        res.render('message/index.njk', {
            title: 'Messaging Dashboard',
            alias: 'messages', 
            user: req.user
        });
    } catch (error) {
        next(error);
    }
};

messageController.renderTemplates = async (req, res, next) => {
    try {
        // Admin override check
        const targetClientId = (req.user.role === 'ADMIN' && req.query.client_id) 
            ? req.query.client_id 
            : null;

        // Concurrently fetch both resources
        const [templatesRes, sendersRes] = await Promise.all([
            goEngineWrapper.getTemplates(req, targetClientId).catch(() => ({ data: [] })),
            goEngineWrapper.getSenderIds(req, targetClientId).catch(() => ({ data: [] }))
        ]);
        
        res.render('message/templates.njk', {
            title: 'Templates & Sender IDs',
            alias: 'templates',
            user: req.user,
            templates: templatesRes.data,
            senderIds: sendersRes.data
        });
    } catch (error) {
        next(error);
    }
};

// Handle traditional form POST from the Template Modal
messageController.createTemplateSync = async (req, res, next) => {
    try {
        // The modal form sends 'Template Name' and 'Message Content'
        // Adjust these keys based on your actual form input 'name' attributes
        const { templateName, templateContent } = req.body; 
        
        await goEngineWrapper.createTemplate({ 
            name: templateName, 
            content: templateContent 
        }, req);
        
        // Redirect back to templates page after creation
        res.redirect('/messages/templates');
    } catch (error) {
        next(error);
    }
};

// ==========================================
// 2. JSON API ENDPOINTS (For AJAX/Fetch)
// ==========================================

messageController.getMessageDashboardData = async (req, res, next) => {
    try {
        // Concurrently fetch all data needed to render the Dashboard and fill the dropdowns!
        const [walletRes, campaignsRes, sendersRes, groupsRes,templatesRes] = await Promise.all([
            goEngineWrapper.getWalletData(req).catch(() => ({ data: { balance: 0 } })),
            goEngineWrapper.listCampaigns(req, 1, 5).catch(() => ({ data: [] })),
            goEngineWrapper.getSenderIds(req).catch(() => ({ data: [] })),
            goEngineWrapper.getContactGroups(req).catch(() => ({ data: [] })),
            goEngineWrapper.getTemplates(req).catch(() => ({ data: [] }))
        ]);

        const recentCampaigns = (campaignsRes.data || []).map(camp => ({
            id: camp.ID,
            name: camp.Name,
            status: camp.Status,
            sent: 0, // Update via outbox stats later if needed
            failed: 0,
            date: camp.CreatedAt
        }));

        res.status(200).json({
            success: true,
            data: {
                balance: walletRes.data?.balance || 0,
                recentCampaigns,
                senderIds: sendersRes.data || [],
                groups: groupsRes.data || [],
                templates: templatesRes.data || []
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load dashboard data' });
    }
};

messageController.getUploadUrl = async (req, res, next) => {
    try {
        const { fileName, fileType } = req.query;
        if (!fileName || !fileType) return res.status(400).json({ error: 'Missing file details.' });

        // Generate a unique S3 key
        const uniqueFileKey = `campaigns/${req.user.client_id}/${Date.now()}_${fileName}`;
        const uploadUrl = await s3Service.generatePresignedPutUrl(uniqueFileKey, fileType);

        res.status(200).json({ success: true, data: { uploadUrl, fileKey: uniqueFileKey } });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

// Handles Scenario A: Sending to a Saved Group
messageController.triggerCampaign = async (req, res, next) => {
    try {
        const { campaignName, senderId, messageContent, groupId } = req.body;
        
        const goPayload = {
            Name: campaignName,
            SenderID: senderId,
            TemplateName: messageContent,
            ContactGroup: parseInt(groupId, 10)
        };

        const result = await goEngineWrapper.launchBulkCampaign(goPayload, req);
        res.status(202).json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Handles Scenario B: Uploading a CSV
messageController.triggerBulkCampaign = async (req, res, next) => {
    try {
        const { campaignName, senderId, messageContent, fileKey } = req.body;
        
        // Generate the accessible download URL for Go
        const fileUrl = await s3Service.generatePresignedGetUrl(fileKey);

        const goPayload = {
            Name: campaignName,
            SenderID: senderId,
            TemplateName: messageContent,
            FileURL: fileUrl
        };

        const result = await goEngineWrapper.launchBulkCampaign(goPayload, req);
        res.status(202).json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

messageController.sendSingle = async (req, res, next) => {
    try {
        const { msisdn, senderId, templateName, message } = req.body;
        
        // Maps exactly to your Go SingleSMSRequest struct
        const goPayload = {
            msisdn: msisdn,
            sender_id: senderId,
            template_name: templateName || "",
            message: message || ""
        };

        const result = await goEngineWrapper.sendSingleSMS(goPayload, req);
        
        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

messageController.getCampaignStats = async (req, res, next) => {
       try {
           const { id } = req.params;
           const result = await goEngineWrapper.getCampaignStats(id, req);
           res.status(200).json({ success: true, data: result.data });
       } catch (error) {
           res.status(500).json({ error: error.message });
       }
};
messageController.editCampaign = async (req, res, next) => {
       try {
        const campaignId = req.params.id;
        const payload = req.body;
        
        await goEngineWrapper.editCampaign(campaignId, payload, req);
        
        res.status(200).json({ success: true, message: "Updated" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


module.exports = messageController;