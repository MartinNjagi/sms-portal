// src/modules/users/user.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const viewMyTeam = async (req, res, next) => {
    try {
        // We pass 'null' for the filter. 
        // The Go Engine will automatically read the user's JWT and return ONLY their team.
        const users = await goEngineWrapper.getUsers(req.token, null);
        
        res.render('users/index.njk', { 
            title: 'My Team',
            alias: 'my-team', // Highlights the sidebar
            users,
            user: req.user
        });
    } catch (error) {
        next(error);
    }
};

const viewClientUsers = async (req, res, next) => {
    try {
        const targetClientId = req.params.id;
        
        // Pass the target ID. If a malicious customer tries to guess this URL,
        // the Go Engine's security override will block them or ignore the ID.
        const users = await goEngineWrapper.getUsers(req.token, targetClientId);
        
        res.render('users/index.njk', { 
            title: `Managing Users (Client #${targetClientId})`,
            alias: 'clients', // Keeps the "Client Management" sidebar highlighted
            users,
            user: req.user,
            targetClientId // Optional: pass to view to show a "Back to Clients" button
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    viewMyTeam,
    viewClientUsers
};