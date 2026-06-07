// ─── Shared helpers ──────────────────────────────────────────────────────────

function labelFor(event) {
    const map = {
        'campaign.completed': 'Completed',
        'campaign.progress':  'In Progress',
        'system.alert':       'System Alert',
    };
    return map[event] || event;
}

function badgeClassFor(event) {
    if (event === 'campaign.completed')  return 'bg-success';
    if (event === 'campaign.progress')   return 'bg-info text-dark';
    if (event.startsWith('system.'))     return 'bg-warning text-dark';
    return 'bg-secondary';
}

function descFor(n) {
    const p = n.payload || {};
    if (n.event === 'campaign.completed') return `${p.campaign_id || '—'} · ${p.sent || 0} sent`;
    if (n.event === 'campaign.progress')  return `${p.campaign_id || '—'} · ${p.percent || 0}% delivered`;
    if (n.event === 'system.alert')       return p.message || '—';
    return JSON.stringify(p);
}

function timeAgo(dateStr) {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)    return 'Just now';
    if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString();
}

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(event, payload) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'notif-toast';
    toast.innerHTML = `
        <div>
            <div class="toast-title">${labelFor(event)}</div>
            <div class="toast-msg">${descFor({ event, payload })}</div>
        </div>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}

// ─── Bell dropdown (runs on every page) ──────────────────────────────────────

const BellDropdown = (() => {
    let notifications = [];

    function unreadCount() {
        return notifications.filter(n => !n.is_read).length;
    }

    function updateBadge() {
        const badge = document.getElementById('notif-badge');
        if (!badge) return;
        const count = unreadCount();
        badge.textContent = count;
        badge.classList.toggle('d-none', count === 0);
    }

    function renderList() {
        const list = document.getElementById('notif-dropdown-list');
        if (!list) return;

        if (!notifications.length) {
            list.innerHTML = `<div class="text-center text-muted py-3" style="font-size:13px;">No notifications</div>`;
            return;
        }

        list.innerHTML = notifications.slice(0, 8).map(n => `
            <div class="notif-item ${n.is_read ? '' : 'unread'}" data-id="${n.id}">
                <div class="flex-grow-1">
                    <div class="notif-title">
                        <span class="badge ${badgeClassFor(n.event)} me-1" style="font-size:10px;">${labelFor(n.event)}</span>
                    </div>
                    <div class="notif-desc">${descFor(n)}</div>
                    <div class="notif-time">${timeAgo(n.created_at)}</div>
                </div>
                ${!n.is_read ? '<span class="notif-unread-dot mt-1 flex-shrink-0"></span>' : ''}
            </div>
        `).join('');

        list.querySelectorAll('.notif-item[data-id]').forEach(el => {
            el.addEventListener('click', () => markRead(el.dataset.id));
        });
    }

    async function fetch() {
        try {
            const res = await axios.get('/notifications/api');
            notifications = res.data.data?.notifications || res.data.data || [];
            renderList();
            updateBadge();
        } catch (e) {
            console.error('Bell fetch failed', e);
        }
    }

    async function markRead(id) {
        await axios.patch(`/notifications/api/${id}/read`);
        const n = notifications.find(n => n.id === id);
        if (n) n.is_read = true;
        renderList();
        updateBadge();
    }

    async function markAllRead() {
        await axios.patch('/notifications/api/read-all');
        notifications.forEach(n => n.is_read = true);
        renderList();
        updateBadge();
    }

    function init() {
        const bell   = document.getElementById('notif-bell');
        const panel  = document.getElementById('notif-panel');
        const markAll = document.getElementById('notif-mark-all');
        if (!bell || !panel) return;

        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            panel.classList.toggle('d-none');
        });

        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && e.target !== bell) {
                panel.classList.add('d-none');
            }
        });

        markAll?.addEventListener('click', markAllRead);

        fetch();
    }

    return { init, push: (event, payload) => {
        notifications.unshift({
            id: Date.now(),
            event,
            payload,
            is_read: false,
            created_at: new Date().toISOString()
        });
        renderList();
        updateBadge();
        showToast(event, payload);
    }};
})();

// ─── SSE (runs on every page) ─────────────────────────────────────────────────

function initSSE() {
    const source = new EventSource('/sse/events');

    ['campaign.completed', 'campaign.progress', 'system.alert'].forEach(ev => {
        source.addEventListener(ev, (e) => {
            const payload = JSON.parse(e.data);
            BellDropdown.push(ev, payload);

            // If the centre page is open, refresh its table live
            if (typeof NotifCentre !== 'undefined') {
                NotifCentre.prepend(ev, payload);
            }
        });
    });

    source.onerror = () => console.warn('SSE reconnecting...');
}

// ─── Notification centre page (only runs on /notifications) ──────────────────

const NotifCentre = (() => {
    if (!document.getElementById('notif-tbody')) return undefined;

    const isAdmin   = window.__NOTIF_IS_ADMIN__;
    let state = {
        notifications: window.__NOTIF_DATA__?.data        || [],
        total:         window.__NOTIF_DATA__?.total        || 0,
        page:          window.__NOTIF_DATA__?.page         || 1,
        pages:         window.__NOTIF_DATA__?.pages        || 1,
        filterUser:    '',
    };

    function renderRow(n) {
        return `
        <tr class="${n.is_read ? '' : 'table-primary bg-opacity-10'}" data-id="${n.id}">
            <td>${n.is_read ? '' : '<span class="notif-unread-dot"></span>'}</td>
            ${isAdmin ? `<td><span class="fw-medium">${n.username || ''}</span><br>
                <small class="text-muted">${n.user_id}</small></td>` : ''}
            <td><span class="badge ${badgeClassFor(n.event)}">${labelFor(n.event)}</span></td>
            <td class="text-muted" style="font-size:13px;">${descFor(n)}</td>
            <td class="text-muted" style="font-size:12px;white-space:nowrap;">${timeAgo(n.created_at)}</td>
        </tr>`;
    }

    function render() {
        const tbody   = document.getElementById('notif-tbody');
        const empty   = document.getElementById('notif-empty');
        const table   = document.getElementById('notif-table');
        const loading = document.getElementById('notif-loading');
        const total   = document.getElementById('notif-total');
        const curPage = document.getElementById('current-page');
        const totPg   = document.getElementById('total-pages');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');

        loading?.classList.add('d-none');

        if (!state.notifications.length) {
            table?.classList.add('d-none');
            empty?.classList.remove('d-none');
        } else {
            table?.classList.remove('d-none');
            empty?.classList.add('d-none');
            tbody.innerHTML = state.notifications.map(renderRow).join('');

            tbody.querySelectorAll('tr[data-id]').forEach(row => {
                row.addEventListener('click', () => markRead(row.dataset.id));
            });
        }

        if (total)   total.textContent  = state.total;
        if (curPage) curPage.textContent = state.page;
        if (totPg)   totPg.textContent  = state.pages;
        if (prevBtn) prevBtn.disabled   = state.page <= 1;
        if (nextBtn) nextBtn.disabled   = state.page >= state.pages;
    }

    async function fetch(page = 1) {
        document.getElementById('notif-loading')?.classList.remove('d-none');
        document.getElementById('notif-table')?.classList.add('d-none');
        state.page = page;

        try {
            const params = { page };
            if (state.filterUser) params.user_id = state.filterUser;
            const res = await axios.get('/notifications/api', { params });
            const d   = res.data.data;
            state.notifications = d.notifications || d || [];
            state.total         = d.total  || 0;
            state.pages         = d.pages  || 1;
        } catch (e) {
            console.error('Notif centre fetch failed', e);
        }
        render();
    }

    async function markRead(id) {
        await axios.patch(`/notifications/api/${id}/read`);
        const n = state.notifications.find(n => n.id === id);
        if (n) { n.is_read = true; render(); }
    }

    function prepend(event, payload) {
        state.notifications.unshift({
            id: Date.now(),
            event,
            payload,
            is_read: false,
            created_at: new Date().toISOString()
        });
        state.total++;
        render();
    }

    // Init
    render();

    document.getElementById('user-filter')?.addEventListener('change', (e) => {
        state.filterUser = e.target.value;
        fetch(1);
    });

    document.getElementById('prev-btn')?.addEventListener('click', () => fetch(state.page - 1));
    document.getElementById('next-btn')?.addEventListener('click', () => fetch(state.page + 1));

    document.getElementById('mark-all-btn')?.addEventListener('click', async () => {
        await axios.patch('/notifications/api/read-all');
        state.notifications.forEach(n => n.is_read = true);
        render();
    });

    return { prepend };
})();

// ─── Boot ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    BellDropdown.init();
    initSSE();
});