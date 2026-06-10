document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // 1. INITIALIZE FORM DATA
    // ==========================================
    try {
        // Fetch setup data from the BFF
        const res = await fetch('/messages/api/dashboard-data'); 
        const { data } = await res.json();
        
        // Populate Sender IDs
        const senderSelect = document.getElementById('singleSenderId');
        senderSelect.innerHTML = '<option value="" disabled selected>Select Sender ID</option>';
        if (data.senderIds) {
            data.senderIds.forEach(sender => {
                if (sender.status === 'APPROVED') {
                    senderSelect.innerHTML += `<option value="${sender.id}">${sender.name || sender.id}</option>`;
                }
            });
        }

        // Populate Templates
        const templateSelect = document.getElementById('singleTemplate');
        if (data.templates) {
            data.templates.forEach(tpl => {
                if (tpl.status === 'approved') {
                    // Store the raw content in a data attribute so we can inject it
                    const safeContent = tpl.content.replace(/"/g, '&quot;');
                    templateSelect.innerHTML += `<option value="${tpl.name}" data-content="${safeContent}">${tpl.name}</option>`;
                }
            });
        }
    } catch (error) {
        console.error("Failed to load setup data:", error);
    }

    // ==========================================
    // 2. UI INTERACTIONS
    // ==========================================
    const templateSelect = document.getElementById('singleTemplate');
    const messageArea = document.getElementById('singleMessage');
    const charCount = document.getElementById('singleCharCount');

    // Auto-fill message area when a template is selected
    templateSelect.addEventListener('change', (e) => {
        if (e.target.value === "") {
            messageArea.value = "";
        } else {
            const selectedOption = e.target.options[e.target.selectedIndex];
            messageArea.value = selectedOption.getAttribute('data-content');
        }
        // Trigger input event to update character count
        messageArea.dispatchEvent(new Event('input'));
        messageArea.focus();
    });

    // Character counter
    messageArea.addEventListener('input', (e) => {
        charCount.innerText = e.target.value.length;
    });

    // ==========================================
    // 3. SUBMIT SINGLE SMS
    // ==========================================
    const quickForm = document.getElementById('form-quick-send');
    
    quickForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btn = document.getElementById('btn-send-single');
        btn.disabled = true;
        btn.innerText = 'Sending...';

        const payload = {
            msisdn: document.getElementById('singlePhone').value,
            senderId: document.getElementById('singleSenderId').value,
            templateName: document.getElementById('singleTemplate').value,
            message: messageArea.value
        };

        try {
            const res = await fetch('/messages/api/single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();
            
            if (res.ok) {
                // If you implemented the global toast notification, you can use showToast() here
                alert('Message dispatched successfully!');
                quickForm.reset();
                charCount.innerText = "0";
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