// src/modules/dashboard/dashboard.controller.js
const goEngineWrapper = require('../../services/goEngineWrapper');

const dashboardController = {};

dashboardController.renderDashboard = async (req, res, next) => {
    try {
        // BFF PATTERN: Aggregate data from multiple Go microservices concurrently
        // We use .catch() on individual promises so if one service is temporarily down, 
        // the whole dashboard doesn't crash (graceful degradation).
        // 1. Calculate Date Range (e.g., Last 7 Days)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 6); // 7 days inclusive

        const endDate = end.toISOString().split('T')[0];
        const startDate = start.toISOString().split('T')[0];



        const [walletRes, campaignsRes, analyticsRes] = await Promise.all([
            goEngineWrapper.getClientBalance(req).catch(() => ({ data: { balance: 0, currency: 'KES' } })),
            goEngineWrapper.listCampaigns(req, 1, 5).catch(() => ({ data: [] })),
            goEngineWrapper.getDashboardAnalytics(req, startDate, endDate).catch(() => ({ data: [] }))
        ]);

        const campaigns = campaignsRes.data || [];
        const dailyData = analyticsRes.data || [];

        // 3. Aggregate totals for the Top Summary Cards
        const totals = dailyData.reduce((acc, curr) => {
            acc.processed += curr.total_processed || 0;
            acc.delivered += curr.delivered_count || 0;
            acc.failed += curr.failed_count || 0;
            acc.rejected += curr.rejected_count || 0;
            acc.cost += curr.total_cost || 0;
            return acc;
        }, { processed: 0, delivered: 0, failed: 0, rejected: 0, cost: 0 });

        // 4. Reverse daily data so chronological order is left-to-right on the chart
        const chartData = [...dailyData].reverse();    

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
            recentActivity: campaigns,
            chartDataJSON: JSON.stringify(chartData)
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