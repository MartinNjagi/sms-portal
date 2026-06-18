document.addEventListener('DOMContentLoaded', () => {
    // 1. Handle Sender ID Request
    const senderForm = document.getElementById('form-request-sender-id');
    if (senderForm) {
        senderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-sender');
            btn.disabled = true; btn.innerText = 'Submitting...';

            const payload = {
                sender_id: document.getElementById('senderIdInput').value,
                justification: document.getElementById('senderIdJustification').value
            };

            try {
                const res = await fetch('/messages/api/sender-ids', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) { alert('Sender ID requested successfully!'); location.reload(); }
                else { alert(data.error || 'Failed to request Sender ID.'); }
            } catch(err) { alert('Network error occurred.'); }
            finally { btn.disabled = false; btn.innerText = 'Submit Request'; }
        });
    }

    // 2. Handle Template Creation
    const templateForm = document.getElementById('form-create-template');
    if (templateForm) {
        templateForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-template');
            btn.disabled = true; btn.innerText = 'Creating...';

            const payload = {
                name: document.getElementById('templateNameInput').value,
                content: document.getElementById('templateContentInput').value
            };

            try {
                const res = await fetch('/messages/api/templates', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (res.ok) { alert('Template created successfully!'); location.reload(); }
                else { alert(data.error || 'Failed to create template.'); }
            } catch(err) { alert('Network error occurred.'); }
            finally { btn.disabled = false; btn.innerText = 'Create Template'; }
        });
    }

    // Helper function to handle the API call for Approvals and Rejections
    async function handleReview(type, id, status) {
        let reason = '';
        
        // If rejecting, ask the admin for a reason to send back to the client
        if (status === 'REJECTED') {
            reason = prompt(`Please provide a reason for rejecting this ${type}:`);
            if (reason === null) return; // Admin clicked cancel
        } else {
            if (!confirm(`Are you sure you want to approve this ${type}?`)) return;
        }

        try {
            const endpoint = type === 'sender' 
                ? `/messages/api/sender-ids/${id}/review` 
                : `/messages/api/templates/${id}/review`;

            const res = await fetch(endpoint, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, reason })
            });

            const data = await res.json();
            
            if (res.ok) {
                alert(`${type.toUpperCase()} successfully marked as ${status}`);
                location.reload();
            } else {
                alert(data.error || `Failed to review ${type}`);
            }
        } catch (err) {
            alert('A network error occurred while submitting the review.');
        }
    }

    // Attach listeners for Sender IDs
    document.querySelectorAll('.approve-sender-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleReview('sender', e.target.getAttribute('data-id'), 'APPROVED'));
    });
    
    document.querySelectorAll('.reject-sender-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleReview('sender', e.target.getAttribute('data-id'), 'REJECTED'));
    });

    // Attach listeners for Templates
    document.querySelectorAll('.approve-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleReview('template', e.target.getAttribute('data-id'), 'APPROVED'));
    });
    
    document.querySelectorAll('.reject-template-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleReview('template', e.target.getAttribute('data-id'), 'REJECTED'));
    });
});
