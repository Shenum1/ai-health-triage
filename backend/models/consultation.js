// backend/models/consultation.js
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun } = require('../config/database');

async function saveConsultation({ userId, sessionId, messages, triageData }) {
  const id = uuidv4();
  const firstUserMsg = messages.find(m => m.role === 'user');
  const title = firstUserMsg
    ? firstUserMsg.content.slice(0, 80) + (firstUserMsg.content.length > 80 ? '...' : '')
    : 'Health Consultation';

  await dbRun(
    `INSERT INTO consultations (id, user_id, session_id, title, triage_level, severity_score, care_recommendation, messages)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, userId, sessionId, title,
      triageData?.level || null,
      triageData?.severity ? parseInt(triageData.severity) : null,
      triageData?.care || null,
      JSON.stringify(messages)
    ]
  );
  return findById(id);
}

async function findByUser(userId, limit = 20) {
  return dbAll(
    `SELECT id, session_id, title, triage_level, severity_score, care_recommendation, created_at
     FROM consultations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
}

async function findById(id) {
  return dbGet('SELECT * FROM consultations WHERE id = ?', [id]);
}

module.exports = { saveConsultation, findByUser, findById };
