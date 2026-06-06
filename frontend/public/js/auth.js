// frontend/public/js/auth.js
// Handles login and register form logic

document.addEventListener('DOMContentLoaded', async () => {
  // Redirect if already logged in
  await Auth.redirectIfAuthed();

  const page = document.body.dataset.page;
  if (page === 'login')    initLogin();
  if (page === 'register') initRegister();
});

// ── Login ─────────────────────────────────────────────────────
function initLogin() {
  const form    = $('#login-form');
  const alert   = $('#login-alert');
  const submitBtn = $('#login-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alert);

    const email    = $('#login-email').value.trim();
    const password = $('#login-password').value;

    if (!email || !password) {
      return showAlert(alert, 'Please enter your email and password.');
    }

    setLoading(submitBtn, true);
    try {
      await API.auth.login(email, password);
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get('redirect') || '/dashboard';
    } catch (err) {
      showAlert(alert, err.message || 'Login failed. Please try again.');
      setLoading(submitBtn, false);
    }
  });
}

// ── Register ──────────────────────────────────────────────────
function initRegister() {
  const form      = $('#register-form');
  const alert     = $('#register-alert');
  const submitBtn = $('#register-btn');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(alert);
    clearFieldErrors();

    const name     = $('#register-name').value.trim();
    const email    = $('#register-email').value.trim();
    const password = $('#register-password').value;
    const confirm  = $('#register-confirm').value;

    let valid = true;

    if (name.length < 2) {
      setFieldError('register-name', 'Name must be at least 2 characters');
      valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('register-email', 'Enter a valid email address');
      valid = false;
    }
    if (password.length < 8) {
      setFieldError('register-password', 'Password must be at least 8 characters');
      valid = false;
    }
    if (password !== confirm) {
      setFieldError('register-confirm', 'Passwords do not match');
      valid = false;
    }

    if (!valid) return;

    setLoading(submitBtn, true);
    try {
      await API.auth.register(name, email, password);
      window.location.href = '/dashboard';
    } catch (err) {
      showAlert(alert, err.message || 'Registration failed. Please try again.');
      setLoading(submitBtn, false);
    }
  });

  // Live password strength indicator
  const pwInput = $('#register-password');
  const strengthBar = $('#pw-strength-bar');
  const strengthText = $('#pw-strength-text');

  if (pwInput && strengthBar) {
    pwInput.addEventListener('input', () => {
      const strength = getPasswordStrength(pwInput.value);
      strengthBar.style.width = strength.pct + '%';
      strengthBar.style.background = strength.color;
      if (strengthText) strengthText.textContent = strength.label;
    });
  }
}

function setFieldError(id, msg) {
  const input = $(`#${id}`);
  const errEl = $(`#${id}-error`);
  if (input) input.classList.add('error');
  if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
}

function clearFieldErrors() {
  $$('.form-input').forEach(el => el.classList.remove('error'));
  $$('.form-error').forEach(el => { el.textContent = ''; el.classList.remove('show'); });
}

function getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { pct: 20,  color: '#E24B4A', label: 'Very weak' },
    { pct: 40,  color: '#EF9F27', label: 'Weak' },
    { pct: 60,  color: '#BA7517', label: 'Fair' },
    { pct: 80,  color: '#639922', label: 'Strong' },
    { pct: 100, color: '#1D9E75', label: 'Very strong' },
  ];
  return levels[Math.min(score, 4)];
}
