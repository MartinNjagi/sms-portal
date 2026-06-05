document.addEventListener('DOMContentLoaded', function() {
    
    // --- UTILITY: RENDER MULTICOLUMN CHECKBOX TABLE ---
    function renderPermissionsTable(containerId, activePermissionIds = [], checkboxClass = 'perm-checkbox') {
        const container = document.getElementById(containerId);
        if (!container) return;

        const storedPermissions = localStorage.getItem('permissions');
        let userPermissions = [];
        
        try {
            userPermissions = storedPermissions ? JSON.parse(storedPermissions) : [];
        } catch (error) {
            container.innerHTML = '<span class="text-danger">Failed to load permissions. Data corrupted.</span>';
            return;
        }

        if (!Array.isArray(userPermissions) || userPermissions.length === 0) {
            container.innerHTML = '<span class="text-muted">No permissions available.</span>';
            return;
        }

        // Group permissions by subject
        const grouped = {};
        userPermissions.forEach(perm => {
            let permName = typeof perm === 'string' ? perm : (perm.Name || perm.name);
            let permId = typeof perm === 'string' ? perm : (perm.ID || perm.id);

            if (!permName) return;

            const parts = permName.split(' ');
            const action = parts[0]; 
            const subject = parts.length > 1 ? parts.slice(1).join(' ') : 'general'; 
            
            if (!grouped[subject]) grouped[subject] = [];
            
            grouped[subject].push({ id: permId, action: action, name: permName });
        });

        // Build Table structure
        let html = `
            <div class="table-responsive border rounded">
                <table class="table table-hover align-middle mb-0">
                    <thead class="table-light">
                        <tr>
                            <th class="w-25 ps-3">Resource / Subject</th>
                            <th>Allowed Actions</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const [subject, perms] of Object.entries(grouped)) {
            const formattedSubject = subject.charAt(0).toUpperCase() + subject.slice(1);
            
            html += `
                <tr>
                    <td class="ps-3 fw-semibold text-capitalize border-end bg-light bg-opacity-50">${formattedSubject}</td>
                    <td>
                        <div class="d-flex flex-wrap gap-4 py-1">
            `;
            
            perms.forEach(p => {
                const isChecked = activePermissionIds.includes(parseInt(p.id)) ? 'checked' : '';
                html += `
                    <div class="form-check form-check-inline m-0">
                        <input class="form-check-input ${checkboxClass}" type="checkbox" value="${p.id}" id="perm_${containerId}_${p.id}" ${isChecked}>
                        <label class="form-check-label text-capitalize cursor-pointer" for="perm_${containerId}_${p.id}">
                            ${p.action}
                        </label>
                    </div>
                `;
            });
            
            html += `</div></td></tr>`;
        }

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    // --- 1. CREATE ROLE FLOW ---
    const createRoleModalElement = document.getElementById('createRoleModal');
    let createPermissionsLoaded = false;

    if (createRoleModalElement) {
        createRoleModalElement.addEventListener('show.bs.modal', function () {
            if (createPermissionsLoaded) return;
            document.getElementById('createPermissionsLoading').style.display = 'none';
            renderPermissionsTable('createPermissionsContainer', [], 'create-perm-checkbox');
            createPermissionsLoaded = true;
        });
    }

    const createRoleForm = document.getElementById('createRoleForm');
    if (createRoleForm) {
        createRoleForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('saveRoleBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';

            const checkedBoxes = document.querySelectorAll('.create-perm-checkbox:checked');
            const permissionIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

            const payload = {
                client_id: parseInt(document.getElementById('client_id').value),
                name: document.getElementById('role_name').value,
                description: document.getElementById('role_description').value,
                permission_ids: permissionIds
            };

            axios.post('/roles/api/create', payload)
            .then(response => {
                window.location.reload(); 
            })
            .catch(error => {
                alert(error.response?.data?.message || 'Failed to create role.');
                btn.disabled = false;
                btn.textContent = 'Create Role';
            });
        });
    }

    // --- 2. EDIT ROLE FLOW ---
    const editRoleModal = new bootstrap.Modal(document.getElementById('editRoleModal'));
    const editButtons = document.querySelectorAll('.edit-role-btn');

    editButtons.forEach(button => {
        button.addEventListener('click', function() {
            const roleId = this.getAttribute('data-role-id');
            const roleName = this.getAttribute('data-role-name');
            const roleDesc = this.getAttribute('data-role-desc');

            document.getElementById('editRoleTitleName').textContent = roleName;
            document.getElementById('edit_role_id').value = roleId;
            document.getElementById('edit_role_name').value = roleName;
            document.getElementById('edit_role_description').value = roleDesc;

            document.getElementById('editPermissionsLoading').style.display = 'block';
            document.getElementById('editPermissionsContainer').innerHTML = '';
            
            editRoleModal.show();

            // Fetch existing permissions to pre-check the table
            axios.get(`/roles/api/${roleId}/permissions`)
            .then(response => {
                document.getElementById('editPermissionsLoading').style.display = 'none';
                const currentPerms = response.data || [];
                const currentPermIds = currentPerms.map(p => parseInt(p.id || p.ID));
                
                renderPermissionsTable('editPermissionsContainer', currentPermIds, 'edit-perm-checkbox');
            })
            .catch(error => {
                document.getElementById('editPermissionsLoading').style.display = 'none';
                document.getElementById('editPermissionsContainer').innerHTML = '<div class="alert alert-danger">Failed to fetch current permissions.</div>';
            });
        });
    });

    const editRoleForm = document.getElementById('editRoleForm');
    if (editRoleForm) {
        editRoleForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const btn = document.getElementById('updateRoleBtn');
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

            const roleId = document.getElementById('edit_role_id').value;
            const checkedBoxes = document.querySelectorAll('.edit-perm-checkbox:checked');
            const permissionIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));

            // Assuming AssignRolePermissions takes { role_id, permission_ids, description }
            const payload = {
                role_id: parseInt(roleId),
                description: document.getElementById('edit_role_description').value,
                permission_ids: permissionIds
            };

            axios.post(`/roles/api/assign`, payload) // Adjust URL to match your Express proxy routing
            .then(response => {
                window.location.reload(); 
            })
            .catch(error => {
                alert(error.response?.data?.message || 'Failed to update role.');
                btn.disabled = false;
                btn.textContent = 'Save Changes';
            });
        });
    }

    // --- 3. DELETE ROLE FLOW ---
    const deleteButtons = document.querySelectorAll('.delete-role-btn');
    deleteButtons.forEach(button => {
        button.addEventListener('click', function() {
            const roleId = this.getAttribute('data-role-id');
            const roleName = this.getAttribute('data-role-name');

            if (confirm(`Are you sure you want to delete the "${roleName}" role?\nThis action cannot be undone.`)) {
                
                // Disable button to prevent double-click
                this.disabled = true;
                this.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

                axios.delete(`/roles/api/${roleId}/delete`) // Adjust URL to match your Express proxy routing
                .then(() => {
                    window.location.reload();
                })
                .catch(error => {
                    alert(error.response?.data?.message || 'Failed to delete role. Ensure no users are assigned to it.');
                    this.disabled = false;
                    this.innerHTML = '<i class="bi bi-trash"></i>';
                });
            }
        });
    });

    // --- 4. VIEW PERMISSIONS FLOW ---
    const viewPermissionsModal = document.getElementById('viewPermissionsModal');
    if (viewPermissionsModal) {
        viewPermissionsModal.addEventListener('show.bs.modal', function (event) {
            const button = event.relatedTarget; 
            const roleId = button.getAttribute('data-role-id');
            const roleName = button.getAttribute('data-role-name');

            document.getElementById('viewPermsRoleName').textContent = roleName;

            const loading = document.getElementById('viewPermsLoading');
            const container = document.getElementById('viewPermsContainer');

            loading.classList.remove('d-none');
            container.classList.add('d-none');
            container.innerHTML = '';

            axios.get(`/roles/api/${roleId}/permissions`)
            .then(response => {
                loading.classList.add('d-none');
                container.classList.remove('d-none');

                const perms = response.data || [];
                if (perms.length === 0) {
                    container.innerHTML = '<div class="alert alert-info">No active permissions found for this role.</div>';
                    return;
                }

                let html = '<div class="d-flex flex-wrap gap-2">';
                perms.forEach(perm => {
                    const permName = perm.name || perm.Name; 
                    html += `
                        <span class="badge bg-primary bg-opacity-10 border border-primary-subtle text-primary text-capitalize px-3 py-2 rounded-pill fs-6 shadow-sm">
                            <i class="bi bi-check2-circle me-1"></i> ${permName}
                        </span>
                    `;
                });
                html += '</div>';
                container.innerHTML = html;
            })
            .catch(error => {
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