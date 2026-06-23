/**
 * SnipFlow - 认证中间件
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'snipflow-dev-secret';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: '请先登录', code: 'AUTH_REQUIRED' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: '登录已过期，请重新登录', code: 'TOKEN_EXPIRED' });
  }
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // 静默忽略无效token
    }
  }
  next();
}

function requirePro(req, res, next) {
  const { getDb } = require('../db');
  const db = getDb();
  const user = db.prepare('SELECT plan, subscription_ends_at FROM users WHERE id = ?').get(req.user.userId);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (user.plan === 'pro') {
    // 检查订阅是否过期
    if (user.subscription_ends_at) {
      const ends = new Date(user.subscription_ends_at);
      if (ends < new Date()) {
        // 过期了，降级
        db.prepare('UPDATE users SET plan = ? WHERE id = ?').run('free', req.user.userId);
        return res.status(403).json({ 
          error: 'Pro 订阅已过期', 
          code: 'PRO_EXPIRED',
          upgradeUrl: '/pricing'
        });
      }
    }
    return next();
  }

  return res.status(403).json({ 
    error: '需要 Pro 订阅', 
    code: 'PRO_REQUIRED',
    upgradeUrl: '/pricing'
  });
}

module.exports = { authenticateToken, optionalAuth, requirePro };