// src/modules/clients/client.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const clientController = {};

// Render the Admin Overview
clientController.renderIndex = async (req, res, next) => {
    try {
        const clients = await goEngineWrapper.getAllClients(req); 
        
        let pendingTransfers = [];
        // Ensure only Superadmin (client_id 1) fetches these
        if (req.user && req.user.client_id === 1) {
            const transfersRes = await goEngineWrapper.getBankTransfers(req, 'PENDING');
            if (transfersRes && transfersRes.Data) {
                pendingTransfers = transfersRes.Data;
            }
        }

        res.render('client/index.njk', {
            title: 'Client Management',
            alias: 'clients',
            clients: clients.data,
            user: req.user,
            pendingTransfers
        });
    } catch (error) {
        next(error);
    }
};

// Render the Wallet Report for a specific client
clientController.renderWalletReport = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const transactions = await goEngineWrapper.getWalletData(req, clientId);
        const balRes = await goEngineWrapper.getClientBalance(req,clientId);
        const balance = balRes.data.balance
        res.render('client/wallet-report.njk', {
            title: 'Wallet History',
            alias: 'clients',
            user: req.user,
            wallet: transactions.data,
            balance:balance
        });
    } catch (error) {
        next(error);
    }
};

// Keep manual activation if you still verify them manually before letting them send
clientController.activateClient = async (req, res) => {
    try {
        const { clientId } = req.params;
        await goEngineWrapper.updateClientStatus(req.token, clientId, 'active');
        res.status(200).json({ success: true, message: 'Client activated.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

clientController.renderAdminWalletReport = async (req, res, next) => {
    try {
        // Admin is looking at a specific sub-client's ID from the URL
        const targetId = req.params.clientId; 
        
        const transactions = await goEngineWrapper.getWalletHistory(req, targetId);

        res.render('client/wallet-report.njk', {
            title: `Ledger for Client ${targetId}`,
            transactions: transactions
        });
    } catch (error) {
        next(error);
    }
};

clientController.viewMyTeam = async (req, res, next) => {
    try {
        // Extract the client ID securely from the JWT session data
        const clientId = req.user.client_id; 

        // Optional safety check: If a System Admin (Client ID 0) clicks this, 
        // you might want to redirect them to the master client list instead.
        // if (clientId === 1 || clientId === "1") {
        //     return res.redirect('/clients'); 
        // }

        // Fetch users using the securely extracted ID
        const users = await goEngineWrapper.getUsers(req);
        
        // Reuse the exact same Nunjucks template! 
        res.render('clients/users.njk', { 
            title: 'My Team',
            alias: 'my-team', // Used to highlight the sidebar menu
            users, 
            clientId,
            user: req.user 
        });
    } catch (error) {
        next(error);
    }
};

clientController.viewClientUsers = async (req, res, next) => {
    try {
        const clientId = req.params.id;
        const users = await goEngineWrapper.getUsers(req.token, clientId);
        
        res.render('clients/users.njk', { 
            users, 
            clientId,
            user: req.user 
        });
    } catch (error) {
        next(error);
    }
};

clientController.suspendClientAction = async (req, res) => {
    try {
        await goEngineWrapper.suspendClient(req.params.id, req);
        res.status(200).json({ success: true, message: 'Client suspended and users locked out.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

clientController.reinstateClientAction = async (req, res) => {
    try {
        await goEngineWrapper.reinstateClient(req.params.id, req);
        res.status(200).json({ success: true, message: 'Client reinstated.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

clientController.createClientAction = async (req, res) => {
    try {
        // Go expects: { name: string, status?: string }
        const payload = { name: req.body.name, status: req.body.status || 'active' };
        const result = await goEngineWrapper.createClient(payload, req);
        res.status(201).json({ success: true, message: 'Tenant created successfully!', data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

clientController.updateClientAction = async (req, res) => {
    try {
        const payload = { name: req.body.name };
        const result = await goEngineWrapper.updateClient(req.params.id, payload, req);
        res.status(200).json({ success: true, message: 'Tenant updated successfully!', data: result.data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = clientController;