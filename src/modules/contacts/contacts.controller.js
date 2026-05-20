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
        const newGroup = await goEngineWrapper.createContactGroup(req.token, { name: groupName, description });

        res.status(201).json({ success: true, data: newGroup });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = contactsController;