document.addEventListener('DOMContentLoaded', function() {
    
    // ---------------------------------------------------------
    // 1. Fetch Roles when the Create User modal opens
    // ---------------------------------------------------------
    const createUserModal = document.getElementById('createUserModal');
    
    if (createUserModal) {
        // Bootstrap 5 standard event listener
        createUserModal.addEventListener('show.bs.modal', function () {
            const roleSelect = document.getElementById('role_id');
            const clientIdInput = document.getElementById('client_id');
            
            if (!clientIdInput) return;
            
            const clientId = clientIdInput.value;

            // Hit your Node proxy
            axios.get(`/users/api/roles?client_id=${clientId}`)
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
            client_id: parseInt(document.getElementById('client_id').value),
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            role_id: parseInt(document.getElementById('role_id').value),
            password: document.getElementById('password').value
        };

        axios.post('/users/api/create', payload)
            .then(response => {
                alert('User created successfully!');
                
                // Bootstrap 5 way to hide a modal programmatically
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