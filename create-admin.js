// create-admin.js
require('dotenv').config();
const { createUser } = require('./backend/models/user');
const { dbRun }      = require('./backend/config/database');

const ADMIN = {
  name:     'Dr lulu',           // change this
  email:    'admin@clinic.com',   // change this
  password: 'StrongPassword123!', // change this
};

(async () => {
  try {
    const user = await createUser(ADMIN);
    await dbRun("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
    console.log('\n  Admin account created successfully');
    console.log(`  Email:    ${user.email}`);
    console.log(`  Role:     admin`);
    console.log(`  Login at: http://localhost:3000/login\n`);
  } catch (err) {
    if (err.message === 'EMAIL_EXISTS') {
      console.error('\n  That email already exists. Try a different one.\n');
    } else {
      console.error('\n  Error:', err.message, '\n');
    }
  }
  process.exit(0);
})();