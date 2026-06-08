document.addEventListener('DOMContentLoaded', () => {
    // We assume 'io()' is already initialized globally.
    // If you need to listen to specific live updates for the dashboard table:
    const socket = io();

    socket.on('campaign.progress', (data) => {
        // Find the campaign in the table and update the sent count dynamically
        // (Assuming you add data-campaign-id attributes to your table rows)
        const row = document.querySelector(`tr[data-campaign-id="${data.campaignId}"]`);
        if (row) {
            const sentCell = row.querySelector('.sent-count');
            if (sentCell) sentCell.innerText = data.sent;
            
            // Optionally update the global sent counter
            const totalSentEl = document.getElementById('dash-total-sent');
            if (totalSentEl) {
                let current = parseInt(totalSentEl.innerText.replace(/,/g, '')) || 0;
                // Add the delta (this requires your payload to send delta or total, adjust accordingly)
                totalSentEl.innerText = (current + 1).toLocaleString(); 
            }
        }
    });
});