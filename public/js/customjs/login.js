// public/js/customjs/login.js

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
        showPassword: false
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
                    console.log("After Login");
                    
                    swal("OTP Sent", "Please check your phone for the verification code.", "success");
                })
                .catch(function (err) {
                    vm.showError(err);
                });
        },

        // --- AUTH: STEP 2 (Verify OTP & Redirect) ---
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

            // public/js/customjs/login.js
            axios.post('/api/auth/login/verify-otp', data)
                .then(function (response) {
                    // You can save the user & permissions to localStorage or Vuex here
                    // so the dashboard knows who is logged in!
                    localStorage.setItem('user', JSON.stringify(response.data.user));
                    localStorage.setItem('permissions', JSON.stringify(response.data.permissions));
                    
                    // The browser automatically brings the HttpOnly cookie along
                    window.location.replace(response.data.redirectUrl);
                }).catch(function (err) {
                    vm.showError(err);
                });
        },

        // --- OTHER ACCOUNT FLOWS ---
        otp: function () {
            if (this.loading) return;
            if (!this.code) { swal("Missing Fields", "Missing Verification Code", "error"); return; }
            if (this.password !== this.password1) { swal("Missing Fields", "Mismatching password", "error"); return; }
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }
            
            let data = {
                service: 'identity',
                msisdn: this.msisdn,
                password: this.password,
                verification_code: this.code,
                route: 'auth/user/password/reset'
            };
            let vm = this;
            vm.loading = "loading";

            axios.post('/request/api', data) 
                .then(function (response) {
                    vm.loading = "";
                    swal("Success", "Password reset successfully. Please log in.", "success");
                    vm.showLogin();
                })
                .catch(function (err) {
                    vm.showError(err);
                });
        },
        verificationOtp: function () {
            if (this.loading) return;
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }
            if (!this.OTPcode) { swal("Missing Fields", "Missing Verification Code", "error"); return; }
            
            let data = {
                service: 'identity',
                verification_code: this.OTPcode,
                msisdn: this.msisdn,
                route: 'auth/user/verify'
            };
            let vm = this;
            vm.loading = "loading";

            axios.post('/request/api', data) 
                .then(function (response) {
                    vm.loading = "";
                    if (response.status === 201 || response.status === 200) {
                        swal("Success", "Account Verified! Please log in.", "success");
                        vm.showLogin();
                    }
                })
                .catch(function (err) {
                    vm.showError(err);
                });
        },
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
        signup: function (ele) {
            if(ele) ele.preventDefault();
            
            if (!this.fullname) { swal("Missing Fields", "Missing Full Name", "error"); return; }
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }
            if (!this.email) { swal("Missing Fields", "Missing Email", "error"); return; }
            if (!this.company) { swal("Missing Fields", "Missing Company Name", "error"); return; }
            if (!this.terms) { swal("Missing Fields", "You must accept terms and conditions to proceed", "error"); return; }
            if (this.password.length < 6) { swal("Missing Fields", "Password must have at least 6 characters", "error"); return; }
            if (this.password !== this.password1) { swal("Missing Fields", "Mismatching password", "error"); return; }

            let visitor = typeof getObject === "function" ? getObject('visitor') : null;
            this.country_code = visitor ? visitor.countryCode : 'ke';
            
            let data = {
                service: 'identity',
                full_name: this.fullname,
                msisdn: this.msisdn,
                email: this.email,
                company_name: this.company,
                country_code: this.country_code,
                password: this.password,
                route: 'auth/signup'
            };
            
            let vm = this;
            vm.loading = 'loading';

            axios.post('/request/api', data)
                .then(function (response) {
                    vm.loading = '';
                    if (response.status === 201 || response.status === 200) {
                        vm.title = "Enter Verification Code";
                        vm.show_signup = 4;
                    }
                })
                .catch(function (err) {
                    vm.showError(err);
                });
        },
        reset: function () {
            let vm = this;
            if (!this.msisdn) { swal("Missing Fields", "Missing Mobile Number", "error"); return; }
            
            let toPost = {
                service: 'identity',
                route: 'auth/user/password/forgot',
                msisdn: vm.msisdn
            };
            vm.loading = 'loading';

            axios.post('/request/api', toPost)
                .then(function (response) {
                    vm.loading = '';
                    swal("Password Reset!", response.data.message || "Instructions sent.", "success");
                    vm.showOTP();
                })
                .catch(function (err) {
                    vm.showError(err);
                });
        }
    }
});