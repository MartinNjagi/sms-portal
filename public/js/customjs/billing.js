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

const bankForm = document.getElementById('form-bank-topup');
if (bankForm) {
    bankForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-bank-pay');
        btn.disabled = true;
        btn.innerText = 'Submitting...';

        const payload = {
            amount: parseFloat(document.getElementById('bankAmount').value),
            reference_number: document.getElementById('bankReference').value
        };

        try {
            const res = await fetch('/accounts/api/topup/bank-transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            
            if (res.ok) {
                swal("Success", "Bank transfer submitted for approval. We will credit your account once verified.", "success");
                bankForm.reset();
                bootstrap.Modal.getInstance(document.getElementById('topUpModal')).hide();
            } else {
                swal("Error", result.error || "Failed to submit receipt", "error");
            }
        } catch (err) {
            swal("Error", "Network error occurred.", "error");
        } finally {
            btn.disabled = false;
            btn.innerText = 'Submit Receipt for Approval';
        }
    });
}