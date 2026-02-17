const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'db', 'mission-control.db');

class Database {
  constructor() {
    this.db = new sqlite3.Database(DB_PATH);
    this.init();
  }

  init() {
    this.db.serialize(() => {
      // System status (single row)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS system_status (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          openclaw_cost_today REAL DEFAULT 0,
          openclaw_cost_total REAL DEFAULT 0,
          trading_equity REAL DEFAULT 100000,
          trading_positions INTEGER DEFAULT 0,
          trading_status TEXT DEFAULT 'idle',
          last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insert default row if not exists
      this.db.run(`
        INSERT OR IGNORE INTO system_status (id) VALUES (1)
      `);

      // Activities
      this.db.run(`
        CREATE TABLE IF NOT EXISTS activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT NOT NULL,
          icon TEXT,
          title TEXT NOT NULL,
          description TEXT,
          metadata TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Chat messages
      this.db.run(`
        CREATE TABLE IF NOT EXISTS chat_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          from_user INTEGER NOT NULL CHECK (from_user IN (0, 1)),
          message TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          read INTEGER DEFAULT 0
        )
      `);

      // Tasks (extended for Session 2)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          status TEXT DEFAULT 'queued',
          description TEXT,
          progress_percent INTEGER DEFAULT 0,
          eta_timestamp DATETIME,
          estimated_cost REAL DEFAULT 0,
          actual_cost REAL DEFAULT 0,
          priority TEXT DEFAULT 'normal',
          assignee TEXT,
          tags TEXT,
          metadata TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          started_at DATETIME,
          completed_at DATETIME
        )
      `);

      // Task logs
      this.db.run(`
        CREATE TABLE IF NOT EXISTS task_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          level TEXT DEFAULT 'info',
          message TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
      `);

      // Task events (timeline)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS task_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          title TEXT NOT NULL,
          details TEXT,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
      `);

      // Task agents (subagent spawning)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS task_agents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          task_id TEXT NOT NULL,
          agent_id TEXT NOT NULL,
          session_key TEXT,
          status TEXT DEFAULT 'pending',
          started_at DATETIME,
          completed_at DATETIME,
          cost REAL DEFAULT 0,
          FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
        )
      `);

      // Ideas (Session 3)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS ideas (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          source TEXT DEFAULT 'manual',
          confidence REAL DEFAULT 0.5,
          status TEXT DEFAULT 'pending',
          tags TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          snoozed_until DATETIME,
          metadata TEXT
        )
      `);

      // Journal entries (Session 3)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS journal_entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_date TEXT NOT NULL UNIQUE,
          title TEXT,
          summary TEXT,
          tasks_completed INTEGER DEFAULT 0,
          tasks_failed INTEGER DEFAULT 0,
          commits INTEGER DEFAULT 0,
          cost_today REAL DEFAULT 0,
          trades_executed INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Journal notes
      this.db.run(`
        CREATE TABLE IF NOT EXISTS journal_notes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER NOT NULL,
          note_text TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(entry_id) REFERENCES journal_entries(id) ON DELETE CASCADE
        )
      `);

      // Cron jobs (Session 4)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS cron_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          schedule TEXT NOT NULL,
          payload TEXT,
          enabled INTEGER DEFAULT 1,
          next_run DATETIME,
          last_run DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // API usage tracking (Session 4)
      this.db.run(`
        CREATE TABLE IF NOT EXISTS api_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          usage_date TEXT NOT NULL,
          model TEXT NOT NULL,
          requests INTEGER DEFAULT 0,
          tokens_in INTEGER DEFAULT 0,
          tokens_out INTEGER DEFAULT 0,
          cost REAL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Indexes
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp DESC)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_task_logs_task ON task_logs(task_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_task_events_task ON task_events(task_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_task_agents_task ON task_agents(task_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_ideas_created ON ideas(created_at DESC)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date DESC)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_journal_notes ON journal_notes(entry_id)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_cron_enabled ON cron_jobs(enabled)`);
      this.db.run(`CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(usage_date DESC)`);
    });
  }

  // Dashboard
  getDashboard() {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM system_status WHERE id = 1', (err, row) => {
        if (err) return reject(err);
        this.db.all('SELECT status, COUNT(*) as count FROM tasks GROUP BY status', (err, tasks) => {
          if (err) return reject(err);
          const taskSummary = { queued: 0, active: 0, completed: 0, failed: 0 };
          tasks.forEach(t => taskSummary[t.status] = t.count);
          resolve({
            cost_today: row.openclaw_cost_today,
            cost_total: row.openclaw_cost_total,
            trading: {
              equity: row.trading_equity,
              positions: row.trading_positions,
              status: row.trading_status
            },
            task_summary: taskSummary,
            last_updated: row.last_updated
          });
        });
      });
    });
  }

  updateStatus(updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(updates), 1];
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE system_status SET ${fields}, last_updated = CURRENT_TIMESTAMP WHERE id = ?`,
        values,
        function(err) {
          if (err) return reject(err);
          resolve({ changed: this.changes });
        }
      );
    });
  }

  // Activities
  getActivities(limit = 20) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM activities ORDER BY timestamp DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(r => ({
            ...r,
            metadata: r.metadata ? JSON.parse(r.metadata) : null
          })));
        }
      );
    });
  }

  addActivity(activity) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO activities (type, icon, title, description, metadata) VALUES (?, ?, ?, ?, ?)',
        [activity.type, activity.icon, activity.title, activity.description, 
         activity.metadata ? JSON.stringify(activity.metadata) : null],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  pruneActivities() {
    return new Promise((resolve, reject) => {
      this.db.run(
        'DELETE FROM activities WHERE id NOT IN (SELECT id FROM activities ORDER BY timestamp DESC LIMIT 50)',
        function(err) {
          if (err) return reject(err);
          resolve({ deleted: this.changes });
        }
      );
    });
  }

  // Chat
  getMessages(limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT ?',
        [limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.reverse());
        }
      );
    });
  }

  addMessage(fromUser, message) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO chat_messages (from_user, message) VALUES (?, ?)',
        [fromUser ? 1 : 0, message],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  getLastMessage() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM chat_messages ORDER BY timestamp DESC LIMIT 1',
        (err, row) => {
          if (err) return reject(err);
          resolve(row);
        }
      );
    });
  }

  markRead(lastId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE chat_messages SET read = 1 WHERE id <= ?',
        [lastId],
        function(err) {
          if (err) return reject(err);
          resolve({ marked: this.changes });
        }
      );
    });
  }

  getUnreadCount() {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM chat_messages WHERE from_user = 0 AND read = 0',
        (err, row) => {
          if (err) return reject(err);
          resolve(row.count);
        }
      );
    });
  }

  // Tasks
  getTasks() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM tasks ORDER BY created_at DESC', (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  createTask(id, title) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO tasks (id, title) VALUES (?, ?)',
        [id, title],
        function(err) {
          if (err) return reject(err);
          resolve({ id });
        }
      );
    });
  }

  updateTask(id, updates) {
    const allowed = ['status', 'started_at', 'completed_at'];
    const fields = Object.keys(updates)
      .filter(k => allowed.includes(k))
      .map(k => `${k} = ?`)
      .join(', ');
    const values = Object.keys(updates)
      .filter(k => allowed.includes(k))
      .map(k => updates[k]);
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE tasks SET ${fields} WHERE id = ?`,
        [...values, id],
        function(err) {
          if (err) return reject(err);
          resolve({ changed: this.changes });
        }
      );
    });
  }

  deleteTask(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM tasks WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes });
      });
    });
  }

  updateTaskExtended(id, updates) {
    const allowed = ['status', 'progress_percent', 'eta_timestamp', 'actual_cost', 'description', 'priority', 'assignee', 'tags'];
    const fields = Object.keys(updates)
      .filter(k => allowed.includes(k))
      .map(k => `${k} = ?`)
      .join(', ');
    const values = Object.keys(updates)
      .filter(k => allowed.includes(k))
      .map(k => {
        if (k === 'tags' && Array.isArray(updates[k])) {
          return JSON.stringify(updates[k]);
        }
        return updates[k];
      });
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE tasks SET ${fields} WHERE id = ?`,
        [...values, id],
        function(err) {
          if (err) return reject(err);
          resolve({ changed: this.changes });
        }
      );
    });
  }

  // Task Logs
  getTaskLogs(taskId, limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM task_logs WHERE task_id = ? ORDER BY timestamp DESC LIMIT ?',
        [taskId, limit],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  addTaskLog(taskId, level, message) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO task_logs (task_id, level, message) VALUES (?, ?, ?)',
        [taskId, level, message],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  // Task Events
  getTaskEvents(taskId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM task_events WHERE task_id = ? ORDER BY timestamp DESC',
        [taskId],
        (err, rows) => {
          if (err) return reject(err);
          resolve((rows || []).map(r => ({
            ...r,
            details: r.details ? JSON.parse(r.details) : null
          })));
        }
      );
    });
  }

  addTaskEvent(taskId, eventType, title, details = null) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO task_events (task_id, event_type, title, details) VALUES (?, ?, ?, ?)',
        [taskId, eventType, title, details ? JSON.stringify(details) : null],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  // Task Agents
  getTaskAgents(taskId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM task_agents WHERE task_id = ? ORDER BY started_at DESC',
        [taskId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  addTaskAgent(taskId, agentId, sessionKey) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO task_agents (task_id, agent_id, session_key) VALUES (?, ?, ?)',
        [taskId, agentId, sessionKey],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  updateTaskAgent(agentId, updates) {
    const fields = Object.keys(updates)
      .filter(k => ['status', 'completed_at', 'cost', 'started_at'].includes(k))
      .map(k => `${k} = ?`)
      .join(', ');
    const values = Object.keys(updates)
      .filter(k => ['status', 'completed_at', 'cost', 'started_at'].includes(k))
      .map(k => updates[k]);
    
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE task_agents SET ${fields} WHERE id = ?`,
        [...values, agentId],
        function(err) {
          if (err) return reject(err);
          resolve({ changed: this.changes });
        }
      );
    });
  }

  // Get full task with related data
  getFullTask(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM tasks WHERE id = ?',
        [id],
        async (err, task) => {
          if (err) return reject(err);
          if (!task) return resolve(null);
          
          try {
            const logs = await this.getTaskLogs(id, 10);
            const events = await this.getTaskEvents(id);
            const agents = await this.getTaskAgents(id);
            
            resolve({
              ...task,
              tags: task.tags ? JSON.parse(task.tags) : [],
              logs,
              events,
              agents
            });
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  }

  // Ideas
  getIdeas(status = null, limit = 20) {
    const query = status 
      ? 'SELECT * FROM ideas WHERE status = ? AND (snoozed_until IS NULL OR snoozed_until < datetime("now")) ORDER BY confidence DESC LIMIT ?'
      : 'SELECT * FROM ideas WHERE snoozed_until IS NULL OR snoozed_until < datetime("now") ORDER BY created_at DESC LIMIT ?';
    
    return new Promise((resolve, reject) => {
      const params = status ? [status, limit] : [limit];
      this.db.all(query, params, (err, rows) => {
        if (err) return reject(err);
        resolve((rows || []).map(r => ({
          ...r,
          tags: r.tags ? JSON.parse(r.tags) : [],
          metadata: r.metadata ? JSON.parse(r.metadata) : {}
        })));
      });
    });
  }

  addIdea(content, source = 'manual', confidence = 0.5, tags = []) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO ideas (content, source, confidence, tags) VALUES (?, ?, ?, ?)',
        [content, source, confidence, JSON.stringify(tags)],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  updateIdea(id, updates) {
    const allowed = ['status', 'snoozed_until', 'confidence'];
    const fields = Object.keys(updates).filter(k => allowed.includes(k)).map(k => `${k} = ?`).join(', ');
    const values = Object.keys(updates).filter(k => allowed.includes(k)).map(k => updates[k]);
    
    return new Promise((resolve, reject) => {
      this.db.run(`UPDATE ideas SET ${fields} WHERE id = ?`, [...values, id], function(err) {
        if (err) return reject(err);
        resolve({ changed: this.changes });
      });
    });
  }

  deleteIdea(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM ideas WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes });
      });
    });
  }

  // Journal
  getJournalEntry(date) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM journal_entries WHERE entry_date = ?', [date], async (err, entry) => {
        if (err) return reject(err);
        if (!entry) return resolve(null);
        
        try {
          const notes = await this.getJournalNotes(entry.id);
          resolve({ ...entry, notes });
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  createJournalEntry(date, summary = '', stats = {}) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT OR IGNORE INTO journal_entries (entry_date, title, summary, tasks_completed, commits, cost_today) VALUES (?, ?, ?, ?, ?, ?)',
        [date, `Daily Summary — ${date}`, summary, stats.tasks_completed || 0, stats.commits || 0, stats.cost_today || 0],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  // Journal Notes
  getJournalNotes(entryId) {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM journal_notes WHERE entry_id = ? ORDER BY created_at DESC', [entryId], (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  addJournalNote(entryId, noteText) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT INTO journal_notes (entry_id, note_text) VALUES (?, ?)', [entryId, noteText], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      });
    });
  }

  deleteJournalNote(noteId) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM journal_notes WHERE id = ?', [noteId], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes });
      });
    });
  }

  // Search
  searchJournal(query) {
    return new Promise((resolve, reject) => {
      const searchQuery = '%' + query + '%';
      this.db.all(
        'SELECT * FROM journal_entries WHERE title LIKE ? OR summary LIKE ? ORDER BY entry_date DESC',
        [searchQuery, searchQuery],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  // Cron Jobs
  getCronJobs() {
    return new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM cron_jobs ORDER BY created_at DESC', (err, rows) => {
        if (err) return reject(err);
        resolve(rows || []);
      });
    });
  }

  addCronJob(name, schedule, payload) {
    return new Promise((resolve, reject) => {
      this.db.run('INSERT INTO cron_jobs (name, schedule, payload) VALUES (?, ?, ?)', [name, schedule, payload], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID });
      });
    });
  }

  updateCronJob(id, updates) {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    return new Promise((resolve, reject) => {
      this.db.run(`UPDATE cron_jobs SET ${fields} WHERE id = ?`, [...values, id], function(err) {
        if (err) return reject(err);
        resolve({ changed: this.changes });
      });
    });
  }

  deleteCronJob(id) {
    return new Promise((resolve, reject) => {
      this.db.run('DELETE FROM cron_jobs WHERE id = ?', [id], function(err) {
        if (err) return reject(err);
        resolve({ deleted: this.changes });
      });
    });
  }

  // API Usage
  getApiUsage(startDate, endDate) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM api_usage WHERE usage_date BETWEEN ? AND ? ORDER BY usage_date DESC',
        [startDate, endDate],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        }
      );
    });
  }

  logApiUsage(model, tokensIn, tokensOut, cost) {
    const today = new Date().toISOString().split('T')[0];
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO api_usage (usage_date, model, requests, tokens_in, tokens_out, cost) VALUES (?, ?, 1, ?, ?, ?) ON CONFLICT(usage_date, model) DO UPDATE SET requests=requests+1, tokens_in=tokens_in+?, tokens_out=tokens_out+?, cost=cost+?',
        [today, model, tokensIn, tokensOut, cost, tokensIn, tokensOut, cost],
        function(err) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        }
      );
    });
  }

  getBudgetStatus() {
    return new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      this.db.get('SELECT SUM(cost) as daily_cost FROM api_usage WHERE usage_date = ?', [today], (err, dailyRow) => {
        if (err) return reject(err);
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        const monthStart = startOfMonth.toISOString().split('T')[0];
        this.db.get('SELECT SUM(cost) as monthly_cost FROM api_usage WHERE usage_date >= ?', [monthStart], (err, monthlyRow) => {
          if (err) return reject(err);
          resolve({
            daily: { used: dailyRow.daily_cost || 0, limit: 5.0 },
            monthly: { used: monthlyRow.monthly_cost || 0, limit: 200.0 }
          });
        });
      });
    });
  }
}

module.exports = new Database();