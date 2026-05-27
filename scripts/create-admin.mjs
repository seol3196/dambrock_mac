import bcrypt from 'bcryptjs';
import { db, id, initDb, now } from '../server/db.js';

initDb();

const loginId = process.argv[2] || process.env.ADMIN_ID || 'admin';
const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'admin123';
const displayName = process.argv[4] || process.env.ADMIN_NAME || '관리자';

if (password.length < 6) {
  console.error('Password must be at least 6 characters.');
  process.exit(1);
}

const existing = db.prepare('SELECT uid FROM users WHERE login_id = ?').get(loginId);

if (existing) {
  db.prepare(
    `UPDATE users
     SET password_hash = ?, role = 'admin', display_name = ?, updated_at = ?
     WHERE login_id = ?`
  ).run(bcrypt.hashSync(password, 12), displayName, now(), loginId);
  console.log(`Updated admin account: ${loginId}`);
} else {
  db.prepare(
    `INSERT INTO users
     (uid, login_id, password_hash, role, display_name, created_at)
     VALUES (?, ?, ?, 'admin', ?, ?)`
  ).run(id('usr_'), loginId, bcrypt.hashSync(password, 12), displayName, now());
  console.log(`Created admin account: ${loginId}`);
}
