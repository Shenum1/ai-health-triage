# MediTriage AI — Health Consultation & Triage System

Full-stack AI health triage app with login/signup, consultation history, and 4-level triage assessment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS |
| Backend | Node.js + Express |
| Database | SQLite3 (prebuilt binaries — no compile step) |
| AI Engine | **Groq API — FREE** (llama-3.3-70b-versatile) |
| Auth | JWT + bcrypt + HTTP-only cookies |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Open .env and add your GROQ_API_KEY and JWT_SECRET

# 3. Start the server
npm run dev       # development (auto-restart)
npm start         # production

# 4. Open http://localhost:3000
```

## Getting Your FREE Groq API Key

1. Go to https://console.groq.com/
2. Sign up (free, no credit card)
3. Click "API Keys" → "Create API Key"
4. Copy it into your .env as GROQ_API_KEY=gsk_...

## Environment Variables (.env)

```
GROQ_API_KEY=gsk_your_key_here        # from console.groq.com (FREE)
JWT_SECRET=any_long_random_string      # make this long and random
PORT=3000
NODE_ENV=development
DB_PATH=./meditriage.db
```

Generate a good JWT_SECRET:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Project Structure

```
meditriage/
├── backend/
│   ├── config/database.js     ← SQLite3 setup (async, no build needed)
│   ├── middleware/auth.js      ← JWT verification
│   ├── models/user.js          ← User CRUD + bcrypt
│   ├── models/consultation.js  ← Consultation history
│   ├── routes/auth.js          ← Register / Login / Logout / Me
│   ├── routes/triage.js        ← Groq AI + triage logic
│   ├── routes/health.js        ← Health check
│   └── server.js               ← Express entry point
├── frontend/
│   ├── public/css/styles.css   ← Design system
│   ├── public/js/api.js        ← API fetch wrapper
│   ├── public/js/auth.js       ← Login/register logic
│   └── public/js/triage.js     ← Chat + history sidebar
│   └── pages/
│       ├── index.html          ← Landing page
│       ├── login.html          ← Login
│       ├── register.html       ← Sign up
│       └── dashboard.html      ← Triage chat dashboard
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/register | No | Create account |
| POST | /api/auth/login | No | Login |
| POST | /api/auth/logout | No | Logout |
| GET | /api/auth/me | Yes | Current user |
| POST | /api/triage/consult | Yes | AI triage consultation |
| GET | /api/triage/history | Yes | Consultation history |
| GET | /api/triage/history/:id | Yes | Single consultation |
| GET | /api/health | No | Health check |

## Triage Levels

| Level | Color | Meaning |
|-------|-------|---------|
| L1 | Green | Self-care at home |
| L2 | Amber | See a GP within 24–72 hrs |
| L3 | Coral | Same-day urgent care |
| L4 | Red | Emergency — call 911/999/112 |

## Why sqlite3 instead of better-sqlite3?

`sqlite3` uses prebuilt binaries and doesn't require Python or build tools to compile.
`better-sqlite3` requires native compilation which often fails on Windows or restricted environments.

## Disclaimer

Educational and informational purposes only. Not a substitute for professional medical advice.
