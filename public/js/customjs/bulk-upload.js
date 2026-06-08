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
        const res = await fetch('/messages/api/dashboard-data'); // Adjust to your actual BFF route for getMessageDashboardData
        const { data } = await res.json();
        
        document.getElementById('stat-balance').innerText = data.balance.toFixed(2);
        
        // Populate Outbox Table
        const tbody = document.getElementById('outboxTableBody');
        tbody.innerHTML = '';
        data.recentCampaigns.forEach(c => {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td><span class="badge badge-${c.status === 'Completed' ? 'success' : 'warning'}">${c.status}</span></td>
                    <td>${c.sent || 0}</td>
                    <td>${c.failed || 0}</td>
                    <td>${new Date().toLocaleDateString()}</td> <td><button class="btn btn-sm btn-outline-info">View</button></td>
                </tr>
            `;
        });
        if(data.recentCampaigns.length === 0) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No recent campaigns.</td></tr>';

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
            targetType: campTargetType.value
        };

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