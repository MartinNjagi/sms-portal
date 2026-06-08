const goEngineWrapper = require('../../services/goEngineWrapper');
const s3Service = require('../../services/cloudStorage');

const contactsController = {};

// --- VIEWS ---

contactsController.renderIndex = async (req, res, next) => {
    try {
        // Fetch the user's groups from Go using the full `req` object
        const groupsResponse = await goEngineWrapper.getContactGroups(req) || [];

        res.render('contacts/index.njk', {
            title: 'Address Book',
            alias: 'contacts',
            user: req.user,
            groups: groupsResponse.data 
        });
    } catch (error) {
        next(error);
    }
};

// --- API ACTIONS: GROUPS ---

contactsController.createGroup = async (req, res, next) => {
    try {
        const { groupName, description } = req.body;
        if (!groupName) return res.status(400).json({ error: 'Group name is required.' });

        // Pass 'req' so HMAC signer can extract IP & Context
        const result = await goEngineWrapper.createContactGroup({ name: groupName, description }, req);
        res.status(201).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

contactsController.updateGroup = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await goEngineWrapper.updateContactGroup(id, req.body, req);
        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

contactsController.deleteGroup = async (req, res, next) => {
    try {
        const { id } = req.params;
        await goEngineWrapper.deleteContactGroup(id, req);
        res.status(200).json({ success: true, message: 'Group deleted successfully.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// --- API ACTIONS: CONTACTS ---

contactsController.getGroupContacts = async (req, res, next) => {
    try {
        const { id } = req.params;
        const result = await goEngineWrapper.getContactsByGroup(id, req);
        res.status(200).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

contactsController.addContacts = async (req, res, next) => {
    try {
        const { groupId, contacts } = req.body; // contacts array of { phone, name }
        if (!groupId || !contacts || contacts.length === 0) {
            return res.status(400).json({ error: 'Group ID and contacts array are required.' });
        }
        
        const result = await goEngineWrapper.addContacts({ groupId, contacts }, req);
        res.status(201).json({ success: true, data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

contactsController.deleteContact = async (req, res, next) => {
    try {
        const { phone_id } = req.params;
        await goEngineWrapper.deleteContact(phone_id, req);
        res.status(200).json({ success: true, message: 'Contact deleted.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// 1. Get Presigned URL for Contacts CSV
contactsController.getUploadUrl = async (req, res, next) => {
    try {
        const { fileName, fileType } = req.query;
        if (!fileName || !fileType) return res.status(400).json({ error: 'Missing file details.' });

        const uniqueFileKey = `contacts/${req.user.clientId}/${Date.now()}_${fileName}`;
        const signedUrl = await s3Service.generatePresignedPutUrl(uniqueFileKey, fileType);

        res.status(200).json({ success: true, data: { uploadUrl: signedUrl, fileKey: uniqueFileKey } });
    } catch (error) { next(error); }
};

// 2. Trigger Go Engine Async Queue
contactsController.triggerCsvImport = async (req, res, next) => {
    try {
        const { fileKey, groupId } = req.body;
        if (!fileKey || !groupId) return res.status(400).json({ error: 'Missing parameters.' });

        // Generate a Pre-signed GET URL that Go can download via http.Get()
        // (Assuming your s3Service has this method. It's the standard pair to generatePresignedPutUrl)
        const downloadUrl = await s3Service.generatePresignedGetUrl(fileKey);

        // Pass the fully accessible URL to Go
        const result = await goEngineWrapper.uploadContactsCSV({
            GroupID: parseInt(groupId, 10),
            FileURL: downloadUrl 
        }, req);

        res.status(202).json({ success: true, message: result.message });
    } catch (error) { 
        next(error); 
    }
};

module.exports = contactsController;