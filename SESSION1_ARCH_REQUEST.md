# Session 1 Architecture Request

Design the architecture for Mission Control v3 - Session 1 (Overview + Chat).

## Scope (Session 1 ONLY)

### Features
1. **Overview Dashboard**
   - Real-time cost tracker (daily/total)
   - Trading bot status (equity, positions)
   - Live activity feed (last 20 items)
   - Today's summary auto-generated

2. **Real-time Chat**
   - WebSocket-based messaging
   - Direct to Bert's main session
   - Message history
   - Online/offline indicator

### Technical Requirements
- Node.js + Express backend
- SQLite database
- Vanilla HTML/CSS/JS frontend
- Liquid Glass design system (frosted glass, neon accents)
- WebSocket for real-time updates
- iOS-optimized (PWA-ready)

### Database Tables Needed
- system_status (costs, trading data, last_updated)
- activities (id, type, icon, title, description, timestamp)
- chat_messages (id, from_user, message, timestamp, read)
- tasks_simple (id, title, status, created_at)

### API Endpoints
- GET /api/dashboard - Overview data
- GET /api/activities - Recent activity
- POST /api/activities - Add activity
- GET /api/chat - Get messages
- POST /api/chat - Send message
- WS /ws - WebSocket for real-time

### Frontend Views
- Overview (cost card, trading card, activity feed)
- Chat (message list, input field)

### Design System
- Background: #0a0a0f (deep space)
- Cards: #12121a with frosted glass blur
- Accent: #00d4aa (mint neon)
- Secondary: #6366f1 (blue)
- Font: -apple-system, SF Pro

## Output Required
1. Complete database schema (SQL)
2. API endpoint specifications
3. WebSocket message types/protocol
4. Frontend component structure
5. File organization
6. Data flow diagrams

DO NOT write implementation code. Architecture only.