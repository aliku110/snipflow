#!/bin/bash
# SnipFlow 部署脚本

set -e

echo "╔══════════════════════════════════════╗"
echo "║       SnipFlow Deploy Script         ║"
echo "╚══════════════════════════════════════╝"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

echo "✓ Node.js $(node -v)"

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install --production

# 配置环境变量
if [ ! -f .env ]; then
    cp .env.example .env
    # 生成随机 JWT Secret
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s/snipflow-dev-secret-change-me-in-production/$JWT_SECRET/" .env
    echo "✓ 已生成配置文件 .env"
else
    echo "✓ .env 已存在"
fi

# 创建数据目录
mkdir -p data

# 初始化数据库
echo ""
echo "🗄️  初始化数据库..."
node server/init-db.js

echo ""
echo "✅ SnipFlow 部署完成！"
echo ""
echo "启动: npm start"
echo "访问: http://localhost:${PORT:-3000}"
echo ""