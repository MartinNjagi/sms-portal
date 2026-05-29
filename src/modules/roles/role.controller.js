// src/modules/roles/role.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

// Render the Roles Management Page
const viewRoles = async (req, res, next) => {
    try {
        // Assuming you have a method to fetch existing roles
        const roles = await goEngineWrapper.getRoles(req, req.user.client_id);
        
        res.render('roles/index.njk', { 
            title: 'Role Management',
            alias: 'roles',
            roles,
            user: req.user // Contains the permissions array from login
        });
    } catch (error) {
        next(error);
    }
};

const viewRolePermissions = async (req, res, next) => {
    try {
        const roleId = req.params.id;
        const permissions = await goEngineWrapper.getRolePermissions(req, roleId);
        
        res.json(permissions);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            message: "Failed to fetch permissions for this role" 
        });
    }
};

// Fetch available permissions from Go
const getPermissions = async (req, res, next) => {
    try {
        const response = await goEngineWrapper.listAvailablePermissions(req);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch permissions" });
    }
};

// Submit the new role to Go
const createRole = async (req, res, next) => {
    try {
        const response = await goEngineWrapper.createRole(req, req.body);
        res.status(201).json(response);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            message: error.response?.data?.error || "Failed to create role" 
        });
    }
};

module.exports = {
    viewRoles,
    viewRolePermissions,
    getPermissions,
    createRole
};