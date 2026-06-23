/**
 * SnipFlow - 数据库连接模块 (sql.js / WASM SQLite)
 */
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dbPath = path.resolve(__dirname, '..', process.env.DB_PATH || './data/snipflow.db');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let SQL = null;
let db = null;
let writePending = false;

/**
 * 获取或初始化数据库
 */
async function getDb() {
  if (db) return db;

  SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
    // 运行初始化建表
    initSchema();
  }

  return db;
}

/**
 * 建表 (首次使用)
 */
function initSchema() {
  const run = (sql, params) => {
    try { db.run(sql, params); } catch (e) { if (!e.message?.includes('already exists')) throw e; }
  };

  run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, display_name TEXT, avatar_url TEXT, bio TEXT DEFAULT \'\', plan TEXT DEFAULT \'free\' CHECK(plan IN (\'free\', \'pro\')), stripe_customer_id TEXT, stripe_subscription_id TEXT, subscription_ends_at TEXT, created_at TEXT DEFAULT (datetime(\'now\')), updated_at TEXT DEFAULT (datetime(\'now\')))');
  run('CREATE TABLE IF NOT EXISTS snippets (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT UNIQUE NOT NULL, user_id INTEGER NOT NULL, title TEXT NOT NULL DEFAULT \'Untitled Snippet\', description TEXT DEFAULT \'\', code TEXT NOT NULL, language TEXT DEFAULT \'plaintext\', visibility TEXT DEFAULT \'private\' CHECK(visibility IN (\'private\', \'public\', \'unlisted\')), is_favorite INTEGER DEFAULT 0, views INTEGER DEFAULT 0, forked_from INTEGER, created_at TEXT DEFAULT (datetime(\'now\')), updated_at TEXT DEFAULT (datetime(\'now\')))');
  run('CREATE TABLE IF NOT EXISTS tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, color TEXT DEFAULT \'#6366f1\')');
  run('CREATE TABLE IF NOT EXISTS snippet_tags (snippet_id INTEGER NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (snippet_id, tag_id))');
  run('CREATE TABLE IF NOT EXISTS snippet_likes (user_id INTEGER NOT NULL, snippet_id INTEGER NOT NULL, created_at TEXT DEFAULT (datetime(\'now\')), PRIMARY KEY (user_id, snippet_id))');
  run('CREATE TABLE IF NOT EXISTS share_links (id INTEGER PRIMARY KEY AUTOINCREMENT, snippet_id INTEGER NOT NULL, share_code TEXT UNIQUE NOT NULL, expires_at TEXT, created_at TEXT DEFAULT (datetime(\'now\')))');
  run('CREATE TABLE IF NOT EXISTS usage_stats (user_id INTEGER PRIMARY KEY, snippet_count INTEGER DEFAULT 0, total_views INTEGER DEFAULT 0, storage_bytes INTEGER DEFAULT 0, api_calls_today INTEGER DEFAULT 0, last_api_call TEXT)');

  run('CREATE INDEX IF NOT EXISTS idx_snippets_user_id ON snippets(user_id)');
  run('CREATE INDEX IF NOT EXISTS idx_snippets_language ON snippets(language)');
  run('CREATE INDEX IF NOT EXISTS idx_snippets_visibility ON snippets(visibility)');
  run('CREATE INDEX IF NOT EXISTS idx_snippets_created_at ON snippets(created_at)');
  run('CREATE INDEX IF NOT EXISTS idx_share_links_code ON share_links(share_code)');
  run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');

  saveDb();
}

/**
 * 保存数据库到文件
 */
function saveDb() {
  if (!db) return;
  try {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    writePending = false;
  } catch (err) {
    console.error('[DB] 保存失败:', err.message);
  }
}

/**
 * 自动保存 (可延迟批量保存)
 */
function autoSave() {
  if (!writePending) {
    writePending = true;
    setImmediate(saveDb);
  }
}

/**
 * 便捷查询: 获取单行 (返回对象)
 */
function get(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    return result;
  }
  stmt.free();
  return undefined;
}

/**
 * 便捷查询: 获取多行 (返回对象数组)
 */
function all(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

/**
 * 便捷执行: 插入/更新/删除
 */
function run(sql, params = []) {
  if (!db) throw new Error('数据库未初始化');
  try {
    db.run(sql, params);
    autoSave();
    return {
      lastInsertRowid: db.exec("SELECT last_insert_rowid() as id")[0]?.values[0][0],
      changes: db.getRowsModified(),
    };
  } catch (err) {
    throw err;
  }
}

/**
 * 关闭数据库
 */
function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
  }
}

module.exports = { getDb, get, all, run, closeDb, saveDb };