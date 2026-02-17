# Mission Control v3 — Session 1 Architecture

> **Scope:** Overview Dashboard + Real-time Chat  
> **Stack:** Node.js · Express · SQLite · Vanilla JS · WebSocket  
> **Design:** Liquid Glass (frosted glass, neon accents, iOS-optimized)

---

## 1. Database Schema (SQLite)

```sql
-- ============================================================
-- Mission Control v3 - Session 1 Schema
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ----- System Status (singleton row, upserted) ---------------
CREATE TABLE IF NOT EXISTS system_status (
    id              INTEGER PRIMARY KEY CHECK (id = 1),  -- enforce single row
    cost_today      REAL    NOT NULL DEFAULT 0.0,        -- USD, today's API spend
    cost_total      REAL    NOT NULL DEFAULT 0.0,        -- USD, all-time spend
    cost_updated_at TEXT,                                  -- ISO-8601
    trading_equity  REAL    DEFAULT 0.0,                  -- current portfolio equity
    trading_pnl     REAL    DEFAULT 0.0,                  -- today's P&L
    trading_positions INTEGER DEFAULT 0,                  -- open position count
    trading_status  TEXT    DEFAULT 'offline',             -- online | offline | error
    trading_updated_at TEXT,                               -- ISO-8601
    summary_text    TEXT    DEFAULT '',                    -- today's auto-generated summary
    summary_updated_at TEXT,                               -- ISO-8601
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed the singleton row
INSERT OR IGNORE INTO system_status (id) VALUES (1);

-- ----- Activity Feed -----------------------------------------
CREATE TABLE IF NOT EXISTS activities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL DEFAULT 'info',           -- info | cost | trade | chat | system | error
    icon        TEXT    NOT NULL DEFAULT '📋',             -- emoji shorthand
    title       TEXT    NOT NULL,
    description TEXT    DEFAULT '',
    source      TEXT    DEFAULT 'system',                  -- system | user | trading | openclaw
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_type    ON activities(type);

-- ----- Chat Messages -----------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user   TEXT    NOT NULL,                          -- 'user' | 'bert' | 'system'
    message     TEXT    NOT NULL,
    msg_type    TEXT    NOT NULL DEFAULT 'text',           -- text | system | error
    read        INTEGER NOT NULL DEFAULT 0,               -- 0 = unread, 1 = read
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_unread  ON chat_messages(read) WHERE read = 0;

-- ----- Tasks (basic, for session 1) -------------------------
CREATE TABLE IF NOT EXISTS tasks_simple (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending',       -- pending | done
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);
```

---

## 2. API Endpoint Specifications

Base URL: `http://<host>:3777/api`

### 2.1 Dashboard

#### `GET /api/dashboard`

Returns the full overview payload in a single call.

**Response `200`:**
```json
{
  "status": {
    "cost_today": 1.23,
    "cost_total": 45.67,
    "cost_updated_at": "2026-02-17T06:15:00Z",
    "trading_equity": 10234.56,
    "trading_pnl": 78.90,
    "trading_positions": 3,
    "trading_status": "online",
    "trading_updated_at": "2026-02-17T06:14:30Z",
    "summary_text": "Today: 12 API calls, 3 trades executed...",
    "summary_updated_at": "2026-02-17T06:00:00Z"
  },
  "activities": [
    {
      "id": 42,
      "type": "trade",
      "icon": "📈",
      "title": "BTC Long Opened",
      "description": "0.01 BTC @ $43,250",
      "source": "trading",
      "created_at": "2026-02-17T06:12:00Z"
    }
  ],
  "unread_messages": 2
}
```

### 2.2 Activities

#### `GET /api/activities`

| Param   | Type    | Default | Description              |
|---------|---------|---------|--------------------------|
| limit   | integer | 20      | Max items (1-100)        |
| offset  | integer | 0       | Pagination offset        |
| type    | string  | (all)   | Filter by activity type  |

**Response `200`:**
```json
{
  "activities": [ /* activity objects */ ],
  "total": 156
}
```

#### `POST /api/activities`

**Request body:**
```json
{
  "type": "info",
  "icon": "🔧",
  "title": "Server Restarted",
  "description": "Automatic restart after update",
  "source": "system"
}
```

**Response `201`:**
```json
{
  "id": 43,
  "type": "info",
  "icon": "🔧",
  "title": "Server Restarted",
  "description": "Automatic restart after update",
  "source": "system",
  "created_at": "2026-02-17T06:20:00Z"
}
```

Activity is also broadcast via WebSocket (see §3).

### 2.3 Chat

#### `GET /api/chat`

| Param  | Type    | Default | Description         |
|--------|---------|---------|---------------------|
| limit  | integer | 50      | Max messages (1-200)|
| before | integer | (none)  | Message ID cursor   |

**Response `200`:**
```json
{
  "messages": [
    {
      "id": 101,
      "from_user": "user",
      "message": "Hey Bert, what's the cost today?",
      "msg_type": "text",
      "created_at": "2026-02-17T06:18:00Z"
    }
  ],
  "has_more": true
}
```

#### `POST /api/chat`

**Request body:**
```json
{
  "message": "Check the trading status"
}
```

`from_user` is always `"user"` for HTTP-originated messages. Bert's replies arrive via WebSocket push only.

**Response `201`:**
```json
{
  "id": 102,
  "from_user": "user",
  "message": "Check the trading status",
  "msg_type": "text",
  "created_at": "2026-02-17T06:19:00Z"
}
```

#### `POST /api/chat/read`

Marks all messages as read.

**Response `200`:**
```json
{ "marked": 5 }
```

### 2.4 System Status (internal / updater)

#### `PATCH /api/status`

Used by internal scripts (cost tracker, trading bot) to push status updates.

**Request body (partial update):**
```json
{
  "cost_today": 2.34,
  "cost_total": 46.78,
  "trading_equity": 10300.00,
  "trading_pnl": 144.00,
  "trading_positions": 2,
  "trading_status": "online"
}
```

Only provided fields are updated. Triggers a `dashboard:update` WebSocket broadcast.

**Response `200`:**
```json
{ "ok": true, "updated_at": "2026-02-17T06:25:00Z" }
```

### 2.5 Error Responses

All errors follow:
```json
{
  "error": "Descriptive message",
  "code": "VALIDATION_ERROR"
}
```

| HTTP Code | Code               | When                          |
|-----------|--------------------|-------------------------------|
| 400       | VALIDATION_ERROR   | Missing/invalid fields        |
| 404       | NOT_FOUND          | Resource doesn't exist        |
| 500       | INTERNAL_ERROR     | Server-side failure           |

---

## 3. WebSocket Protocol

**Endpoint:** `ws://<host>:3777/ws`

Connection is upgraded from HTTP. No authentication for Session 1 (local network assumed).

### 3.1 Message Envelope

Every WebSocket frame is a JSON object with this structure:

```json
{
  "type": "<message_type>",
  "payload": { /* type-specific data */ },
  "ts": "2026-02-17T06:20:00Z"
}
```

### 3.2 Client → Server Messages

| Type            | Payload                              | Description                   |
|-----------------|--------------------------------------|-------------------------------|
| `chat:send`     | `{ "message": "string" }`           | User sends a chat message     |
| `chat:read`     | `{}`                                 | Mark all as read              |
| `ping`          | `{}`                                 | Keep-alive                    |

### 3.3 Server → Client Messages

| Type                 | Payload                                              | Description                        |
|----------------------|------------------------------------------------------|------------------------------------|
| `chat:message`       | `{ "id", "from_user", "message", "msg_type", "created_at" }` | New chat message (from any source) |
| `chat:read_confirm`  | `{ "marked": number }`                               | Read confirmation                  |
| `dashboard:update`   | `{ "field": "cost\|trading\|summary", "data": {} }`  | Partial dashboard status change    |
| `activity:new`       | `{ /* full activity object */ }`                      | New activity feed item             |
| `presence:status`    | `{ "bert": "online\|offline", "clients": number }`   | Connection status                  |
| `pong`               | `{}`                                                  | Keep-alive response                |
| `error`              | `{ "code": "string", "message": "string" }`          | Error                              |

### 3.4 Connection Lifecycle

```
Client                          Server
  |                                |
  |--- HTTP Upgrade /ws ---------->|
  |<-- 101 Switching Protocols ----|
  |                                |
  |<-- presence:status ------------|   (immediate: current state)
  |<-- dashboard:update -----------|   (immediate: full snapshot)
  |                                |
  |--- ping ---------------------->|   (every 30s from client)
  |<-- pong -----------------------|
  |                                |
  |--- chat:send ----------------->|
  |<-- chat:message ---------------|   (echo back + stored)
  |                                |
  |    ... Bert replies via internal API ...
  |<-- chat:message ---------------|   (from_user: "bert")
  |<-- activity:new ---------------|   (async, any time)
  |<-- dashboard:update -----------|   (async, any time)
  |                                |
  |--- close --------------------->|
  |<-- close ----------------------|
```

### 3.5 Reconnection Strategy

Client reconnects with exponential backoff: 1s → 2s → 4s → 8s → 15s (cap). On reconnect, client fetches `GET /api/dashboard` to re-sync state, then resumes WebSocket for incremental updates.

---

## 4. Frontend Component Hierarchy

```
App
├── NavBar                          (bottom tab bar, iOS-safe)
│   ├── NavTab [Overview]           (active/inactive state)
│   └── NavTab [Chat]              (unread badge)
│
├── View: Overview
│   ├── HeaderBar                   (title, time, status dot)
│   ├── CostCard                    (glass card)
│   │   ├── CostToday              (large number, accent color)
│   │   ├── CostTotal              (smaller, secondary)
│   │   └── CostSparkline          (optional: mini trend line)
│   ├── TradingCard                 (glass card)
│   │   ├── TradingStatus          (online/offline badge)
│   │   ├── EquityDisplay          (large number)
│   │   ├── PnlDisplay             (green/red colored)
│   │   └── PositionCount          (pill badge)
│   ├── SummaryCard                 (glass card, collapsible)
│   │   └── SummaryText            (auto-generated daily summary)
│   └── ActivityFeed                (glass card, scrollable)
│       └── ActivityItem[]          (icon + title + desc + relative time)
│           ├── ActivityIcon        (emoji)
│           ├── ActivityContent     (title bold, desc muted)
│           └── ActivityTime        (relative: "2m ago")
│
└── View: Chat
    ├── ChatHeader                  (title + Bert status indicator)
    │   └── PresenceDot            (green=online, gray=offline)
    ├── MessageList                 (scrollable, auto-scroll to bottom)
    │   └── ChatBubble[]
    │       ├── BubbleUser          (right-aligned, accent bg)
    │       └── BubbleBert          (left-aligned, glass bg)
    │           ├── MessageText
    │           └── MessageTime     (subtle timestamp)
    ├── TypingIndicator             (future: dots animation)
    └── ChatInput                   (fixed bottom, iOS safe-area)
        ├── TextInput               (auto-resize textarea)
        └── SendButton              (accent colored, disabled when empty)
```

### 4.1 State Management

No framework. Plain JS module with a simple reactive store:

```
state = {
  view: 'overview' | 'chat',
  dashboard: { status, activities, unread_messages },
  chat: { messages[], has_more, bert_status },
  ws: { connected, reconnecting }
}
```

State changes trigger targeted DOM updates via setter functions. No virtual DOM, no diffing — direct `element.textContent` / `element.innerHTML` updates scoped to the changed data.

### 4.2 CSS Architecture

Single CSS file with CSS custom properties for the design system:

```
:root {
  --bg-deep:       #0a0a0f;
  --bg-card:       rgba(18, 18, 26, 0.6);
  --bg-card-hover: rgba(18, 18, 26, 0.8);
  --glass-blur:    blur(20px);
  --glass-border:  rgba(255, 255, 255, 0.06);
  --accent-mint:   #00d4aa;
  --accent-blue:   #6366f1;
  --accent-red:    #ef4444;
  --accent-green:  #22c55e;
  --text-primary:  rgba(255, 255, 255, 0.95);
  --text-secondary: rgba(255, 255, 255, 0.55);
  --text-muted:    rgba(255, 255, 255, 0.3);
  --radius:        16px;
  --safe-top:      env(safe-area-inset-top);
  --safe-bottom:   env(safe-area-inset-bottom);
  --font-stack:    -apple-system, 'SF Pro Display', BlinkMacSystemFont, sans-serif;
}
```

Glass card mixin pattern:
```
.glass-card {
  background: var(--bg-card);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
}
```

---

## 5. File Structure

```
mission-control-v3/
├── ARCHITECTURE.md              ← this file
├── BUILD_LOG.md                 ← progress tracking
├── SESSION1_ARCH_REQUEST.md     ← input spec
│
├── server/
│   ├── index.js                 ← Express + WS server entry, port 3777
│   ├── db.js                    ← SQLite init, schema migration, query helpers
│   ├── routes/
│   │   ├── dashboard.js         ← GET /api/dashboard
│   │   ├── activities.js        ← GET/POST /api/activities
│   │   ├── chat.js              ← GET/POST /api/chat, POST /api/chat/read
│   │   └── status.js            ← PATCH /api/status (internal updater)
│   ├── ws/
│   │   ├── handler.js           ← WebSocket connection handler, message router
│   │   └── broadcast.js         ← Broadcast helpers (to all clients, filtered)
│   └── utils/
│       └── time.js              ← ISO formatting, relative time helpers
│
├── public/
│   ├── index.html               ← Single-page shell, meta tags, PWA manifest link
│   ├── manifest.json            ← PWA manifest (name, icons, theme-color)
│   ├── sw.js                    ← Service worker (cache shell for offline)
│   ├── css/
│   │   └── style.css            ← All styles (design system + components)
│   ├── js/
│   │   ├── app.js               ← Entry: init, router, state
│   │   ├── state.js             ← State store + change subscriptions
│   │   ├── api.js               ← HTTP fetch wrappers
│   │   ├── ws.js                ← WebSocket client, reconnection logic
│   │   ├── views/
│   │   │   ├── overview.js      ← Overview view render + update functions
│   │   │   └── chat.js          ← Chat view render + update functions
│   │   └── components/
│   │       ├── navbar.js        ← Bottom navigation bar
│   │       ├── cost-card.js     ← Cost tracking card
│   │       ├── trading-card.js  ← Trading status card
│   │       ├── activity-feed.js ← Activity feed list
│   │       ├── chat-bubble.js   ← Message bubble factory
│   │       └── glass-card.js    ← Shared glass card creation helper
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
│
├── data/
│   └── mission-control.db       ← SQLite database file (created at runtime)
│
└── package.json                 ← Dependencies: express, better-sqlite3, ws
```

### 5.1 Dependencies (package.json)

```
{
  "name": "mission-control-v3",
  "version": "3.0.0",
  "dependencies": {
    "express": "^4.18",
    "better-sqlite3": "^11.0",
    "ws": "^8.16"
  }
}
```

Three production dependencies. No build step. No bundler. No framework.

---

## 6. Data Flow Diagrams

### 6.1 Dashboard Load (Initial)

```
┌─────────┐         ┌─────────┐         ┌──────────┐
│ Browser  │         │ Express │         │  SQLite   │
│ (iOS)    │         │ Server  │         │    DB     │
└────┬─────┘         └────┬────┘         └────┬──────┘
     │                     │                   │
     │  GET /api/dashboard │                   │
     │────────────────────>│                   │
     │                     │  SELECT status    │
     │                     │──────────────────>│
     │                     │  SELECT activities│
     │                     │──────────────────>│
     │                     │  COUNT unread     │
     │                     │──────────────────>│
     │                     │<──────────────────│
     │   { status, activities, unread }        │
     │<────────────────────│                   │
     │                     │                   │
     │  WS connect /ws     │                   │
     │════════════════════>│                   │
     │<═ presence:status ══│                   │
     │<═ dashboard:update ═│  (full snapshot)  │
     │                     │                   │
```

### 6.2 Chat Message Flow

```
┌─────────┐         ┌─────────┐         ┌──────────┐       ┌──────────┐
│ Browser  │         │ Express │         │  SQLite   │       │  OpenClaw │
│ (user)   │         │ + WS    │         │    DB     │       │  (Bert)   │
└────┬─────┘         └────┬────┘         └────┬──────┘       └────┬──────┘
     │                     │                   │                   │
     │  WS: chat:send      │                   │                   │
     │═══════════════════=>│                   │                   │
     │                     │ INSERT message    │                   │
     │                     │──────────────────>│                   │
     │                     │<──────────────────│                   │
     │<═ chat:message ═════│ (echo: from_user) │                   │
     │                     │                   │                   │
     │                     │  POST /api/chat   │                   │
     │                     │  (internal relay) ────────────────────>
     │                     │                   │    Bert processes  │
     │                     │                   │<──────────────────│
     │                     │ INSERT reply      │  POST /api/chat   │
     │                     │  (from: bert)     │  (from: bert)     │
     │                     │──────────────────>│                   │
     │<═ chat:message ═════│ (from: bert)      │                   │
     │                     │                   │                   │
```

### 6.3 Real-time Status Update (Cost/Trading)

```
┌──────────┐       ┌─────────┐         ┌──────────┐        ┌──────────┐
│ External  │       │ Express │         │  SQLite   │        │ Browser  │
│ Script    │       │ + WS    │         │    DB     │        │ (all)    │
└────┬──────┘       └────┬────┘         └────┬──────┘        └────┬─────┘
     │                    │                   │                    │
     │ PATCH /api/status  │                   │                   │
     │ { cost_today: 3.5 }│                   │                   │
     │───────────────────>│                   │                   │
     │                    │ UPDATE system_status                  │
     │                    │──────────────────>│                   │
     │                    │<──────────────────│                   │
     │  { ok: true }      │                   │                   │
     │<───────────────────│                   │                   │
     │                    │                   │                   │
     │                    │ WS broadcast to all connected         │
     │                    │═══════════════════════════════════════>│
     │                    │  dashboard:update { field: "cost",    │
     │                    │    data: { cost_today: 3.5 } }        │
     │                    │                   │                   │
     │                    │ INSERT activity    │                   │
     │                    │──────────────────>│                   │
     │                    │═══ activity:new ══════════════════════>│
     │                    │                   │                   │
```

### 6.4 Activity Feed — New Item

```
┌──────────┐       ┌─────────┐         ┌──────────┐        ┌──────────┐
│ Any       │       │ Express │         │  SQLite   │        │ Browser  │
│ Source    │       │ + WS    │         │    DB     │        │ (all)    │
└────┬──────┘       └────┬────┘         └────┬──────┘        └────┬─────┘
     │                    │                   │                    │
     │ POST /api/activities                   │                   │
     │───────────────────>│                   │                   │
     │                    │ INSERT activity   │                   │
     │                    │──────────────────>│                   │
     │                    │<── { id, ... } ───│                   │
     │  201 { activity }  │                   │                   │
     │<───────────────────│                   │                   │
     │                    │                   │                   │
     │                    │═══ activity:new ══════════════════════>│
     │                    │   (broadcast to all WS clients)       │
     │                    │                   │  DOM: prepend to  │
     │                    │                   │  activity feed,   │
     │                    │                   │  trim to 20 items │
```

---

## 7. iOS / PWA Considerations

### 7.1 Viewport & Safe Areas
- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
- `<meta name="apple-mobile-web-app-capable" content="yes">`
- `<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">`
- `<meta name="theme-color" content="#0a0a0f">`
- All layout uses `env(safe-area-inset-*)` padding for notch/home indicator

### 7.2 Touch Optimization
- All tap targets ≥ 44×44px
- `-webkit-tap-highlight-color: transparent` globally
- `touch-action: manipulation` to disable double-tap zoom
- Chat input uses `inputmode="text"` and `enterkeyhint="send"`
- Prevent iOS bounce: `overscroll-behavior: none` on body, allow on scroll containers

### 7.3 PWA Manifest
- `display: "standalone"`, `orientation: "portrait"`
- `background_color: "#0a0a0f"`, `theme_color: "#0a0a0f"`
- App icons at 192px and 512px

### 7.4 Service Worker (Minimal)
- Cache the app shell (HTML, CSS, JS) for instant reload
- Network-first for API calls (no stale data)
- Fallback offline page with "Reconnecting..." state

---

## 8. Design Tokens Reference

| Token               | Value                          | Usage                                |
|----------------------|--------------------------------|--------------------------------------|
| `--bg-deep`         | `#0a0a0f`                      | Page background                      |
| `--bg-card`         | `rgba(18, 18, 26, 0.6)`       | Card backgrounds                     |
| `--glass-blur`      | `blur(20px)`                   | Frosted glass effect                 |
| `--glass-border`    | `rgba(255, 255, 255, 0.06)`   | Subtle card borders                  |
| `--accent-mint`     | `#00d4aa`                      | Primary accent (costs, buttons)      |
| `--accent-blue`     | `#6366f1`                      | Secondary accent (trading, links)    |
| `--accent-red`      | `#ef4444`                      | Negative P&L, errors                 |
| `--accent-green`    | `#22c55e`                      | Positive P&L, online status          |
| `--text-primary`    | `rgba(255, 255, 255, 0.95)`   | Headlines, values                    |
| `--text-secondary`  | `rgba(255, 255, 255, 0.55)`   | Labels, descriptions                 |
| `--text-muted`      | `rgba(255, 255, 255, 0.3)`    | Timestamps, placeholders             |
| `--radius`          | `16px`                         | Card corner radius                   |
| `--radius-sm`       | `10px`                         | Buttons, pills                       |
| `--radius-bubble`   | `18px`                         | Chat bubbles                         |
| `--font-stack`      | `-apple-system, 'SF Pro Display', ...` | System font                   |
| `--font-mono`       | `'SF Mono', 'Fira Code', monospace`   | Numbers, code                  |
| `--spacing-xs`      | `4px`                          | Tight padding                        |
| `--spacing-sm`      | `8px`                          | Inner element spacing                |
| `--spacing-md`      | `16px`                         | Card padding, gaps                   |
| `--spacing-lg`      | `24px`                         | Section spacing                      |
| `--spacing-xl`      | `32px`                         | View padding                         |
| `--nav-height`      | `64px`                         | Bottom nav bar height                |
| `--header-height`   | `56px`                         | Top header bar height                |

---

## 9. Interaction Patterns

### 9.1 View Switching
- Bottom tab bar with two tabs: Overview (📊) and Chat (💬)
- No page reload — toggle visibility of view containers
- Chat tab shows unread count badge (mint accent) when > 0
- Active tab has mint underline indicator

### 9.2 Activity Feed
- Newest first, capped at 20 visible items
- New items animate in (slide down + fade in, 300ms ease)
- Each item shows relative time ("2m ago") — updated every 30s via timer
- No pagination in Session 1; older items fetched if scrolled (stretch goal)

### 9.3 Chat
- Auto-scroll to bottom on new message (unless user has scrolled up)
- User bubbles: right-aligned, mint accent background
- Bert bubbles: left-aligned, glass card background
- System messages: centered, muted text, no bubble
- Send on Enter (desktop) or Send button (mobile)
- Shift+Enter for newline
- Empty input disables send button

### 9.4 Status Indicators
- Trading status dot: green pulse = online, gray = offline, red pulse = error
- Bert presence dot in chat header: green = WS connected, gray = offline
- WebSocket connection: subtle banner at top when disconnected ("Reconnecting...")

---

## 10. Security Notes (Session 1)

- **No authentication** — local network access only
- Server binds to `0.0.0.0:3777` (accessible from LAN)
- PATCH /api/status is open (only internal scripts should call it)
- No CORS restrictions (same-origin served by Express static)
- Future sessions will add auth tokens for external access

---

*Architecture complete. Ready for Session 1 implementation.*
