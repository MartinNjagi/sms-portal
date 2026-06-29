// src/modules/dashboard/dashboard.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const dashboardController = {};

dashboardController.renderDashboard = async (req, res, next) => {
    try {
        // BFF PATTERN: Aggregate data from multiple Go microservices concurrently
        // We use .catch() on individual promises so if one service is temporarily down, 
        // the whole dashboard doesn't crash (graceful degradation).
        const [walletRes, campaignsRes] = await Promise.all([
            goEngineWrapper.getClientBalance(req).catch(() => ({ data: { balance: 0, currency: 'KES' } })),
            goEngineWrapper.listCampaigns(req, 1, 5).catch(() => ({ data: [] }))
        ]);

        const campaigns = campaignsRes.data || [];
        
        console.log("Wallet Response", walletRes.data);
        

        // Construct the summary object expected by the Nunjucks view
        const summary = {
            balance: walletRes.data?.balance || 0,
            currency: walletRes.data?.currency || 'KES',
            // Note: To get lifetime totals (Total Sent, Total Failed), you will eventually want 
            // to add a global stats endpoint to your Go SMS controller that runs a COUNT() on the Outbox.
            totalSent: '---', 
            failed: '---'     
        };

        // Render the Nunjucks view with the stitched data
        res.render('dashboard/index.njk', {
            title: 'Overview',
            alias: 'dashboard',
            user: req.user,
            stats: summary,
            recentActivity: campaigns
        });

    } catch (error) {
        // If the token expired or Go rejects it, clear the cookie and force a re-login
        if (error.status === 401 || error.message?.toLowerCase().includes('token') || error.message?.includes('Unauthorized')) {
            res.clearCookie('session_token');
            return res.redirect('/login');
        }
        next(error); 
    }
};

module.exports = dashboardController;