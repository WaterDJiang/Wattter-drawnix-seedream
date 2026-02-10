# 第一阶段：构建前端
FROM node:20 AS frontend-builder

# 安装 git，NX 在处理项目图时可能依赖 git 进行元数据分析
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /builder

# 禁用 NX 守护进程和云服务，确保在 CI 环境中行为可预测
ENV NX_DAEMON=false
ENV NX_SKIP_CHECK_FOR_UPDATE=true
ENV NX_NO_CLOUD=true

# 复制依赖文件
COPY package*.json ./
# 使用 npm ci 进行更严格的依赖安装（如果存在 package-lock.json）
# 如果没有 lock 文件则回退到 npm install
RUN npm ci || npm install

# 复制所有源代码
COPY . .

# 清理可能存在的本地缓存并构建
RUN npx nx reset && npx nx build web

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