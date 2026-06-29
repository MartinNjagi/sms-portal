document.addEventListener('DOMContentLoaded', function() {
    
    // ---------------------------------------------------------
    // 1. Fetch Roles when the Create User modal opens
    // ---------------------------------------------------------
    const createUserModal = document.getElementById('createUserModal');
    
    if (createUserModal) {
        createUserModal.addEventListener('show.bs.modal', async () => {
            const roleSelect = document.getElementById('role_id');
            const clientId = document.getElementById('client_id')?.value;

            if (!clientId || !roleSelect) return;

            roleSelect.innerHTML = '<option>Loading...</option>';

            try {
                const { data } = await axios.get(`/users/api/roles`, {
                    params: { client_id: clientId }
                });

                roleSelect.innerHTML = '<option value="">Select a role...</option>';

                (data.data || []).forEach(({ id, name }) => {
                    roleSelect.add(new Option(name, id));
                });
            } catch (err) {
                console.error(err);
                roleSelect.innerHTML = '<option value="">Failed to load roles</option>';
            }
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

    // ---------------------------------------------------------
    // 3. Actions Modal: Fetch & Populate User Data
    // ---------------------------------------------------------
    const actionsUserModal = document.getElementById('actionsUserModal');
    
    if (actionsUserModal) {
        actionsUserModal.addEventListener('show.bs.modal', async (e) => {
            const btn = e.relatedTarget;
            const userId = btn.getAttribute('data-userid');
            
            const form = document.getElementById('updateUserForm');
            const loader = document.getElementById('actionsLoading');
            
            // Reset view
            form.classList.add('d-none');
            loader.classList.remove('d-none');
            document.getElementById('update_user_id').value = userId;

            try {
                // Fetch current user details
                const { data } = await axios.get(`/users/api/${userId}`);
                const user = data.data;

                document.getElementById('update_name').value = user.full_name;
                document.getElementById('update_email').value = user.email;
                document.getElementById('update_status').value = user.status;

                // Show form, hide loader
                loader.classList.add('d-none');
                form.classList.remove('d-none');
            } catch (err) {
                console.error(err);
                alert('Failed to load user details.');
                bootstrap.Modal.getInstance(actionsUserModal).hide();
            }
        });
    }

    // ---------------------------------------------------------
    // 4. Submit User Updates
    // ---------------------------------------------------------
    const updateUserForm = document.getElementById('updateUserForm');
    if (updateUserForm) {
        updateUserForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = document.getElementById('saveUpdateBtn');
            const userId = document.getElementById('update_user_id').value;
            
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

            const payload = {
                full_name: document.getElementById('update_name').value,
                status: document.getElementById('update_status').value
            };

            axios.put(`/users/api/${userId}`, payload)
                .then(() => {
                    alert('User updated successfully!');
                    window.location.reload(); 
                })
                .catch(error => {
                    console.error('Error updating user:', error);
                    alert(error.response?.data?.error || 'Failed to update user.');
                })
                .finally(() => {
                    btn.disabled = false;
                    btn.textContent = 'Save Changes';
                });
        });
    }

    // ---------------------------------------------------------
    // 5. Delete User action
    // ---------------------------------------------------------
    const deleteUserBtn = document.getElementById('deleteUserBtn');
    if (deleteUserBtn) {
        deleteUserBtn.addEventListener('click', function() {
            const userId = document.getElementById('update_user_id').value;
            
            if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                return;
            }

            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Deleting...';

            axios.delete(`/users/api/${userId}`)
                .then(() => {
                    alert('User deleted successfully!');
                    window.location.reload(); 
                })
                .catch(error => {
                    console.error('Error deleting user:', error);
                    alert(error.response?.data?.error || 'Failed to delete user.');
                    btn.disabled = false;
                    btn.textContent = 'Delete User';
                });
        });
    }

});