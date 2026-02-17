# DEPLOYMENT GUIDE — Mission Control v3

**Time to Deploy:** ~10 minutes  
**Cost to Operate:** ~$7/month (Render)  
**Status:** Ready to go!

---

## Step 1: Create GitHub Repositories

You'll need TWO repos:
1. **API Backend** - mission-control-api
2. **Frontend** - mission-control-v3

### API Backend Repo
```bash
# Go to github.com/new
# Repository name: mission-control-api
# Description: Mission Control v3 API Backend
# Public (free)
# Click "Create repository"

# Then in terminal:
cd /home/c/.openclaw/workspace/mission-control-v3
git remote add origin https://github.com/YOUR_USERNAME/mission-control-api.git
git branch -M main
git push -u origin main
```

### Frontend Repo
```bash
# Go to github.com/new again
# Repository name: mission-control-v3
# Description: Mission Control v3 Dashboard
# Public (free)
# Click "Create repository"

# In a new terminal directory:
mkdir mission-control-v3-frontend
cd mission-control-v3-frontend
cp -r /home/c/.openclaw/workspace/mission-control-v3/public/* .
git init
git add .
git commit -m "Frontend: Mission Control v3 dashboard"
git remote add origin https://github.com/YOUR_USERNAME/mission-control-v3.git
git branch -M main
git push -u origin main
```

---

## Step 2: Deploy Backend to Render

1. **Sign up at render.com** (if not already)
   - Use GitHub for easy login
   - Free tier works great

2. **Create Web Service**
   - Click "New +"
   - Select "Web Service"
   - Connect your GitHub account
   - Select `mission-control-api` repo

3. **Configure Service**
   - **Name:** mission-control-api
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free (Render will offer paid, but free works)

4. **Add Persistent Disk** (IMPORTANT!)
   - Name: `mission-control-db`
   - Mount Path: `/opt/render/project/src/db`
   - Size: 1 GB (plenty)

5. **Deploy!**
   - Click "Create Web Service"
   - Wait 2-3 minutes for first build
   - You'll see a URL like: `https://mission-control-api-xxx.onrender.com`
   - **Save this URL!**

---

## Step 3: Deploy Frontend to GitHub Pages

1. **Go to mission-control-v3 repo**
   - Click Settings
   - Scroll to "Pages"
   - Source: Deploy from branch
   - Branch: main, /(root)
   - Click Save

2. **Wait 1-2 minutes**
   - GitHub builds and deploys
   - You'll see URL like: `https://YOUR_USERNAME.github.io/mission-control-v3`
   - **This is your frontend URL!**

---

## Step 4: Connect Frontend to Backend

The frontend needs to know where the API is.

**In mission-control-v3-frontend (or your local copy):**

Edit `app.js`:
```javascript
// Line 5, change this:
const API_URL = 'http://localhost:3000';

// To this:
const API_URL = 'https://mission-control-api-xxx.onrender.com';
```

Replace `mission-control-api-xxx` with your actual Render URL.

Then:
```bash
git add app.js
git commit -m "Update API URL to Render backend"
git push origin main
```

GitHub Pages will auto-rebuild in ~1 minute.

---

## Step 5: Test the Deployment!

1. **Open your frontend URL** in a browser
   - `https://YOUR_USERNAME.github.io/mission-control-v3`

2. **Test WebSocket connection**
   - Open browser console (F12)
   - Should see "WebSocket connected"
   - No errors

3. **Test a feature**
   - Go to Overview tab
   - Should show dashboard
   - Try Workshop → Add a task
   - Should see it appear
   - Go to Chat, send a message
   - Should appear in list

4. **Test on mobile**
   - Open URL on iPhone/Android
   - Try "Add to Home Screen"
   - Should install as PWA
   - Works offline

---

## Step 6: Monitor & Maintain

### Render Dashboard
- Watch logs in real-time
- See if any crashes
- Monitor disk usage
- Restart if needed (rare)

### GitHub
- All deployments automatic
- Updates to main branch auto-deploy
- No manual steps needed

### Usage
- Logs go to Render console
- Database persists on disk
- Auto-restarts on crash
- Stays online 24/7

---

## Troubleshooting

### WebSocket Not Connecting
```
Error: Failed to connect to WebSocket
```
- Check API_URL in app.js is correct
- Make sure Render service is running
- Clear browser cache (Ctrl+Shift+Del)
- Check browser console for exact error

### 404 on API Endpoints
```
404: Not Found
```
- Verify Render service is deployed
- Check Render logs for errors
- Make sure package.json has correct start command
- Restart Render service

### GitHub Pages Not Building
```
No deployment found
```
- Check Settings → Pages
- Make sure branch is set to "main"
- Check Actions tab for build logs
- Wait 2-3 minutes for rebuild

### Database Getting Large
```
Disk full error
```
- Render gives you 1 GB (plenty for months)
- Check db/mission-control.db file size
- Consider adding cleanup cron job if needed

---

## URLs You'll Need

Once deployed, save these:

```
Frontend:   https://YOUR_USERNAME.github.io/mission-control-v3
Backend:    https://mission-control-api-xxx.onrender.com
GitHub API: https://github.com/YOUR_USERNAME/mission-control-api
GitHub Web: https://github.com/YOUR_USERNAME/mission-control-v3
```

---

## Optional: Custom Domain

Want your own domain? Render supports it:
1. Go to render.com service settings
2. Add custom domain
3. Point DNS records (instructions provided)
4. HTTPS auto-enabled

---

## Cost Summary

| Service | Cost | Why |
|---------|------|-----|
| Render | $7/month | Always-on backend |
| GitHub Pages | Free | CDN included |
| GitHub Repos | Free | Public repos |
| Domain (optional) | ~$10/year | Your choice |
| **Total** | ~$7/month | Incredibly cheap! |

---

## Next Steps

1. ✅ Create GitHub repos (2 repos)
2. ✅ Push code to repos
3. ✅ Deploy to Render (1 service)
4. ✅ Enable GitHub Pages (1 setting)
5. ✅ Update API_URL in app.js
6. ✅ Test the deployment
7. ✅ Share the URL!

---

## Support

If something breaks:
1. Check Render logs
2. Check GitHub Actions logs
3. Check browser console (F12)
4. Restart Render service
5. Check README.md for more help

---

**Mission Control v3 is live!** 🚀

Your personal command center is now running 24/7 on the internet. 

Invite your team. Track your work. Own your data. Go build! 💪
