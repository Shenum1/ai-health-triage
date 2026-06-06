// backend/server.js
require('dotenv').config();

const express      = require('express');
const helmet       = require('helmet');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const morgan       = require('morgan');
const path         = require('path');

const REQUIRED = ['GROQ_API_KEY', 'JWT_SECRET'];
const missing  = REQUIRED.filter(k => !process.env[k]);
if (missing.length) {
  console.error('\n  Missing required environment variables:', missing.join(', '));
  console.error('  Copy .env.example to .env and fill in your values.\n');
  process.exit(1);
}

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'"],
      styleSrc:   ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: true, limit: '20kb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── Static frontend ──────────────────────────────────────────
const FRONTEND = path.join(__dirname, '../frontend');
app.use(express.static(path.join(FRONTEND, 'public')));

app.get('/',             (req, res) => res.sendFile(path.join(FRONTEND, 'pages/index.html')));
app.get('/login',        (req, res) => res.sendFile(path.join(FRONTEND, 'pages/login.html')));
app.get('/register',     (req, res) => res.sendFile(path.join(FRONTEND, 'pages/register.html')));
app.get('/dashboard',    (req, res) => res.sendFile(path.join(FRONTEND, 'pages/dashboard.html')));
app.get('/see-a-doctor', (req, res) => res.sendFile(path.join(FRONTEND, 'pages/see-a-doctor.html')));
app.get('/my-requests',  (req, res) => res.sendFile(path.join(FRONTEND, 'pages/my-requests.html')));
app.get('/admin',        (req, res) => res.sendFile(path.join(FRONTEND, 'pages/admin.html')));

// ── API Routes ───────────────────────────────────────────────
app.use('/api/health', require('./routes/health'));
app.use('/api/auth',   require('./routes/auth'));
app.use('/api/triage', require('./routes/triage'));
app.use('/api/doctor', require('./routes/doctor'));

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.status(404).sendFile(path.join(FRONTEND, 'pages/index.html'));
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = parseInt(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`\n  MediTriage AI  ->  http://localhost:${PORT}`);
  console.log(`  AI Engine: Groq (llama-3.3-70b-versatile)`);
  console.log(`  Mode: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
