document.addEventListener('DOMContentLoaded', async () => {
    
    // ==========================================
    // 1. INITIALIZATION & DATA FETCHING
    // ==========================================
    const campTargetType = document.getElementById('campTargetType');
    const targetGroupWrapper = document.getElementById('targetGroupWrapper');
    const targetCsvWrapper = document.getElementById('targetCsvWrapper');
    const campMessage = document.getElementById('campMessage');

    // Toggle between Group and CSV upload inputs
    campTargetType.addEventListener('change', (e) => {
        if (e.target.value === 'csv') {
            targetGroupWrapper.classList.add('d-none');
            targetCsvWrapper.classList.remove('d-none');
        } else {
            targetGroupWrapper.classList.remove('d-none');
            targetCsvWrapper.classList.add('d-none');
        }
    });

    // Character Counter
    campMessage.addEventListener('input', (e) => {
        const len = e.target.value.length;
        document.getElementById('charCount').innerText = `${len} Characters`;
        document.getElementById('smsCount').innerText = `${Math.ceil(len / 160)} SMS Pages`;
    });

    // Fetch Dashboard Data (Balance, Campaigns, Setup dropdowns)
    try {
        const res = await fetch('/messages/api/dashboard-data'); 
        const { data } = await res.json();
        
        document.getElementById('stat-balance').innerText = data.balance.toFixed(2);
        
        const senderSelect = document.getElementById('campSenderId');
        senderSelect.innerHTML = '<option value="" disabled selected>Select Sender ID</option>';
        data.senderIds.forEach(sender => {
            if (sender.status === 'APPROVED') {
                senderSelect.innerHTML += `<option value="${sender.id}">${sender.sender_id}</option>`;
            }
        });

        const groupSelect = document.getElementById('campGroupId');
        groupSelect.innerHTML = '<option value="" disabled selected>Select Group</option>';
        data.groups.forEach(group => {
            groupSelect.innerHTML += `<option value="${group.id}">${group.name}</option>`;
        });

        const templateSelect = document.getElementById('campTemplateName');
        const msgArea = document.getElementById('campMessage');

        templateSelect.innerHTML = '<option value="" disabled selected>Select an approved template</option>';
        if (data.templates && data.templates.length > 0) {
            data.templates.forEach(tpl => {
                if (tpl.status === 'APPROVED') {
                    const safeContent = tpl.content.replace(/"/g, '&quot;');
                    templateSelect.innerHTML += `<option value="${tpl.name}" data-content="${safeContent}">${tpl.name}</option>`;
                }
            });

            templateSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const tplContent = selectedOption.getAttribute('data-content');
                
                msgArea.value = tplContent;
                msgArea.dispatchEvent(new Event('input')); // Force character count update
            });
        } else {
            templateSelect.innerHTML = '<option value="" disabled selected>No approved templates found</option>';
        }

        // Populate Campaigns Table
        const campaignsTbody = document.getElementById('campaignsTableBody');
        campaignsTbody.innerHTML = '';
        
        if (data.recentCampaigns.length === 0) {
            campaignsTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No recent campaigns.</td></tr>';
        } else {
            data.recentCampaigns.forEach(c => {
                const safeFormatDate = (dateString) => {
                    if (!dateString) return 'N/A';
                    const isoString = dateString.replace(' ', 'T'); 
                    const d = new Date(isoString);
                    return isNaN(d) ? dateString : d.toLocaleString();
                };

                let actionsHtml = `<button class="btn btn-sm btn-outline-info view-campaign-btn" data-id="${c.id}" data-name="${c.name}">View Stats</button>`;
                
                if (c.status === 'SCHEDULED') {
                    actionsHtml += ` <button class="btn btn-sm btn-outline-warning edit-campaign-btn ml-1" 
                                        data-id="${c.id}" data-name="${c.name}" data-time="${c.scheduled_for}">Edit</button>`;
                }

                let badgeColor = 'warning';
                if (c.status === 'SCHEDULED') badgeColor = 'info';
                if (c.status === 'COMPLETED' || c.status === 'SENT') badgeColor = 'success';
                if (c.status === 'PROCESSING') badgeColor = 'primary';

                campaignsTbody.innerHTML += `
                    <tr>
                        <td><strong>${c.name}</strong></td>
                        <td><span class="badge badge-${badgeColor}">${c.status}</span></td>
                        <td>${c.sent || 0}</td>
                        <td>${c.failed || 0}</td>
                        <td>${c.status === 'SCHEDULED' ? safeFormatDate(c.scheduled_for) : safeFormatDate(c.created_at)}</td> 
                        <td class="text-right">${actionsHtml}</td>
                    </tr>
                `;
            });
        }
        
        document.querySelectorAll('.view-campaign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                openStatsModal(e.target.getAttribute('data-id'), e.target.getAttribute('data-name'));
            });
        });

    } catch (error) {
        console.error("Failed to load dashboard data", error);
    }

    // ==========================================
    // 2. THE CAMPAIGN TRIGGER ENGINE
    // ==========================================
    const launchForm = document.getElementById('form-launch-campaign');
    
    launchForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = document.getElementById('btn-submit-campaign');
        const progress = document.getElementById('uploadProgress');
        
        const payload = {
            campaignName: document.getElementById('campName').value,
            senderId: document.getElementById('campSenderId').value,
            messageContent: document.getElementById('campMessage').value, 
            templateName: document.getElementById('campTemplateName').value,
            targetType: document.getElementById('campTargetType').value
        };

        const schedTime = document.getElementById('campScheduledFor').value;
        if (schedTime) {
            payload.scheduledFor = `${schedTime}:00+03:00`;
        }

        submitBtn.disabled = true;

        try {
            if (payload.targetType === 'group') {
                payload.groupId = document.getElementById('campGroupId').value;
                if(!payload.groupId) throw new Error("Please select a group.");

                submitBtn.innerText = 'Queuing Campaign...';
                
                const res = await fetch('/messages/api/trigger', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                const result = await res.json();
                if(!result.success) throw new Error(result.error);
                
                alert('Campaign queued successfully!');
                location.reload();
            } 
            else {
                const fileInput = document.getElementById('campCsvFile');
                const file = fileInput.files[0];
                if(!file) throw new Error("Please select a CSV file.");

                progress.classList.remove('d-none');
                submitBtn.innerText = 'Requesting Secure Upload...';

                const urlRes = await fetch(`/messages/api/upload-url?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}`);
                const urlData = await urlRes.json();
                if (!urlData.success) throw new Error(urlData.error);
                
                const { uploadUrl, fileKey } = urlData.data;

                submitBtn.innerText = 'Uploading Target List...';
                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type },
                    body: file
                });
                if (!uploadRes.ok) throw new Error('Failed to upload file to storage bucket.');

                submitBtn.innerText = 'Launching Campaign...';
                payload.fileKey = fileKey;
                
                const triggerRes = await fetch('/messages/api/trigger-bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const triggerData = await triggerRes.json();
                if (!triggerData.success) throw new Error(triggerData.error);

                alert('Bulk Campaign accepted and processing started!');
                location.reload();
            }

        } catch (error) {
            alert(error.message || 'An error occurred while launching the campaign.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = 'Send / Schedule Campaign';
            if(progress) progress.classList.add('d-none');
        }
    });

    // Attach Edit Listeners (Event Delegation for dynamically created buttons)
    document.addEventListener('click', (e) => {
        if(e.target.classList.contains('edit-campaign-btn')) {
            const id = e.target.getAttribute('data-id');
            const name = e.target.getAttribute('data-name');
            const scheduledTime = e.target.getAttribute('data-time');

            document.getElementById('editCampId').value = id;
            document.getElementById('editCampName').value = name;
            
            if (scheduledTime) {
                const date = new Date(scheduledTime.replace(' ', 'T'));
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                document.getElementById('editCampScheduledFor').value = date.toISOString().slice(0,16);
            }
            $('#editCampaignModal').modal('show');
        }
    });

    const editForm = document.getElementById('form-edit-campaign');
    if (editForm) {
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-save-edit');
            btn.disabled = true;
            btn.innerText = 'Saving...';

            const id = document.getElementById('editCampId').value;
            const payload = {
                name: document.getElementById('editCampName').value,
                scheduled_for: new Date(document.getElementById('editCampScheduledFor').value).toISOString()
            };

            try {
                const res = await fetch(`/messages/api/campaigns/${id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.ok) {
                    alert('Campaign updated successfully!');
                    location.reload();
                } else {
                    const data = await res.json();
                    alert(data.error || 'Failed to update campaign.');
                }
            } catch (err) {
                alert('A network error occurred.');
            } finally {
                btn.disabled = false;
                btn.innerText = 'Save Changes';
            }
        });
    }

    // ==========================================
    // 3. STATS MODAL LOGIC
    // ==========================================
    async function openStatsModal(id, name) {
        document.getElementById('modalCampName').innerText = name;
        document.getElementById('modalStatTotal').innerText = '...';
        document.getElementById('modalStatPending').innerText = '...';
        document.getElementById('modalStatSent').innerText = '...';
        document.getElementById('modalStatFailed').innerText = '...';

        $('#campaignStatsModal').modal('show');
        await fetchAndPopulateStats(id);

        const refreshBtn = document.getElementById('btn-refresh-stats');
        const newRefreshBtn = refreshBtn.cloneNode(true); 
        refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
        
        newRefreshBtn.addEventListener('click', async () => {
            newRefreshBtn.innerText = 'Refreshing...';
            newRefreshBtn.disabled = true;
            await fetchAndPopulateStats(id);
            newRefreshBtn.innerText = 'Refresh Live Stats';
            newRefreshBtn.disabled = false;
        });
    }

    async function fetchAndPopulateStats(id) {
        try {
            const res = await fetch(`/messages/api/campaigns/${id}/stats`);
            const result = await res.json();
            
            if (res.ok && result.data) {
                const stats = result.data;
                document.getElementById('modalStatTotal').innerText = (stats.TOTAL || 0).toLocaleString();
                const pendingCount = (stats.PENDING || 0) + (stats.PROCESSING || 0);
                document.getElementById('modalStatPending').innerText = pendingCount.toLocaleString();
                document.getElementById('modalStatSent').innerText = (stats.SENT || stats.DELIVERED || 0).toLocaleString();
                document.getElementById('modalStatFailed').innerText = (stats.FAILED || 0).toLocaleString();
            }
        } catch (err) {
            console.error("Failed to fetch campaign stats", err);
        }
    }

    // ==========================================
    // 4. UNIFIED OUTBOX LEDGER LOGIC
    // ==========================================
    async function loadUnifiedOutbox(page = 1) {
        const tbody = document.getElementById('unifiedOutboxTableBody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">Loading...</td></tr>';

        try {
            const res = await fetch(`/messages/api/outbox?page=${page}`);
            const { data } = await res.json();
            
            tbody.innerHTML = '';
            
            if (!data || data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No messages found in the outbox.</td></tr>';
                return;
            }

            data.forEach(msg => {
                const isCampaign = msg.CampaignID !== null;
                const typeBadge = isCampaign 
                    ? `<span class="badge badge-primary">Campaign</span> <small class="text-muted d-block">${msg.Campaign ? msg.Campaign.Name : ''}</small>` 
                    : `<span class="badge badge-secondary">Transactional</span>`;

                let statusClass = 'warning';
                if (msg.Status === 'DELIVERED' || msg.Status === 'SENT') statusClass = 'success';
                if (msg.Status === 'FAILED') statusClass = 'danger';

                const isoString = msg.CreatedAt.replace(' ', 'T'); 
                const dateStr = new Date(isoString).toLocaleString();
                const msgPreview = msg.Message.length > 50 ? msg.Message.substring(0, 50) + '...' : msg.Message;

                tbody.innerHTML += `
                    <tr>
                        <td class="text-muted small">${dateStr}</td>
                        <td>${typeBadge}</td>
                        <td><strong>${msg.MSISDN}</strong></td>
                        <td>${msg.SenderID}</td>
                        <td class="text-truncate text-muted small" style="max-width: 250px;" title="${msg.Message.replace(/"/g, '&quot;')}">${msgPreview}</td>
                        <td>KES ${msg.Cost}</td>
                        <td><span class="badge badge-${statusClass}">${msg.Status}</span></td>
                    </tr>
                `;
            });
        } catch (error) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load outbox data.</td></tr>';
            console.error("Failed to load unified outbox", error);
        }
    }

    // Trigger Outbox load when the tab is clicked
    document.getElementById('outbox-tab').addEventListener('click', () => {
        loadUnifiedOutbox(1);
    });

    document.getElementById('btn-refresh-outbox')?.addEventListener('click', () => {
        loadUnifiedOutbox(1);
    });

    // Basic Tab Logic Fallback
    document.querySelectorAll('#campaignTabs .nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('show', 'active'));
            this.classList.add('active');
            document.querySelector(this.getAttribute('href')).classList.add('show', 'active');
        });
    });
});