const goEngineWrapper = require('../../services/goEngineWrapper');

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
        const resultData = result.data

        // 1. The BFF catches result.token and HIDES it inside an encrypted cookie
        res.cookie('access_token', resultData.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 
        });

        // 2. Send the success response to the browser to trigger the redirect
        res.status(200).json({
            message: "Login successful",
            user: resultData.user,               
            permission_ids: resultData.permission_ids, 
            permissions: resultData.permissions,
            redirectUrl: '/dashboard'
        });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

// ── Password Reset Flow ───────────────────────────────────────────────────────

const handleForgotPasswordSend = async (req, res) => {
    try {
        const result = await goEngineWrapper.forgotPasswordSend(req.body.msisdn, req);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const handleForgotPasswordVerify = async (req, res) => {
    try {
        const { msisdn, code } = req.body;
        const result = await goEngineWrapper.forgotPasswordVerify(msisdn, code, req);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const handleResetPassword = async (req, res) => {
    try {
        const { msisdn, reset_token, new_password } = req.body;
        const result = await goEngineWrapper.resetPassword(msisdn, reset_token, new_password, req);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Destroys the session cookie to log the user out
const logout = (req, res) => {
    res.clearCookie('access_token');
    res.redirect('/login');
};

// ── Passkeys (WebAuthn) ───────────────────────────────────────────────────────

const passkeyLoginBegin = async (req, res) => {
    try {
        // MSISDN is optional here (if using discoverable credentials)
        const result = await goEngineWrapper.passkeyLoginBegin(req.body.msisdn, req);
        res.status(200).json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

const passkeyLoginFinish = async (req, res) => {
    try {
        const result = await goEngineWrapper.passkeyLoginFinish(req.body, req);
        const resultData = result.data;

        // 1. Set the cookie just like OTP verification
        res.cookie('access_token', resultData.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000 
        });

        // 2. Return user context to Vue
        res.status(200).json({
            message: "Passkey login successful",
            user: resultData.user,               
            permission_ids: resultData.permission_ids, 
            permissions: resultData.permissions,
            redirectUrl: '/dashboard'
        });
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

const passkeyRegisterBegin = async (req, res) => {
    try {
        // The Go engine will extract the user ID from the JWT cookie
        const result = await goEngineWrapper.passkeyRegisterBegin(req);
        res.status(200).json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};

const passkeyRegisterFinish = async (req, res) => {
    try {
        const result = await goEngineWrapper.passkeyRegisterFinish(req.body, req);
        res.status(200).json(result);
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
};


module.exports = {
    renderLogin,
    handleRequestOtp,
    handleVerifyOtp,
    logout,
    handleForgotPasswordSend,
    handleForgotPasswordVerify,
    handleResetPassword,
    passkeyLoginBegin,
    passkeyLoginFinish,
    passkeyRegisterBegin,
    passkeyRegisterFinish
};