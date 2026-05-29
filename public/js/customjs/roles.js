document.addEventListener('DOMContentLoaded', function() {
    
    const createRoleModal = document.getElementById('createRoleModal');
    const permissionsContainer = document.getElementById('permissionsContainer');
    const permissionsLoading = document.getElementById('permissionsLoading');
    let permissionsLoaded = false;

    // 1. Fetch and Group Permissions on Modal Open
    if (createRoleModal) {
        createRoleModal.addEventListener('show.bs.modal', function () {
            if (permissionsLoaded) return; // Prevent re-fetching if already loaded

            axios.get('/roles/api/permissions')
            .then(response => {
                permissionsLoading.style.display = 'none';
                permissionsContainer.innerHTML = '';
                
                const allPermissions = response.data || [];
                
                // Group permissions by their subject (e.g., "read users" -> "users")
                const grouped = {};
                
                allPermissions.forEach(perm => {
                    // Anti-Escalation Check: Only process permissions the current user has
                    if (myPermissions.includes(perm.Name)) {
                        const parts = perm.Name.split(' ');
                        const action = parts[0]; // e.g., "read"
                        const subject = parts.slice(1).join(' '); // e.g., "users"
                        
                        if (!grouped[subject]) {
                            grouped[subject] = [];
                        }
                        grouped[subject].push({ id: perm.ID, action: action, name: perm.Name });
                    }
                });

                // Render the grouped checkboxes
                for (const [subject, perms] of Object.entries(grouped)) {
                    // Capitalize the subject for the header
                    const formattedSubject = subject.charAt(0).toUpperCase() + subject.slice(1);
                    
                    let html = `
                        <div class="col-md-4 mb-4">
                            <div class="card shadow-sm h-100">
                                <div class="card-header bg-light fw-bold text-capitalize">
                                    ${formattedSubject}
                                </div>
                                <div class="card-body">
                    `;
                    
                    perms.forEach(p => {
                        html += `
                            <div class="form-check mb-2">
                                <input class="form-check-input perm-checkbox" type="checkbox" value="${p.id}" id="perm_${p.id}">
                                <label class="form-check-label text-capitalize" for="perm_${p.id}">
                                    ${p.action}
                                </label>
                            </div>
                        `;
                    });
                    
                    html += `</div></div></div>`;
                    permissionsContainer.innerHTML += html;
                }
                
                permissionsLoaded = true;
            })
            .catch(error => {
                console.error('Error fetching permissions:', error);
                permissionsLoading.innerHTML = '<span class="text-danger">Failed to load permissions.</span>';
            });
        });
    }

    // 2. Submit the Form
    const createRoleForm = document.getElementById('createRoleForm');
    
    if (createRoleForm) {
        createRoleForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const btn = document.getElementById('saveRoleBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';

            // Gather all checked permission IDs
            const checkedBoxes = document.querySelectorAll('.perm-checkbox:checked');
            const permissionIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

            const payload = {
                client_id: parseInt(document.getElementById('client_id').value),
                name: document.getElementById('role_name').value,
                description: document.getElementById('role_description').value,
                permission_ids: permissionIds
            };

            axios.post('/roles/api/create', payload)
            .then(response => {
                alert('Role created successfully!');
                window.location.reload(); 
            })
            .catch(error => {
                console.error('Error creating role:', error);
                const errorMsg = error.response?.data?.message || 'Failed to create role.';
                alert(errorMsg);
                btn.disabled = false;
                btn.textContent = 'Create Role';
            });
        });
    }

    const viewPermissionsModal = document.getElementById('viewPermissionsModal');

    if (viewPermissionsModal) {
        viewPermissionsModal.addEventListener('show.bs.modal', function (event) {
            // Button that triggered the modal
            const button = event.relatedTarget; 
            
            // Extract info from data-* attributes
            const roleId = button.getAttribute('data-role-id');
            const roleName = button.getAttribute('data-role-name');

            // Update the modal title
            document.getElementById('viewPermsRoleName').textContent = roleName;

            // UI Elements
            const loading = document.getElementById('viewPermsLoading');
            const container = document.getElementById('viewPermsContainer');

            // Reset UI to loading state
            loading.classList.remove('d-none');
            container.classList.add('d-none');
            container.innerHTML = '';

            // Hit your new Node.js endpoint (which proxies to your Go endpoint)
            axios.get(`/roles/api/${roleId}/permissions`)
            .then(response => {
                // Hide loading, show container
                loading.classList.add('d-none');
                container.classList.remove('d-none');

                const perms = response.data || [];
                
                if (perms.length === 0) {
                    container.innerHTML = '<div class="alert alert-info">No active permissions found for this role.</div>';
                    return;
                }

                // Render permissions as clean, modern pills
                let html = '<div class="d-flex flex-wrap gap-2">';
                perms.forEach(perm => {
                    // Adjust 'perm.name' to match whatever your Go JSON output is (e.g., perm.Name)
                    const permName = perm.name || perm.Name; 
                    html += `
                        <span class="badge bg-primary bg-opacity-10 border border-primary-subtle text-primary text-capitalize px-3 py-2 rounded-pill fs-6">
                            <i class="bi bi-check2-circle me-1"></i> ${permName}
                        </span>
                    `;
                });
                html += '</div>';
                
                container.innerHTML = html;
            })
            .catch(error => {
                console.error('Error fetching role permissions:', error);
                loading.classList.add('d-none');
                container.classList.remove('d-none');
                container.innerHTML = `
                    <div class="alert alert-danger">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i> Failed to load permissions.
                    </div>
                `;
            });
        });
    }

});