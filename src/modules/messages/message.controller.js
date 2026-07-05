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
        const balRes = await goEngineWrapper.getClientBalance(req);
        const balance = balRes.data.balance

        res.render('message/index.njk', {
            title: 'Messaging Dashboard',
            alias: 'messages', 
            user: req.user,
            balance: balance
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
        const [walletRes, campaignsRes, sendersRes, groupsRes, templatesRes] = await Promise.all([
            goEngineWrapper.getClientBalance(req).catch(() => ({ data: { balance: 0 } })),
            goEngineWrapper.listCampaigns(req, 1, 5).catch(() => ({ data: [] })),
            goEngineWrapper.getSenderIds(req).catch(() => ({ data: [] })),
            goEngineWrapper.getContactGroups(req).catch(() => ({ data: [] })),
            goEngineWrapper.getTemplates(req).catch(() => ({ data: [] }))
        ]);

        const recentCampaigns = (campaignsRes.data || [])

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

messageController.getUnifiedOutbox = async (req, res, next) => {
    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 50;
        const result = await goEngineWrapper.getUnifiedOutbox(req, page,limit);
        res.status(200).json({ success: true, data: result.data, pagination: result.pagination });
    } catch (error) {
        res.status(500).json({ error: 'Failed to load outbox ledger' });
    }
};

messageController.getUploadUrl = async (req, res, next) => {
    try {
        const { fileName, fileType } = req.query;
        if (!fileName || !fileType) return res.status(400).json({ error: 'Missing file details.' });

        const uniqueFileKey = `campaigns/${req.user.client_id}/${Date.now()}_${fileName}`;
        const uploadUrl = await s3Service.generatePresignedPutUrl(uniqueFileKey, fileType);

        res.status(200).json({ success: true, data: { uploadUrl, fileKey: uniqueFileKey } });
    } catch (error) { 
        res.status(500).json({ error: error.message }); 
    }
};

messageController.triggerCampaign = async (req, res, next) => {
    try {
        const { campaignName, senderId, templateName, groupId, scheduledFor } = req.body;
        
        const goPayload = {
            name: campaignName,
            sender_id: senderId,
            template_name: templateName, 
            contact_group: groupId.toString() 
        };

        let result;
        
        if (scheduledFor) {
            goPayload.scheduled_for = scheduledFor;
            result = await goEngineWrapper.scheduleCampaign(goPayload, req);
        } else {
            result = await goEngineWrapper.launchBulkCampaign(goPayload, req);
        }

        res.status(202).json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

messageController.triggerBulkCampaign = async (req, res, next) => {
    try {
        const { campaignName, senderId, templateName, fileKey, scheduledFor } = req.body;
        
        const goPayload = {
            name: campaignName,
            sender_id: senderId,
            template_name: templateName,
            file_url: fileKey 
        };

        let result;
        
        if (scheduledFor) {
            goPayload.scheduled_for = scheduledFor;
            result = await goEngineWrapper.scheduleCampaign(goPayload, req);
        } else {
            result = await goEngineWrapper.launchBulkCampaign(goPayload, req);
        }

        res.status(202).json({ success: true, message: result.message });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

messageController.sendSingle = async (req, res, next) => {
    try {
        // ADD priority TO THE DESTRUCTURED BODY
        const { msisdn, sender_id, message, priority } = req.body;        
        const goPayload = {
            msisdn: msisdn,
            sender_id: sender_id,
            message: message,
            priority: priority // <-- ADD THIS LINE
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

messageController.requestSenderId = async (req, res, next) => {
    try {
        const { sender_id, justification } = req.body;
        const result = await goEngineWrapper.createSenderId({ sender_id, justification }, req);
        res.status(201).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

messageController.createTemplateAsync = async (req, res, next) => {
    try {
        const { name, content } = req.body;
        const result = await goEngineWrapper.createTemplate({ name, content }, req);
        res.status(201).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

messageController.reviewSenderId = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; 
        
        const result = await goEngineWrapper.approveSenderId(id, { status, reason }, req);
        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

messageController.reviewTemplate = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status, reason } = req.body; 
        
        const result = await goEngineWrapper.approveTemplate(id, { status, reason }, req);
        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = messageController;