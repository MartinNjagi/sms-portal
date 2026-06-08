document.addEventListener('DOMContentLoaded', () => {
    
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
                    location.reload(); // Quick refresh to show the new pending ID
                } else {
                    alert(result.error || 'Failed to request Sender ID.');
                }
            } catch (error) {
                alert('A network error occurred.');
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

});