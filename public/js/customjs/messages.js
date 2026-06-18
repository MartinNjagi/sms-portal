document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // 1. DOM ELEMENTS
    // ==========================================
    const senderSelect = document.getElementById('singleSenderId');
    const templateSelect = document.getElementById('singleTemplate');
    const manualGroup = document.getElementById('manualMessageGroup');
    const manualMessage = document.getElementById('singleMessage');
    const dynamicContainer = document.getElementById('dynamicInputsContainer');
    const dynamicInputsList = document.getElementById('dynamicInputsList');
    const livePreviewText = document.getElementById('livePreviewText');
    const charCount = document.getElementById('previewCharCount');
    const smsCount = document.getElementById('previewSmsCount');
    const quickForm = document.getElementById('form-quick-send');

    // State trackers
    let currentTemplateContent = "";
    let extractedVariables = [];

    // ==========================================
    // 2. FETCH DATA & INITIALIZE
    // ==========================================
    try {
        const res = await fetch('/messages/api/dashboard-data'); 
        const { data } = await res.json();
        
        // Populate Sender IDs
        senderSelect.innerHTML = '<option value="" disabled selected>Select Sender ID</option>';
        if (data.senderIds) {
            data.senderIds.forEach(sender => {
                if (sender.status === 'APPROVED') {
                    senderSelect.innerHTML += `<option value="${sender.id}">${sender.sender_id}</option>`;
                }
            });
        }

        // Populate Templates
        if (data.templates) {
            data.templates.forEach(tpl => {
                if (tpl.status === 'APPROVED') {
                    const safeContent = tpl.content.replace(/"/g, '&quot;');
                    templateSelect.innerHTML += `<option value="${tpl.name}" data-content="${safeContent}">${tpl.name}</option>`;
                }
            });
        }
    } catch (error) {
        console.error("Failed to load setup data:", error);
    }

    // ==========================================
    // 3. MESSAGE CONSTRUCTOR LOGIC
    // ==========================================

    function updatePreview(text) {
        if (!text.trim()) {
            livePreviewText.innerHTML = "<em>Type a message or select a template to see the preview here...</em>";
            livePreviewText.classList.add('text-muted');
            charCount.innerText = "0";
            smsCount.innerText = "0";
            return;
        }

        livePreviewText.innerHTML = text;
        livePreviewText.classList.remove('text-muted');
        
        const len = text.length;
        charCount.innerText = len;
        smsCount.innerText = Math.ceil(len / 160);
    }

    function buildCompiledMessage() {
        if (templateSelect.value === "") {
            return manualMessage.value;
        }
        let compiled = currentTemplateContent;
        extractedVariables.forEach(variable => {
            const inputEl = document.getElementById(`var_${variable}`);
            // Fallback placeholder (defaults to curly brackets if empty)
            const val = inputEl && inputEl.value ? inputEl.value : `{${variable}}`;
            
            // Replace both [variable] and {variable} globally
            const regex = new RegExp(`\\[${variable}\\]|\\{${variable}\\}`, 'g');
            compiled = compiled.replace(regex, val);
        });
        return compiled;
    }

    // Handle Template Selection
    templateSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        dynamicInputsList.innerHTML = ""; // Clear old inputs
        extractedVariables = [];

        if (val === "") {
            // CUSTOM MESSAGE MODE
            manualGroup.classList.remove('d-none');
            dynamicContainer.classList.add('d-none');
            manualMessage.required = true;
            updatePreview(manualMessage.value);
        } else {
            // TEMPLATE MODE
            manualGroup.classList.add('d-none');
            manualMessage.required = false;
            
            const selectedOption = e.target.options[e.target.selectedIndex];
            currentTemplateContent = selectedOption.getAttribute('data-content');

            // Regex to find anything inside square brackets [] OR curly brackets {}
            const regex = /\[(.*?)\]|\{(.*?)\}/g;

            // m[1] captures text inside [], m[2] captures text inside {}
            const matches = [...currentTemplateContent.matchAll(regex)].map(m => m[1] || m[2]);
            
            // Get unique variables only
            extractedVariables = [...new Set(matches)];

            if (extractedVariables.length > 0) {
                dynamicContainer.classList.remove('d-none');
                
                // Build an input field for each variable
                extractedVariables.forEach(variable => {
                    const col = document.createElement('div');
                    col.className = 'col-md-6 form-group mb-2';
                    col.innerHTML = `
                        <label class="small fw-bold text-primary">${variable}</label>
                        <input type="text" id="var_${variable}" class="form-control form-control-sm dynamic-var-input" placeholder="Value for ${variable}">
                    `;
                    dynamicInputsList.appendChild(col);
                });

                // Attach event listeners to new inputs to update preview live
                document.querySelectorAll('.dynamic-var-input').forEach(input => {
                    input.addEventListener('input', () => updatePreview(buildCompiledMessage()));
                });
            } else {
                // Template has no variables
                dynamicContainer.classList.add('d-none');
            }

            updatePreview(buildCompiledMessage());
        }
    });

    // Handle Manual Textarea Input
    manualMessage.addEventListener('input', () => {
        updatePreview(manualMessage.value);
    });

    // ==========================================
    // 4. SUBMIT TO API
    // ==========================================
    quickForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('btn-send-single');
        btn.disabled = true;
        btn.innerText = 'Sending...';

        // Build the replacements map
        const replacements = {};
        extractedVariables.forEach(variable => {
            const inputEl = document.getElementById(`var_${variable}`);
            if (inputEl) {
                // Key matches exactly what is inside the bracket, without brackets
                replacements[variable] = inputEl.value; 
            }
        });

        if (!senderSelect.value) {
            alert('Select a sender ID');
            return;
        }

        const payload = {
            msisdn: document.getElementById('singlePhone').value.trim(),
            sender_id: senderSelect.value,
            message: buildCompiledMessage().trim()
        };

        console.log('Outgoing SendSingle', payload);

        if (!payload.message) {
            alert('Message cannot be empty');
            return;
        }

        try {
            const res = await fetch('/messages/api/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            
            if (res.ok) {
                alert('Message dispatched successfully!');
                
                // Reset form gracefully
                quickForm.reset();
                templateSelect.dispatchEvent(new Event('change')); // Trigger reset logic
            } else {
                alert(result.error || 'Failed to send message.');
            }
        } catch (err) {
            alert('A network error occurred.');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Send Message';
        }
    });
});