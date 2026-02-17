# Mission Control v3 - Session 2 Architecture Extension
## Workshop: Task Queue System

---

## Extended Database Schema

### New/Modified Tables

```sql
-- Extend tasks table with progress tracking
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS (
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  eta_timestamp DATETIME,
  estimated_cost REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  description TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
  assignee TEXT,
  tags TEXT, -- JSON array of tags
  metadata TEXT -- JSON for custom data
);

-- Task logs (stdout/stderr from tasks)
CREATE TABLE IF NOT EXISTS task_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  level TEXT DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'debug')),
  message TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Task timeline events (status changes, milestones)
CREATE TABLE IF NOT EXISTS task_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'status_change', 'progress_update', 'comment', 'milestone'
  title TEXT NOT NULL,
  details TEXT, -- JSON
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Subagent spawns (track which agents run for which tasks)
CREATE TABLE IF NOT EXISTS task_agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  session_key TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  started_at DATETIME,
  completed_at DATETIME,
  cost REAL DEFAULT 0,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON task_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_logs_timestamp ON task_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
CREATE INDEX IF NOT EXISTS idx_task_events_timestamp ON task_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_task_agents_task_id ON task_agents(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority DESC);
```

---

## Extended API Endpoints

### Task Management (Enhanced)

```
GET /api/tasks
Query params: ?status=active&priority=high&limit=20
Response: [
  {
    "id": "task-123",
    "title": "Build dashboard",
    "description": "Create overview dashboard",
    "status": "active",
    "progress_percent": 45,
    "eta_timestamp": "2026-02-17T04:30:00Z",
    "priority": "high",
    "assignee": "Bert",
    "tags": ["frontend", "urgent"],
    "estimated_cost": 0.15,
    "actual_cost": 0.08,
    "created_at": "2026-02-17T01:00:00Z",
    "started_at": "2026-02-17T01:15:00Z",
    "completed_at": null
  }
]

POST /api/tasks
Body: {
  "title": "New task",
  "description": "Task description",
  "priority": "normal",
  "estimated_cost": 0.05,
  "tags": ["tag1", "tag2"]
}
Response: { "id": "task-456", "status": "queued", ... }

GET /api/tasks/:id
Response: Full task details + progress + eta

GET /api/tasks/:id/logs
Query: ?level=info&limit=50
Response: [
  {
    "id": 1,
    "level": "info",
    "message": "Task started",
    "timestamp": "2026-02-17T01:15:00Z"
  }
]

POST /api/tasks/:id/logs
Body: { "level": "info", "message": "Progress update" }
Response: { "id": 2 }

GET /api/tasks/:id/timeline
Response: [
  {
    "id": 1,
    "event_type": "status_change",
    "title": "Status changed to active",
    "details": { "from": "queued", "to": "active" },
    "timestamp": "2026-02-17T01:15:00Z"
  }
]

PUT /api/tasks/:id
Body: {
  "status": "active",
  "progress_percent": 50,
  "eta_timestamp": "2026-02-17T03:00:00Z",
  "actual_cost": 0.12
}
Response: { "success": true }

DELETE /api/tasks/:id
Response: { "deleted": true }
```

### Subagent Spawning

```
POST /api/tasks/:id/spawn-agent
Body: {
  "agent_id": "main",
  "prompt": "Do this task...",
  "model": "haiku",
  "timeout_seconds": 3600
}
Response: {
  "agent_entry_id": 1,
  "session_key": "agent:main:subagent:xxx",
  "status": "pending"
}

GET /api/tasks/:id/agents
Response: [
  {
    "id": 1,
    "agent_id": "main",
    "session_key": "agent:main:subagent:xxx",
    "status": "running",
    "started_at": "2026-02-17T01:20:00Z",
    "cost": 0.02
  }
]

GET /api/tasks/:id/agents/:agent_id/status
Response: {
  "status": "running",
  "progress": 45,
  "cost": 0.02,
  "last_message_at": "2026-02-17T01:25:00Z"
}
```

---

## Frontend Extensions

### Workshop View Structure

```html
<section id="workshop" class="view">
  <header class="view-header">
    <h1>Workshop</h1>
    <div class="view-controls">
      <input class="quick-add" placeholder="Add task...">
      <button class="filter-btn">Filters</button>
    </div>
  </header>
  
  <!-- Filter bar -->
  <div class="filter-bar">
    <button class="filter-tag active" data-filter="all">All</button>
    <button class="filter-tag" data-filter="active">Active</button>
    <button class="filter-tag" data-filter="queued">Queued</button>
  </div>
  
  <!-- Task list (draggable on desktop, swipeable on mobile) -->
  <div class="task-list" id="task-list">
    <!-- Task cards injected here -->
  </div>
  
  <!-- Detail modal (hidden) -->
  <div class="modal" id="task-modal">
    <div class="modal-content">
      <header class="modal-header">
        <h2 id="modal-title">Task</h2>
        <button class="close-btn">×</button>
      </header>
      
      <div class="modal-body">
        <!-- Tabs: Details, Logs, Timeline, Agents -->
        <div class="modal-tabs">
          <button class="tab-btn active" data-tab="details">Details</button>
          <button class="tab-btn" data-tab="logs">Logs</button>
          <button class="tab-btn" data-tab="timeline">Timeline</button>
          <button class="tab-btn" data-tab="agents">Agents</button>
        </div>
        
        <!-- Details Tab -->
        <div class="tab-content" id="tab-details">
          <div class="detail-group">
            <label>Status</label>
            <select id="task-status">
              <option>queued</option>
              <option>active</option>
              <option>paused</option>
              <option>completed</option>
              <option>failed</option>
            </select>
          </div>
          <div class="detail-group">
            <label>Progress</label>
            <input type="range" id="task-progress" min="0" max="100">
            <span id="progress-value">0%</span>
          </div>
          <div class="detail-group">
            <label>ETA</label>
            <input type="datetime-local" id="task-eta">
          </div>
          <div class="detail-group">
            <label>Cost</label>
            <div class="cost-display">
              <span>Est: $<span id="task-cost-est">0</span></span>
              <span>Actual: $<span id="task-cost-actual">0</span></span>
            </div>
          </div>
        </div>
        
        <!-- Logs Tab -->
        <div class="tab-content" id="tab-logs">
          <div class="logs-list" id="logs-list"></div>
          <div class="log-input">
            <textarea id="log-input" placeholder="Add log..."></textarea>
            <button id="add-log-btn">Add</button>
          </div>
        </div>
        
        <!-- Timeline Tab -->
        <div class="tab-content" id="tab-timeline">
          <div class="timeline" id="timeline"></div>
        </div>
        
        <!-- Agents Tab -->
        <div class="tab-content" id="tab-agents">
          <div class="agents-list" id="agents-list"></div>
          <button id="spawn-agent-btn" class="neon-button">Spawn Agent</button>
        </div>
      </div>
    </div>
  </div>
</section>
```

### Task Card Component

```html
<div class="task-card" data-id="task-123">
  <div class="task-header">
    <h3 class="task-title">Build Dashboard</h3>
    <span class="priority-badge high">High</span>
  </div>
  
  <div class="task-progress">
    <div class="progress-bar">
      <div class="progress-fill" style="width: 45%"></div>
    </div>
    <div class="progress-labels">
      <span>45%</span>
      <span class="eta">ETA 3h</span>
    </div>
  </div>
  
  <div class="task-meta">
    <span class="status-badge active">Active</span>
    <span class="cost">$0.08 / $0.15</span>
    <span class="assignee">Bert</span>
  </div>
  
  <div class="task-tags">
    <span class="tag">frontend</span>
    <span class="tag">urgent</span>
  </div>
  
  <!-- Swipe actions on mobile -->
  <div class="task-actions">
    <button class="action-pause">⏸</button>
    <button class="action-complete">✓</button>
    <button class="action-delete">✕</button>
  </div>
</div>
```

---

## Real-time Updates via WebSocket

### New Message Types

```json
// Task status changed
{
  "type": "task_update",
  "task_id": "task-123",
  "updates": {
    "status": "active",
    "progress_percent": 50
  }
}

// New task log
{
  "type": "task_log",
  "task_id": "task-123",
  "log": {
    "id": 42,
    "level": "info",
    "message": "Processing...",
    "timestamp": "2026-02-17T01:30:00Z"
  }
}

// Task timeline event
{
  "type": "task_event",
  "task_id": "task-123",
  "event": {
    "id": 5,
    "event_type": "status_change",
    "title": "Status changed to active",
    "timestamp": "2026-02-17T01:30:00Z"
  }
}

// Subagent spawned
{
  "type": "task_agent",
  "task_id": "task-123",
  "agent": {
    "id": 1,
    "agent_id": "main",
    "status": "running",
    "session_key": "..."
  }
}
```

---

## Interactions

### Mobile (Touch)
- **Swipe left** → Reveal pause/complete/delete buttons
- **Tap task** → Open detail modal
- **Long-hold task** → Reorder with drag (if supported)

### Desktop (Pointer)
- **Drag task** → Reorder task list
- **Click task** → Open detail modal
- **Right-click task** → Context menu (pause, complete, delete)

---

## Success Criteria (Session 2)

- [ ] Extended database with task_logs and task_events
- [ ] Task cards with progress bars and ETA
- [ ] Detail modal with tabs (details, logs, timeline, agents)
- [ ] Quick-add input for new tasks
- [ ] Spawn subagent from UI
- [ ] Real-time updates via WebSocket
- [ ] Mobile swipe actions
- [ ] Desktop drag-and-drop
- [ ] All animations smooth (60fps)

**Session 2 → Session 3: Intelligence + Journal**
