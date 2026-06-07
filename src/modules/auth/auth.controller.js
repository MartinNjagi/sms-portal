const goEngineWrapper = require('../../services/goEngineWrapper');
const ws = require('../../services/webSocketService');

// Renders the Nunjucks login page
const renderLogin = (req, res) => {
    res.render('login/index.njk', { title: 'Login - SMS Platform' });
};

// Step 1: Pass credentials to Go to trigger SMS
const handleRequestOtp = async (req, res) => {
    try {
        const { msisdn, password } = req.body;
        const result = await goEngineWrapper.requestOtp(msisdn, password,req);
        
        // Tell the frontend to show the OTP input field
        res.status(200).json(result); 
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

// Step 2: Verify the code, catch the JWT, and set the Cookie
const handleVerifyOtp = async (req, res) => {
    try {
        const { msisdn, code } = req.body;
        const result = await goEngineWrapper.verifyOtp(msisdn, code, req);

        // 1. The BFF catches result.token and HIDES it inside an encrypted cookie
        res.cookie('access_token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 
        });

        // 2. Send the success response to the browser to trigger the redirect
        res.status(200).json({
            message: "Login successful",
            user: result.user,               
            permission_ids: result.permission_ids, 
            permissions: result.permissions,
            redirectUrl: '/dashboard'
        });
        ws.connect(result.token)
  .on('campaign.completed', (payload) => showToast(payload))
  .on('campaign.progress',  (payload) => updateProgressBar(payload))
  .on('system.alert',       (payload) => showAlert(payload));
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

// Destroys the session cookie to log the user out
const logout = (req, res) => {
    res.clearCookie('access_token');
    res.redirect('/login');
    ws.disconnect();
};

module.exports = {
    renderLogin,
    handleRequestOtp,
    handleVerifyOtp,
    logout
};