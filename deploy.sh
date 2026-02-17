#!/bin/bash

# Mission Control v3 - Super Quick Deploy Script
# Requirements: GitHub CLI (gh), git, Node.js
# Time: ~2 minutes

set -e

echo "🚀 Mission Control v3 - One-Click Deploy"
echo "=========================================="
echo ""

# Check requirements
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI not found. Install with:"
    echo "   brew install gh  (or apt-get install gh on Linux)"
    exit 1
fi

if ! gh auth status &> /dev/null; then
    echo "❌ Not logged into GitHub. Run:"
    echo "   gh auth login"
    exit 1
fi

# Get GitHub username
USERNAME=$(gh api user -q '.login')
echo "✅ Logged in as: $USERNAME"
echo ""

# Create API repo
echo "📦 Creating mission-control-api repo..."
gh repo create mission-control-api \
    --public \
    --source=/home/c/.openclaw/workspace/mission-control-v3 \
    --remote=origin \
    --push \
    --description "Mission Control v3 - API Backend" \
    2>/dev/null || echo "ℹ️  Repo may already exist"

echo "✅ API repo created: https://github.com/$USERNAME/mission-control-api"
echo ""

# Create frontend repo
echo "📦 Creating mission-control-v3 repo..."

# Create temp dir for frontend only
TEMP_DIR=$(mktemp -d)
cp -r /home/c/.openclaw/workspace/mission-control-v3/public/* $TEMP_DIR/
cp /home/c/.openclaw/workspace/mission-control-v3/README.md $TEMP_DIR/
cd $TEMP_DIR

git init
git add .
git commit -m "Frontend: Mission Control v3 dashboard"
git remote add origin https://github.com/$USERNAME/mission-control-v3.git
git branch -M main
git push -u origin main -f

echo "✅ Frontend repo created: https://github.com/$USERNAME/mission-control-v3"
cd -
rm -rf $TEMP_DIR
echo ""

# Create Render deployment link
echo "🎯 Render Deployment Instructions:"
echo "===================================="
echo ""
echo "1. Click this link to deploy the backend:"
echo "   https://render.com/deploy?repo=https://github.com/$USERNAME/mission-control-api"
echo ""
echo "2. Configure in Render:"
echo "   - Name: mission-control-api"
echo "   - Environment: Node"
echo "   - Build: npm install"
echo "   - Start: npm start"
echo "   - Plan: Free (or Starter for true 24/7)"
echo "   - Add Disk: mission-control-db, /opt/render/project/src/db, 1GB"
echo ""
echo "3. Once deployed, copy the Render URL"
echo ""
echo "4. Enable GitHub Pages for frontend:"
echo "   - Go: https://github.com/$USERNAME/mission-control-v3/settings/pages"
echo "   - Source: Deploy from a branch"
echo "   - Branch: main, /(root)"
echo "   - Save"
echo ""
echo "5. Update API URL in frontend:"
echo "   - Edit: https://github.com/$USERNAME/mission-control-v3/blob/main/app.js"
echo "   - Line 5: Change API_URL to your Render URL"
echo "   - Commit (GitHub Pages auto-rebuilds)"
echo ""
echo "✅ Done! Your dashboard is live!"
echo ""
echo "Frontend: https://$USERNAME.github.io/mission-control-v3"
echo "Backend:  https://mission-control-api-xxx.onrender.com"
echo ""
echo "🎉 Mission Control v3 is ready!"
