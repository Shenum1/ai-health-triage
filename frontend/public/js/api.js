// frontend/public/js/api.js

const API = {
  BASE: '',

  async _request(method, path, body) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(API.BASE + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed (${res.status})`);
      err.status = res.status; err.data = data; throw err;
    }
    return data;
  },

  get:    (path)       => API._request('GET',   path),
  post:   (path, body) => API._request('POST',  path, body),
  patch:  (path, body) => API._request('PATCH', path, body),
  delete: (path)       => API._request('DELETE', path),

  auth: {
    register: (name, email, password) => API.post('/api/auth/register', { name, email, password }),
    login:    (email, password)       => API.post('/api/auth/login',    { email, password }),
    logout:   ()                      => API.post('/api/auth/logout'),
    me:       ()                      => API.get('/api/auth/me'),
  },

  triage: {
    consult:         (messages, sessionId) => API.post('/api/triage/consult', { messages, sessionId }),
    history:         ()                    => API.get('/api/triage/history'),
    getConsultation: (id)                  => API.get(`/api/triage/history/${id}`),
  },

  doctor: {
    // User routes
    submitRequest:   (data)  => API.post('/api/doctor/request', data),
    myRequests:      ()      => API.get('/api/doctor/my-requests'),
    getMyRequest:    (id)    => API.get(`/api/doctor/my-requests/${id}`),
    cancelRequest:   (id)    => API.post(`/api/doctor/my-requests/${id}/cancel`),

    // Admin routes
    allRequests:     (status) => API.get(`/api/doctor/admin/requests${status ? `?status=${status}` : ''}`),
    getRequest:      (id)     => API.get(`/api/doctor/admin/requests/${id}`),
    updateRequest:   (id, data) => API.patch(`/api/doctor/admin/requests/${id}`, data),
  },

  health: () => API.get('/api/health'),
};

// ── Auth helpers ──────────────────────────────────────────────
const Auth = {
  _user: null,

  async getUser(force = false) {
    if (Auth._user && !force) return Auth._user;
    try { const { user } = await API.auth.me(); Auth._user = user; return user; }
    catch { Auth._user = null; return null; }
  },

  async requireAuth() {
    const user = await Auth.getUser();
    if (!user) { window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname); return null; }
    return user;
  },

  async requireAdmin() {
    const user = await Auth.getUser();
    if (!user) { window.location.href = '/login'; return null; }
    if (user.role !== 'admin') { window.location.href = '/dashboard'; return null; }
    return user;
  },

  async redirectIfAuthed() {
    const user = await Auth.getUser();
    if (user) { const p = new URLSearchParams(window.location.search); window.location.href = p.get('redirect') || '/dashboard'; }
    return user;
  },

  async logout() { await API.auth.logout(); Auth._user = null; window.location.href = '/login'; },
};

// ── DOM helpers ───────────────────────────────────────────────
function $(sel, ctx = document)  { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function showAlert(el, message, type = 'error') {
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert--${type} show`;
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
function hideAlert(el) { if (el) { el.className = 'alert'; el.textContent = ''; } }

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('btn--loading', loading);
}

function formatDate(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(isoStr) {
  if (!isoStr) return '—';
  return new Date(isoStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function triageBadgeClass(level) {
  return { L1: 'badge--green', L2: 'badge--amber', L3: 'badge--coral', L4: 'badge--red' }[level] || 'badge--gray';
}

function triageLabel(level) {
  return { L1: 'Self-care', L2: 'See a doctor', L3: 'Urgent care', L4: 'Emergency' }[level] || 'Pending';
}

function statusBadgeClass(status) {
  return { pending: 'badge--amber', reviewing: 'badge--navy', scheduled: 'badge--green', completed: 'badge--green', cancelled: 'badge--gray' }[status] || 'badge--gray';
}

function statusLabel(status) {
  return { pending: 'Pending', reviewing: 'Under review', scheduled: 'Scheduled', completed: 'Completed', cancelled: 'Cancelled' }[status] || status;
}

function escapeHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function generateSessionId() {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

// ── Inline icon set (no CDN needed) ──────────────────────────
const ICONS = {
  'activity':        '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  'alert-octagon':   '<polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>',
  'alert-triangle':  '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  'arrow-up-circle': '<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>',
  'building-2':      '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  'calendar':        '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'calendar-check':  '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="9 16 11 18 15 14"/>',
  'check':           '<polyline points="20 6 9 17 4 12"/>',
  'check-circle':    '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  'clipboard-list':  '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><line x1="12" y1="11" x2="16" y2="11"/><line x1="12" y1="16" x2="16" y2="16"/><line x1="8" y1="11" x2="8.01" y2="11"/><line x1="8" y1="16" x2="8.01" y2="16"/>',
  'clock':           '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  'layers':          '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  'lock':            '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'phone':           '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.67 10.43 19.79 19.79 0 0 1 1.61 1.8 2 2 0 0 1 3.6 0h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 7.91a16 16 0 0 0 6.16 6.16l.95-.95a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 15.44v1.48Z"/>',
  'search':          '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  'stethoscope':     '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
  'user':            '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'video':           '<polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>',
  'x-circle':        '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
};

function renderIcons() {
  document.querySelectorAll('i[data-lucide]').forEach(el => {
    const name  = el.getAttribute('data-lucide');
    const paths = ICONS[name];
    if (!paths) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('data-lucide', name);
    svg.style.cssText    = el.style.cssText;
    svg.style.display    = 'inline-block';
    svg.style.verticalAlign = 'middle';
    svg.style.flexShrink = '0';
    svg.innerHTML = paths;
    el.replaceWith(svg);
  });
}
