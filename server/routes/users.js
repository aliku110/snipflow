/**
 * SnipFlow - 用户路由 (注册/登录/资料)
 */
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { get, all, run } = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'snipflow-dev-secret';

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: '用户名、邮箱和密码为必填项' });
    }

    if (username.length < 2 || username.length > 30) {
      return res.status(400).json({ error: '用户名长度应在2-30个字符之间' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 检查用户是否已存在
    const existing = get('SELECT id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing) {
      return res.status(409).json({ error: '用户名或邮箱已被注册' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const display = displayName || username;

    const result = run(
      'INSERT INTO users (username, email, password_hash, display_name) VALUES (?, ?, ?, ?)',
      [username, email, passwordHash, display]
    );

    run('INSERT INTO usage_stats (user_id) VALUES (?)', [result.lastInsertRowid]);

    const token = jwt.sign(
      { userId: result.lastInsertRowid, username, email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      user: {
        id: result.lastInsertRowid,
        username,
        email,
        displayName: display,
        plan: 'free',
      }
    });
  } catch (err) {
    console.error('[Register Error]', err);
    res.status(500).json({ error: '注册失败，请稍后再试' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码为必填项' });
    }

    const user = get('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);

    if (!user) {
      return res.status(401).json({ error: '邮箱/用户名或密码错误' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: '邮箱/用户名或密码错误' });
    }

    // 检查订阅是否过期
    if (user.plan === 'pro' && user.subscription_ends_at) {
      const ends = new Date(user.subscription_ends_at);
      if (ends < new Date()) {
        run("UPDATE users SET plan = 'free' WHERE id = ?", [user.id]);
        user.plan = 'free';
      }
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        bio: user.bio,
        plan: user.plan,
        createdAt: user.created_at,
      }
    });
  } catch (err) {
    console.error('[Login Error]', err);
    res.status(500).json({ error: '登录失败，请稍后再试' });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, (req, res) => {
  const user = get(
    'SELECT id, username, email, display_name, avatar_url, bio, plan, created_at FROM users WHERE id = ?',
    [req.user.userId]
  );

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const stats = get('SELECT * FROM usage_stats WHERE user_id = ?', [user.id]);

  res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      plan: user.plan,
      createdAt: user.created_at,
    },
    stats: stats || { snippet_count: 0, total_views: 0 }
  });
});

// 更新用户资料
router.put('/profile', authenticateToken, (req, res) => {
  const { displayName, bio, avatarUrl } = req.body;

  const updates = [];
  const params = [];

  if (displayName !== undefined) { updates.push('display_name = ?'); params.push(displayName); }
  if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
  if (avatarUrl !== undefined) { updates.push('avatar_url = ?'); params.push(avatarUrl); }

  if (updates.length === 0) {
    return res.status(400).json({ error: '没有要更新的字段' });
  }

  updates.push("updated_at = datetime('now')");
  params.push(req.user.userId);

  run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

  res.json({ message: '资料已更新' });
});

// 获取用户公开资料
router.get('/profile/:username', (req, res) => {
  const user = get(
    'SELECT id, username, display_name, avatar_url, bio, created_at FROM users WHERE username = ?',
    [req.params.username]
  );

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  const snippetCount = get(
    "SELECT COUNT(*) as count FROM snippets WHERE user_id = ? AND visibility = 'public'",
    [user.id]
  );

  res.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      createdAt: user.created_at,
    },
    stats: {
      publicSnippets: snippetCount.count,
    }
  });
});

// 免费用户限制检查
router.get('/limits', authenticateToken, (req, res) => {
  const user = get('SELECT plan FROM users WHERE id = ?', [req.user.userId]);
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const snippetCount = get('SELECT COUNT(*) as count FROM snippets WHERE user_id = ?', [req.user.userId]);

  res.json({
    plan: user.plan,
    snippetCount: snippetCount.count,
    freeLimit: 50,
    proFeatures: [
      '无限代码片段',
      'AI 智能命名',
      '团队协作',
      'API 访问',
      '批量导出/导入',
      '自定义分享品牌',
    ],
    canCreate: user.plan === 'pro' || snippetCount.count < 50,
  });
});

module.exports = router;