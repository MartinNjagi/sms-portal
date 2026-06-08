// public/js/customjs/contacts.js

document.addEventListener('DOMContentLoaded', () => {
    const createGroupForm = document.getElementById('createGroupForm');
    
    if (createGroupForm) {
        createGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent standard page reload
            
            const btn = document.getElementById('saveGroupBtn');
            const statusDiv = document.getElementById('groupStatus');
            const groupName = document.getElementById('groupName').value.trim();
            const description = document.getElementById('groupDescription').value.trim();

            // UI Reset
            btn.disabled = true;
            btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Saving...';
            statusDiv.style.display = 'none';

            try {
                // Assuming you mounted the contacts router at '/contacts' in server.js
                const response = await fetch('/contacts/api/groups', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ groupName, description })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    // The Go Engine successfully saved it!
                    // The easiest way to update the UI is to reload the view,
                    // which will now fetch the newly updated list of groups from Go.
                    window.location.reload();
                } else {
                    throw new Error(result.error || 'Failed to create group. Please try again.');
                }
            } catch (err) {
                statusDiv.innerText = err.message;
                statusDiv.style.display = 'block';
                btn.disabled = false;
                btn.innerText = 'Save Group';
            }
        });
    }

    const importForm = document.getElementById('form-import-csv');
    
    // --- Helper: Strict 254 Normalizer ---
    const normalizeTo254 = (phone) => {
        let p = phone.replace(/\D/g, ''); // Strip ALL non-numeric chars (e.g., +, spaces, -)
        
        // Handle 07xx or 01xx -> 2547xx / 2541xx
        if ((p.startsWith('07') || p.startsWith('01')) && p.length === 10) {
            p = '254' + p.substring(1);
        } 
        // Handle numbers where the user forgot the 0 or 254 (e.g., 712345678)
        else if ((p.startsWith('7') || p.startsWith('1')) && p.length === 9) {
            p = '254' + p;
        }

        // Final strict check: Must be exactly 12 digits and start with 254
        if (p.length === 12 && p.startsWith('254')) {
            return p;
        }
        return null; // Invalid
    };

    if (importForm) {
        importForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const submitBtn = document.getElementById('btn-submit-import');
            const groupId = document.getElementById('importGroupId').value;
            const fileInput = document.getElementById('importCsvFile');
            const originalFile = fileInput.files[0];
            const progressContainer = document.getElementById('importProgressContainer');

            if (!originalFile) return alert('Please select a file.');

            submitBtn.disabled = true;
            submitBtn.innerText = 'Analyzing & Cleaning...';

            try {
                // 1. Read file into browser memory
                const fileText = await readFileAsText(originalFile);
                
                // 2. Parse, Clean, and Normalize
                const rawLines = fileText.split(/\r?\n/).map(line => line.trim()).filter(line => line);
                
                // Strip header if the first row has letters
                if (/[a-zA-Z]/.test(rawLines[0])) rawLines.shift();

                const validContacts = [];
                let invalidCount = 0;

                rawLines.forEach(line => {
                    // Single column assumed, but we split by comma just in case they upload a multi-column by mistake
                    const rawPhone = line.split(',')[0]; 
                    const cleanPhone = normalizeTo254(rawPhone);
                    
                    if (cleanPhone) {
                        validContacts.push(cleanPhone); // Push strictly '254xxxxxxxxx'
                    } else {
                        invalidCount++;
                    }
                });

                if (validContacts.length === 0) {
                    throw new Error('No valid Kenyan phone numbers found in the CSV.');
                }

                if (invalidCount > 0) {
                    const proceed = confirm(`Cleaned ${validContacts.length} valid numbers. Discarded ${invalidCount} invalid rows. Proceed?`);
                    if (!proceed) throw new Error('Import cancelled by user.');
                }

                progressContainer.classList.remove('d-none');

                // 3. THE SMART ROUTER
                if (validContacts.length <= 2000) {
                    
                    // --- SYNC FLOW: Send JSON Array directly ---
                    submitBtn.innerText = 'Importing Instantly...';
                    
                    const syncRes = await fetch('/contacts/api/contacts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ groupId: parseInt(groupId, 10), contacts: validContacts })
                    });

                    const syncData = await syncRes.json();
                    if (!syncData.success) throw new Error(syncData.error);
                    
                    alert(`Success! ${validContacts.length} contacts were added instantly.`);

                } else {
                    
                    // --- ASYNC FLOW: File too large, send to S3 ---
                    submitBtn.innerText = 'Requesting Secure Upload...';
                    
                    // Generate a BRAND NEW CSV Blob containing only the strict 254 numbers
                    const cleanCsvText = validContacts.join('\n');
                    const cleanFileToUpload = new File([cleanCsvText], `cleaned_${originalFile.name}`, { type: 'text/csv' });
                    
                    const urlRes = await fetch(`/contacts/api/upload-url?fileName=${encodeURIComponent(cleanFileToUpload.name)}&fileType=${encodeURIComponent(cleanFileToUpload.type)}`);
                    const urlData = await urlRes.json();
                    if (!urlData.success) throw new Error(urlData.error);
                    
                    const { uploadUrl, fileKey } = urlData.data;

                    // Upload our new PERFECT file to S3
                    submitBtn.innerText = 'Uploading to Cloud...';
                    const uploadRes = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': cleanFileToUpload.type },
                        body: cleanFileToUpload
                    });
                    if (!uploadRes.ok) throw new Error('Failed to upload file to storage bucket.');

                    submitBtn.innerText = 'Queuing for Processing...';
                    const triggerRes = await fetch('/contacts/api/trigger-import', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ fileKey, groupId })
                    });

                    const triggerData = await triggerRes.json();
                    if (!triggerData.success) throw new Error(triggerData.error);

                    alert(`Success! Your clean list of ${validContacts.length} contacts is processing in the background.`);
                }
                
                location.reload(); 

            } catch (error) {
                if (error.message !== 'Import cancelled by user.') {
                    alert(error.message || 'An error occurred during import.');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerText = 'Upload & Import';
                progressContainer.classList.add('d-none');
            }
        });
    }
});

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read the file.'));
        reader.readAsText(file);
    });
}