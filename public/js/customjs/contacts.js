// public/js/customjs/contacts.js

document.addEventListener('DOMContentLoaded', () => {
   const createGroupForm = document.getElementById('new-group-form');
    
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
                const response = await fetch('/contacts/api/groups', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json' 
                    },
                    body: JSON.stringify({ groupName, description })
                });

                const result = await response.json();

                if (response.ok && result.success) {
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
                    
                    alert(`Success! ${syncData.data.processed}/${validContacts.length} contacts were added instantly.`);

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

    const groupLinks = document.querySelectorAll('.group-link');
    const displayPane = document.getElementById('contacts-display-pane');

    groupLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault(); // Stop the # from jumping to the top of the page

            // 1. Manage Active State Highlighting on the Left Menu
            groupLinks.forEach(l => {
                l.classList.remove('active');
                l.querySelector('.badge').classList.replace('bg-light', 'bg-secondary');
                l.querySelector('.badge').classList.remove('text-primary');
            });
            link.classList.add('active');
            link.querySelector('.badge').classList.replace('bg-secondary', 'bg-light');
            link.querySelector('.badge').classList.add('text-primary');

            // 2. Extract group info from the clicked link
            const groupId = link.dataset.groupId;
            const groupName = link.dataset.groupName;
            const groupDesc = link.dataset.groupDesc || '';

            // 3. Show a loading spinner in the right pane instantly
            displayPane.innerHTML = `
                <div class="d-flex justify-content-center align-items-center h-100">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;

            try {
                // 4. Fetch the contacts from your Go backend
                const res = await fetch(`/contacts/api/groups/${groupId}/contacts`);
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || 'Failed to load contacts');
                }
                console.log("data", data);
                
                // Assuming your Go API returns { success: true, data: [ { phoneNumber: "254..." }, ... ] }
                const contacts = data.data || []; 

                // 5. Build the UI HTML
                let html = `
                    <div class="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                        <div>
                            <h4 class="mb-0">${groupName}</h4>
                            <small class="text-muted">${groupDesc}</small>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-primary fs-6">${contacts.length} Contacts</span>
                            <button 
                                class="btn btn-sm btn-outline-secondary" 
                                id="btn-edit-group"
                                data-group-id="${groupId}"
                                data-group-name="${groupName}">
                                ✏️ Edit / Replace
                            </button>
                        </div>
                    </div>
                `;

                if (contacts.length === 0) {
                    html += `
                        <div class="text-center text-muted py-5 mt-4">
                            <span style="font-size: 2rem;">📭</span>
                            <p class="mt-2">No contacts in this group yet.</p>
                        </div>
                    `;
                } else {
                    html += `
                        <div class="table-responsive" style="max-height: 600px; overflow-y: auto;">
                            <table class="table table-hover align-middle">
                                <thead class="table-light sticky-top">
                                    <tr>
                                        <th>Phone Number</th>
                                        <th>Status</th> 
                                    </tr>
                                </thead>
                                <tbody>
                                    ${contacts.map(c => `
                                        <tr>
                                            <td class="fw-medium">${c.phoneNumber || c}</td>
                                            <td><span class="badge bg-success bg-opacity-10 text-success">Active</span></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                }

                // 6. Inject the populated table into the display pane
                // After injecting html into displayPane, wire up the edit button:
                displayPane.innerHTML = html;
                wireEditGroupButton(); // <-- call this after every render

            } catch (err) {
                displayPane.innerHTML = `
                    <div class="alert alert-danger mt-4 text-center">
                        <strong>Error:</strong> ${err.message}
                    </div>
                `;
            }
        });
    });

});

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read the file.'));
        reader.readAsText(file);
    });
}

function wireEditGroupButton() {
    const btn = document.getElementById('btn-edit-group');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const groupId   = btn.dataset.groupId;
        const groupName = btn.dataset.groupName;

        // Inject an inline replace panel below the button
        const pane = document.getElementById('contacts-display-pane');
        
        // Preserve the header, replace the table with an edit form
        const existingHeader = pane.querySelector('.border-bottom');
        
        const editPanel = document.createElement('div');
        editPanel.id = 'edit-group-panel';
        editPanel.innerHTML = `
            <div class="alert alert-warning py-2 mb-3">
                <strong>⚠️ Replace Mode:</strong> This will <strong>replace all contacts</strong> 
                in <em>${groupName}</em> with the list below.
            </div>

            <div class="mb-3">
                <label class="form-label fw-semibold">Upload Replacement CSV</label>
                <input type="file" class="form-control" id="editGroupCsvFile" accept=".csv">
                <div class="form-text">Same format as import — one phone number per row.</div>
            </div>

            <div id="editGroupStatus" class="alert d-none"></div>

            <div class="d-flex gap-2">
                <button class="btn btn-danger" id="btn-confirm-replace">
                    Replace Contacts
                </button>
                <button class="btn btn-outline-secondary" id="btn-cancel-edit">
                    Cancel
                </button>
            </div>
        `;

        // Remove any existing edit panel before inserting
        document.getElementById('edit-group-panel')?.remove();
        pane.appendChild(editPanel);

        // Cancel just removes the panel
        document.getElementById('btn-cancel-edit').addEventListener('click', () => {
            editPanel.remove();
        });

        // Confirm: read CSV, validate, PUT to backend
        document.getElementById('btn-confirm-replace').addEventListener('click', async () => {
            const fileInput = document.getElementById('editGroupCsvFile');
            const statusDiv = document.getElementById('editGroupStatus');
            const confirmBtn = document.getElementById('btn-confirm-replace');

            if (!fileInput.files[0]) {
                return showEditStatus(statusDiv, 'danger', 'Please select a CSV file first.');
            }

            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Processing...';
            statusDiv.classList.add('d-none');

            try {
                const fileText   = await readFileAsText(fileInput.files[0]);
                const rawLines   = fileText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

                // Strip header if needed
                if (/[a-zA-Z]/.test(rawLines[0])) rawLines.shift();

                const validContacts = [];
                let invalidCount = 0;
                rawLines.forEach(line => {
                    const raw     = line.split(',')[0];
                    const cleaned = normalizeTo254(raw);
                    cleaned ? validContacts.push(cleaned) : invalidCount++;
                });

                if (validContacts.length === 0) {
                    throw new Error('No valid Kenyan phone numbers found in this file.');
                }

                if (invalidCount > 0) {
                    const ok = confirm(
                        `Found ${validContacts.length} valid numbers. ` +
                        `Discarded ${invalidCount} invalid rows.\n\nProceed with replacement?`
                    );
                    if (!ok) throw new Error('Cancelled.');
                }

                confirmBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Replacing...';

                const res = await fetch(`/contacts/api/groups/${groupId}/contacts`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ contacts: validContacts })
                });

                const result = await res.json();
                if (!res.ok || !result.success) throw new Error(result.error || 'Replace failed.');

                showEditStatus(statusDiv, 'success', 
                    `✅ Group replaced with ${result.data?.members ?? validContacts.length} contacts.`
                );

                // Refresh the group count badge on the left sidebar
                const groupLink = document.querySelector(`.group-link[data-group-id="${groupId}"] .badge`);
                if (groupLink) groupLink.textContent = validContacts.length;

                // Auto-dismiss edit panel after 2s
                setTimeout(() => editPanel.remove(), 2000);

            } catch (err) {
                if (err.message !== 'Cancelled.') {
                    showEditStatus(statusDiv, 'danger', err.message);
                }
            } finally {
                confirmBtn.disabled  = false;
                confirmBtn.innerHTML = 'Replace Contacts';
            }
        });
    });
}

function showEditStatus(el, type, message) {
    el.className = `alert alert-${type}`;
    el.textContent = message;
    el.classList.remove('d-none');
}



/**
 * normalizeTo254(phone) → "254XXXXXXXXX" | null
 *
 * Handles:
 *  07XXXXXXXX   (10 digits, leading 0)
 *  01XXXXXXXX   (10 digits, Safaricom 010x)
 *  7XXXXXXXX    (9 digits, missing leading 0)
 *  1XXXXXXXX    (9 digits, missing leading 0)
 *  2547XXXXXXXX (12 digits, already normalized)
 *  +2547XXXXXXX (13 chars with +)
 *  254 7XX...   (spaces anywhere)
 */
const normalizeTo254 = (phone) => {
    if (!phone || typeof phone !== 'string') return null;

    // Strip everything that isn't a digit
    let p = phone.replace(/\D/g, '');

    if (!p) return null;

    // Already fully qualified
    if (p.length === 12 && p.startsWith('254')) {
        return isValidSafaricomPrefix(p.slice(3)) ? p : null;
    }

    // +254XXXXXXXXX stripped to 254XXXXXXXXX (13 chars with + → 12 digits)
    // already handled above after stripping \D

    // 07XXXXXXXX or 01XXXXXXXX → 254 + last 9 digits
    if (p.length === 10 && (p.startsWith('07') || p.startsWith('01'))) {
        p = '254' + p.slice(1);
        return isValidSafaricomPrefix(p.slice(3)) ? p : null;
    }

    // 7XXXXXXXX or 1XXXXXXXX (9 digits, dropped leading 0)
    if (p.length === 9 && (p.startsWith('7') || p.startsWith('1'))) {
        p = '254' + p;
        return isValidSafaricomPrefix(p.slice(3)) ? p : null;
    }

    return null;
};

/**
 * Validates the 9-digit subscriber number against known
 * Kenyan operator prefixes (as of 2025).
 *
 * Safaricom : 70x, 71x, 72x, 74x, 75x, 76x, 79x, 110, 111
 * Airtel    : 73x, 75x (shared), 10x
 * Telkom    : 77x
 */
const VALID_KE_PREFIXES = new Set([
    '70','71','72','73','74','75','76','77','78','79', // GSM block
    '10','11',                                          // newer blocks
]);

const isValidSafaricomPrefix = (subscriber9) => {
    if (!subscriber9 || subscriber9.length !== 9) return false;
    const prefix2 = subscriber9.slice(0, 2);
    return VALID_KE_PREFIXES.has(prefix2);
};


/**
 * batchNormalize(rawList) → { valid: string[], invalid: string[] }
 *
 * Deduplicates, normalizes, and splits a raw list.
 * Drop-in preparser before any downstream send.
 */
const batchNormalize = (rawList = []) => {
    const seen  = new Set();
    const valid   = [];
    const invalid = [];

    for (const raw of rawList) {
        const normalized = normalizeTo254(String(raw ?? '').trim());

        if (!normalized) {
            invalid.push(raw);
            continue;
        }

        if (seen.has(normalized)) continue; // silent dedupe
        seen.add(normalized);
        valid.push(normalized);
    }

    return { valid, invalid };
};