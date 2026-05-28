document.addEventListener('DOMContentLoaded', function() {
    
    // ---------------------------------------------------------
    // 1. Fetch Roles when the Create User modal opens
    // ---------------------------------------------------------
    const createUserModal = document.getElementById('createUserModal');
    
    if (createUserModal) {
        // Vanilla JS equivalent for Bootstrap 5 modal event
        createUserModal.addEventListener('show.bs.modal', function () {
            const roleSelect = document.getElementById('role_id');
            const clientIdInput = document.getElementById('client_id');
            
            if (!clientIdInput) return; // Exit if not on the user page
            
            const clientId = clientIdInput.value;

            // Hit your Node proxy, which forwards to your Go identity service
            axios.post('/request/api', {
                service: 'identity',
                route: 'roles', 
                client_id: parseInt(clientId) 
            })
            .then(response => {
                roleSelect.innerHTML = '<option value="">Select a role...</option>';
                
                const roles = response.data.message || response.data;
                if (Array.isArray(roles)) {
                    roles.forEach(role => {
                        let option = document.createElement('option');
                        option.value = role.id;
                        option.textContent = role.name;
                        roleSelect.appendChild(option);
                    });
                }
            })
            .catch(error => {
                console.error('Error fetching roles:', error);
                roleSelect.innerHTML = '<option value="">Failed to load roles</option>';
            });
        });
    }

    // ---------------------------------------------------------
    // 2. Submit the New User to the Backend
    // ---------------------------------------------------------
    const createUserForm = document.getElementById('createUserForm');
    
    if (createUserForm) {
        createUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = document.getElementById('saveUserBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Creating...';

            const payload = {
                service: 'identity',
                route: 'user/create', 
                client_id: parseInt(document.getElementById('client_id').value),
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                role_id: parseInt(document.getElementById('role_id').value),
                password: document.getElementById('password').value
            };

            axios.post('/request/api', payload)
            .then(response => {
                alert('User created successfully!');
                
                // Vanilla JS equivalent to hide Bootstrap 5 modal
                const modalInstance = bootstrap.Modal.getInstance(createUserModal);
                if (modalInstance) {
                    modalInstance.hide();
                }
                
                window.location.reload(); 
            })
            .catch(error => {
                console.error('Error creating user:', error);
                const errorMessage = error.response && error.response.data && error.response.data.message 
                    ? error.response.data.message 
                    : 'Failed to create user.';
                alert(errorMessage);
            })
            .finally(() => {
                btn.disabled = false;
                btn.textContent = 'Create User';
            });
        });
    }
});