// backend/routes/doctor.js
// User-facing doctor request routes + admin management routes

const express = require('express');
const rateLimit = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const {
  createRequest, findById, findByUser,
  findAll, countByStatus, updateStatus, cancelRequest
} = require('../models/doctorRequest');

const router = express.Router();

const requestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 10,
  message: { error: 'Too many requests submitted — please try again later' },
});

// ── Middleware: admin only ───────────────────────────────────
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ══════════════════════════════════════════════════════════════
//  USER ROUTES
// ══════════════════════════════════════════════════════════════

// POST /api/doctor/request  — submit a new doctor request
router.post('/request', requireAuth, requestLimiter, async (req, res) => {
  const {
    consultationId, fullName, email, phone, dateOfBirth,
    preferredDate, preferredTime, consultationType,
    chiefComplaint, triageLevel, severityScore, additionalNotes
  } = req.body;

  // Validate required fields
  if (!fullName?.trim())      return res.status(400).json({ error: 'Full name is required' });
  if (!email?.trim())         return res.status(400).json({ error: 'Email is required' });
  if (!preferredDate)         return res.status(400).json({ error: 'Preferred date is required' });
  if (!preferredTime)         return res.status(400).json({ error: 'Preferred time is required' });
  if (!chiefComplaint?.trim()) return res.status(400).json({ error: 'Chief complaint is required' });

  // Preferred date must be today or future
  const today = new Date(); today.setHours(0,0,0,0);
  if (new Date(preferredDate) < today) {
    return res.status(400).json({ error: 'Preferred date must be today or in the future' });
  }

  try {
    const request = await createRequest({
      userId: req.user.id, consultationId, fullName: fullName.trim(),
      email: email.trim(), phone, dateOfBirth, preferredDate, preferredTime,
      consultationType, chiefComplaint: chiefComplaint.trim(),
      triageLevel, severityScore, additionalNotes
    });
    return res.status(201).json({ message: 'Doctor request submitted successfully', request });
  } catch (err) {
    console.error('Doctor request error:', err);
    return res.status(500).json({ error: 'Failed to submit request — please try again' });
  }
});

// GET /api/doctor/my-requests  — current user's requests
router.get('/my-requests', requireAuth, async (req, res) => {
  try {
    const requests = await findByUser(req.user.id);
    return res.json({ requests });
  } catch (err) {
    console.error('My requests error:', err);
    return res.status(500).json({ error: 'Failed to retrieve your requests' });
  }
});

// GET /api/doctor/my-requests/:id — single request detail (user owns it)
router.get('/my-requests/:id', requireAuth, async (req, res) => {
  try {
    const request = await findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.user_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    return res.json({ request });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve request' });
  }
});

// POST /api/doctor/my-requests/:id/cancel — user cancels own request
router.post('/my-requests/:id/cancel', requireAuth, async (req, res) => {
  try {
    const request = await cancelRequest(req.params.id, req.user.id);
    return res.json({ message: 'Request cancelled', request });
  } catch (err) {
    if (err.message === 'NOT_FOUND')      return res.status(404).json({ error: 'Request not found' });
    if (err.message === 'FORBIDDEN')      return res.status(403).json({ error: 'Access denied' });
    if (err.message === 'NOT_CANCELLABLE') return res.status(400).json({ error: 'This request cannot be cancelled' });
    return res.status(500).json({ error: 'Failed to cancel request' });
  }
});

// ══════════════════════════════════════════════════════════════
//  ADMIN ROUTES  (role = admin)
// ══════════════════════════════════════════════════════════════

// GET /api/doctor/admin/requests
router.get('/admin/requests', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const requests = await findAll({ status, limit: parseInt(limit), offset: parseInt(offset) });
    const counts   = await countByStatus();
    return res.json({ requests, counts });
  } catch (err) {
    console.error('Admin requests error:', err);
    return res.status(500).json({ error: 'Failed to retrieve requests' });
  }
});

// GET /api/doctor/admin/requests/:id
router.get('/admin/requests/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const request = await findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    return res.json({ request });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve request' });
  }
});

// PATCH /api/doctor/admin/requests/:id — update status, assign doctor, add notes
router.patch('/admin/requests/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status, doctorNotes, assignedDoctor, scheduledAt } = req.body;
  if (!status) return res.status(400).json({ error: 'Status is required' });

  try {
    const request = await updateStatus(req.params.id, { status, doctorNotes, assignedDoctor, scheduledAt });
    return res.json({ message: 'Request updated', request });
  } catch (err) {
    if (err.message === 'INVALID_STATUS') return res.status(400).json({ error: 'Invalid status value' });
    console.error('Admin update error:', err);
    return res.status(500).json({ error: 'Failed to update request' });
  }
});

// POST /api/doctor/admin/seed — create first admin account (one-time use)
router.post('/admin/seed', async (req, res) => {
  const { secret, name, email, password } = req.body;
  if (secret !== process.env.ADMIN_SEED_SECRET) {
    return res.status(403).json({ error: 'Invalid seed secret' });
  }
  try {
    const { createUser } = require('../models/user');
    const { dbRun } = require('../config/database');
    const user = await createUser({ name, email, password });
    await dbRun(`UPDATE users SET role = 'admin' WHERE id = ?`, [user.id]);
    return res.status(201).json({ message: 'Admin account created', userId: user.id });
  } catch (err) {
    if (err.message === 'EMAIL_EXISTS') return res.status(409).json({ error: 'Email already exists' });
    return res.status(500).json({ error: 'Failed to create admin' });
  }
});

module.exports = router;
