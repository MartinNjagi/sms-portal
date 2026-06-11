document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. TAB NAVIGATION FIX
    // ==========================================
    const tabLinks = document.querySelectorAll('#settings-list-tab .list-group-item');
    const tabPanes = document.querySelectorAll('.tab-content .tab-pane');

    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            tabLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('show', 'active'));
            
            this.classList.add('active');
            const targetPane = document.querySelector(this.getAttribute('href'));
            if (targetPane) targetPane.classList.add('show', 'active');
        });
    });

    if (window.location.hash) {
        const directLink = document.querySelector(`a[href="${window.location.hash}"]`);
        if (directLink) directLink.click();
    }

    // ==========================================
    // 2. ADMIN TOOLS LOGIC
    // ==========================================
    const adminClientDropdowns = document.querySelectorAll('.admin-client-dropdown');
    
    // Only fetch clients if the admin dropdowns exist on the page
    if (adminClientDropdowns.length > 0) {
        
        // Fetch clients to populate the target selectors
        fetch('/clients') // Adjust to your actual identity/clients BFF endpoint
            .then(res => res.json())
            .then(data => {
                const clients = Array.isArray(data) ? data : (data.data || []);
                adminClientDropdowns.forEach(dropdown => {
                    dropdown.innerHTML = '<option value="" disabled selected>Select a client</option>';
                    clients.forEach(c => {
                        dropdown.innerHTML += `<option value="${c.id}">[${c.id}] ${c.name}</option>`;
                    });
                });
            })
            .catch(console.error);

        // Handle Manual Wallet Adjustment Submission
        const adjForm = document.getElementById('form-manual-adjustment');
        if (adjForm) {
            adjForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btn-submit-adj');
                btn.disabled = true;
                btn.innerText = 'Processing...';

                const payload = {
                    client_id: parseInt(document.getElementById('adjClientId').value, 10),
                    action: document.getElementById('adjAction').value,
                    credits: parseInt(document.getElementById('adjCredits').value, 10),
                    description: document.getElementById('adjDescription').value
                };

                try {
                    const res = await fetch('/settings/api/admin/wallet-adjust', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (res.ok) {
                        alert('Wallet adjusted successfully.');
                        adjForm.reset();
                    } else {
                        alert(result.error || 'Adjustment failed.');
                    }
                } catch (err) {
                    alert('Network error.');
                } finally {
                    btn.disabled = false;
                    btn.innerText = 'Apply Adjustment';
                }
            });
        }

        // Handle Billing Configuration Submission
        const cfgForm = document.getElementById('form-billing-config');
        if (cfgForm) {
            cfgForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('btn-submit-cfg');
                btn.disabled = true;
                btn.innerText = 'Updating...';

                const clientId = document.getElementById('cfgClientId').value;
                const baseRateVal = document.getElementById('cfgBaseRate').value;
                
                const payload = {};
                // Only send fields if they were filled out, avoiding accidental overwrites
                if (baseRateVal !== "") payload.base_sms_rate = parseFloat(baseRateVal);
                payload.refund_on_failed_delivery = document.getElementById('cfgRefund').checked;

                try {
                    const res = await fetch(`/settings/api/admin/billing-config/${clientId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();

                    if (res.ok) {
                        alert('Billing configuration updated successfully.');
                        cfgForm.reset();
                    } else {
                        alert(result.error || 'Configuration update failed.');
                    }
                } catch (err) {
                    alert('Network error.');
                } finally {
                    btn.disabled = false;
                    btn.innerText = 'Update Configuration';
                }
            });
        }
    }
});