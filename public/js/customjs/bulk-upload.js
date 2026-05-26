document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialize Socket.io (Connects to your Node.js BFF)
    const socket = io();

    // DOM Elements - UI & Status
    const uploadBtn = document.getElementById('startUploadBtn');
    const statusDisplay = document.getElementById('uploadStatus');
    const liveProgressCard = document.getElementById('liveProgressCard');

    // DOM Elements - Form Inputs
    const campaignNameInput = document.getElementById('campaignName');
    const senderIdInput = document.getElementById('senderId');
    const messageBox = document.getElementById('messageBox');
    const useCsvRadio = document.getElementById('useCsv');
    const groupSelect = document.getElementById('groupId');
    const csvFileInput = document.getElementById('csvFileInput');

    // Listen for WebSocket connection issues
    socket.on('connect_error', (err) => {
        console.error('Socket connection lost:', err.message);
    });

    uploadBtn.addEventListener('click', async () => {
        // Extract base form data
        const campaignName = campaignNameInput.value.trim() || 'Unnamed Campaign';
        const senderId = senderIdInput.value;
        const messageContent = messageBox.value.trim();
        const isCsv = useCsvRadio.checked;

        // 1. Common Validation Check
        if (!senderId) return showError('Please select a valid Sender ID.');
        if (!messageContent) return showError('Message content cannot be empty.');

        // Update UI State
        uploadBtn.disabled = true;
        statusDisplay.classList.remove('d-none', 'alert-danger', 'alert-success');
        statusDisplay.classList.add('alert-info', 'd-block');
        liveProgressCard.style.display = 'none';

        // 2. Branch Logic: CSV Upload vs. Saved Group
        if (isCsv) {
            const file = csvFileInput.files[0];
            if (!file) {
                uploadBtn.disabled = false;
                return showError('Please select a CSV file to upload.');
            }
            statusDisplay.innerText = "Validating CSV file format...";
            validateAndProcessCsv(file, campaignName, senderId, messageContent);
        } else {
            const groupId = groupSelect.value;
            if (!groupId) {
                uploadBtn.disabled = false;
                return showError('Please select a Saved Group from the dropdown.');
            }
            statusDisplay.innerText = "Preparing group campaign...";
            
            // Bypass S3 completely and trigger Go Engine directly
            const payload = { campaignName, senderId, messageContent, groupId };
            triggerCampaignBackend(payload);
        }
    });

    // --- CSV Specific Logic ---
    function validateAndProcessCsv(file, campaignName, senderId, messageContent) {
        Papa.parse(file, {
            header: true,      
            preview: 5,        // Only read the first 5 rows to save memory
            skipEmptyLines: true,
            complete: async function(results) {
                const headers = results.meta.fields.map(h => h.toLowerCase().trim());
                const hasPhoneColumn = headers.includes('phone') || headers.includes('msisdn') || headers.includes('number');

                if (!hasPhoneColumn) {
                    uploadBtn.disabled = false;
                    return showError('Validation Failed: Your CSV must contain a column named "Phone", "Number", or "MSISDN".');
                }

                if (results.data.length === 0) {
                    uploadBtn.disabled = false;
                    return showError('Validation Failed: The CSV appears to be empty.');
                }

                statusDisplay.innerText = "File verified. Requesting secure upload link...";
                await uploadAndTrigger(file, campaignName, senderId, messageContent);
            },
            error: function(error) {
                uploadBtn.disabled = false;
                showError(`Error reading file: ${error.message}`);
            }
        });
    }

    async function uploadAndTrigger(file, campaignName, senderId, messageContent) {
        try {
            // GET PRE-SIGNED URL FROM NODE.JS BFF
            const urlResponse = await fetch(`/api/messages/upload-url?fileName=${file.name}&fileType=${file.type}&estimatedRows=10000`);
            const urlResult = await urlResponse.json();
            
            if (!urlResponse.ok) throw new Error(urlResult.error || 'Failed to get secure link.');

            statusDisplay.innerText = "Uploading straight to cloud storage (bypassing server)...";

            // UPLOAD DIRECTLY TO S3/MINIO
            const uploadResponse = await fetch(urlResult.data.uploadUrl, {
                method: 'PUT',
                body: file,
                headers: { 'Content-Type': file.type }
            });

            if (!uploadResponse.ok) throw new Error('Cloud storage rejected the file upload.');

            statusDisplay.innerText = "Upload complete. Triggering Go Engine...";

            // Send to Go Engine with the cloud storage fileKey
            const payload = {
                fileKey: urlResult.data.fileKey,
                campaignName,
                senderId,
                messageContent
            };

            triggerCampaignBackend(payload);

        } catch (err) {
            uploadBtn.disabled = false;
            showError(`Process failed: ${err.message}`);
        }
    }

    // --- Core API Trigger & Socket Logic ---
    async function triggerCampaignBackend(payload) {
        try {
            const triggerResponse = await fetch('/api/messages/process-campaign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload) // Payload contains either 'fileKey' or 'groupId'
            });

            const triggerResult = await triggerResponse.json();
            
            if (!triggerResponse.ok) throw new Error(triggerResult.error || 'Failed to trigger campaign.');

            // Success UI Update
            statusDisplay.innerText = "Campaign launched successfully! Watching live updates...";
            statusDisplay.classList.replace('alert-info', 'alert-success');
            liveProgressCard.style.display = 'block';

            // Subscribe to real-time events for this specific client/campaign
            socket.emit('join_campaign_room', triggerResult.data.clientId); 

            socket.on('campaign_progress', (data) => {
                if (data.campaignId === triggerResult.data.campaignId) {
                    
                    animateValue("wsSentCount", data.sent);
                    animateValue("wsFailedCount", data.failed);

                    if (data.status === 'completed') {
                        statusDisplay.innerText = "Campaign Processing Complete!";
                        uploadBtn.disabled = false;
                        socket.off('campaign_progress'); // Memory cleanup
                    }
                }
            });

        } catch (err) {
            uploadBtn.disabled = false;
            showError(`Failed to trigger campaign: ${err.message}`);
        }
    }

    // --- UI Helpers ---
    function animateValue(id, targetValue) {
        const obj = document.getElementById(id);
        const currentValue = parseInt(obj.innerText.replace(/,/g, '')) || 0;
        
        if (currentValue === targetValue) return;
        
        obj.innerText = targetValue.toLocaleString();
        
        // Brief flash effect
        obj.classList.add('text-success', 'scale-up');
        setTimeout(() => obj.classList.remove('text-success', 'scale-up'), 300);
    }

    function showError(msg) {
        statusDisplay.classList.remove('d-none', 'alert-info', 'alert-success');
        statusDisplay.classList.add('alert-danger', 'd-block');
        statusDisplay.innerText = msg;
    }
});