# 第一阶段：构建前端
FROM node:20 AS frontend-builder

WORKDIR /builder

# 禁用 NX 守护进程，在 Docker 容器中通常不需要且容易出错
ENV NX_DAEMON=false

# 复制依赖文件并安装
COPY package*.json ./
# 使用 npm install 安装完整依赖以确保 nx 等工具可用
RUN npm install

# 复制所有源代码
COPY . .

# 构建前端：先重置 NX 缓存，然后执行构建
RUN npx nx reset && npm run build:web

# 第二阶段：运行时环境
FROM node:20-alpine AS runtime

WORKDIR /app

# 安装生产依赖
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# 复制后端API文件
COPY server.js ./
COPY api/ ./api/

# 复制前端构建产物
COPY --from=frontend-builder /builder/dist/apps/web/ ./public/

# 创建启动脚本
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🚀 启动Drawnix服务..."' >> /app/start.sh && \
    echo 'echo "📁 静态文件目录: /app/public"' >> /app/start.sh && \
    echo 'echo "🔧 API服务端口: 3000"' >> /app/start.sh && \
    echo 'node server.js' >> /app/start.sh && \
    chmod +x /app/start.sh

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

# 启动服务
CMD ["sh", "/app/start.sh"]