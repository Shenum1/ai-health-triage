// backend/models/doctorRequest.js
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbAll, dbRun } = require('../config/database');

const VALID_STATUSES  = ['pending', 'reviewing', 'scheduled', 'completed', 'cancelled'];
const VALID_TYPES     = ['video', 'phone', 'in-person'];

async function createRequest({
  userId, consultationId, fullName, email, phone, dateOfBirth,
  preferredDate, preferredTime, consultationType, chiefComplaint,
  triageLevel, severityScore, additionalNotes
}) {
  const id = uuidv4();
  await dbRun(
    `INSERT INTO doctor_requests (
      id, user_id, consultation_id, full_name, email, phone, date_of_birth,
      preferred_date, preferred_time, consultation_type, chief_complaint,
      triage_level, severity_score, additional_notes
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, userId, consultationId || null, fullName, email, phone || null,
      dateOfBirth || null, preferredDate, preferredTime,
      VALID_TYPES.includes(consultationType) ? consultationType : 'video',
      chiefComplaint, triageLevel || null,
      severityScore ? parseInt(severityScore) : null,
      additionalNotes || null
    ]
  );
  return findById(id);
}

async function findById(id) {
  return dbGet('SELECT * FROM doctor_requests WHERE id = ?', [id]);
}

async function findByUser(userId) {
  return dbAll(
    `SELECT * FROM doctor_requests WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
}

// Admin: get all requests with optional status filter
async function findAll({ status, limit = 50, offset = 0 } = {}) {
  if (status && VALID_STATUSES.includes(status)) {
    return dbAll(
      `SELECT dr.*, u.name as user_name, u.email as user_email
       FROM doctor_requests dr
       JOIN users u ON dr.user_id = u.id
       WHERE dr.status = ?
       ORDER BY dr.created_at DESC LIMIT ? OFFSET ?`,
      [status, limit, offset]
    );
  }
  return dbAll(
    `SELECT dr.*, u.name as user_name, u.email as user_email
     FROM doctor_requests dr
     JOIN users u ON dr.user_id = u.id
     ORDER BY dr.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

async function countByStatus() {
  return dbAll(
    `SELECT status, COUNT(*) as count FROM doctor_requests GROUP BY status`
  );
}

async function updateStatus(id, { status, doctorNotes, assignedDoctor, scheduledAt }) {
  if (!VALID_STATUSES.includes(status)) throw new Error('INVALID_STATUS');
  await dbRun(
    `UPDATE doctor_requests
     SET status = ?, doctor_notes = ?, assigned_doctor = ?, scheduled_at = ?,
         updated_at = NOW()
     WHERE id = ?`,
    [status, doctorNotes || null, assignedDoctor || null, scheduledAt || null, id]
  );
  return findById(id);
}

async function cancelRequest(id, userId) {
  const req = await findById(id);
  if (!req) throw new Error('NOT_FOUND');
  if (req.user_id !== userId) throw new Error('FORBIDDEN');
  if (['completed', 'cancelled'].includes(req.status)) throw new Error('NOT_CANCELLABLE');
  await dbRun(
    `UPDATE doctor_requests SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
    [id]
  );
  return findById(id);
}

module.exports = { createRequest, findById, findByUser, findAll, countByStatus, updateStatus, cancelRequest };
