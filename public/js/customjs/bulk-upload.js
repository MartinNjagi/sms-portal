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

    // Fetch Dashboard Data (Balance, Outbox, Setup dropdowns)
    try {
        const res = await fetch('/messages/api/dashboard-data'); 
        const { data } = await res.json();
        
        document.getElementById('stat-balance').innerText = data.balance.toFixed(2);
        
        // 👉 ADD THIS: Populate Sender IDs Dropdown
        const senderSelect = document.getElementById('campSenderId');
        senderSelect.innerHTML = '<option value="" disabled selected>Select Sender ID</option>';
        data.senderIds.forEach(sender => {
            // Only allow them to select approved IDs
            if (sender.status === 'APPROVED') {
                senderSelect.innerHTML += `<option value="${sender.id}">${sender.sender_id}</option>`;
            }
        });

        // Populate Groups Dropdown
        const groupSelect = document.getElementById('campGroupId');
        groupSelect.innerHTML = '<option value="" disabled selected>Select Group</option>';
        data.groups.forEach(group => {
            groupSelect.innerHTML += `<option value="${group.id}">${group.name}</option>`;
        });
        

        // Populate templates
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

            // 👉 NEW: Update preview when a template is selected
            templateSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const tplContent = selectedOption.getAttribute('data-content');
                
                msgArea.value = tplContent;
                msgArea.dispatchEvent(new Event('input')); // Force character count update
            });

        } else {
            templateSelect.innerHTML = '<option value="" disabled selected>No approved templates found</option>';
        }


        // Populate Outbox Table
        const tbody = document.getElementById('outboxTableBody');
        tbody.innerHTML = '';
        data.recentCampaigns.forEach(c => {
            
        // 👉 DEBUG: See exactly what Go is sending you
        console.log(`Campaign [${c.name}] - Raw Date: '${c.created_at}' | Raw Scheduled: '${c.scheduled_for}'`);

        // 👉 FIX: Safely parse SQL-style dates by replacing the space with a 'T'
        const safeFormatDate = (dateString) => {
            if (!dateString) return 'N/A';
            
            // Replaces "2026-06-19 20:23:00" with "2026-06-19T20:23:00"
            const isoString = dateString.replace(' ', 'T'); 
            const d = new Date(isoString);
            
            // If it's still invalid, just return the raw string rather than crashing
            return isNaN(d) ? dateString : d.toLocaleString();
        };

        let actionsHtml = `<button class="btn btn-sm btn-outline-info view-campaign-btn" data-id="${c.id}" data-name="${c.name}">View</button>`;
        
        if (c.status === 'SCHEDULED') {
            actionsHtml += ` <button class="btn btn-sm btn-outline-warning edit-campaign-btn ml-1" 
                                data-id="${c.id}" 
                                data-name="${c.name}" 
                                data-time="${c.scheduled_for}">Edit</button>`;
        }

        tbody.innerHTML += `
            <tr>
                <td><strong>${c.name}</strong></td>
                <td><span class="badge badge-${c.status === 'SCHEDULED' ? 'info' : (c.status === 'COMPLETED' ? 'success' : 'warning')}">${c.status}</span></td>
                <td>${c.sent || 0}</td>
                <td>${c.failed || 0}</td>
                
                <td>${c.status === 'SCHEDULED' ? safeFormatDate(c.scheduled_for) : safeFormatDate(c.date)}</td> 
                
                <td class="text-right">${actionsHtml}</td>
            </tr>
        `;
        });
        if(data.recentCampaigns.length === 0) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No recent campaigns.</td></tr>';
        
        document.querySelectorAll('.view-campaign-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const campaignId = e.target.getAttribute('data-id');
                const campaignName = e.target.getAttribute('data-name');
                
                openStatsModal(campaignId, campaignName);
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
        messageContent: document.getElementById('campMessage').value, // The preview content
        templateName: document.getElementById('campTemplateName').value, // The actual template name
        targetType: campTargetType.value
        };

        // 👉 NEW: Parse the scheduled time
        const schedTime = document.getElementById('campScheduledFor').value;
        if (schedTime) {

        payload.scheduledFor = `${schedTime}:00+03:00`;
            }

        submitBtn.disabled = true;

        try {
            // --- SCENARIO A: SENDING TO A SAVED GROUP ---
            if (payload.targetType === 'group') {
                payload.groupId = document.getElementById('campGroupId').value;
                if(!payload.groupId) throw new Error("Please select a group.");

                submitBtn.innerText = 'Queuing Campaign...';
                
                // Hit your triggerCampaign BFF endpoint
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
            // --- SCENARIO B: UPLOADING A CSV ---
            else {
                const fileInput = document.getElementById('campCsvFile');
                const file = fileInput.files[0];
                if(!file) throw new Error("Please select a CSV file.");

                progress.classList.remove('d-none');
                submitBtn.innerText = 'Requesting Secure Upload...';

                // 1. Get Pre-signed S3 URL from Node BFF
                const urlRes = await fetch(`/messages/api/upload-url?fileName=${encodeURIComponent(file.name)}&fileType=${encodeURIComponent(file.type)}`);
                const urlData = await urlRes.json();
                if (!urlData.success) throw new Error(urlData.error);
                
                const { uploadUrl, fileKey } = urlData.data;

                // 2. Upload directly to S3 / MinIO
                submitBtn.innerText = 'Uploading Target List...';
                const uploadRes = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': file.type },
                    body: file
                });
                if (!uploadRes.ok) throw new Error('Failed to upload file to storage bucket.');

                // 3. Trigger the Go Engine Background Processor
                submitBtn.innerText = 'Launching Campaign...';
                payload.fileKey = fileKey;
                
                // Hit your triggerGoEngine BFF endpoint
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
            submitBtn.innerText = 'Send Campaign';
            progress.classList.add('d-none');
        }
    });

// 👉 NEW: Attach Edit Listeners
    document.querySelectorAll('.edit-campaign-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            const name = e.target.getAttribute('data-name');
            const scheduledTime = e.target.getAttribute('data-time');

            document.getElementById('editCampId').value = id;
            document.getElementById('editCampName').value = name;
            
            // Format time for the datetime-local input (YYYY-MM-DDThh:mm)
            if (scheduledTime) {
                const date = new Date(scheduledTime);
                date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
                document.getElementById('editCampScheduledFor').value = date.toISOString().slice(0,16);
            }

            $('#editCampaignModal').modal('show');
        });
    });

    // 👉 NEW: Handle Edit Submission
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
                // Convert back to standard ISO for the Go backend
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
    // STATS MODAL LOGIC
    // ==========================================
    let currentPollingInterval = null;

    async function openStatsModal(id, name) {
        // 1. Reset UI
        document.getElementById('modalCampName').innerText = name;
        document.getElementById('modalStatTotal').innerText = '...';
        document.getElementById('modalStatPending').innerText = '...';
        document.getElementById('modalStatSent').innerText = '...';
        document.getElementById('modalStatFailed').innerText = '...';

        // 2. Open Modal (Bootstrap 5 Vanilla JS)
        const statsModal = bootstrap.Modal.getOrCreateInstance(document.getElementById('campaignStatsModal'));
        statsModal.show();

        // 3. Fetch Data immediately
        await fetchAndPopulateStats(id);

        // 4. Attach manual refresh button logic
        const refreshBtn = document.getElementById('btn-refresh-stats');
        // Remove old listeners to prevent duplicates if they click multiple campaigns
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
            // Hit your Node BFF which proxies to Go's blazing fast COUNT() query
            const res = await fetch(`/messages/api/campaigns/${id}/stats`);
            const result = await res.json();
            
            if (res.ok && result.data) {
                const stats = result.data;
                
                // Animate values for a nice touch
                document.getElementById('modalStatTotal').innerText = (stats.TOTAL || 0).toLocaleString();
                
                // Combine PENDING and PROCESSING for a simpler UI view
                const pendingCount = (stats.PENDING || 0) + (stats.PROCESSING || 0);
                document.getElementById('modalStatPending').innerText = pendingCount.toLocaleString();
                
                document.getElementById('modalStatSent').innerText = (stats.SENT || stats.DELIVERED || 0).toLocaleString();
                document.getElementById('modalStatFailed').innerText = (stats.FAILED || 0).toLocaleString();
            }
        } catch (err) {
            console.error("Failed to fetch campaign stats", err);
        }
    }


    // Basic Tab Logic (Vanilla JS fallback)
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