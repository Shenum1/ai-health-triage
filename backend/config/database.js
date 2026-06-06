const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 1,
  ssl: { rejectUnauthorized: false },
});

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL DEFAULT 'user',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS consultations (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id          TEXT NOT NULL,
    title               TEXT,
    triage_level        TEXT,
    severity_score      INTEGER,
    care_recommendation TEXT,
    messages            JSONB NOT NULL DEFAULT '[]',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS doctor_requests (
    id                TEXT PRIMARY KEY,
    user_id           TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consultation_id   TEXT REFERENCES consultations(id) ON DELETE SET NULL,
    full_name         TEXT NOT NULL,
    email             TEXT NOT NULL,
    phone             TEXT,
    date_of_birth     TEXT,
    preferred_date    TEXT NOT NULL,
    preferred_time    TEXT NOT NULL,
    consultation_type TEXT NOT NULL DEFAULT 'video',
    chief_complaint   TEXT NOT NULL,
    triage_level      TEXT,
    severity_score    INTEGER,
    additional_notes  TEXT,
    status            TEXT NOT NULL DEFAULT 'pending',
    doctor_notes      TEXT,
    assigned_doctor   TEXT,
    scheduled_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_consultations_user ON consultations(user_id);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_requests_user ON doctor_requests(user_id);
  CREATE INDEX IF NOT EXISTS idx_requests_status ON doctor_requests(status);
`;

let schemaReady = false;

async function ensureSchema() {
  if (schemaReady) return;
  await pool.query(SCHEMA_SQL);
  await pool.query('ALTER TABLE users DROP COLUMN IF EXISTS password');
  schemaReady = true;
}

// Convert SQLite ? placeholders to Postgres $1, $2, ... positional params
function toPgParams(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function dbGet(sql, params = []) {
  await ensureSchema();
  const { rows } = await pool.query(toPgParams(sql), params);
  return rows[0] || null;
}

async function dbAll(sql, params = []) {
  await ensureSchema();
  const { rows } = await pool.query(toPgParams(sql), params);
  return rows;
}

async function dbRun(sql, params = []) {
  await ensureSchema();
  const result = await pool.query(toPgParams(sql), params);
  return { changes: result.rowCount };
}

module.exports = { dbGet, dbAll, dbRun };
