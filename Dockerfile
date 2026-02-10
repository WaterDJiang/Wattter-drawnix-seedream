# 第一阶段：构建前端
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖文件
COPY package*.json ./

# 安装依赖（使用legacy-peer-deps解决版本冲突）
RUN npm ci --legacy-peer-deps

# 复制源代码
COPY . .

# 使用vite直接构建前端（绕过NX的复杂性）
RUN npm run build:web

# 第二阶段：运行时环境
FROM node:20-alpine AS runtime

WORKDIR /app

# 只安装生产依赖
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# 复制后端API文件
COPY server.js ./
COPY api/ ./api/

# 复制前端构建产物
COPY --from=builder /app/dist/apps/web/ ./public/

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 启动服务
CMD ["node", "server.js"]
