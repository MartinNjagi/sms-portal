const goEngineWrapper = require('../../services/goEngineWrapper');

const contactsController = {};

// Render the main Contacts UI
contactsController.renderIndex = async (req, res, next) => {
    try {
        // Fetch the user's groups from Go
        const groups = await goEngineWrapper.getContactGroups(req.token);

        res.render('contacts/index.njk', {
            title: 'Address Book',
            alias: 'contacts',
            groups: groups // Pass the data to Nunjucks
        });
    } catch (error) {
        next(error);
    }
};

// API Endpoint for the frontend AJAX form to hit
contactsController.createGroup = async (req, res, next) => {
    try {
        const { groupName, description } = req.body;
        
        if (!groupName) {
            return res.status(400).json({ error: 'Group name is required.' });
        }

        // Pass the request to Go
        const newGroup = await goEngineWrapper.createContactGroup({ name: groupName, description });

        res.status(201).json({ success: true, data: newGroup });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
contactsController.renderAddressBook = async (req, res, next) => {
    try {
        // Fetch the contact groups for the logged-in user
        // (This relies on the Go backend having an endpoint for this)
        const groups = await goEngineWrapper.getContactGroups(req) || [];

        res.render('contacts/index.njk', {
            title: 'Address Book',
            alias: 'contacts', // Highlights the sidebar
            user: req.user,
            groups
        });
    } catch (error) {
        next(error);
    }
};
module.exports = contactsController;