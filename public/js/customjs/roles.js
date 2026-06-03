document.addEventListener('DOMContentLoaded', function() {
    
    const createRoleModalElement = document.getElementById('createRoleModal');
    const permissionsContainer = document.getElementById('permissionsContainer');
    const permissionsLoading = document.getElementById('permissionsLoading');
    let permissionsLoaded = false;

    // 1. Fetch and Group Permissions on Modal Open
    if (createRoleModalElement) {
        createRoleModalElement.addEventListener('show.bs.modal', function () {
            console.log('[Modal] Opened Create Role Modal');
            
            if (permissionsLoaded) {
                console.log('[Modal] Permissions already loaded, skipping render.');
                return; 
            }

            if (permissionsLoading) permissionsLoading.style.display = 'none';
            if (permissionsContainer) permissionsContainer.innerHTML = '';
            
            // 2. Retrieve the logged-in user's permissions
            const storedPermissions = localStorage.getItem('permissions');
            console.log('[LocalStorage] Raw string data:', storedPermissions);
            
            let userPermissions = [];
            
            try {
                userPermissions = storedPermissions ? JSON.parse(storedPermissions) : [];
                console.log('[LocalStorage] Parsed array length:', userPermissions.length, 'Data:', userPermissions);
            } catch (error) {
                console.error('[Error] Failed parsing permissions from localStorage:', error);
                if (permissionsContainer) {
                    permissionsContainer.innerHTML = '<span class="text-danger">Failed to load permissions. Data corrupted.</span>';
                }
                return;
            }

            if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
                console.warn('[Warning] No permissions found or data is not an array.');
                if (permissionsContainer) {
                    permissionsContainer.innerHTML = '<span class="text-muted">No permissions available.</span>';
                }
                permissionsLoaded = true;
                return;
            }

            // 3. Group permissions by their subject
            const grouped = {};
            
            userPermissions.forEach((perm, index) => {
                console.log(`[Processing Loop] Item #${index}:`, perm);
                
                // Fallback: Check if perm is a string (e.g., "read users") or an object (e.g., {ID: 1, Name: "read users"})
                // Go struct JSON outputs are often camelCase or pascalCase based on tags (e.g., Name vs name).
                let permName = typeof perm === 'string' ? perm : (perm.Name || perm.name);
                let permId = typeof perm === 'string' ? perm : (perm.ID || perm.id);

                if (!permName) {
                    console.error(`[Error] Skipping invalid format at index ${index}. Could not find a 'Name' property.`, perm);
                    return; // Skip this iteration
                }

                const parts = permName.split(' ');
                const action = parts[0]; 
                const subject = parts.length > 1 ? parts.slice(1).join(' ') : 'general'; 
                
                if (!grouped[subject]) {
                    grouped[subject] = [];
                }
                
                grouped[subject].push({ 
                    id: permId, 
                    action: action, 
                    name: permName 
                });
            });

            console.log('[Grouped Data] Final grouped object:', grouped);

            // 4. Render the grouped checkboxes
            if (Object.keys(grouped).length === 0) {
                console.warn('[Warning] Grouping resulted in 0 items to render.');
            }

            for (const [subject, perms] of Object.entries(grouped)) {
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
                if (permissionsContainer) permissionsContainer.innerHTML += html;
            }
            
            console.log('[Success] Finished rendering to DOM');
            permissionsLoaded = true;
        });
    } else {
        console.error('[Error] Modal element #createRoleModal not found in the DOM.');
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