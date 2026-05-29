// src/modules/users/user.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

// --- PAGE RENDERING METHODS ---

const viewMyTeam = async (req, res, next) => {
    try {
        const users = await goEngineWrapper.getUsers(req, null);
        res.render('users/index.njk', { 
            title: 'My Team',
            alias: 'my-team',
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
        const users = await goEngineWrapper.getUsers(req, targetClientId);
        res.render('users/index.njk', { 
            title: `Managing Users (Client #${targetClientId})`,
            alias: 'clients',
            users,
            user: req.user,
            targetClientId 
        });
    } catch (error) {
        next(error);
    }
};

// --- API METHODS (For Axios calls) ---

const getRoles = async (req, res, next) => {

    try {
        const roles = await goEngineWrapper.getRoles(req); 
        
        res.json(roles);
    } catch (error) {
        console.error("Error fetching roles:", error);
        res.status(500).json({ message: "Failed to fetch roles" });
    }
};

const createUser = async (req, res, next) => {
    try {
        // req.body contains the name, email, role_id, password, client_id
        const newUser = await goEngineWrapper.createUser(req);
        
        res.status(201).json({ message: "User created successfully", user: newUser });
    } catch (error) {
        console.error("Error creating user:", error);
        res.status(500).json({ message: error.message || "Failed to create user" });
    }
};

module.exports = {
    viewMyTeam,
    viewClientUsers,
    getRoles,
    createUser
};