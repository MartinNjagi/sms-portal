// src/modules/account/account.controller.js (Normal Users)
const goEngineWrapper = require('../../services/goEngineWrapper');

const accountController = {};

accountController.renderMyBilling = async (req, res, next) => {
    try {
        // User is looking at their OWN history. 
        // We guarantee they can't spoof this because req.user.clientId 
        // comes directly from the decoded HttpOnly secure cookie/token.
        const myId = req.user.clientId; 
        
        const transactions = await goEngineWrapper.getWalletHistory(req.token, myId,req);

        res.render('account/billing.njk', {
            title: 'My Billing & Invoices',
            transactions: transactions
        });
    } catch (error) {
        next(error);
    }
};

module.exports = accountController;