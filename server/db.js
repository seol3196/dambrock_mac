import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.SQLITE_PATH || path.join(DATA_DIR, 'dambrock.sqlite');

fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function now() {
  return new Date().toISOString();
}

export function id(prefix = '') {
  return `${prefix}${crypto.randomUUID()}`;
}

function json(value, fallback) {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function toPublicUser(row) {
  if (!row) return null;
  return {
    uid: row.uid,
    id: row.login_id,
    role: row.role,
    displayName: row.display_name,
    teacherId: row.teacher_id,
    passwordHint: row.password_hint,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toWall(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    accessMode: row.access_mode,
    commentsEnabled: Boolean(row.comments_enabled),
    likesEnabled: Boolean(row.likes_enabled),
    ownerId: row.owner_id,
    ownerName: row.owner_name,
    backgroundTone: row.background_tone,
    columnCount: row.column_count,
    columnNames: json(row.column_names, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toPost(row) {
  if (!row) return null;
  const likedBy = json(row.liked_by, {});
  return {
    id: row.id,
    wallId: row.wall_id,
    authorId: row.author_id,
    authorName: row.author_name,
    content: row.content,
    color: row.color,
    column: row.column_no,
    order: row.order_no,
    likedBy,
    likeCount: row.like_count ?? Object.keys(likedBy).length,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function toComment(row) {
  if (!row) return null;
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.author_id,
    authorName: row.author_name,
    text: row.text,
    createdAt: row.created_at
  };
}

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      login_id TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
      display_name TEXT NOT NULL,
      teacher_id TEXT,
      password_hint TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      uid TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS walls (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      access_mode TEXT NOT NULL DEFAULT 'login',
      comments_enabled INTEGER NOT NULL DEFAULT 1,
      likes_enabled INTEGER NOT NULL DEFAULT 1,
      owner_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
      owner_name TEXT NOT NULL,
      background_tone TEXT NOT NULL,
      column_count INTEGER NOT NULL DEFAULT 4,
      column_names TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      wall_id TEXT NOT NULL REFERENCES walls(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      content TEXT NOT NULL,
      color TEXT NOT NULL,
      column_no INTEGER NOT NULL DEFAULT 1,
      order_no REAL NOT NULL,
      liked_by TEXT NOT NULL DEFAULT '{}',
      like_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    CREATE INDEX IF NOT EXISTS idx_users_teacher ON users(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_walls_owner ON walls(owner_id);
    CREATE INDEX IF NOT EXISTS idx_posts_wall ON posts(wall_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
  `);

  const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
  if (userCount === 0) {
    const loginId = process.env.ADMIN_ID || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    db.prepare(
      `INSERT INTO users
       (uid, login_id, password_hash, role, display_name, created_at)
       VALUES (?, ?, ?, 'admin', '관리자', ?)`
    ).run(id('usr_'), loginId, bcrypt.hashSync(password, 12), now());
    console.log(`Created initial admin account: ${loginId} / ${password}`);
  }
}

export { DB_PATH };
