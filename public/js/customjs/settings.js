document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // TAB NAVIGATION FIX (Fallback for deep links)
    // ==========================================
    const tabLinks = document.querySelectorAll('#settings-list-tab .list-group-item');
    const tabPanes = document.querySelectorAll('.tab-content .tab-pane');

    tabLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // 1. Remove active classes from all links and panes
            tabLinks.forEach(l => l.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('show', 'active'));

            // 2. Add active class to the clicked link
            this.classList.add('active');

            // 3. Find target pane and show it
            const targetId = this.getAttribute('href');
            const targetPane = document.querySelector(targetId);
            if (targetPane) {
                targetPane.classList.add('show', 'active');
            }
        });
    });

    // Check URL hash on load to open a specific tab directly (e.g., /settings#templates)
    if (window.location.hash) {
        const directLink = document.querySelector(`a[href="${window.location.hash}"]`);
        if (directLink) directLink.click();
    }

    // ==========================================
    // SENDER ID MANAGEMENT
    // ==========================================
    const senderForm = document.getElementById('form-request-sender-id');
    
    if (senderForm) {
        senderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-submit-sender');
            const senderId = document.getElementById('senderIdInput').value;
            const justification = document.getElementById('senderIdJustification').value;

            submitBtn.disabled = true;
            submitBtn.innerText = 'Submitting...';

            try {
                const response = await fetch('/settings/api/sender-ids', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senderId, justification })
                });

                const result = await response.json();
                
                if (response.ok) {
                    alert(result.message || 'Sender ID requested successfully.');
                    location.reload(); 
                } else {
                    alert(result.error || 'Failed to request Sender ID.');
                }
            } catch (error) {
                alert('A network error occurred connecting to the backend.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Submit Request';
            }
        });
    }

    // Handle Sender ID Deletion
    document.querySelectorAll('.delete-sender-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Are you sure you want to delete this Sender ID?')) return;
            
            const id = e.target.getAttribute('data-id');
            e.target.disabled = true;

            try {
                const response = await fetch(`/settings/api/sender-ids/${id}`, { method: 'DELETE' });
                const result = await response.json();

                if (response.ok) {
                    document.getElementById(`row-sender-${id}`).remove();
                } else {
                    alert(result.error || 'Failed to delete Sender ID.');
                    e.target.disabled = false;
                }
            } catch (error) {
                alert('A network error occurred.');
                e.target.disabled = false;
            }
        });
    });

    // ==========================================
    // TEMPLATE MANAGEMENT
    // ==========================================
    const templateForm = document.getElementById('form-create-template');
    if (templateForm) {
        templateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('btn-submit-template');
            const name = document.getElementById('templateNameInput').value;
            const content = document.getElementById('templateContentInput').value;

            submitBtn.disabled = true;
            submitBtn.innerText = 'Saving...';

            try {
                const response = await fetch('/settings/api/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, content })
                });

                const result = await response.json();
                
                if (response.ok) {
                    alert(result.message || 'Template created successfully.');
                    // Force the hash so it reloads back onto the Templates tab
                    window.location.hash = 'templates';
                    location.reload(); 
                } else {
                    alert(result.error || 'Failed to create Template.');
                }
            } catch (error) {
                alert('A network error occurred.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Create Template';
            }
        });
    }

    // Handle Template Deletion
    document.querySelectorAll('.delete-template-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!confirm('Are you sure you want to delete this Template?')) return;
            
            const id = e.target.getAttribute('data-id');
            e.target.disabled = true;

            try {
                const response = await fetch(`/settings/api/templates/${id}`, { method: 'DELETE' });
                const result = await response.json();

                if (response.ok) {
                    document.getElementById(`row-template-${id}`).remove();
                } else {
                    alert(result.error || 'Failed to delete Template.');
                    e.target.disabled = false;
                }
            } catch (error) {
                alert('A network error occurred.');
                e.target.disabled = false;
            }
        });
    });


    // ==========================================
    // ADMIN ACTIONS (CLIENT SWITCHER)
    // ==========================================
    const clientSwitcher = document.getElementById('adminClientSwitcher');
    const loadClientBtn = document.getElementById('btn-load-client');

    if (clientSwitcher) {
        // Fetch clients to populate the dropdown
        // Assuming your auth/identity service exposes a standard GET /clients route
        fetch('/clients') // Adjust this if your BFF endpoint for listing clients is different
            .then(res => res.json())
            .then(data => {
                // If it's returning HTML instead of JSON, you may need a dedicated /api/clients route
                const clients = Array.isArray(data) ? data : (data.data || []);
                
                // Read current URL parameter to keep the selected client persistent
                const urlParams = new URLSearchParams(window.location.search);
                const currentClientId = urlParams.get('client_id');

                clients.forEach(c => {
                    const option = document.createElement('option');
                    option.value = c.id;
                    option.innerText = `[${c.id}] ${c.name}`;
                    if (currentClientId == c.id) option.selected = true;
                    clientSwitcher.appendChild(option);
                });
            })
            .catch(console.error);

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
    // ADMIN ACTIONS (APPROVE / REJECT)
    // ==========================================

    const handleApproval = async (type, id, status, button) => {
        let reason = '';
        if (status === 'rejected') {
            reason = prompt(`Please provide a reason for rejecting this ${type}:`);
            if (reason === null) return; // User cancelled the prompt
        }

        button.disabled = true;
        const originalText = button.innerText;
        button.innerText = '...';

        try {
            const response = await fetch(`/settings/api/admin/${type}s/${id}/approve`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, reason })
            });

            const result = await response.json();

            if (response.ok) {
                alert(`${type.toUpperCase()} ${status} successfully.`);
                location.reload();
            } else {
                alert(result.error || `Failed to update ${type}.`);
                button.disabled = false;
                button.innerText = originalText;
            }
        } catch (error) {
            alert('A network error occurred.');
            button.disabled = false;
            button.innerText = originalText;
        }
    };

    // Attach Sender ID Listeners
    document.querySelectorAll('.approve-sender-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleApproval('sender-id', e.target.getAttribute('data-id'), 'APPROVED', e.target));
    });
    document.querySelectorAll('.reject-sender-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleApproval('sender-id', e.target.getAttribute('data-id'), 'REJECTED', e.target));
    });

    // Attach Template Listeners
    document.querySelectorAll('.approve-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleApproval('template', e.target.getAttribute('data-id'), 'APPROVED', e.target));
    });
    document.querySelectorAll('.reject-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleApproval('template', e.target.getAttribute('data-id'), 'REJECTED', e.target));
    });

});