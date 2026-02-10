# Drawnix Deployment Guide

## 🚀 Vercel Deployment Setup

### Prerequisites
- Node.js 18+ 
- Vercel CLI (optional but recommended)
- Git repository access

### Quick Start

1. **Install Vercel CLI** (if not already installed):
```bash
npm i -g vercel
```

2. **Build the project**:
```bash
npm run build:web
```

3. **Deploy to Vercel**:
```bash
./deploy-vercel.sh
```

### Deployment Options

#### Option 1: Vercel CLI (Recommended)
```bash
# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Deploy preview (for testing)
vercel
```

#### Option 2: Git Integration (Auto-deployment)
1. Push your code to GitHub/GitLab
2. Go to [Vercel Dashboard](https://vercel.com)
3. Import your repository
4. Vercel will auto-deploy on every push

#### Option 3: Manual Deployment
```bash
vercel deploy dist/apps/web
```

## 🚀 Zeabur Deployment Setup

### Prerequisites
- GitHub repository connected to Zeabur
- Docker support (Project includes `Dockerfile`)

### Deployment Steps
1. **Connect Repository**: Import your Drawnix repository into Zeabur.
2. **Auto-detection**: Zeabur will automatically detect the `Dockerfile` and `zeabur.json`.
3. **Environment Variables**: (Optional) Add the following variables in Zeabur dashboard to pre-configure API keys:
   - `VOLCENGINE_API_KEY`: Your Volcengine (豆包) API key.
   - `MODELSCOPE_API_KEY`: Your ModelScope API key.
4. **Deploy**: Zeabur will build the Docker image and deploy the service.

### Configuration
The project includes `zeabur.json` which specifies:
- Service name: `drawnix-seedream`
- Deployment type: `web`
- Dockerfile path: `Dockerfile`
- Default environment variables (`PORT: 3000`)

## 📋 Build Commands

```bash
# Development
npm start                 # Start dev server at localhost:7200

# Building
npm run build            # Build all packages
npm run build:web        # Build only web app

# Testing
npm test                 # Run all tests
```

## 🏗️ Project Structure

```
drawnix/
├── apps/web/            # Main web application
├── packages/            # Reusable packages
│   ├── drawnix/         # Core whiteboard logic
│   ├── react-board/     # React board components
│   └── react-text/      # Text editing components
├── dist/apps/web/       # Build output
└── vercel.json          # Vercel configuration
```

## 🔧 Troubleshooting

### Build Issues
- Ensure all dependencies are installed: `npm install`
- Check Node.js version (18+ recommended)
- Clear cache if needed: `npm run build:web -- --force`

### Deployment Issues
- Check Vercel logs in dashboard
- Ensure `vercel.json` is present
- Verify build output exists in `dist/apps/web`

### Performance
- Build includes code splitting and optimization
- Assets are automatically optimized by Vercel
- Consider enabling Vercel Analytics for performance monitoring

## 📊 Build Output

Successful build creates:
- `index.html` - Main entry point
- `assets/` - Optimized JS/CSS bundles
- `favicon.ico` & `logo/` - Brand assets
- `_headers` & `_redirects` - Netlify/Vercel config

## 🔒 Security

The `vercel.json` includes security headers:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

## 🎯 Next Steps

1. Deploy your app using one of the methods above
2. Set up custom domain (optional)
3. Configure analytics/monitoring
4. Set up CI/CD pipeline for automated deployments

## 📚 Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Nx Documentation](https://nx.dev/)
- [Vite Documentation](https://vitejs.dev/)

---

**Happy deploying! 🎉**