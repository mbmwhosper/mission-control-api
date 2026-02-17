const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const crypto = require('crypto');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// WebSocket clients
const clients = new Set();

// Broadcast to all clients
function broadcast(data, exclude = null) {
  const msg = JSON.stringify(data);
  clients.forEach(client => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// WebSocket handling
wss.on('connection', (ws, req) => {
  clients.add(ws);
  console.log('Client connected, total:', clients.size);
  
  // Send connection confirmation
  ws.send(JSON.stringify({ type: 'connected', clients: clients.size }));
  
  // Broadcast user joined
  broadcast({ type: 'clients', count: clients.size }, ws);

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      
      switch (msg.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
          
        case 'typing':
          broadcast({ type: 'typing', from_user: 1, is_typing: msg.is_typing }, ws);
          break;
          
        case 'chat':
          const result = await db.addMessage(true, msg.message);
          const newMsg = await db.getLastMessage();
          broadcast({
            type: 'chat',
            id: newMsg.id,
            from_user: 1,
            message: newMsg.message,
            timestamp: newMsg.timestamp
          });
          break;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('Client disconnected, total:', clients.size);
    broadcast({ type: 'clients', count: clients.size });
  });
});

// API Routes

// Dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    const data = await db.getDashboard();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activities
app.get('/api/activities', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const activities = await db.getActivities(limit);
    res.json(activities);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/activities', async (req, res) => {
  try {
    const { type, icon, title, description, metadata } = req.body;
    const result = await db.addActivity({ type, icon, title, description, metadata });
    await db.pruneActivities();
    
    // Broadcast new activity
    const activity = {
      id: result.id,
      type,
      icon,
      title,
      description,
      metadata,
      timestamp: new Date().toISOString()
    };
    broadcast({ type: 'activity', activity });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chat
app.get('/api/chat', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const messages = await db.getMessages(limit);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;
    await db.addMessage(true, message);
    const newMsg = await db.getLastMessage();
    
    broadcast({
      type: 'chat',
      id: newMsg.id,
      from_user: 1,
      message: newMsg.message,
      timestamp: newMsg.timestamp
    });
    
    res.json(newMsg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat/read', async (req, res) => {
  try {
    const { last_id } = req.body;
    const result = await db.markRead(last_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chat/unread', async (req, res) => {
  try {
    const count = await db.getUnreadCount();
    res.json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Tasks
app.get('/api/tasks', async (req, res) => {
  try {
    const tasks = await db.getTasks();
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks', async (req, res) => {
  try {
    const { title } = req.body;
    const id = crypto.randomUUID();
    await db.createTask(id, title);
    res.json({ id, title, status: 'queued' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.status === 'active') updates.started_at = new Date().toISOString();
    if (req.body.status === 'completed' || req.body.status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    
    await db.updateTask(id, updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    await db.deleteTask(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Extended task endpoints for Session 2
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await db.getFullTask(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.progress_percent !== undefined) updates.progress_percent = req.body.progress_percent;
    if (req.body.eta_timestamp) updates.eta_timestamp = req.body.eta_timestamp;
    if (req.body.actual_cost !== undefined) updates.actual_cost = req.body.actual_cost;
    if (req.body.description) updates.description = req.body.description;
    if (req.body.priority) updates.priority = req.body.priority;
    if (req.body.assignee) updates.assignee = req.body.assignee;
    
    if (req.body.status === 'active' && !updates.started_at) updates.started_at = new Date().toISOString();
    if (req.body.status === 'completed' || req.body.status === 'failed') {
      updates.completed_at = new Date().toISOString();
    }
    
    await db.updateTaskExtended(id, updates);
    
    // Broadcast update
    const task = await db.getFullTask(id);
    broadcast({
      type: 'task_update',
      task_id: id,
      updates: task
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Task logs
app.get('/api/tasks/:id/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await db.getTaskLogs(req.params.id, limit);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/logs', async (req, res) => {
  try {
    const { level, message } = req.body;
    const result = await db.addTaskLog(req.params.id, level || 'info', message);
    
    // Broadcast new log
    broadcast({
      type: 'task_log',
      task_id: req.params.id,
      log: {
        id: result.id,
        level: level || 'info',
        message,
        timestamp: new Date().toISOString()
      }
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Task timeline/events
app.get('/api/tasks/:id/timeline', async (req, res) => {
  try {
    const events = await db.getTaskEvents(req.params.id);
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/timeline', async (req, res) => {
  try {
    const { event_type, title, details } = req.body;
    const result = await db.addTaskEvent(req.params.id, event_type, title, details);
    
    // Broadcast event
    broadcast({
      type: 'task_event',
      task_id: req.params.id,
      event: {
        id: result.id,
        event_type,
        title,
        timestamp: new Date().toISOString()
      }
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Task agents (subagent management)
app.get('/api/tasks/:id/agents', async (req, res) => {
  try {
    const agents = await db.getTaskAgents(req.params.id);
    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tasks/:id/spawn-agent', async (req, res) => {
  try {
    const { agent_id, session_key } = req.body;
    const result = await db.addTaskAgent(req.params.id, agent_id, session_key);
    
    // Broadcast agent spawned
    broadcast({
      type: 'task_agent',
      task_id: req.params.id,
      agent: {
        id: result.id,
        agent_id,
        session_key,
        status: 'pending',
        started_at: null
      }
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Ideas (Session 3)
app.get('/api/ideas', async (req, res) => {
  try {
    const status = req.query.status;
    const limit = parseInt(req.query.limit) || 20;
    const ideas = await db.getIdeas(status, limit);
    res.json(ideas);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ideas', async (req, res) => {
  try {
    const { content, source, confidence, tags } = req.body;
    const result = await db.addIdea(content, source || 'manual', confidence || 0.5, tags || []);
    
    broadcast({
      type: 'idea_scanned',
      idea: {
        id: result.id,
        content,
        source: source || 'manual',
        confidence: confidence || 0.5,
        timestamp: new Date().toISOString()
      }
    });
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/ideas/:id', async (req, res) => {
  try {
    const updates = {};
    if (req.body.status) updates.status = req.body.status;
    if (req.body.snoozed_until) updates.snoozed_until = req.body.snoozed_until;
    if (req.body.confidence !== undefined) updates.confidence = req.body.confidence;
    
    await db.updateIdea(req.params.id, updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/ideas/:id', async (req, res) => {
  try {
    await db.deleteIdea(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Journal (Session 3)
app.get('/api/journal/:date', async (req, res) => {
  try {
    let entry = await db.getJournalEntry(req.params.date);
    if (!entry) {
      await db.createJournalEntry(req.params.date);
      entry = await db.getJournalEntry(req.params.date);
    }
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/journal/:date/notes', async (req, res) => {
  try {
    const { note_text } = req.body;
    let entry = await db.getJournalEntry(req.params.date);
    if (!entry) {
      await db.createJournalEntry(req.params.date);
      entry = await db.getJournalEntry(req.params.date);
    }
    
    const result = await db.addJournalNote(entry.id, note_text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/journal/:date/notes/:note_id', async (req, res) => {
  try {
    await db.deleteJournalNote(req.params.note_id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.json([]);
    
    const results = await db.searchJournal(query);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cron Jobs (Session 4)
app.get('/api/cron', async (req, res) => {
  try {
    const jobs = await db.getCronJobs();
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cron', async (req, res) => {
  try {
    const { name, schedule, payload } = req.body;
    const result = await db.addCronJob(name, schedule, JSON.stringify(payload || {}));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/cron/:id', async (req, res) => {
  try {
    const { schedule, enabled, name } = req.body;
    const updates = {};
    if (schedule) updates.schedule = schedule;
    if (name) updates.name = name;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    await db.updateCronJob(req.params.id, updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/cron/:id', async (req, res) => {
  try {
    await db.deleteCronJob(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/cron/:id/run', async (req, res) => {
  try {
    const jobs = await db.getCronJobs();
    const job = jobs.find(j => j.id == req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    // Update last_run
    await db.updateCronJob(job.id, { last_run: new Date().toISOString() });
    
    // Broadcast execution
    broadcast({ type: 'cron_executed', job_id: job.id, result: 'success' });
    res.json({ executed: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API Usage (Session 4)
app.get('/api/api-usage', async (req, res) => {
  try {
    const start = req.query.start || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const end = req.query.end || new Date().toISOString().split('T')[0];
    const usage = await db.getApiUsage(start, end);
    res.json(usage);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/budget-status', async (req, res) => {
  try {
    const budget = await db.getBudgetStatus();
    res.json(budget);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/api-usage/log', async (req, res) => {
  try {
    const { model, tokens_in, tokens_out, cost } = req.body;
    await db.logApiUsage(model, tokens_in || 0, tokens_out || 0, cost || 0);
    
    // Broadcast usage update
    broadcast({
      type: 'api_usage_update',
      data: { model, tokens_in, tokens_out, cost }
    });
    
    res.json({ logged: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sync endpoint (for local agent)
app.post('/api/sync', async (req, res) => {
  try {
    const { costs, activities: newActivities } = req.body;
    
    if (costs) {
      await db.updateStatus({
        openclaw_cost_today: costs.today,
        openclaw_cost_total: costs.total
      });
    }
    
    if (newActivities && Array.isArray(newActivities)) {
      for (const activity of newActivities) {
        await db.addActivity(activity);
      }
      await db.pruneActivities();
    }
    
    // Broadcast updates
    const dashboard = await db.getDashboard();
    broadcast({ type: 'status_update', data: dashboard });
    
    res.json({ synced: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', clients: clients.size });
});

// Start server
server.listen(PORT, () => {
  console.log(`Mission Control API running on port ${PORT}`);
});