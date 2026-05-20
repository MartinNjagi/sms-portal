// src/modules/clients/client.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const clientController = {};

// Render the Admin Overview
clientController.renderIndex = async (req, res, next) => {
    try {
        const clients = await goEngineWrapper.getAllClients(req.token);

        res.render('client/index.njk', {
            title: 'Client Management',
            alias: 'clients',
            clients: clients
        });
    } catch (error) {
        next(error);
    }
};

// Render the Wallet Report for a specific client
clientController.renderWalletReport = async (req, res, next) => {
    try {
        const { clientId } = req.params;
        const transactions = await goEngineWrapper.getClientWalletHistory(req.token, clientId);

        res.render('client/wallet-report.njk', {
            title: 'Wallet History',
            alias: 'clients',
            transactions: transactions
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
        
        const transactions = await goEngineWrapper.getWalletHistory(req.token, targetId);

        res.render('client/wallet-report.njk', {
            title: `Ledger for Client ${targetId}`,
            transactions: transactions
        });
    } catch (error) {
        next(error);
    }
};

module.exports = clientController;