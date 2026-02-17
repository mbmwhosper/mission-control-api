// Extended database methods for Session 2 (Workshop)
// Add these to database.js

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

// Task Events (Timeline)
getTaskEvents(taskId) {
  return new Promise((resolve, reject) => {
    this.db.all(
      'SELECT * FROM task_events WHERE task_id = ? ORDER BY timestamp DESC',
      [taskId],
      (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(r => ({
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

// Task Agents (Subagent spawning)
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
    .filter(k => ['status', 'completed_at', 'cost'].includes(k))
    .map(k => `${k} = ?`)
    .join(', ');
  
  const values = Object.keys(updates)
    .filter(k => ['status', 'completed_at', 'cost'].includes(k))
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

// Extended Task Methods
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
            metadata: task.metadata ? JSON.parse(task.metadata) : {},
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

extendedUpdateTask(id, updates) {
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