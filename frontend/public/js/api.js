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

function renderIcons() {
  if (window.lucide) lucide.createIcons();
}
