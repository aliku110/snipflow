# SnipFlow - 云端代码片段管理平台

让代码更有价值。

## 产品定位

面向开发者的 **Freemium SaaS** 代码片段管理平台。  
免费版够用，Pro 会员解锁全部功能。

## 功能特色

- ✅ 快速保存代码片段，30+ 编程语言语法高亮
- ✅ 标签 + 语言 + 搜索，智能分类管理
- ✅ 公开/私密/仅链接可见，灵活控制隐私
- ✅ 一键生成分享链接，嵌入博客/文档
- ✅ Fork 他人片段，二次创作
- ✅ 免费版：50 个片段额度
- 🌟 Pro 版：无限额度 + AI 智能命名 + 团队协作 + API 访问

## 技术栈

- **后端:** Node.js + Express + sql.js (WASM SQLite, 零编译)
- **前端:** 原生 SPA (HTML + CSS + JS)
- **高亮:** highlight.js
- **支付:** Stripe (预留，无 key 时 Demo 模式)
- **部署:** Railway / Docker / 直接运行

## 一键部署

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new?template=https://github.com/aliku110/snipflow)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/aliku110/snipflow)

> 点击上方按钮，授权 GitHub，Railway/Render 自动部署。无需手动配置服务器。

## 快速启动

```bash
# 1. 安装依赖
npm install

# 2. 初始化数据库（自动）
npm run dev

# 3. 访问
open http://localhost:3000
```

## 部署

### 生产部署 (云服务器)

```bash
# 1. 克隆到服务器
git clone ... snipflow
cd snipflow

# 2. 安装依赖
npm install --production

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env：修改 JWT_SECRET、配置 Stripe key（可选）

# 4. 使用 PM2 守护运行
npm install -g pm2
pm2 start server/index.js --name snipflow
pm2 save
pm2 startup

# 5. Nginx 反向代理
# 参考 deploy/nginx.conf
```

### Docker 部署

```bash
docker build -t snipflow .
docker run -d -p 3000:3000 -v snipflow-data:/app/data snipflow
```

### Railway 部署（推荐）

1. 点击上方 **Deploy on Railway** 按钮
2. 用 GitHub 登录 Railway
3. 选择仓库 `aliku110/snipflow`
4. Railway 自动部署，分配 `*.railway.app` 域名
5. 在 Railway Dashboard 设置环境变量 `JWT_SECRET`

支持自动 HTTPS、自动扩缩容、免费额度。

## API 文档

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|------|
| POST | /api/users/register | 注册 | - |
| POST | /api/users/login | 登录 | - |
| GET | /api/users/me | 当前用户信息 | ✅ |
| GET | /api/users/limits | 使用限制 | ✅ |
| GET | /api/snippets | 我的片段列表 | ✅ |
| POST | /api/snippets | 创建片段 | ✅ |
| GET | /api/snippets/:uuid | 获取片段 | 可选 |
| PUT | /api/snippets/:uuid | 更新片段 | ✅ |
| DELETE | /api/snippets/:uuid | 删除片段 | ✅ |
| GET | /api/snippets/explore | 公开片段浏览 | - |
| POST | /api/snippets/:uuid/like | 收藏/取消 | ✅ |
| POST | /api/snippets/:uuid/fork | Fork 片段 | ✅ |
| POST | /api/snippets/:uuid/share | 生成分享链接 | ✅ |
| GET | /api/snippets/share/:code | 通过分享码读取 | - |
| GET | /api/payments/pricing | 定价信息 | - |
| POST | /api/payments/subscribe | 订阅 Pro | ✅ |
| POST | /api/payments/cancel | 取消订阅 | ✅ |
| GET | /api/payments/status | 订阅状态 | ✅ |

## 盈利策略

| 阶段 | 目标 | 策略 |
|------|------|------|
| 🚀 启动 | 1000 用户 | 免费 + 口碑传播，开发者社区推广 |
| 📈 增长 | 10000 用户 | 付费转化率 5%，月收入 ¥9,500 |
| 💰 规模 | 50000+ 用户 | Pro ¥19/月 + 团队版 ¥49/月 + API 按量计费 |

### 环境变量（必填）

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务端口 | `3000` |
| `JWT_SECRET` | JWT 签名密钥（生产环境**必须修改**） | `snipflow-dev-secret` |
| `DB_PATH` | SQLite 数据库路径 | `./data/snipflow.db` |
| `STRIPE_SECRET_KEY` | Stripe Secret Key（可选） | - |
| `STRIPE_PRICE_PRO_MONTHLY` | Stripe Price ID（可选） | - |

## 许可

MIT