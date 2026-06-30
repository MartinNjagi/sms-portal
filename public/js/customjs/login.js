// public/js/customjs/login.js

// --- WEBAUTHN BASE64 HELPERS ---
function bufferDecode(value) {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const binary = window.atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

function bufferEncode(value) {
    const bytes = new Uint8Array(value);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}


let loginVM = new Vue({
    el: '#login',
    data: {
        OTPcode: '',
        code: '', 
        fullname: '', 
        email: '', 
        terms: false, 
        loading: '',
        success: false,
        error: false,
        busy: false,
        password: '',
        password1: '',
        msisdn: '',
        company: '',
        country_code: 'ke',
        show_signup: 0,
        title: 'Login',
        showPassword: false,
        pendingRedirectUrl: '', // Stores the redirect URL while we prompt for Passkey
    },
    methods: {
        toggleShowPassword() {
            this.showPassword = !this.showPassword;
        },
        showLogin: function () {
            this.title = "Login";
            this.show_signup = 0;
        },
        showJoin: function () {
            this.title = "Get Started";
            this.show_signup = 1;
        },
        showForgotPassword: function () {
            this.title = "Forgot Password";
            this.show_signup = 2;
        },
        showOTP: function () {
            this.title = "Enter Verification Code";
            this.show_signup = 3;
        },
        showOTPVerification: function () {
            this.title = "Enter Verification Code";
            this.show_signup = 4;
        },
        showLoginOTP: function () {
            this.title = "Enter Login OTP";
            this.show_signup = 5; // New state specifically for Login 2FA
        },
        showError: function (err) {
            this.loading = '';
            
            // Safely extract the message with a fallback
            let msg = "An unexpected error occurred.";
            if (err.response && err.response.data && err.response.data.error) {
                msg = err.response.data.error; 
            } else if (err.response && err.response.data && err.response.data.message) {
                msg = err.response.data.message;
            } else if (err.message) {
                msg = err.message;
            }

            this.error = msg;
            swal("Failed", msg, "error");
        },
        
        // --- AUTH: STEP 1 (Verify Password & Send SMS) ---
        login: async function (ele) {
            if (ele) ele.preventDefault();
            if (this.loading) return;
            if (!this.password) { swal("Missing Fields", "Missing Password", "error"); return; }
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }
            
            let data = {
                msisdn: this.msisdn,
                password: this.password
            };
            
            let vm = this;
            vm.loading = "loading";

            // Hit our new BFF endpoint for Step 1
            axios.post('/api/auth/login/request-otp', data)
                .then(function (response) {
                    vm.loading = "";
                    // Password is correct, SMS triggered. Show the OTP input view.
                    vm.showLoginOTP();                     
                    swal({
                    title: "OTP Sent",
                    text: "Please check your phone for the verification code.",
                    icon: "success",
                    timer: 3000, // Time in milliseconds (3 seconds)
                    buttons: false // Optional: hides the "OK" button
                    });
                })
                .catch(function (err) {
                    vm.showError(err);
                });
        },

        showPasskeyPrompt: function () {
            this.title = "Create a Passkey";
            this.show_signup = 6;
        },

        // --- AUTH: STEP 2 (Verify OTP & Prompt Passkey) ---
        verifyLoginOTP: function (ele) {
            if (ele) ele.preventDefault();
            if (this.loading) return;
            if (!this.OTPcode) { swal("Missing Fields", "Missing Verification Code", "error"); return; }
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }

            let data = {
                msisdn: this.msisdn,
                code: this.OTPcode
            };

            let vm = this;
            vm.loading = "loading";

            axios.post('/api/auth/login/verify-otp', data)
                .then(function (response) {
                    vm.loading = "";
                    localStorage.setItem('user', JSON.stringify(response.data.user));
                    localStorage.setItem('permissions', JSON.stringify(response.data.permissions));
                    
                    // Instead of redirecting immediately, store URL and prompt for Passkey
                    vm.pendingRedirectUrl = response.data.redirectUrl;
                    vm.showPasskeyPrompt();
                }).catch(function (err) {
                    vm.showError(err);
                });
        },

        // --- PASSKEY: REGISTRATION ---
        skipPasskey: function () {
            window.location.replace(this.pendingRedirectUrl || '/dashboard');
        },

        registerPasskey: async function () {
            let vm = this;
            vm.loading = "loading";

            try {
                // 1. Get challenge from server
                const beginRes = await axios.post('/api/auth/passkey/register/begin');
                const options = beginRes.data.data.options;
                const sessionKey = beginRes.data.data.session_key;

                // Decode buffers for browser
                options.publicKey.challenge = bufferDecode(options.publicKey.challenge);
                options.publicKey.user.id = bufferDecode(options.publicKey.user.id);
                if (options.publicKey.excludeCredentials) {
                    options.publicKey.excludeCredentials.forEach(cred => {
                        cred.id = bufferDecode(cred.id);
                    });
                }

                // 2. Prompt browser biometrics/hardware key
                const credential = await navigator.credentials.create({ publicKey: options.publicKey });

                // Encode buffers for server
                const credentialPayload = {
                    id: credential.id,
                    rawId: bufferEncode(credential.rawId),
                    type: credential.type,
                    response: {
                        attestationObject: bufferEncode(credential.response.attestationObject),
                        clientDataJSON: bufferEncode(credential.response.clientDataJSON)
                    }
                };

                // 3. Send to server to finish registration
                await axios.post('/api/auth/passkey/register/finish', {
                    session_key: sessionKey,
                    credential: credentialPayload
                });

                swal("Success", "Passkey registered! You can use it next time you log in.", "success")
                    .then(() => {
                        window.location.replace(vm.pendingRedirectUrl || '/dashboard');
                    });

            } catch (err) {
                vm.loading = "";
                // If user cancels the biometric prompt, don't show a massive error, just skip
                if (err.name === 'NotAllowedError') {
                    vm.skipPasskey();
                    return;
                }
                vm.showError(err);
            }
        },

        // --- PASSKEY: LOGIN ---
        passkeyLogin: async function () {
            let vm = this;
            vm.loading = "loading";

            try {
                // 1. Get challenge (discoverable login, no msisdn needed)
                const beginRes = await axios.post('/api/auth/passkey/login/begin', { msisdn: this.msisdn });
                const options = beginRes.data.data.options;
                const sessionKey = beginRes.data.data.session_key;

                options.publicKey.challenge = bufferDecode(options.publicKey.challenge);
                if (options.publicKey.allowCredentials) {
                    options.publicKey.allowCredentials.forEach(cred => {
                        cred.id = bufferDecode(cred.id);
                    });
                }

                // 2. Prompt browser biometrics
                const assertion = await navigator.credentials.get({ publicKey: options.publicKey });

                const assertionPayload = {
                    id: assertion.id,
                    rawId: bufferEncode(assertion.rawId),
                    type: assertion.type,
                    response: {
                        authenticatorData: bufferEncode(assertion.response.authenticatorData),
                        clientDataJSON: bufferEncode(assertion.response.clientDataJSON),
                        signature: bufferEncode(assertion.response.signature),
                        userHandle: assertion.response.userHandle ? bufferEncode(assertion.response.userHandle) : null
                    }
                };

                // 3. Finish login and get JWT cookie
                const finishRes = await axios.post('/api/auth/passkey/login/finish', {
                    session_key: sessionKey,
                    credential: assertionPayload
                });

                localStorage.setItem('user', JSON.stringify(finishRes.data.user));
                localStorage.setItem('permissions', JSON.stringify(finishRes.data.permissions));
                window.location.replace(finishRes.data.redirectUrl);

            } catch (err) {
                vm.loading = "";
                if (err.name === 'NotAllowedError') return; // User closed the prompt
                vm.showError(err);
            }
        },

         // --- OTHER ACCOUNT FLOWS ---
        resendCode: function () {
            if (this.loading) return;
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }
            
            let data = {
                service: 'identity',
                msisdn: this.msisdn,
                route: 'auth/user/resend/verification'
            };
            let vm = this;
            vm.loading = "loading";
            axios.post('/request/api', data)
                .then(function (response) {
                    vm.loading = "";
                    swal("Code Sent", "A new code has been sent to your phone.", "success");
                })
                .catch(function (err) {
                    vm.showError(err);
                });
        },

        // --- AUTH: FORGOT PASSWORD (STEP 1: Send SMS) ---
        reset: function () {
            let vm = this;
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }
            
            let data = { msisdn: vm.msisdn };
            vm.loading = 'loading';

            // Hits the new BFF route instead of the old proxy
            axios.post('/api/auth/password/forgot-send', data)
                .then(function (response) {
                    vm.loading = '';
                    swal("OTP Sent", response.data.message || "Please check your phone for the verification code.", "success");
                    vm.showOTP(); // Shows signup state 3
                })
                .catch(function (err) {
                    vm.showError(err);
                });
        },

        // --- AUTH: RESET PASSWORD (STEP 2 & 3: Verify & Reset) ---
        otp: async function (ele) {
            if (ele) ele.preventDefault();
            let vm = this;
            
            // Validation
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }
            if (!this.code) { swal("Missing Fields", "Missing Verification Code", "error"); return; }
            if (!this.password || !this.password1) { swal("Missing Fields", "Please enter and confirm your new password", "error"); return; }
            if (this.password !== this.password1) { swal("Mismatch", "Passwords do not match", "error"); return; }
            if (this.password.length < 8) { swal("Invalid", "Password must be at least 8 characters long", "error"); return; }

            vm.loading = 'loading';

            try {
                // Step 2: Verify the 6-digit OTP to get the secure reset_token UUID
                const verifyRes = await axios.post('/api/auth/password/forgot-verify', {
                    msisdn: vm.msisdn,
                    code: vm.code
                });

                // Extract the UUID from the response wrapper
                const resetToken = verifyRes.data.data.reset_token;

                // Step 3: Immediately use the reset_token to set the new password
                await axios.post('/api/auth/password/reset', {
                    msisdn: vm.msisdn,
                    reset_token: resetToken,
                    new_password: vm.password
                });

                vm.loading = '';
                swal("Success", "Your password has been reset successfully. Please log in with your new credentials.", "success")
                    .then(() => {
                        // Clear sensitive data and return to login screen
                        vm.password = '';
                        vm.password1 = '';
                        vm.code = '';
                        vm.showLogin(); 
                    });

            } catch (err) {
                vm.showError(err);
            }
        },

    
    }
});