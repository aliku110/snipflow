/**
 * SnipFlow - 代码片段 CRUD 路由
 */
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { get, all, run } = require('../db');
const { authenticateToken, optionalAuth, requirePro } = require('../middleware/auth');

const router = express.Router();

const LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'go', 'rust', 'cpp', 'c',
  'csharp', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'bash', 'sql',
  'html', 'css', 'scss', 'json', 'xml', 'yaml', 'markdown', 'dockerfile',
  'graphql', 'plaintext'
];

function getSnippetTags(snippetId) {
  return all(`
    SELECT t.id, t.name, t.color 
    FROM tags t 
    JOIN snippet_tags st ON t.id = st.tag_id 
    WHERE st.snippet_id = ?
  `, [snippetId]);
}

function formatSnippet(snippet) {
  if (!snippet) return null;
  const tags = getSnippetTags(snippet.id);
  const likeCount = get('SELECT COUNT(*) as count FROM snippet_likes WHERE snippet_id = ?', [snippet.id]);
  const shareLink = get('SELECT share_code FROM share_links WHERE snippet_id = ?', [snippet.id]);
  
  return {
    id: snippet.uuid,
    userId: snippet.user_id,
    title: snippet.title,
    description: snippet.description,
    code: snippet.code,
    language: snippet.language,
    visibility: snippet.visibility,
    isFavorite: !!snippet.is_favorite,
    views: snippet.views,
    tags,
    likeCount: likeCount ? likeCount.count : 0,
    shareCode: shareLink?.share_code || null,
    forkedFrom: snippet.forked_from,
    createdAt: snippet.created_at,
    updatedAt: snippet.updated_at,
  };
}

// ===== API Routes =====

// 获取语言列表
router.get('/languages', (req, res) => {
  res.json({ languages: LANGUAGES });
});

// 获取公开片段列表（探索）
router.get('/explore', (req, res) => {
  const { lang, search, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = "WHERE s.visibility = 'public'";
  const params = [];

  if (lang) { where += ' AND s.language = ?'; params.push(lang); }
  if (search) {
    where += ' AND (s.title LIKE ? OR s.description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }

  const total = get(`SELECT COUNT(*) as count FROM snippets s ${where.split('ORDER BY')[0]}`, params);
  const snippets = all(
    `SELECT s.*, u.username, u.display_name FROM snippets s JOIN users u ON s.user_id = u.id ${where} ORDER BY s.views DESC, s.created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    snippets: snippets.map(s => formatSnippet(s)),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: total ? total.count : 0,
      totalPages: Math.ceil((total ? total.count : 0) / parseInt(limit)),
    }
  });
});

// 获取热门标签
router.get('/tags/popular', (req, res) => {
  const tags = all(`
    SELECT t.id, t.name, t.color, COUNT(st.snippet_id) as count
    FROM tags t
    JOIN snippet_tags st ON t.id = st.tag_id
    JOIN snippets s ON st.snippet_id = s.id
    WHERE s.visibility = 'public'
    GROUP BY t.id
    ORDER BY count DESC
    LIMIT 30
  `);
  res.json({ tags });
});

// 获取当前用户的片段列表
router.get('/', authenticateToken, (req, res) => {
  const { lang, tag, search, visibility, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let where = 'WHERE user_id = ?';
  const params = [req.user.userId];

  if (lang) { where += ' AND language = ?'; params.push(lang); }
  if (visibility) { where += ' AND visibility = ?'; params.push(visibility); }
  if (search) {
    where += ' AND (title LIKE ? OR description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term);
  }

  const total = get(`SELECT COUNT(*) as count FROM snippets ${where}`, params);
  const snippets = all(
    `SELECT * FROM snippets ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  res.json({
    snippets: snippets.map(s => formatSnippet(s)),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: total ? total.count : 0,
      totalPages: Math.ceil((total ? total.count : 0) / parseInt(limit)),
    }
  });
});

// 通过 UUID 获取单个片段
router.get('/:uuid', optionalAuth, (req, res) => {
  const snippet = get('SELECT * FROM snippets WHERE uuid = ?', [req.params.uuid]);

  if (!snippet) {
    return res.status(404).json({ error: '片段不存在' });
  }

  if (snippet.visibility === 'private' && (!req.user || req.user.userId !== snippet.user_id)) {
    return res.status(403).json({ error: '无权访问该片段' });
  }

  if (!req.user || req.user.userId !== snippet.user_id) {
    run('UPDATE snippets SET views = views + 1 WHERE id = ?', [snippet.id]);
    snippet.views = (snippet.views || 0) + 1;
  }

  const user = get('SELECT id, username, display_name, avatar_url, bio FROM users WHERE id = ?', [snippet.user_id]);

  res.json({
    snippet: {
      ...formatSnippet(snippet),
      author: user ? {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      } : null,
    }
  });
});

// 创建片段
router.post('/', authenticateToken, (req, res) => {
  const { title, description, code, language, visibility, tags: tagNames, isFavorite } = req.body;

  if (!code) {
    return res.status(400).json({ error: '代码内容不能为空' });
  }

  const user = get('SELECT plan FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  if (user.plan === 'free') {
    const count = get('SELECT COUNT(*) as count FROM snippets WHERE user_id = ?', [req.user.userId]);
    if (count.count >= 50) {
      return res.status(403).json({
        error: '免费用户最多创建 50 个代码片段，升级 Pro 获取无限额度',
        code: 'LIMIT_REACHED',
        upgradeUrl: '/pricing'
      });
    }
  }

  const snippetUuid = uuidv4();

  const result = run(
    'INSERT INTO snippets (uuid, user_id, title, description, code, language, visibility, is_favorite) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [snippetUuid, req.user.userId, title || 'Untitled Snippet', description || '', code, language || 'plaintext', visibility || 'private', isFavorite ? 1 : 0]
  );

  if (tagNames && Array.isArray(tagNames) && tagNames.length > 0) {
    for (const tagName of tagNames) {
      let tag = get('SELECT id FROM tags WHERE name = ?', [tagName]);
      if (!tag) {
        const tagResult = run('INSERT INTO tags (name) VALUES (?)', [tagName]);
        tag = { id: tagResult.lastInsertRowid };
      }
      try { run('INSERT INTO snippet_tags (snippet_id, tag_id) VALUES (?, ?)', [result.lastInsertRowid, tag.id]); } catch(e) {}
    }
  }

  run(`
    INSERT INTO usage_stats (user_id, snippet_count, storage_bytes) 
    VALUES (?, 1, ?)
    ON CONFLICT(user_id) DO UPDATE SET 
      snippet_count = snippet_count + 1,
      storage_bytes = storage_bytes + ?
  `, [req.user.userId, code.length, code.length]);

  const snippet = get('SELECT * FROM snippets WHERE id = ?', [result.lastInsertRowid]);

  res.status(201).json({
    message: '片段创建成功',
    snippet: formatSnippet(snippet),
  });
});

// 更新片段
router.put('/:uuid', authenticateToken, (req, res) => {
  const snippet = get('SELECT * FROM snippets WHERE uuid = ?', [req.params.uuid]);

  if (!snippet) return res.status(404).json({ error: '片段不存在' });
  if (snippet.user_id !== req.user.userId) return res.status(403).json({ error: '无权修改该片段' });

  const { title, description, code, language, visibility, tags: tagNames, isFavorite } = req.body;
  const updates = [];
  const params = [];

  if (title !== undefined) { updates.push('title = ?'); params.push(title); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description); }
  if (code !== undefined) { updates.push('code = ?'); params.push(code); }
  if (language !== undefined) { updates.push('language = ?'); params.push(language); }
  if (visibility !== undefined) { updates.push('visibility = ?'); params.push(visibility); }
  if (isFavorite !== undefined) { updates.push('is_favorite = ?'); params.push(isFavorite ? 1 : 0); }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')");
    params.push(snippet.id);
    run(`UPDATE snippets SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  if (tagNames !== undefined && Array.isArray(tagNames)) {
    try { run('DELETE FROM snippet_tags WHERE snippet_id = ?', [snippet.id]); } catch(e) {}
    for (const tagName of tagNames) {
      let tag = get('SELECT id FROM tags WHERE name = ?', [tagName]);
      if (!tag) {
        const tagResult = run('INSERT INTO tags (name) VALUES (?)', [tagName]);
        tag = { id: tagResult.lastInsertRowid };
      }
      try { run('INSERT INTO snippet_tags (snippet_id, tag_id) VALUES (?, ?)', [snippet.id, tag.id]); } catch(e) {}
    }
  }

  const updated = get('SELECT * FROM snippets WHERE id = ?', [snippet.id]);
  res.json({ message: '片段已更新', snippet: formatSnippet(updated) });
});

// 删除片段
router.delete('/:uuid', authenticateToken, (req, res) => {
  const snippet = get('SELECT * FROM snippets WHERE uuid = ?', [req.params.uuid]);

  if (!snippet) return res.status(404).json({ error: '片段不存在' });
  if (snippet.user_id !== req.user.userId) return res.status(403).json({ error: '无权删除该片段' });

  run('DELETE FROM snippets WHERE id = ?', [snippet.id]);
  run('UPDATE usage_stats SET snippet_count = MAX(0, snippet_count - 1), storage_bytes = MAX(0, storage_bytes - ?) WHERE user_id = ?',
    [(snippet.code || '').length, req.user.userId]);

  res.json({ message: '片段已删除' });
});

// 生成分享链接
router.post('/:uuid/share', authenticateToken, (req, res) => {
  const snippet = get('SELECT * FROM snippets WHERE uuid = ?', [req.params.uuid]);
  if (!snippet) return res.status(404).json({ error: '片段不存在' });
  if (snippet.user_id !== req.user.userId) return res.status(403).json({ error: '无权操作' });

  const existing = get('SELECT share_code FROM share_links WHERE snippet_id = ?', [snippet.id]);
  if (existing) {
    return res.json({ shareCode: existing.share_code, url: `/share/${existing.share_code}` });
  }

  const shareCode = uuidv4().slice(0, 8);
  const { expiresInDays } = req.body;
  let expiresAt = null;
  if (expiresInDays) {
    const date = new Date();
    date.setDate(date.getDate() + parseInt(expiresInDays));
    expiresAt = date.toISOString();
  }

  run('INSERT INTO share_links (snippet_id, share_code, expires_at) VALUES (?, ?, ?)', [snippet.id, shareCode, expiresAt]);
  res.json({ shareCode, url: `/share/${shareCode}` });
});

// 通过分享码获取片段
router.get('/share/:code', (req, res) => {
  const link = get(`
    SELECT sl.*, s.*, u.username, u.display_name
    FROM share_links sl
    JOIN snippets s ON sl.snippet_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE sl.share_code = ?
  `, [req.params.code]);

  if (!link) return res.status(404).json({ error: '分享链接不存在' });
  if (link.expires_at && new Date(link.expires_at) < new Date()) return res.status(410).json({ error: '分享链接已过期' });

  res.json({ snippet: formatSnippet(link) });
});

// 收藏/取消收藏
router.post('/:uuid/like', authenticateToken, (req, res) => {
  const snippet = get('SELECT id FROM snippets WHERE uuid = ?', [req.params.uuid]);
  if (!snippet) return res.status(404).json({ error: '片段不存在' });

  const existing = get('SELECT * FROM snippet_likes WHERE user_id = ? AND snippet_id = ?', [req.user.userId, snippet.id]);

  if (existing) {
    run('DELETE FROM snippet_likes WHERE user_id = ? AND snippet_id = ?', [req.user.userId, snippet.id]);
    res.json({ liked: false });
  } else {
    run('INSERT INTO snippet_likes (user_id, snippet_id) VALUES (?, ?)', [req.user.userId, snippet.id]);
    res.json({ liked: true });
  }
});

// Fork
router.post('/:uuid/fork', authenticateToken, (req, res) => {
  const original = get('SELECT * FROM snippets WHERE uuid = ?', [req.params.uuid]);
  if (!original) return res.status(404).json({ error: '片段不存在' });

  const user = get('SELECT plan FROM users WHERE id = ?', [req.user.userId]);
  if (user.plan === 'free') {
    const count = get('SELECT COUNT(*) as count FROM snippets WHERE user_id = ?', [req.user.userId]);
    if (count.count >= 50) {
      return res.status(403).json({ error: '免费用户最多创建 50 个代码片段', code: 'LIMIT_REACHED', upgradeUrl: '/pricing' });
    }
  }

  const snippetUuid = uuidv4();
  const result = run(
    'INSERT INTO snippets (uuid, user_id, title, description, code, language, visibility, forked_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [snippetUuid, req.user.userId, `${original.title} (fork)`, original.description || '', original.code, original.language, 'private', original.id]
  );

  const snippet = get('SELECT * FROM snippets WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({ message: 'Fork 成功', snippet: formatSnippet(snippet) });
});

module.exports = router;