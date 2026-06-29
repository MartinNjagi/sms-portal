// src/modules/users/user.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

// --- PAGE RENDERING METHODS ---

const viewMyTeam = async (req, res, next) => {
    try {
        const users = await goEngineWrapper.getUsers(req, null);
      //  console.log("ResponseUserQuery",users);
        res.render('users/index.njk', { 
            title: 'My Team',
            alias: 'my-team',
            users: users.data,
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
            users: users.data,
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

const getUser = async (req, res, next) => {
    try {
        // Assuming your wrapper passes req.params.id properly
        const user = await goEngineWrapper.getUser(req, req.params.id); 
        res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ error: error.message || "Failed to fetch user" });
    }
};

const updateUser = async (req, res, next) => {
    try {
        // req.body contains full_name, status
        await goEngineWrapper.updateUser(req, req.params.id);
        res.status(200).json({ message: "User updated successfully" });
    } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).json({ error: error.message || "Failed to update user" });
    }
};

const deleteUser = async (req, res, next) => {
    try {
        await goEngineWrapper.deleteUser(req, req.params.id);
        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ error: error.message || "Failed to delete user" });
    }
};

// Update your module.exports to include the new methods
module.exports = {
    viewMyTeam,
    viewClientUsers,
    getRoles,
    createUser,
    getUser,     // NEW
    updateUser,  // NEW
    deleteUser   // NEW
};