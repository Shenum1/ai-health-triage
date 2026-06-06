// frontend/public/js/triage.js
// Main dashboard logic: chat interface, triage engine, history sidebar

document.addEventListener('DOMContentLoaded', async () => {
  const user = await Auth.requireAuth();
  if (!user) return;

  // Populate user info in UI
  $$('[data-user-name]').forEach(el => el.textContent = user.name);
  $$('[data-user-email]').forEach(el => el.textContent = user.email);
  $$('[data-user-initials]').forEach(el => {
    el.textContent = user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  });

  initChat();
  initHistory();
  initSidebar();

  // Show admin panel link for admin users
  if (user.role === 'admin') {
    const adminLink = document.getElementById('admin-link');
    if (adminLink) adminLink.style.display = 'inline-flex';
  }

  // Load appointment notification badge
  loadAppointmentBadge();

  // Logout
  const logoutBtn = $('#logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => Auth.logout());

});

// ── Chat State ────────────────────────────────────────────────
let sessionId = generateSessionId();
let conversationMessages = [];
let queryCount = 0;
let isLoading = false;
let currentTriage = null;

function initChat() {
  const input   = $('#chat-input');
  const sendBtn = $('#chat-send');
  const newBtn  = $('#new-session-btn');

  if (!input || !sendBtn) return;

  sendBtn.addEventListener('click', () => sendMessage());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    sendBtn.disabled = !input.value.trim() || isLoading;
  });

  if (newBtn) newBtn.addEventListener('click', newSession);

  // Quick chip buttons
  $$('.quick-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (isLoading) return;
      input.value = chip.dataset.text || chip.textContent;
      input.dispatchEvent(new Event('input'));
      sendMessage();
    });
  });

  sendBtn.disabled = true;
}

async function sendMessage() {
  const input = $('#chat-input');
  const text  = input?.value.trim();
  if (!text || isLoading) return;

  // Hide chips after first message
  const chipsEl = $('#quick-chips');
  if (chipsEl) chipsEl.style.display = 'none';

  input.value = '';
  input.style.height = 'auto';
  $('#chat-send').disabled = true;

  appendMessage('user', text);
  conversationMessages.push({ role: 'user', content: text });

  setTyping(true);

  try {
    const data = await API.triage.consult(conversationMessages, sessionId);

    conversationMessages.push({ role: 'assistant', content: data.reply });
    queryCount++;

    currentTriage = data.triage;
    updateTriageUI(data.triage);
    setMetrics(queryCount, data.triage);
    maybeShowDoctorCTA(data.triage, data.consultationId);

    const cleanHtml = formatAIReply(data.reply);
    appendMessage('assistant', cleanHtml, data.triage);

    // Refresh history panel
    loadHistory();
  } catch (err) {
    appendMessage('assistant', `<span class="msg-error">Error: ${escapeHtml(err.message)}. Please try again.</span>`, null);
  } finally {
    setTyping(false);
  }
}

function appendMessage(role, content, triage) {
  const container = $('#chat-messages');
  if (!container) return;

  const wrap = document.createElement('div');
  wrap.className = `chat-msg chat-msg--${role} animate-fadeIn`;

  const avatar = document.createElement('div');
  avatar.className = 'chat-msg__avatar';
  if (role === 'assistant') {
    avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
  } else {
    const initials = (Auth._user?.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    avatar.textContent = initials;
  }

  const bubble = document.createElement('div');
  bubble.className = 'chat-msg__bubble';
  bubble.innerHTML = content;

  if (triage?.level) {
    const card = document.createElement('div');
    card.className = `triage-card triage-card--${triageCardVariant(triage.level)}`;
    card.innerHTML = `
      <span class="triage-card__icon">${triageIcon(triage.level)}</span>
      <div>
        <div class="triage-card__level">${triage.level} — ${triageLabel(triage.level)}</div>
        ${triage.care ? `<div class="triage-card__action">${escapeHtml(triage.care)}</div>` : ''}
      </div>
    `;
    bubble.appendChild(card);
  }

  wrap.appendChild(avatar);
  wrap.appendChild(bubble);
  container.appendChild(wrap);
  container.scrollTop = container.scrollHeight;
}

function setTyping(on) {
  isLoading = on;
  const t = $('#typing-indicator');
  if (t) t.style.display = on ? 'flex' : 'none';
  const container = $('#chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}

function updateTriageUI(triage) {
  const levels = { L1: 'tl1', L2: 'tl2', L3: 'tl3', L4: 'tl4' };
  $$('.triage-level-pill').forEach(el => el.classList.remove('active'));
  if (triage?.level && levels[triage.level]) {
    const el = $(`#${levels[triage.level]}`);
    if (el) el.classList.add('active');
  }
}

function setMetrics(count, triage) {
  const qEl = $('#metric-queries');
  const lEl = $('#metric-level');
  const sEl = $('#metric-severity');
  if (qEl) qEl.textContent = count;
  if (lEl) lEl.textContent = triage?.level || '—';
  if (sEl) sEl.textContent = triage?.severity ? triage.severity + '/10' : '—';
}

function formatAIReply(text) {
  return text
    .replace(/TRIAGE_LEVEL:\s*L[1-4]/gi, '')
    .replace(/SEVERITY_SCORE:\s*\d+/gi, '')
    .replace(/CARE_RECOMMENDATION:\s*.+/gi, '')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n\n+/g, '<br><br>')
    .replace(/\n/g, '<br>')
    .trim();
}

function triageCardVariant(level) {
  return { L1: 'green', L2: 'amber', L3: 'coral', L4: 'red' }[level] || 'gray';
}

function triageIcon(level) {
  return { L1: '✓', L2: '↑', L3: '⚠', L4: '🚨' }[level] || '•';
}

function newSession() {
  sessionId = generateSessionId();
  conversationMessages = [];
  queryCount = 0;
  currentTriage = null;

  const container = $('#chat-messages');
  if (container) {
    container.innerHTML = '';
    appendWelcomeMessage();
  }

  const chipsEl = $('#quick-chips');
  if (chipsEl) chipsEl.style.display = 'flex';

  $$('.triage-level-pill').forEach(el => el.classList.remove('active'));
  setMetrics(0, null);
}

function appendWelcomeMessage() {
  appendMessage('assistant', `
    Hello! I'm <strong>MediTriage AI</strong>, your preliminary health consultation assistant.<br><br>
    Please describe your symptoms — include when they started, how severe they feel on a scale of 1–10,
    and any relevant medical history. What's been bothering you today?
  `, null);
}

// ── History Sidebar ────────────────────────────────────────────
async function initHistory() {
  await loadHistory();
}

async function loadHistory() {
  const list = $('#history-list');
  if (!list) return;

  try {
    const { consultations } = await API.triage.history();

    if (!consultations.length) {
      list.innerHTML = `<p class="history-empty">No consultations yet.<br>Start a conversation above.</p>`;
      return;
    }

    list.innerHTML = consultations.map(c => `
      <div class="history-item" data-id="${c.id}" onclick="loadConsultation('${c.id}')">
        <div class="history-item__top">
          ${c.triage_level
            ? `<span class="badge ${triageBadgeClass(c.triage_level)}">${c.triage_level}</span>`
            : `<span class="badge badge--gray">—</span>`}
          <span class="history-item__date">${formatDate(c.created_at)}</span>
        </div>
        <div class="history-item__title">${escapeHtml(c.title || 'Consultation')}</div>
        ${c.care_recommendation ? `<div class="history-item__care">${escapeHtml(c.care_recommendation)}</div>` : ''}
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = `<p class="history-empty text-muted">Could not load history.</p>`;
  }
}

async function loadConsultation(id) {
  try {
    const { consultation } = await API.triage.getConsultation(id);

    // Restore session
    sessionId = consultation.session_id;
    conversationMessages = consultation.messages || [];

    const container = $('#chat-messages');
    if (!container) return;
    container.innerHTML = '';

    for (const msg of consultation.messages) {
      if (msg.role === 'user') {
        appendMessage('user', escapeHtml(msg.content), null);
      } else {
        const triage = msg === consultation.messages[consultation.messages.length - 1]
          ? { level: consultation.triage_level, severity: consultation.severity_score, care: consultation.care_recommendation }
          : null;
        appendMessage('assistant', formatAIReply(msg.content), triage);
      }
    }

    // Close sidebar on mobile
    const sidebar = $('#history-sidebar');
    if (sidebar && window.innerWidth < 900) sidebar.classList.remove('open');
  } catch (err) {
    console.error('Failed to load consultation:', err);
  }
}

function initSidebar() {
  const toggleBtn = $('#history-toggle');
  const sidebar   = $('#history-sidebar');
  const overlay   = $('#sidebar-overlay');

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('show');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      overlay.classList.remove('show');
    });
  }
}

// Show "See a Doctor" CTA when triage level is L2 or above
function maybeShowDoctorCTA(triage, consultationId) {
  const btn = document.getElementById('see-doctor-btn');
  if (!btn) return;
  if (triage?.level && ['L2','L3','L4'].includes(triage.level)) {
    const url = consultationId ? `/see-a-doctor?consultation=${consultationId}` : '/see-a-doctor';
    btn.href = url;
    btn.style.display = 'inline-flex';
  }
}

// ── Appointment badge on navbar ───────────────────────────────
async function loadAppointmentBadge() {
  try {
    const { requests } = await API.doctor.myRequests();
    const link = document.getElementById('appointments-link');
    if (!link) return;

    const scheduled = requests.filter(r => r.status === 'scheduled').length;
    const pending   = requests.filter(r => r.status === 'pending' || r.status === 'reviewing').length;

    if (scheduled > 0) {
      link.innerHTML = `📅 Appointments <span style="
        display:inline-flex;align-items:center;justify-content:center;
        background:#1D9E75;color:white;font-size:0.65rem;font-weight:700;
        width:18px;height:18px;border-radius:50%;margin-left:4px;
      ">${scheduled}</span>`;
      link.style.color = 'var(--teal)';
      link.style.fontWeight = '600';
    } else if (pending > 0) {
      link.innerHTML = `📅 Appointments <span style="
        display:inline-flex;align-items:center;justify-content:center;
        background:#BA7517;color:white;font-size:0.65rem;font-weight:700;
        width:18px;height:18px;border-radius:50%;margin-left:4px;
      ">${pending}</span>`;
    }
  } catch (_) {
    // Silently fail — not critical
  }
}
