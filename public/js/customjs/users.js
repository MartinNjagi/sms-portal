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

            // Updated payload to match Go struct requirements
            const payload = {
                client_id: parseInt(document.getElementById('client_id').value),
                full_name: document.getElementById('name').value, // Changed from 'name'
                email: document.getElementById('email').value,
                msisdn: document.getElementById('msisdn').value,  // Added MSISDN
                role_id: parseInt(document.getElementById('role_id').value),
                password: document.getElementById('password').value
            };

            axios.post('/users/api/create', payload)
                .then(response => {
                    alert('User created successfully!');
                    
                    // Get the actual DOM element for Bootstrap 5 instance
                    const modalEl = document.getElementById('createUserModal');
                    const modalInstance = bootstrap.Modal.getInstance(modalEl);
                    if (modalInstance) {
                        modalInstance.hide();
                    }
                    
                    window.location.reload(); 
                })
                .catch(error => {
                    console.error('Error creating user:', error);
                    
                    // Look for error.response.data.error instead of .message
                    const errorMessage = error.response && error.response.data && error.response.data.error 
                        ? error.response.data.error 
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