// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    connectSocket();
});

function connectSocket() {
    const ws = new WebSocket('wss://dashboard.example.com/ws');

    ws.onopen = () => {
        console.log('Connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);

        switch (data.event) {
            case 'campaign.completed':
                showToast(data.payload);
                break;

            case 'campaign.progress':
                updateProgressBar(data.payload);
                break;

            case 'system.alert':
                showAlert(data.payload);
                break;
        }
    };

    ws.onclose = () => {
        console.log('Disconnected');
    };
}