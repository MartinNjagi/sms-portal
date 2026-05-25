// src/modules/billing/billing.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const renderWallet = async (req, res, next) => {
    try {
        const clientId = req.user.clientId;
        
        // Fetch the mock wallet data using the logged-in user's client ID
        const walletData = await goEngineWrapper.getWalletData(req.token, clientId);
        
        res.render('billing/index.njk', { 
            title: 'My Wallet & Billing',
            alias: 'billing', // This ensures the sidebar link highlights correctly
            user: req.user,
            wallet: walletData
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    renderWallet
};