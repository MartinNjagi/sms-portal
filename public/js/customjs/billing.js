document.getElementById('form-mpesa-topup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-mpesa-pay');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Pushing to phone...';

    const payload = {
        amount: parseFloat(document.getElementById('mpesaAmount').value),
        phone: document.getElementById('mpesaPhone').value
    };

    try {
        const res = await axios.post('/accounts/api/topup/mpesa', payload);
        swal("Check your phone", "Please enter your M-Pesa PIN to complete the transaction.", "info");
    } catch (err) {
        swal("Error", err.response?.data?.error || "Top-up failed", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = 'Trigger STK Push';
    }
});

document.getElementById('form-card-topup')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-card-pay');
    btn.disabled = true;
    btn.innerText = 'Redirecting...';

    const payload = { amount: parseFloat(document.getElementById('cardAmount').value) };

    try {
        // Your backend should return a Stripe/Gateway checkout URL
        const res = await axios.post('/accounts/api/topup/card', payload);
        window.location.href = res.data.checkoutUrl; 
    } catch (err) {
        swal("Error", err.response?.data?.error || "Failed to initialize checkout", "error");
        btn.disabled = false;
        btn.innerText = 'Proceed to Secure Checkout';
    }
});