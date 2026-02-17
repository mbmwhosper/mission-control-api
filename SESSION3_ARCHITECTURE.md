# Mission Control v3 - Session 3 Architecture Extension
## Intelligence: Idea Scanner + Journal: Daily Recaps

---

## Database Schema Extensions

### New Tables

```sql
-- Ideas (scanned from messages, code, conversations)
CREATE TABLE IF NOT EXISTS ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  source TEXT, -- 'message', 'code', 'command', 'manual'
  confidence REAL DEFAULT 0.5, -- 0.0-1.0
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'implementing', 'later', 'dismissed', 'completed')),
  tags TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  snoozed_until DATETIME,
  metadata TEXT -- JSON (line number, file path, etc.)
);

-- Journal entries (daily recaps, auto-generated)
CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL UNIQUE, -- YYYY-MM-DD
  title TEXT,
  summary TEXT, -- Auto-generated summary
  tasks_completed INTEGER DEFAULT 0,
  tasks_failed INTEGER DEFAULT 0,
  commits INTEGER DEFAULT 0,
  cost_today REAL DEFAULT 0,
  trades_executed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Journal notes (manual notes per day, associated with entry)
CREATE TABLE IF NOT EXISTS journal_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL,
  note_text TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ideas_snoozed ON ideas(snoozed_until);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_notes_entry ON journal_notes(entry_id);
```

---

## API Endpoints

### Ideas

```
GET /api/ideas
Query: ?status=pending&sort=confidence&limit=20
Response: [
  {
    "id": 1,
    "content": "Build dashboard UI",
    "source": "message",
    "confidence": 0.95,
    "status": "pending",
    "tags": ["frontend", "urgent"],
    "created_at": "2026-02-17T01:00:00Z",
    "snoozed_until": null
  }
]

POST /api/ideas
Body: {
  "content": "New idea",
  "source": "manual",
  "confidence": 0.8,
  "tags": ["tag1"]
}
Response: { "id": 1, ... }

PUT /api/ideas/:id
Body: {
  "status": "implementing",
  "snoozed_until": "2026-02-18T10:00:00Z"
}

DELETE /api/ideas/:id
Response: { "deleted": true }

POST /api/ideas/:id/dismiss
Response: { "id": 1, "status": "dismissed" }

POST /api/ideas/:id/snooze
Body: { "hours": 24 }
Response: { "snoozed_until": "..." }

POST /api/ideas/scan
Body: {
  "text": "I want to add real-time updates",
  "source": "message"
}
Response: [{ "id": 1, "idea": "...", "confidence": 0.9 }]
```

### Journal

```
GET /api/journal/{YYYY-MM-DD}
Response: {
  "id": 1,
  "entry_date": "2026-02-17",
  "title": "Daily Summary",
  "summary": "Completed 5 tasks, pushed 3 commits, cost $0.15",
  "tasks_completed": 5,
  "tasks_failed": 0,
  "commits": 3,
  "cost_today": 0.15,
  "trades_executed": 2,
  "notes": [
    {
      "id": 1,
      "note_text": "Great progress on dashboard",
      "created_at": "2026-02-17T14:30:00Z"
    }
  ]
}

GET /api/journal?start=2026-02-10&end=2026-02-17
Response: [journal entries for date range]

POST /api/journal/{YYYY-MM-DD}/notes
Body: { "note_text": "Manual note" }
Response: { "id": 1, ... }

DELETE /api/journal/{YYYY-MM-DD}/notes/:note_id
Response: { "deleted": true }

GET /api/search?q=dashboard&type=journal
Response: [matching entries]
```

---

## Idea Scanning Algorithm

### Trigger Points
1. **New message in chat** → Scan for keywords
2. **New commit message** → Extract title
3. **Code files** → Scan for TODO/FIXME comments
4. **Manual entry** → User adds idea

### Keywords & Patterns

```javascript
const patterns = {
  'want': /i want to|we should|i'd like to|need to/i,
  'question': /should we|could we|what if|how about/i,
  'todo': /TODO:|FIXME:|XXX:|HACK:/,
  'action': /implement|build|create|add|fix|improve|refactor/i
};
```

### Confidence Scoring

```
Base: 0.5
+ keyword match: 0.2
+ action verb: 0.15
+ exclamation (!): 0.05
+ all caps: 0.1
= confidence (0.0-1.0)
```

---

## Journal Auto-Generation

### Daily Summary (runs at midnight or on-demand)

```
Tasks Completed: SELECT COUNT(*) FROM tasks WHERE status='completed' AND completed_at > TODAY()
Tasks Failed: SELECT COUNT(*) FROM tasks WHERE status='failed' AND completed_at > TODAY()
Commits: Parse git log for today
Cost: SELECT SUM(actual_cost) FROM tasks WHERE DATE(completed_at) = TODAY()
Trades: Parse trading activity for today
```

### Entry Format

```
📊 Daily Summary — Feb 17, 2026

✅ Tasks: 5 completed, 0 failed
📝 Commits: 3 pushed
💰 Cost: $0.15
📈 Trades: 2 executed

Auto-generated summary text...
```

---

## Frontend Extensions

### Intelligence View Structure

```html
<section id="intelligence" class="view">
  <header class="view-header">
    <h1>Intelligence</h1>
    <button class="scan-btn">Scan Now</button>
  </header>
  
  <div class="filter-tabs">
    <button class="tab active" data-filter="pending">Pending</button>
    <button class="tab" data-filter="implementing">Implementing</button>
    <button class="tab" data-filter="dismissed">Dismissed</button>
  </div>
  
  <div class="ideas-list" id="ideas-list">
    <!-- Idea cards injected -->
  </div>
</section>
```

### Idea Card Component

```html
<div class="idea-card" data-id="1">
  <div class="idea-header">
    <span class="confidence-badge" title="95% confidence">⭐ 95%</span>
    <span class="source-badge">Message</span>
  </div>
  <p class="idea-content">Build a real-time dashboard</p>
  <div class="idea-tags">
    <span class="idea-tag">frontend</span>
    <span class="idea-tag">urgent</span>
  </div>
  <div class="idea-actions">
    <button class="btn-implement">Implement</button>
    <button class="btn-snooze">Later</button>
    <button class="btn-dismiss">Dismiss</button>
  </div>
</div>
```

### Journal View Structure

```html
<section id="journal" class="view">
  <header class="view-header">
    <h1>Journal</h1>
    <input type="date" id="journal-date">
  </header>
  
  <!-- Calendar Navigation -->
  <div class="calendar-nav">
    <button class="prev-day">← Prev</button>
    <span class="current-date">Feb 17, 2026</span>
    <button class="next-day">Next →</button>
  </div>
  
  <!-- Daily Summary -->
  <div class="journal-summary glass-card">
    <h2 id="entry-title">Daily Summary</h2>
    <div class="entry-stats">
      <div class="stat">
        <span class="label">Tasks</span>
        <span class="value"><span id="stat-tasks">0</span> ✓</span>
      </div>
      <div class="stat">
        <span class="label">Commits</span>
        <span class="value"><span id="stat-commits">0</span></span>
      </div>
      <div class="stat">
        <span class="label">Cost</span>
        <span class="value">$<span id="stat-cost">0.00</span></span>
      </div>
    </div>
    <p class="entry-summary" id="entry-summary"></p>
  </div>
  
  <!-- Manual Notes -->
  <div class="journal-notes glass-card">
    <h3>Notes</h3>
    <div class="notes-list" id="notes-list"></div>
    <div class="note-input">
      <textarea id="note-input" placeholder="Add a note..."></textarea>
      <button id="note-add-btn">Add</button>
    </div>
  </div>
  
  <!-- Full-text Search -->
  <div class="search-box">
    <input type="text" id="search-journal" placeholder="Search journal...">
    <div class="search-results" id="search-results"></div>
  </div>
</section>
```

---

## Real-time Updates via WebSocket

### New Message Types

```json
// Idea scanned
{
  "type": "idea_scanned",
  "idea": {
    "id": 1,
    "content": "...",
    "confidence": 0.9
  }
}

// Daily entry auto-generated
{
  "type": "journal_generated",
  "entry": {
    "entry_date": "2026-02-17",
    "summary": "..."
  }
}
```

---

## Success Criteria (Session 3)

- [ ] Ideas table with scanning support
- [ ] Idea cards with confidence scores
- [ ] Dismiss, Snooze, Implement actions
- [ ] Journal entries auto-generated
- [ ] Calendar navigation (prev/next day)
- [ ] Manual notes per day
- [ ] Full-text search
- [ ] Real-time idea + journal updates via WebSocket
- [ ] Responsive on mobile + desktop

**Session 3 → Session 4: Cron + API Usage + Deploy**
