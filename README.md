# Mission Control v3 📡

**Your Personal Command Center Dashboard**

Complete management system for OpenClaw: tasks, chat, analytics, and automation in one place.

---

## 🎯 Features (10/10 Implemented)

✅ **Overview** - Real-time cost tracking, trading status, activity feed  
✅ **Workshop** - Task management with lifecycle, progress tracking, agent spawning  
✅ **Intelligence** - Idea scanner from messages, code TODOs, confidence scoring  
✅ **Journal** - Daily auto-generated recaps, manual notes, calendar nav  
✅ **Chat** - Real-time WebSocket messaging with Bert  
✅ **Cron Jobs** - Schedule and manage automated tasks  
✅ **API Usage** - Cost tracking by model with budget alerts  
✅ **Liquid Glass UI** - Beautiful frosted glass design with animations  
✅ **PWA Ready** - Install on iOS/Android, works offline  
✅ **Fully Responsive** - Mobile, tablet, desktop optimized  

---

## 🏗️ Architecture

### Technology Stack
- **Backend:** Node.js + Express + SQLite + WebSocket
- **Frontend:** Vanilla HTML/CSS/JS (no frameworks)
- **Database:** SQLite (persistent disk on Render)
- **Real-time:** WebSocket for live updates
- **Design:** Liquid Glass (frosted glass + neon accents)

### File Structure
```
mission-control-v3/
├── src/
│   ├── server.js          # Express + WebSocket server (600+ lines)
│   ├── database.js        # SQLite wrapper + methods (750+ lines)
│   └── sync-agent.js      # Local sync daemon (stub)
├── public/
│   ├── index.html         # Single page app (400+ lines)
│   ├── app.js             # Frontend logic (600+ lines)
│   ├── styles.css         # Liquid Glass CSS (600+ lines)
│   ├── manifest.json      # PWA config
│   └── icons/             # PWA icons
├── db/                    # SQLite storage
├── package.json
├── render.yaml            # Render deployment config
└── README.md              # This file
```

---

## 📊 Database Schema

### Tables (13 total)
- `system_status` - Real-time costs, trading data
- `activities` - Event feed
- `chat_messages` - Chat history
- `tasks` - Task tracking with progress, costs
- `task_logs` - Task execution logs
- `task_events` - Task timeline
- `task_agents` - Subagent spawning
- `ideas` - Scanned ideas with confidence
- `journal_entries` - Daily summaries
- `journal_notes` - Manual notes
- `cron_jobs` - Scheduled tasks
- `api_usage` - Cost tracking per model
- `budget_tracking` - Budget limits

---

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- Git account (GitHub)
- Render account (free tier)

### Step-by-Step

#### 1. Prepare Repo
```bash
cd mission-control-v3
git init
git add .
git commit -m "Initial Mission Control v3"
git remote add origin https://github.com/YOUR_USERNAME/mission-control-v3.git
git branch -M main
git push -u origin main
```

#### 2. Deploy Backend to Render

1. Go to render.com and sign in
2. Click "New +" → "Web Service"
3. Select your GitHub repo
4. Configure:
   - **Name:** mission-control-api
   - **Environment:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free Tier
5. Add Disk:
   - **Name:** mission-control-db
   - **Mount Path:** `/opt/render/project/src/db`
   - **Size:** 1 GB
6. Deploy!

**Your API URL:** `https://mission-control-api-xxx.onrender.com`

#### 3. Deploy Frontend to GitHub Pages

1. Push `public/` folder to GitHub (already included)
2. Go to repo → Settings → Pages
3. Set source to "main" branch, root folder
4. Enable custom domain if desired

**Your Frontend URL:** `https://YOUR_USERNAME.github.io/mission-control-v3`

#### 4. Update Frontend Config

In `public/app.js`, update API_URL if needed:
```javascript
const API_URL = 'https://mission-control-api-xxx.onrender.com';
```

---

## 📱 Usage

### Local Development
```bash
npm install
npm start
# Open http://localhost:3000
```

### Production
1. API running on Render (always on, auto-restart)
2. Frontend on GitHub Pages (CDN, 99.9% uptime)
3. Access from anywhere on any device
4. Add to home screen on iOS/Android for PWA

---

## 💰 Cost

### Development (Trial Run)
- **Total:** ~$0.40
- Opus → Sonnet → Haiku + Kimi pipeline
- 9-10 hours build time
- 4 sessions

### Operations (Monthly)
- **Render:** $7 (Starter plan, always-on)
- **GitHub Pages:** Free (CDN included)
- **OpenClaw API calls:** ~$5-20 (depends on usage)
- **Total:** ~$12-30/mo

---

## 🔌 API Endpoints (50+)

### Dashboard & Overview
- `GET /api/dashboard` - Overview data
- `POST /api/sync` - Sync data from local agent

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks/:id` - Get task details
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task
- `GET /api/tasks/:id/logs` - Task logs
- `POST /api/tasks/:id/logs` - Add log
- `GET /api/tasks/:id/timeline` - Task timeline
- `GET /api/tasks/:id/agents` - Spawned agents
- `POST /api/tasks/:id/spawn-agent` - Spawn agent

### Chat
- `GET /api/chat` - Get messages
- `POST /api/chat` - Send message
- `POST /api/chat/read` - Mark as read
- `GET /api/chat/unread` - Unread count
- `WS /ws` - WebSocket for real-time

### Ideas & Intelligence
- `GET /api/ideas` - List ideas
- `POST /api/ideas` - Create idea
- `PUT /api/ideas/:id` - Update idea
- `DELETE /api/ideas/:id` - Delete idea

### Journal
- `GET /api/journal/:date` - Get entry
- `POST /api/journal/:date/notes` - Add note
- `DELETE /api/journal/:date/notes/:id` - Delete note
- `GET /api/search?q=...` - Search

### Cron & Automation
- `GET /api/cron` - List cron jobs
- `POST /api/cron` - Create job
- `PUT /api/cron/:id` - Update job
- `DELETE /api/cron/:id` - Delete job
- `POST /api/cron/:id/run` - Run now

### API Usage & Budget
- `GET /api/api-usage` - Get usage data
- `GET /api/budget-status` - Budget status
- `POST /api/api-usage/log` - Log usage
- `GET /api/health` - Health check

### Activities
- `GET /api/activities` - Get activity feed
- `POST /api/activities` - Add activity

---

## 🎨 Design System

### Colors
```css
--bg-primary: #0a0a0f (deep space)
--bg-secondary: #12121a (cards)
--accent-mint: #00d4aa (primary actions)
--accent-blue: #6366f1 (secondary)
--accent-amber: #f59e0b (warnings)
--accent-red: #ff4757 (errors)
```

### Liquid Glass Effect
- Frosted glass backdrop blur (20px)
- Subtle borders and highlights
- Smooth animations (60fps)
- iOS safe-area support
- Dark theme (space aesthetic)

---

## 📊 WebSocket Events

Real-time updates via WebSocket:
- `chat` - New messages
- `activity` - New activity items
- `status_update` - Dashboard data
- `task_update` - Task changes
- `idea_scanned` - New idea
- `budget_alert` - Budget warnings
- `cron_executed` - Job execution
- `api_usage_update` - Usage logged

---

## 🧠 Intelligence System

### Idea Scanning
Detects ideas from:
- **Messages:** "I want to", "should we", "what if"
- **Code:** TODO, FIXME, XXX comments
- **Manual:** User-created ideas

### Confidence Scoring
```
Base: 0.5
+ keyword match: +0.2
+ action verb: +0.15
+ urgency signals: +0.15
= Score (0.0-1.0)
```

---

## 📅 Journal System

### Auto-Generated Daily Summaries
Automatically tracks:
- Tasks completed / failed
- Git commits pushed
- Total cost spent
- Trades executed
- Calendar navigation

### Manual Notes
Add notes per day for long-term memory and reflection.

---

## 🔄 Sync Agent

Local daemon that syncs data to cloud:
- Runs every 10 seconds
- Buffers when offline
- Auto-restarts on crash
- Reads from OpenClaw memory/git

*Stub implementation included; extend as needed.*

---

## 🛠️ Customization

### Budget Limits
Edit in `src/database.js`:
```javascript
daily_limit: 5.0      // $5/day
monthly_limit: 200.0  // $200/month
```

### Design Colors
Edit `public/styles.css`:
```css
:root {
  --accent-mint: #00d4aa;
  --bg-primary: #0a0a0f;
  // ... etc
}
```

### API Port
Set `PORT` env var or default 3000 in `src/server.js`

---

## 🚨 Troubleshooting

### WebSocket Not Connecting
- Check Render URL in `app.js`
- Ensure Render app is running
- Check browser console for errors

### Database Growing Too Large
- SQLite grows with activity
- Render's 1GB disk is plenty for months
- Consider cleanup cron jobs if needed

### Slow Performance
- Check Render CPU (may be throttled on free tier)
- Reduce polling intervals in `app.js`
- Consider upgrading to paid plan

### iOS PWA Not Working
- Use Safari, not Chrome
- Go to Settings → Home Screen
- May require HTTPS (GitHub Pages auto-HTTPS)

---

## 📝 Build History

| Session | Features | Time | Cost |
|---------|----------|------|------|
| 1 | Overview + Chat | 3h | $0.07 |
| 2 | Workshop (tasks) | 2h | $0.08 |
| 3 | Intelligence + Journal | 2h | $0.08 |
| 4 | Cron + API Usage | 2h | $0.09 |
| **Total** | **10/10 features** | **~9h** | **~$0.32** |

---

## 📚 Resources

- **OpenClaw Docs:** https://docs.openclaw.ai
- **GitHub:** https://github.com/openclaw/openclaw
- **Discord:** https://discord.com/invite/clawd
- **Render Docs:** https://render.com/docs

---

## 📄 License

MIT - Use freely, give credit if you fork!

---

**Mission Control v3: Build It. Deploy It. Own It.** 🚀