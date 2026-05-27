import bcrypt from 'bcryptjs';
import express from 'express';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DB_PATH,
  db,
  id,
  initDb,
  now,
  toComment,
  toPost,
  toPublicUser,
  toWall
} from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const DEFAULT_PORT = Number(process.env.PORT || 47831);
const HOST = process.env.HOST || '0.0.0.0';
const CLIENT_DIR = fs.existsSync(DIST) ? DIST : ROOT;

initDb();

const app = express();
app.use(express.json({ limit: '1mb' }));

function tokenFrom(req) {
  const header = req.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return '';
}

function userFrom(req) {
  const token = tokenFrom(req);
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT users.*
       FROM sessions
       JOIN users ON users.uid = sessions.uid
       WHERE sessions.token = ?`
    )
    .get(token);
  return row || null;
}

function requireUser(req, res, next) {
  const user = userFrom(req);
  if (!user) return res.status(401).json({ error: 'unauthenticated' });
  req.user = user;
  return next();
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) return res.status(403).json({ error: 'forbidden' });
    return next();
  };
}

function requireTeacherOrAdmin(req, res, next) {
  if (!req.user || !['teacher', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  return next();
}

function assertPassword(password) {
  if (String(password || '').length < 6) {
    const error = new Error('Password must be at least 6 characters.');
    error.status = 400;
    throw error;
  }
}

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, dbPath: DB_PATH });
});

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const loginId = String(req.body.id || '').trim();
  const password = String(req.body.password || '');
  const row = db.prepare('SELECT * FROM users WHERE login_id = ?').get(loginId);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: 'invalid-credentials' });
  }
  const token = id('tok_');
  db.prepare('INSERT INTO sessions (token, uid, created_at) VALUES (?, ?, ?)').run(
    token,
    row.uid,
    now()
  );
  return res.json({ token, user: toPublicUser(row) });
}));

app.post('/api/auth/logout', requireUser, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(tokenFrom(req));
  res.json({ ok: true });
});

app.get('/api/auth/me', requireUser, (req, res) => {
  res.json({ user: toPublicUser(req.user) });
});

app.get('/api/users', requireUser, (req, res) => {
  const { role, teacherId } = req.query;
  const clauses = [];
  const params = [];
  if (role) {
    clauses.push('role = ?');
    params.push(role);
  }
  if (teacherId) {
    clauses.push('teacher_id = ?');
    params.push(teacherId);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = db.prepare(`SELECT * FROM users ${where} ORDER BY created_at DESC`).all(...params);
  res.json({ items: rows.map(toPublicUser) });
});

app.post('/api/users', requireUser, requireTeacherOrAdmin, (req, res) => {
  const loginId = String(req.body.id || '').trim();
  const password = String(req.body.password || '');
  const role = String(req.body.role || '').trim();
  if (!loginId || !['teacher', 'student'].includes(role)) {
    return res.status(400).json({ error: 'invalid-user' });
  }
  if (req.user.role === 'teacher' && role !== 'student') {
    return res.status(403).json({ error: 'forbidden' });
  }
  assertPassword(password);

  const uid = id('usr_');
  const displayName = String(req.body.displayName || loginId).trim();
  const teacherId = role === 'student' ? req.body.teacherId || req.user.uid : null;
  const passwordHint = req.body.passwordHint || null;
  try {
    db.prepare(
      `INSERT INTO users
       (uid, login_id, password_hash, role, display_name, teacher_id, password_hint, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(uid, loginId, bcrypt.hashSync(password, 12), role, displayName, teacherId, passwordHint, now());
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'id-already-exists' });
    }
    throw error;
  }
  res.status(201).json({ user: toPublicUser(db.prepare('SELECT * FROM users WHERE uid = ?').get(uid)) });
});

app.patch('/api/users/:uid', requireUser, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE uid = ?').get(req.params.uid);
  if (!target) return res.status(404).json({ error: 'not-found' });
  const canEdit =
    req.user.role === 'admin' ||
    req.user.uid === target.uid ||
    (req.user.role === 'teacher' && target.teacher_id === req.user.uid);
  if (!canEdit) return res.status(403).json({ error: 'forbidden' });

  const displayName = String(req.body.displayName || target.display_name).trim();
  db.prepare('UPDATE users SET display_name = ?, updated_at = ? WHERE uid = ?').run(
    displayName,
    now(),
    target.uid
  );
  res.json({ user: toPublicUser(db.prepare('SELECT * FROM users WHERE uid = ?').get(target.uid)) });
});

app.delete('/api/users/:uid', requireUser, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE uid = ?').get(req.params.uid);
  if (!target) return res.status(404).json({ error: 'not-found' });
  const canDelete =
    req.user.role === 'admin' ||
    (req.user.role === 'teacher' && target.role === 'student' && target.teacher_id === req.user.uid);
  if (!canDelete) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM users WHERE uid = ?').run(target.uid);
  res.json({ count: 1, deleted: [{ uid: target.uid }] });
});

app.post('/api/users/passwords', requireUser, requireTeacherOrAdmin, (req, res) => {
  const uids = Array.isArray(req.body.uids) ? req.body.uids : [];
  const password = String(req.body.password || '');
  assertPassword(password);
  const hash = bcrypt.hashSync(password, 12);
  const update = db.prepare(
    'UPDATE users SET password_hash = ?, password_hint = ?, updated_at = ? WHERE uid = ?'
  );
  const change = db.transaction(() => {
    for (const uid of uids) {
      const target = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
      if (!target) continue;
      if (req.user.role === 'teacher' && target.teacher_id !== req.user.uid) continue;
      update.run(hash, password, now(), uid);
    }
  });
  change();
  res.json({ count: uids.length });
});

app.get('/api/walls', requireUser, (req, res) => {
  const { ownerId } = req.query;
  const rows = ownerId
    ? db.prepare('SELECT * FROM walls WHERE owner_id = ? ORDER BY created_at DESC').all(ownerId)
    : db.prepare('SELECT * FROM walls ORDER BY created_at DESC').all();
  res.json({ items: rows.map(toWall) });
});

app.post('/api/walls', requireUser, requireRole('teacher'), (req, res) => {
  const wallId = id('wall_');
  db.prepare(
    `INSERT INTO walls
     (id, title, description, access_mode, comments_enabled, likes_enabled, owner_id, owner_name,
      background_tone, column_count, column_names, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    wallId,
    String(req.body.title || '').trim(),
    String(req.body.description || ''),
    req.body.accessMode === 'public' ? 'public' : 'login',
    req.body.commentsEnabled === false ? 0 : 1,
    req.body.likesEnabled === false ? 0 : 1,
    req.user.uid,
    String(req.body.ownerName || req.user.display_name || req.user.login_id),
    req.body.backgroundTone || 'bg-[#fff8e8]',
    Number(req.body.columnCount || 4),
    JSON.stringify(req.body.columnNames || {}),
    now()
  );
  res.status(201).json({ wall: toWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(wallId)) });
});

app.get('/api/walls/:id', (req, res) => {
  const wall = toWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(req.params.id));
  if (!wall) return res.status(404).json({ error: 'not-found' });
  if (wall.accessMode === 'login' && !userFrom(req)) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  res.json({ wall });
});

app.patch('/api/walls/:id', requireUser, requireRole('teacher'), (req, res) => {
  const wall = db.prepare('SELECT * FROM walls WHERE id = ?').get(req.params.id);
  if (!wall) return res.status(404).json({ error: 'not-found' });
  if (wall.owner_id !== req.user.uid) return res.status(403).json({ error: 'forbidden' });
  db.prepare(
    `UPDATE walls SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      access_mode = COALESCE(?, access_mode),
      comments_enabled = COALESCE(?, comments_enabled),
      likes_enabled = COALESCE(?, likes_enabled),
      background_tone = COALESCE(?, background_tone),
      column_count = COALESCE(?, column_count),
      column_names = COALESCE(?, column_names),
      updated_at = ?
     WHERE id = ?`
  ).run(
    req.body.title == null ? null : String(req.body.title),
    req.body.description == null ? null : String(req.body.description),
    req.body.accessMode == null ? null : req.body.accessMode === 'public' ? 'public' : 'login',
    req.body.commentsEnabled == null ? null : req.body.commentsEnabled ? 1 : 0,
    req.body.likesEnabled == null ? null : req.body.likesEnabled ? 1 : 0,
    req.body.backgroundTone == null ? null : req.body.backgroundTone,
    req.body.columnCount == null ? null : Number(req.body.columnCount),
    req.body.columnNames == null ? null : JSON.stringify(req.body.columnNames),
    now(),
    wall.id
  );
  res.json({ wall: toWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(wall.id)) });
});

app.delete('/api/walls/:id', requireUser, requireRole('teacher'), (req, res) => {
  const wall = db.prepare('SELECT * FROM walls WHERE id = ?').get(req.params.id);
  if (!wall) return res.status(404).json({ error: 'not-found' });
  if (wall.owner_id !== req.user.uid) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM walls WHERE id = ?').run(wall.id);
  res.json({ ok: true });
});

app.get('/api/posts', (req, res) => {
  const { wallId } = req.query;
  if (!wallId) return res.status(400).json({ error: 'wallId-required' });
  const wall = toWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(wallId));
  if (!wall) return res.status(404).json({ error: 'not-found' });
  if (wall.accessMode === 'login' && !userFrom(req)) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  const rows = db.prepare('SELECT * FROM posts WHERE wall_id = ? ORDER BY order_no ASC').all(wallId);
  res.json({ items: rows.map(toPost) });
});

app.post('/api/posts', (req, res) => {
  const wall = toWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(req.body.wallId));
  if (!wall) return res.status(404).json({ error: 'not-found' });
  const user = userFrom(req);
  if (wall.accessMode === 'login' && !user) return res.status(401).json({ error: 'unauthenticated' });
  const postId = id('post_');
  db.prepare(
    `INSERT INTO posts
     (id, wall_id, author_id, author_name, content, color, column_no, order_no, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    postId,
    wall.id,
    user?.uid || 'anonymous',
    String(req.body.authorName || user?.display_name || '익명'),
    String(req.body.content || '').trim(),
    req.body.color || 'bg-yellow-100',
    Number(req.body.column || 1),
    Number(req.body.order ?? Date.now()),
    now()
  );
  res.status(201).json({ post: toPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(postId)) });
});

app.patch('/api/posts/:id', requireUser, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'not-found' });
  const wall = db.prepare('SELECT * FROM walls WHERE id = ?').get(post.wall_id);
  const canEdit = post.author_id === req.user.uid || wall?.owner_id === req.user.uid;
  if (!canEdit) return res.status(403).json({ error: 'forbidden' });
  db.prepare(
    `UPDATE posts SET
      content = COALESCE(?, content),
      color = COALESCE(?, color),
      column_no = COALESCE(?, column_no),
      order_no = COALESCE(?, order_no),
      updated_at = ?
     WHERE id = ?`
  ).run(
    req.body.content == null ? null : String(req.body.content),
    req.body.color == null ? null : req.body.color,
    req.body.column == null ? null : Number(req.body.column),
    req.body.order == null ? null : Number(req.body.order),
    now(),
    post.id
  );
  res.json({ post: toPost(db.prepare('SELECT * FROM posts WHERE id = ?').get(post.id)) });
});

app.delete('/api/posts/:id', requireUser, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'not-found' });
  const wall = db.prepare('SELECT * FROM walls WHERE id = ?').get(post.wall_id);
  const canDelete = post.author_id === req.user.uid || wall?.owner_id === req.user.uid;
  if (!canDelete) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM posts WHERE id = ?').run(post.id);
  res.json({ ok: true });
});

app.post('/api/posts/:id/toggle-like', requireUser, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) return res.status(404).json({ error: 'not-found' });
  const wall = toWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(post.wall_id));
  if (!wall?.likesEnabled) return res.status(403).json({ error: 'likes-disabled' });
  const likedBy = post.liked_by ? JSON.parse(post.liked_by) : {};
  const liked = Boolean(likedBy[req.user.uid]);
  if (liked) delete likedBy[req.user.uid];
  else likedBy[req.user.uid] = true;
  db.prepare('UPDATE posts SET liked_by = ?, like_count = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(likedBy),
    Object.keys(likedBy).length,
    now(),
    post.id
  );
  res.json({ liked: !liked });
});

app.post('/api/posts/layouts', requireUser, requireRole('teacher'), (req, res) => {
  const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
  const update = db.prepare('UPDATE posts SET column_no = ?, order_no = ?, updated_at = ? WHERE id = ?');
  db.transaction(() => {
    for (const item of updates) update.run(Number(item.column), Number(item.order), now(), item.id);
  })();
  res.json({ count: updates.length });
});

app.post('/api/walls/:id/delete-column', requireUser, requireRole('teacher'), (req, res) => {
  const wall = db.prepare('SELECT * FROM walls WHERE id = ?').get(req.params.id);
  if (!wall) return res.status(404).json({ error: 'not-found' });
  if (wall.owner_id !== req.user.uid) return res.status(403).json({ error: 'forbidden' });

  const column = Number(req.body.column);
  const columnCount = Number(req.body.columnCount);
  const columnNames = req.body.columnNames || {};
  const nextColumnNames = {};
  for (let nextColumn = 1; nextColumn < columnCount; nextColumn += 1) {
    const name = nextColumn < column ? columnNames[nextColumn] : columnNames[nextColumn + 1];
    if (typeof name === 'string' && name.trim()) nextColumnNames[nextColumn] = name.trim();
  }

  db.transaction(() => {
    const deletedPosts = db
      .prepare('SELECT id FROM posts WHERE wall_id = ? AND column_no = ?')
      .all(wall.id, column);
    for (const post of deletedPosts) {
      db.prepare('DELETE FROM comments WHERE post_id = ?').run(post.id);
    }
    db.prepare('DELETE FROM posts WHERE wall_id = ? AND column_no = ?').run(wall.id, column);
    db.prepare(
      'UPDATE posts SET column_no = column_no - 1, updated_at = ? WHERE wall_id = ? AND column_no > ?'
    ).run(now(), wall.id, column);
    db.prepare('UPDATE walls SET column_count = ?, column_names = ?, updated_at = ? WHERE id = ?').run(
      columnCount - 1,
      JSON.stringify(nextColumnNames),
      now(),
      wall.id
    );
  })();
  res.json({ ok: true });
});

app.get('/api/comments', (req, res) => {
  const { postId } = req.query;
  if (!postId) return res.status(400).json({ error: 'postId-required' });
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'not-found' });
  const wall = toWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(post.wall_id));
  if (wall?.accessMode === 'login' && !userFrom(req)) {
    return res.status(401).json({ error: 'unauthenticated' });
  }
  const rows = db.prepare('SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC').all(postId);
  res.json({ items: rows.map(toComment) });
});

app.post('/api/comments', (req, res) => {
  const user = userFrom(req);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.body.postId);
  if (!post) return res.status(404).json({ error: 'not-found' });
  const wall = toWall(db.prepare('SELECT * FROM walls WHERE id = ?').get(post.wall_id));
  if (wall?.accessMode === 'login' && !user) return res.status(401).json({ error: 'unauthenticated' });
  if (!wall?.commentsEnabled) return res.status(403).json({ error: 'comments-disabled' });
  const commentId = id('comment_');
  db.prepare(
    'INSERT INTO comments (id, post_id, author_id, author_name, text, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    commentId,
    req.body.postId,
    user?.uid || 'anonymous',
    String(req.body.authorName || user?.login_id || '익명'),
    String(req.body.text || '').trim(),
    now()
  );
  res.status(201).json({ comment: toComment(db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId)) });
});

app.delete('/api/comments/:id', requireUser, (req, res) => {
  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) return res.status(404).json({ error: 'not-found' });
  if (comment.author_id !== req.user.uid) return res.status(403).json({ error: 'forbidden' });
  db.prepare('DELETE FROM comments WHERE id = ?').run(comment.id);
  res.json({ ok: true });
});

app.use(express.static(CLIENT_DIR));
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  const indexPath = path.join(CLIENT_DIR, 'index.html');
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send('Run npm run build before production start.');
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({ error: error.message || 'server-error' });
});

function listen(port) {
  const server = http.createServer(app);
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && port < DEFAULT_PORT + 50) {
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, HOST, () => {
    console.log(`Dambrock running at http://localhost:${port}`);
    console.log(`SQLite database: ${DB_PATH}`);
  });
}

listen(DEFAULT_PORT);
