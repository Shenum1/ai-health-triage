// backend/models/user.js
const { supabaseAdmin } = require('../config/supabase');
const { dbGet, dbRun } = require('../config/database');

async function createUser({ name, email, password }) {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
  });

  if (error) {
    if (error.message?.toLowerCase().includes('already registered') ||
        error.message?.toLowerCase().includes('already been registered') ||
        error.code === 'email_exists') {
      throw new Error('EMAIL_EXISTS');
    }
    throw error;
  }

  await dbRun(
    'INSERT INTO users (id, name, email, role) VALUES (?, ?, ?, ?)',
    [data.user.id, name.trim(), email.toLowerCase(), 'user']
  );

  return findById(data.user.id);
}

async function findByEmail(email) {
  return dbGet('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
}

async function findById(id) {
  return dbGet('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [id]);
}

module.exports = { createUser, findByEmail, findById };
