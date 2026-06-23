/**
 * SnipFlow - 数据库初始化
 */
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/snipflow.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

async function initDb() {
  const SQL = await initSqlJs();
  let db;

  // 尝试从文件加载已有数据库
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  const run = (sql, params = []) => {
    try {
      return db.run(sql, params);
    } catch (e) {
      // 有些表可能已存在，ignore
      if (!e.message.includes('already exists')) throw e;
    }
  };

  run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      avatar_url TEXT,
      bio TEXT DEFAULT '',
      plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'pro')),
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_ends_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL DEFAULT 'Untitled Snippet',
      description TEXT DEFAULT '',
      code TEXT NOT NULL,
      language TEXT DEFAULT 'plaintext',
      visibility TEXT DEFAULT 'private' CHECK(visibility IN ('private', 'public', 'unlisted')),
      is_favorite INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      forked_from INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#6366f1'
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS snippet_tags (
      snippet_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (snippet_id, tag_id),
      FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS snippet_likes (
      user_id INTEGER NOT NULL,
      snippet_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, snippet_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS share_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snippet_id INTEGER NOT NULL,
      share_code TEXT UNIQUE NOT NULL,
      expires_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (snippet_id) REFERENCES snippets(id) ON DELETE CASCADE
    )
  `);

  run(`
    CREATE TABLE IF NOT EXISTS usage_stats (
      user_id INTEGER PRIMARY KEY,
      snippet_count INTEGER DEFAULT 0,
      total_views INTEGER DEFAULT 0,
      storage_bytes INTEGER DEFAULT 0,
      api_calls_today INTEGER DEFAULT 0,
      last_api_call TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 索引
  run('CREATE INDEX IF NOT EXISTS idx_snippets_user_id ON snippets(user_id)');
  run('CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language)');
  run('CREATE INDEX IF NOT EXISTS idx_snippets_visibility ON snippets(visibility)');
  run('CREATE INDEX IF NOT EXISTS idx_snippets_created_at ON snippets(created_at)');
  run('CREATE INDEX IF NOT EXISTS idx_share_links_code ON share_links(share_code)');
  run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

  // 保存到文件
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);

  db.close();

  console.log('[DB] 数据库初始化完成:', dbPath);
}

// 运行初始化
initDb().catch(err => {
  console.error('[DB] 初始化失败:', err);
  process.exit(1);
});