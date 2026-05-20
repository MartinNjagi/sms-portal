// public/js/customjs/bulk-upload.js

// 1. Initialize Socket.io (Connects to your Node.js BFF, not Go directly)
const socket = io();

// DOM Elements
const fileInput = document.getElementById('csvFileInput');
const uploadBtn = document.getElementById('startUploadBtn');
const statusDisplay = document.getElementById('uploadStatus');
const liveProgressCard = document.getElementById('liveProgressCard');

// Listen for WebSocket connection issues
socket.on('connect_error', (err) => {
    console.error('Socket connection lost:', err.message);
});

uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    const campaignName = document.getElementById('campaignName').value || 'Unnamed Campaign';
    const senderId = document.getElementById('senderId').value;
    
    if (!file) {
        return showError('Please select a CSV file first.');
    }
    if (!senderId) {
        return showError('Please select a valid Sender ID.');
    }

    uploadBtn.disabled = true;
    statusDisplay.style.color = '#333';
    statusDisplay.innerText = "Validating file format...";

    // 1. FAST CLIENT-SIDE VALIDATION
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
            await processValidatedFile(file, campaignName, senderId);
        },
        error: function(error) {
            uploadBtn.disabled = false;
            showError(`Error reading file: ${error.message}`);
        }
    });
});

async function processValidatedFile(file, campaignName, senderId) {
    try {
        // 2. GET PRE-SIGNED URL FROM NODE.JS BFF
        const urlResponse = await fetch(`/api/messages/upload-url?fileName=${file.name}&fileType=${file.type}&estimatedRows=10000`);
        const urlResult = await urlResponse.json();
        
        if (!urlResponse.ok) throw new Error(urlResult.error || 'Failed to get secure link.');

        statusDisplay.innerText = "Uploading straight to cloud storage (bypassing server)...";

        // 3. UPLOAD DIRECTLY TO S3/MINIO (Bypassing Node.js entirely)
        const uploadResponse = await fetch(urlResult.data.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type }
        });

        if (!uploadResponse.ok) throw new Error('Cloud storage rejected the file upload.');

        statusDisplay.innerText = "Upload complete. Triggering Go Engine...";

        // 4. TRIGGER THE GO ENGINE VIA NODE.JS
        const triggerResponse = await fetch('/api/messages/process-campaign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileKey: urlResult.data.fileKey,
                campaignName: campaignName,
                senderId: senderId
            })
        });

        const triggerResult = await triggerResponse.json();
        
        if (!triggerResponse.ok) throw new Error(triggerResult.error || 'Failed to trigger campaign.');

        // --- 5. THE REAL-TIME MAGIC ---
        statusDisplay.innerText = "Campaign is processing! Watching for live updates...";
        statusDisplay.style.color = "green";

        // Unhide the Live Progress Card
        liveProgressCard.style.display = 'block';

        // Tell Node.js to put this browser connection into the correct room
        // Assuming your backend sends back the clientId in the trigger response
        socket.emit('join_campaign_room', triggerResult.data.clientId); 

        // Listen for the specific progress event relayed from Go -> Node -> Browser
        socket.on('campaign_progress', (data) => {
            if (data.campaignId === triggerResult.data.campaignId) {
                
                // Animate the DOM numbers
                animateValue("wsSentCount", data.sent);
                animateValue("wsFailedCount", data.failed);

                if (data.status === 'completed') {
                    statusDisplay.innerText = "Campaign Complete!";
                    uploadBtn.disabled = false; // Re-enable button for next campaign
                    socket.off('campaign_progress'); // Stop listening to save memory
                }
            }
        });

    } catch (err) {
        uploadBtn.disabled = false;
        showError(`Process failed: ${err.message}`);
    }
}

// UI Helper: Smooth number counting animation
function animateValue(id, targetValue) {
    const obj = document.getElementById(id);
    const currentValue = parseInt(obj.innerText.replace(/,/g, '')) || 0;
    
    if (currentValue === targetValue) return;
    
    obj.innerText = targetValue.toLocaleString();
    
    // Flash effect to show activity (Requires a brief CSS transition in your stylesheet)
    obj.classList.add('text-success', 'fw-bold');
    setTimeout(() => {
        obj.classList.remove('text-success', 'fw-bold');
    }, 300);
}

// UI Helper: Show Errors cleanly
function showError(msg) {
    statusDisplay.style.color = 'red';
    statusDisplay.innerText = msg;
}