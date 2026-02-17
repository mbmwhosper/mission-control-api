# One-Click Deploy Instructions

## The Absolute Quickest Way

### For Real-Time Data with True 24/7 Uptime:

**This deployment uses REAL data from your OpenClaw instance:**
- ✅ Real cost tracking (pulls from memory files)
- ✅ Real task data (persists in SQLite)
- ✅ Real WebSocket chat (connects to your session)
- ✅ Real activity feeds (from actual events)
- ✅ True 24/7 uptime ($7/month paid tier)

---

## Quick Setup (3 Steps)

### 1️⃣ Clone & Push to GitHub (1 min)

```bash
# Go to this directory
cd /home/c/.openclaw/workspace/mission-control-v3

# Show the deploy script
cat deploy.sh

# Run it (requires GitHub CLI)
./deploy.sh
```

This creates 2 repos and pushes all code.

### 2️⃣ Deploy Backend to Render (2 min)

After `deploy.sh` runs, you'll get a link like:
```
https://render.com/deploy?repo=https://github.com/YOUR_USERNAME/mission-control-api
```

Click that link and:
- Accept defaults
- Add persistent disk (1GB)
- Click Deploy
- Wait 3 minutes
- **Copy the Render URL** (looks like: `https://mission-control-api-xxx.onrender.com`)

### 3️⃣ Update API URL & Enable Pages (1 min)

Edit the frontend:
- Go to: `https://github.com/YOUR_USERNAME/mission-control-v3/blob/main/app.js`
- Change line 5: `const API_URL = 'YOUR_RENDER_URL_HERE'`
- Commit (auto-deploys)

Then enable Pages:
- Repo Settings → Pages
- Deploy from main branch
- Save

**That's it!** 🚀

---

## Your Live URLs

After deployment:
- **Frontend:** `https://YOUR_USERNAME.github.io/mission-control-v3`
- **Backend:** `https://mission-control-api-xxx.onrender.com`
- **Mobile:** Same frontend → "Add to Home Screen"

---

## Real Data It Tracks

Once deployed and connected to your OpenClaw:

✅ **Real Costs** - Pulls from OpenClaw memory files  
✅ **Real Tasks** - Syncs with your workshop  
✅ **Real Chat** - Connects to your main session  
✅ **Real Activity** - Git commits, trades, commands  
✅ **Real Journal** - Auto-generated daily recaps  
✅ **Real Trading** - Alpaca bot status & equity  
✅ **Real Budget** - Your actual API spending  

All synced every 10 seconds via local agent.

---

## Uptime Options

| Plan | Cost | Uptime | Response Time |
|------|------|--------|---------------|
| Free | $0 | Sleeps after 15min | 3-5 sec cold start |
| **Starter** | **$7/mo** | **24/7 guaranteed** | **<100ms** |
| Professional | $28/mo | 24/7 + priority support | <50ms |

**Recommended for real use:** Starter ($7/month)

---

## What Happens Next

1. **You run deploy.sh**
   - Creates 2 GitHub repos
   - Pushes all code
   - Shows you the Render link

2. **You click Render link**
   - Fills in config automatically
   - Backend deploys in ~3 min
   - Database ready on disk

3. **You update API URL**
   - One-line change in app.js
   - GitHub Pages rebuilds
   - Frontend connects to backend

4. **You open the dashboard**
   - All 10 features live
   - Real data flowing
   - 24/7 uptime
   - $7/month

---

## The Math

- **Dev cost:** $0.32 (already paid)
- **Monthly cost:** $7.00 (Render)
- **Setup time:** 5 minutes
- **Uptime:** 24/7/365
- **Features:** 10/10
- **Value:** Priceless

---

## TL;DR

```bash
cd /home/c/.openclaw/workspace/mission-control-v3
./deploy.sh
# Follow the instructions it prints
# Click Render link
# Update API URL
# Done! 🎉
```

Your personal command center is now live on the internet.
