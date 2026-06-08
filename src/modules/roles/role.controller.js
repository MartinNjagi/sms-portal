// src/modules/roles/role.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

// Render the Roles Management Page
const viewRoles = async (req, res, next) => {
    try {
        const roles = await goEngineWrapper.getRoles(req, req.user.client_id);
        const roleData = roles.data
        // Strip the superAdmin role (id: 1) for any client other than client_id 1
        const filteredRoles = req.user.client_id !== 1
            ? roleData.filter(role => role.id !== 1)
            : roleData;
        
        res.render('roles/index.njk', { 
            title: 'Role Management',
            alias: 'roles',
            roles: filteredRoles,
            user: req.user
        });
    } catch (error) {
        next(error);
    }
};

const viewRolePermissions = async (req, res, next) => {
    try {
        const roleId = req.params.id;
        const permissions = await goEngineWrapper.getRolePermissions(req, roleId);
        
        res.json(permissions.data);
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
        const response = await goEngineWrapper.createRole(req);
        res.status(201).json(response);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            message: error.response?.data?.error || "Failed to create role" 
        });
    }
};

// Submit updated permissions for an existing role
const assignRolePermissions = async (req, res, next) => {
    try {
        const response = await goEngineWrapper.assignRolePermissions(req);
        res.status(200).json(response);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            message: error.response?.data?.error || "Failed to update role permissions" 
        });
    }
};

// Delete a role
const deleteRole = async (req, res, next) => {
    try {
        const roleId = req.params.id;
        const response = await goEngineWrapper.deleteRole(req, roleId);
        res.status(200).json(response);
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            message: error.response?.data?.error || "Failed to delete role" 
        });
    }
};

module.exports = {
    viewRoles,
    viewRolePermissions,
    getPermissions,
    createRole,
    assignRolePermissions,
    deleteRole             
};