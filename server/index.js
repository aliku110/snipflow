/**
 * SnipFlow - 服务器入口
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== 中间件 =====
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// 信任反向代理 (localtunnel/nginx)
app.set('trust proxy', 1);

// API 限流
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: '请求过于频繁，请稍后再试' },
  validate: { xForwardedForHeader: false },
});
app.use('/api', apiLimiter);

// ===== API 路由 =====
app.use('/api/users', require('./routes/users'));
app.use('/api/snippets', require('./routes/snippets'));
app.use('/api/payments', require('./routes/payments'));

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '1.0.0', uptime: process.uptime() });
});

// SPA 支持
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'API 端点不存在' });
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: '服务器内部错误' });
});

// ===== 启动 =====
async function start() {
  await getDb();
  console.log('[DB] 数据库已加载');

  app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║         SnipFlow v1.0.0              ║
║   代码片段管理平台 (SaaS)             ║
║                                      ║
║  Server: http://localhost:${PORT}     ║
╚══════════════════════════════════════╝
    `);
  });
}

start().catch(err => {
  console.error('[Fatal]', err);
  process.exit(1);
});

module.exports = app;