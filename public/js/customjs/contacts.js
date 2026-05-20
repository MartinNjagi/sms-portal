// public/js/customjs/contacts.js

document.addEventListener('DOMContentLoaded', () => {
    const createGroupForm = document.getElementById('createGroupForm');
    
    if (createGroupForm) {
        createGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent standard page reload
            
            const btn = document.getElementById('saveGroupBtn');
            const statusDiv = document.getElementById('groupStatus');
            const groupName = document.getElementById('groupName').value.trim();
            const description = document.getElementById('groupDescription').value.trim();

            // UI Reset
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
            statusDiv.style.display = 'none';

            try {
                // Assuming you mounted the contacts router at '/contacts' in server.js
                const response = await fetch('/contacts/api/groups', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ groupName, description })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // The Go Engine successfully saved it!
                    // The easiest way to update the UI is to reload the view,
                    // which will now fetch the newly updated list of groups from Go.
                    window.location.reload();
                } else {
                    throw new Error(result.error || 'Failed to create group. Please try again.');
                }
            } catch (err) {
                statusDiv.innerText = err.message;
                statusDiv.style.display = 'block';
                btn.disabled = false;
                btn.innerText = 'Save Group';
            }
        });
    }
});