document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. TAB NAVIGATION FIX (Bootstrap 5)
    // ==========================================
    const tabLinks = document.querySelectorAll('#settings-list-tab .list-group-item');
    const tabPanes = document.querySelectorAll('.tab-content .tab-pane');

    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            tabLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('show', 'active'));
            
            this.classList.add('active');
            const targetId = this.getAttribute('href');
            const targetPane = document.querySelector(targetId);
            if (targetPane) targetPane.classList.add('show', 'active');
            
            // Save tab to URL hash for refresh persistence
            if(history.pushState) {
                history.pushState(null, null, targetId);
            }
        });
    });

    if (window.location.hash) {
        const directLink = document.querySelector(`a[href="${window.location.hash}"]`);
        if (directLink) directLink.click();
    }

    // ==========================================
    // 2. ADMIN CONTEXT SWITCHER
    // ==========================================
    const clientSwitcher = document.getElementById('adminClientSwitcher');
    const loadClientBtn = document.getElementById('btn-load-client');
    
    if (loadClientBtn && clientSwitcher) {
        loadClientBtn.addEventListener('click', () => {
            const selectedId = clientSwitcher.value;
            const url = new URL(window.location.href);
            if (selectedId) {
                url.searchParams.set('client_id', selectedId);
            } else {
                url.searchParams.delete('client_id');
            }
            window.location.href = url.toString();
        });
    }

    // ==========================================
    // 3. WEBHOOK MANAGEMENT (NEW)
    // ==========================================
    const formWebhook = document.getElementById('form-webhook');
    if (formWebhook) {
        formWebhook.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = formWebhook.querySelector('button[type="submit"]');
            btn.disabled = true;
            btn.innerText = 'Saving...';

            try {
                const res = await fetch('/settings/api/webhook', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ webhook_url: document.getElementById('webhookUrl').value })
                });
                const result = await res.json();
                
                if (res.ok) {
                    alert('Webhook updated successfully!');
                } else {
                    alert(result.error || 'Failed to save webhook.');
                }
            } catch (err) {
                alert('A network error occurred.');
            } finally {
                btn.disabled = false;
                btn.innerText = 'Save Webhook';
            }
        });
    }

    // ==========================================
    // 4. API KEY MANAGEMENT
    // ==========================================
    const btnGenerateKey = document.getElementById('btn-generate-key');
    if (btnGenerateKey) {
        btnGenerateKey.addEventListener('click', async () => {
            btnGenerateKey.disabled = true;
            btnGenerateKey.innerText = 'Generating...';

            try {
                // Pass targetClientId if Admin is generating a key for a client
                const payload = targetClientId ? { client_id: targetClientId } : {};
                
                const res = await fetch('/settings/api/keys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await res.json();
                
                if (res.ok && result.data && result.data.key) {
                    document.getElementById('newApiKeyValue').value = result.data.key;
                    // Assuming Bootstrap 5
                    new bootstrap.Modal(document.getElementById('apiKeyModal')).show();
                } else {
                    alert(result.error || 'Failed to generate API Key.');
                }
            } catch (err) {
                alert('A network error occurred.');
            } finally {
                btnGenerateKey.disabled = false;
                btnGenerateKey.innerText = '+ Generate New Key';
            }
        });
    }

    document.querySelectorAll('.btn-revoke-key').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Are you sure you want to revoke this API key? This action is permanent and will break any integrations using it.')) return;
            
            const keyId = e.target.getAttribute('data-id');
            e.target.disabled = true;

            try {
                const payload = targetClientId ? { client_id: targetClientId } : {};
                
                const res = await fetch(`/settings/api/keys/${keyId}`, { 
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    document.getElementById(`row-key-${keyId}`).remove();
                } else {
                    const result = await res.json();
                    alert(result.error || 'Failed to revoke API Key.');
                    e.target.disabled = false;
                }
            } catch (err) {
                alert('A network error occurred.');
                e.target.disabled = false;
            }
        });
    });

    // ==========================================
    // 5. ADMIN BILLING ACTIONS
    // ==========================================
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

});