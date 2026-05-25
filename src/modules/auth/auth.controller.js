const goEngineWrapper = require('../../services/goEngineWrapper');

// Renders the Nunjucks login page
const renderLogin = (req, res) => {
    res.render('login/index.njk', { title: 'Login - SMS Platform' });
};

// Step 1: Pass credentials to Go to trigger SMS
const handleRequestOtp = async (req, res) => {
    try {
        const { msisdn, password } = req.body;
        const result = await goEngineWrapper.requestOtp(msisdn, password);
        
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
        const result = await goEngineWrapper.verifyOtp(msisdn, code);

        // 1. The BFF catches result.token and HIDES it inside an encrypted cookie
    res.cookie('access_token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000 
    });

    // 2. The BFF passes ONLY the safe data to the Vue frontend
    res.status(200).json({
        message: "Login successful",
        user: result.user,               // <-- Passed through
        permissions: result.permissions, // <-- Passed through
        redirectUrl: '/dashboard'
    });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

// Destroys the session cookie to log the user out
const logout = (req, res) => {
    res.clearCookie('access_token');
    res.redirect('/login');
};

module.exports = {
    renderLogin,
    handleRequestOtp,
    handleVerifyOtp,
    logout
};