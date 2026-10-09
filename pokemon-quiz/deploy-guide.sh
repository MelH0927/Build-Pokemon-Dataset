#!/bin/bash
# Vercel Deployment Guide for Pokemon Quiz
# This script will guide you through deploying to Vercel (server-independent hosting)

set -e

echo "🎮 Pokemon Quiz - Server-Independent Deployment Guide"
echo "=================================================="
echo ""

# Check if vercel is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

echo "✅ Vercel CLI is ready"
echo ""

echo "📋 Step-by-Step Deployment:"
echo ""

echo "1️⃣  First, you need a MongoDB URI (required for serverless deployment)"
echo "   Recommended: MongoDB Atlas (free tier available)"
echo "   📖 Visit: https://www.mongodb.com/atlas/database"
echo "   📝 Create account → New Project → Create Database → Get connection string"
echo "   💡 Format: mongodb+srv://username:password@cluster.mongodb.net/pokemon-quiz"
echo ""

echo "2️⃣  Set up your environment variables:"
echo "   You'll need:"
echo "   - MONGODB_URI: Your MongoDB connection string"
echo "   - ADMIN_KEY: A secure admin key for the dashboard"
echo ""

echo "3️⃣  Run the deployment:"
echo "   Execute: vercel --prod"
echo "   - Login with GitHub/GitLab/Bitbucket when prompted"
echo "   - Follow the prompts to link your project"
echo "   - Add environment variables when asked"
echo ""

echo "4️⃣  After deployment:"
echo "   - Your app will be live at: https://your-project-name.vercel.app"
echo "   - Test: /api/health should return {'ok': true}"
echo "   - Admin: /admin?key=YOUR_ADMIN_KEY"
echo ""

echo "🚀 Ready to deploy? Run: vercel --prod"
echo ""

echo "📚 Manual deployment steps:"
echo "1. vercel login"
echo "2. vercel env add MONGODB_URI"
echo "3. vercel env add ADMIN_KEY" 
echo "4. vercel --prod"
echo ""

echo "🔧 Troubleshooting:"
echo "- MongoDB connection issues: Check Atlas IP whitelist (allow 0.0.0.0/0 for serverless)"
echo "- Build errors: Ensure all dependencies in package.json"
echo "- API timeouts: MongoDB connection might need optimization"
echo ""

echo "Need help? Check the deployment logs with: vercel logs"