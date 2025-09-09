#!/bin/bash

# Drawnix Vercel Deployment Script
# This script builds and deploys the Drawnix app to Vercel

echo "🚀 Starting Drawnix deployment to Vercel..."

# Build the web app
echo "📦 Building web app..."
npm run build:web

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo "📁 Build output located at: dist/apps/web"
    echo ""
    echo "🎯 To deploy to Vercel, run one of these commands:"
    echo ""
    echo "Option 1 - Using Vercel CLI (recommended):"
    echo "  npm i -g vercel"
    echo "  vercel --prod"
    echo ""
    echo "Option 2 - Using Git integration:"
    echo "  1. Push your changes to GitHub"
    echo "  2. Connect your repo to Vercel at https://vercel.com"
    echo "  3. Vercel will auto-deploy on push"
    echo ""
    echo "Option 3 - Manual deployment:"
    echo "  vercel deploy dist/apps/web"
    echo ""
else
    echo "❌ Build failed! Please fix the errors above."
    exit 1
fi