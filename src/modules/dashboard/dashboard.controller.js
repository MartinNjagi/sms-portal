// src/modules/dashboard/dashboard.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const dashboardController = {};

dashboardController.renderDashboard = async (req, res, next) => {
    try {
        // Fetch the user's dashboard stats from Go, passing their specific token
        // so Go knows exactly whose data to return.
        const dashboardData = await goEngineWrapper.getDashboardStats(req);
        console.log("renderDashboard");
                
        // Render the Nunjucks view with the stitched data
        res.render('dashboard/index.njk', {
            title: 'Overview',
            alias: 'dashboard',
            user: req.user, // <--- MUST INCLUDE THIS
            stats: dashboardData.summary, // e.g., total sent, failed, balance
            recentActivity: dashboardData.recentCampaigns
        });

    } catch (error) {
        // If the token expired or Go rejects it, clear the cookie and force a re-login
        if (error.status === 401) {
            res.clearCookie('session_token');
            return res.redirect('/login');
        }
        next(error); // Pass to global error handler
    }
};

module.exports = dashboardController;