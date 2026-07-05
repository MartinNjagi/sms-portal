// src/modules/billing/billing.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const renderWallet = async (req, res, next) => {
    try {
        const clientId = req.user.clientId;
        
        // Fetch the wallet data using the logged-in user's client ID
        const walletData = await goEngineWrapper.getWalletData(req);
        
        res.render('billing/index.njk', { 
            title: 'My Wallet & Billing',
            alias: 'billing', // This ensures the sidebar link highlights correctly
            user: req.user,
            wallet: walletData.data
        });
    } catch (error) {
        next(error);
    }
};


const triggerMpesa = async (req, res) => {
    try {
        const result = await goEngineWrapper.initiateMpesaTopUp(req.body, req);
        res.status(200).json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const triggerCard = async (req, res) => {
    try {
        const result = await goEngineWrapper.initiateCardTopUp(req.body, req);
        res.status(200).json(result);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

module.exports = {
    renderWallet, triggerCard,triggerMpesa
};