// backend/models/user.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { dbGet, dbRun } = require('../config/database');

const SALT_ROUNDS = 12;

async function createUser({ name, email, password }) {
  const existing = await dbGet('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]);
  if (existing) throw new Error('EMAIL_EXISTS');

  const hashed = bcrypt.hashSync(password, SALT_ROUNDS);
  const id = uuidv4();
  await dbRun(
    'INSERT INTO users (id, name, email, password) VALUES (?, ?, ?, ?)',
    [id, name.trim(), email.toLowerCase(), hashed]
  );
  return findById(id);
}

async function findByEmail(email) {
  return dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
}

async function findById(id) {
  return dbGet('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [id]);
}

function verifyPassword(plaintext, hashed) {
  return bcrypt.compareSync(plaintext, hashed);
}

module.exports = { createUser, findByEmail, findById, verifyPassword };
