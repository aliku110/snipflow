# SnipFlow - Docker 部署
FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package.json ./
RUN npm install --production

# 复制代码
COPY . .

# 创建数据目录
RUN mkdir -p data

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 启动
CMD ["node", "server/index.js"]