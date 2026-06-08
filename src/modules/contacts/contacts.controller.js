const goEngineWrapper = require('../../services/goEngineWrapper');

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

module.exports = contactsController;