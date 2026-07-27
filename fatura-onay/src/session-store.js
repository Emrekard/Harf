// Oturumları SQLite'ta saklayan basit session store.
// Sunucu yeniden başlatıldığında kullanıcılar oturumda kalır.
// Mevcut better-sqlite3 bağlantısını kullanır; ek bir sürücü gerektirmez.
const session = require('express-session');
const { db } = require('./db');

db.exec(`
CREATE TABLE IF NOT EXISTS sessions (
  sid        TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
`);

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000;

class SqliteStore extends session.Store {
  constructor() {
    super();
    this.stmts = {
      get: db.prepare('SELECT data, expires_at FROM sessions WHERE sid = ?'),
      set: db.prepare(`
        INSERT INTO sessions (sid, data, expires_at) VALUES (@sid, @data, @expires_at)
        ON CONFLICT(sid) DO UPDATE SET data = @data, expires_at = @expires_at
      `),
      destroy: db.prepare('DELETE FROM sessions WHERE sid = ?'),
      touch: db.prepare('UPDATE sessions SET expires_at = ? WHERE sid = ?'),
      clear: db.prepare('DELETE FROM sessions'),
      count: db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?'),
      prune: db.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
    };

    // Süresi dolan oturumları saatte bir temizle.
    this.timer = setInterval(() => this.prune(), 60 * 60 * 1000);
    this.timer.unref();
    this.prune();
  }

  expiryOf(sess) {
    const ms = sess && sess.cookie && sess.cookie.maxAge ? sess.cookie.maxAge : DEFAULT_TTL_MS;
    return Date.now() + ms;
  }

  prune() {
    try {
      this.stmts.prune.run(Date.now());
    } catch (err) {
      console.error('Oturum temizleme hatası:', err.message);
    }
  }

  get(sid, cb) {
    try {
      const row = this.stmts.get.get(sid);
      if (!row) return cb(null, null);
      if (row.expires_at <= Date.now()) {
        this.stmts.destroy.run(sid);
        return cb(null, null);
      }
      cb(null, JSON.parse(row.data));
    } catch (err) {
      cb(err);
    }
  }

  set(sid, sess, cb = () => {}) {
    try {
      this.stmts.set.run({ sid, data: JSON.stringify(sess), expires_at: this.expiryOf(sess) });
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  destroy(sid, cb = () => {}) {
    try {
      this.stmts.destroy.run(sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  touch(sid, sess, cb = () => {}) {
    try {
      this.stmts.touch.run(this.expiryOf(sess), sid);
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  clear(cb = () => {}) {
    try {
      this.stmts.clear.run();
      cb(null);
    } catch (err) {
      cb(err);
    }
  }

  length(cb = () => {}) {
    try {
      cb(null, this.stmts.count.get(Date.now()).n);
    } catch (err) {
      cb(err);
    }
  }
}

module.exports = SqliteStore;
