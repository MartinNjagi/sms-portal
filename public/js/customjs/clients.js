document.addEventListener('DOMContentLoaded', () => {
    // 1. Suspend Client
    document.querySelectorAll('.btn-suspend').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const clientId = e.target.closest('button').dataset.id;
            const clientName = e.target.closest('button').dataset.name;

            const confirm = await swal({
                title: "Suspend Tenant?",
                text: `This will instantly lock out all users under ${clientName} and disable their API keys.`,
                icon: "warning",
                buttons: ["Cancel", "Yes, Suspend"],
                dangerMode: true,
            });

            if (confirm) {
                try {
                    // Update this path to match your exact BFF router configuration
                    const res = await axios.post(`/admin/api/clients/${clientId}/suspend`);
                    swal("Suspended", res.data.message, "success").then(() => location.reload());
                } catch (err) {
                    swal("Error", err.response?.data?.error || "Failed to suspend client.", "error");
                }
            }
        });
    });

    // 2. Reinstate Client
    document.querySelectorAll('.btn-reinstate').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const clientId = e.target.closest('button').dataset.id;
            const clientName = e.target.closest('button').dataset.name;

            const confirm = await swal({
                title: "Reinstate Tenant?",
                text: `Restore access for users and API keys under ${clientName}?`,
                icon: "info",
                buttons: ["Cancel", "Yes, Reinstate"]
            });

            if (confirm) {
                try {
                    const res = await axios.post(`/admin/api/clients/${clientId}/reinstate`);
                    swal("Reinstated", res.data.message, "success").then(() => location.reload());
                } catch (err) {
                    swal("Error", err.response?.data?.error || "Failed to reinstate client.", "error");
                }
            }
        });
    });
});