document.addEventListener('DOMContentLoaded', () => {
    // 1. Suspend Client
    document.querySelectorAll('.btn-suspend').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const clientId = e.target.closest('button').dataset.id;
            const clientName = e.target.closest('button').dataset.name;

            const confirm = await swal({
                title: "Suspend Tenant?",
                text: `This will instantly lock out all users under ${clientName} and disable their API keys.`,
                icon: "warning",
                buttons: ["Cancel", "Yes, Suspend"],
                dangerMode: true,
            });

            if (confirm) {
                try {
                    // Update this path to match your exact BFF router configuration
                    const res = await axios.post(`/admin/api/clients/${clientId}/suspend`);
                    swal("Suspended", res.data.message, "success").then(() => location.reload());
                } catch (err) {
                    swal("Error", err.response?.data?.error || "Failed to suspend client.", "error");
                }
            }
        });
    });

    // 2. Reinstate Client
    document.querySelectorAll('.btn-reinstate').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const clientId = e.target.closest('button').dataset.id;
            const clientName = e.target.closest('button').dataset.name;

            const confirm = await swal({
                title: "Reinstate Tenant?",
                text: `Restore access for users and API keys under ${clientName}?`,
                icon: "info",
                buttons: ["Cancel", "Yes, Reinstate"]
            });

            if (confirm) {
                try {
                    const res = await axios.post(`/admin/api/clients/${clientId}/reinstate`);
                    swal("Reinstated", res.data.message, "success").then(() => location.reload());
                } catch (err) {
                    swal("Error", err.response?.data?.error || "Failed to reinstate client.", "error");
                }
            }
        });
    });

    // Bank Transfer Approval Logic
    const processButtons = document.querySelectorAll('.btn-process-txn');
    
    processButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const txnId = e.target.getAttribute('data-id');
            const action = e.target.getAttribute('data-action');
            const row = document.getElementById(`txn-row-${txnId}`);
            
            const isConfirmed = confirm(`Are you sure you want to ${action.toLowerCase()} this transaction?`);
            if (!isConfirmed) return;

            const rowBtns = row.querySelectorAll('button');
            rowBtns.forEach(b => b.disabled = true);
            e.target.innerText = 'Processing...';

            try {
                const payload = {
                    status: action,
                    description: `Processed from Client Management by Superadmin`
                };

                // Hitting the endpoint we set up in the settings/billing routes
                const res = await fetch(`/settings/api/admin/bank-transfer/${txnId}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await res.json();

                if (res.ok) {
                    row.remove();
                    if (typeof swal !== 'undefined') {
                        swal("Success", `Transaction has been ${action.toLowerCase()}.`, "success");
                    }
                    // Optional: Reload page to update ledger balances below
                    // window.location.reload(); 
                } else {
                    alert(result.error || `Failed to ${action.toLowerCase()} transaction.`);
                    rowBtns.forEach(b => b.disabled = false);
                    e.target.innerText = action === 'APPROVED' ? 'Approve' : 'Reject';
                }
            } catch (err) {
                console.error(err);
                alert('A network error occurred.');
                rowBtns.forEach(b => b.disabled = false);
                e.target.innerText = action === 'APPROVED' ? 'Approve' : 'Reject';
            }
        });
    });

});