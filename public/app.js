// Mission Control v3 - Frontend
const API_URL = window.location.origin;
let ws = null;
let currentView = 'overview';
let unreadCount = 0;

// DOM Elements
const views = {
  overview: document.getElementById('overview'),
  workshop: document.getElementById('workshop'),
  intelligence: document.getElementById('intelligence'),
  journal: document.getElementById('journal'),
  cron: document.getElementById('cron'),
  api_usage: document.getElementById('api_usage'),
  chat: document.getElementById('chat')
};

const quickAdd = document.getElementById('quick-add');
const taskList = document.getElementById('task-list');
const filterBar = document.getElementById('filter-bar');
const ideasList = document.getElementById('ideas-list');
const ideasFilterBar = document.getElementById('ideas-filter-bar');
const journalDate = document.getElementById('journal-date');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');
const noteInput = document.getElementById('note-input');
const noteAddBtn = document.getElementById('note-add-btn');
const notesList = document.getElementById('notes-list');

let tasks = [];
let currentFilter = 'all';
let ideas = [];
let currentIdeaFilter = 'pending';
let currentJournalDate = new Date().toISOString().split('T')[0];

const navBtns = document.querySelectorAll('.nav-btn');
const chatBadge = document.getElementById('chat-badge');
const connectionStatus = document.getElementById('connection-status');
const messagesList = document.getElementById('messages-list');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');

// Initialize
async function init() {
  setupNavigation();
  setupChat();
  setupWorkshop();
  setupIntelligence();
  setupJournal();
  connectWebSocket();
  
  // Load initial data
  await loadDashboard();
  await loadActivities();
  await loadMessages();
  await loadTasks();
  await loadIdeas();
  await loadJournal(currentJournalDate);
  
  // Poll dashboard every 10 seconds
  setInterval(loadDashboard, 10000);
  setInterval(loadActivities, 10000);
  setInterval(loadTasks, 15000);
  setInterval(() => loadIdeas(), 20000);
}

// Navigation
function setupNavigation() {
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      switchView(view);
      
      // Clear chat badge when opening chat
      if (view === 'chat') {
        unreadCount = 0;
        updateBadge();
        markMessagesRead();
      }
    });
  });
}

function switchView(view) {
  currentView = view;
  
  // Update nav buttons
  navBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  // Update views
  Object.keys(views).forEach(key => {
    views[key].classList.toggle('active', key === view);
  });
}

// WebSocket
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
    updateConnectionStatus('connected');
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
    updateConnectionStatus('disconnected');
    // Reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };
  
  ws.onerror = (err) => {
    console.error('WebSocket error:', err);
    updateConnectionStatus('disconnected');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleWebSocketMessage(data);
  };
}

function handleWebSocketMessage(data) {
  switch (data.type) {
    case 'connected':
      updateConnectionStatus('connected');
      break;
      
    case 'chat':
      addMessageToUI(data);
      if (currentView !== 'chat' && data.from_user === 0) {
        unreadCount++;
        updateBadge();
      }
      break;
      
    case 'activity':
      addActivityToUI(data.activity);
      break;
      
    case 'status_update':
      updateDashboard(data.data);
      break;
      
    case 'typing':
      if (data.from_user === 0) {
        typingIndicator.style.display = data.is_typing ? 'flex' : 'none';
      }
      break;
  }
}

function updateConnectionStatus(status) {
  const statuses = {
    connected: 'Bert is online',
    connecting: 'Connecting...',
    disconnected: 'Disconnected'
  };
  
  connectionStatus.textContent = statuses[status];
  connectionStatus.className = 'connection-status ' + status;
}

// Dashboard
async function loadDashboard() {
  try {
    const res = await fetch(`${API_URL}/api/dashboard`);
    const data = await res.json();
    updateDashboard(data);
  } catch (err) {
    console.error('Failed to load dashboard:', err);
  }
}

function updateDashboard(data) {
  // Cost
  document.getElementById('cost-today').textContent = `$${data.cost_today.toFixed(2)}`;
  document.getElementById('cost-total').textContent = `$${data.cost_total.toFixed(2)}`;
  
  const progress = Math.min((data.cost_today / 5) * 100, 100);
  document.getElementById('cost-progress').style.width = `${progress}%`;
  
  // Trading
  document.getElementById('trading-equity').textContent = `$${data.trading.equity.toLocaleString()}`;
  document.getElementById('trading-positions').textContent = data.trading.positions;
  
  const statusEl = document.getElementById('trading-status');
  statusEl.textContent = data.trading.status.charAt(0).toUpperCase() + data.trading.status.slice(1);
  statusEl.classList.toggle('active', data.trading.status === 'active');
  
  // Tasks
  document.getElementById('tasks-queued').textContent = data.task_summary.queued;
  document.getElementById('tasks-active').textContent = data.task_summary.active;
  document.getElementById('tasks-completed').textContent = data.task_summary.completed;
}

// Activities
async function loadActivities() {
  try {
    const res = await fetch(`${API_URL}/api/activities`);
    const activities = await res.json();
    renderActivities(activities);
  } catch (err) {
    console.error('Failed to load activities:', err);
  }
}

function renderActivities(activities) {
  const list = document.getElementById('activity-list');
  
  if (activities.length === 0) {
    list.innerHTML = '<div class="activity-empty">No recent activity</div>';
    return;
  }
  
  list.innerHTML = activities.map(a => `
    <div class="activity-item" data-id="${a.id}">
      <span class="activity-icon">${a.icon || getDefaultIcon(a.type)}</span>
      <div class="activity-content">
        <div class="activity-title">${escapeHtml(a.title)}</div>
        <div class="activity-desc">${escapeHtml(a.description || '')}</div>
      </div>
      <span class="activity-time">${formatTime(a.timestamp)}</span>
    </div>
  `).join('');
}

function addActivityToUI(activity) {
  const list = document.getElementById('activity-list');
  
  // Remove empty state
  if (list.querySelector('.activity-empty')) {
    list.innerHTML = '';
  }
  
  const item = document.createElement('div');
  item.className = 'activity-item';
  item.style.animation = 'fadeIn 0.3s ease';
  item.innerHTML = `
    <span class="activity-icon">${activity.icon || getDefaultIcon(activity.type)}</span>
    <div class="activity-content">
      <div class="activity-title">${escapeHtml(activity.title)}</div>
      <div class="activity-desc">${escapeHtml(activity.description || '')}</div>
    </div>
    <span class="activity-time">${formatTime(activity.timestamp)}</span>
  `;
  
  list.insertBefore(item, list.firstChild);
  
  // Keep only last 20
  while (list.children.length > 20) {
    list.removeChild(list.lastChild);
  }
}

function getDefaultIcon(type) {
  const icons = {
    git: '📝',
    task: '✅',
    cost: '💰',
    trade: '📈',
    command: '⌨️',
    system: '⚙️'
  };
  return icons[type] || '•';
}

// Chat
function setupChat() {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
      sendMessage();
    }
  });
  
  chatInput.addEventListener('input', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing', is_typing: true }));
      clearTimeout(window.typingTimeout);
      window.typingTimeout = setTimeout(() => {
        ws.send(JSON.stringify({ type: 'typing', is_typing: false }));
      }, 1000);
    }
  });
  
  sendBtn.addEventListener('click', () => {
    if (chatInput.value.trim()) {
      sendMessage();
    }
  });
}

async function loadMessages() {
  try {
    const res = await fetch(`${API_URL}/api/chat`);
    const messages = await res.json();
    renderMessages(messages);
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

function renderMessages(messages) {
  if (messages.length === 0) {
    messagesList.innerHTML = `
      <div class="chat-empty">
        <span class="empty-icon">💬</span>
        <p>Start a conversation</p>
        <span class="empty-hint">Send a message to connect with Bert</span>
      </div>
    `;
    return;
  }
  
  messagesList.innerHTML = messages.map(m => `
    <div class="message ${m.from_user ? 'user' : 'bert'}">
      <div class="message-bubble">
        ${escapeHtml(m.message)}
        <div class="message-time">${formatTime(m.timestamp)}</div>
      </div>
    </div>
  `).join('');
  
  scrollToBottom();
}

function addMessageToUI(msg) {
  const emptyState = messagesList.querySelector('.chat-empty');
  if (emptyState) {
    emptyState.remove();
  }
  
  const div = document.createElement('div');
  div.className = `message ${msg.from_user ? 'user' : 'bert'}`;
  div.innerHTML = `
    <div class="message-bubble">
      ${escapeHtml(msg.message)}
      <div class="message-time">${formatTime(msg.timestamp)}</div>
    </div>
  `;
  
  messagesList.appendChild(div);
  scrollToBottom();
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  
  chatInput.value = '';
  
  // Send via WebSocket if connected
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'chat', message: text }));
  } else {
    // Fallback to HTTP
    try {
      await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      loadMessages();
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  }
}

async function markMessagesRead() {
  try {
    const res = await fetch(`${API_URL}/api/chat`);
    const messages = await res.json();
    const lastId = messages[messages.length - 1]?.id;
    if (lastId) {
      await fetch(`${API_URL}/api/chat/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_id: lastId })
      });
    }
  } catch (err) {
    console.error('Failed to mark read:', err);
  }
}

function scrollToBottom() {
  messagesList.scrollTop = messagesList.scrollHeight;
}

function updateBadge() {
  chatBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
  chatBadge.classList.toggle('show', unreadCount > 0);
}

// Utilities
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString();
}

// Intelligence
function setupIntelligence() {
  document.getElementById('scan-btn').addEventListener('click', async () => {
    await loadIdeas();
  });
  
  ideasFilterBar.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-tag')) {
      document.querySelectorAll('#ideas-filter-bar .filter-tag').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentIdeaFilter = e.target.dataset.filter;
      renderIdeas();
    }
  });
}

async function loadIdeas() {
  try {
    const res = await fetch(`${API_URL}/api/ideas?status=${currentIdeaFilter}`);
    ideas = await res.json();
    renderIdeas();
  } catch (err) {
    console.error('Failed to load ideas:', err);
  }
}

function renderIdeas() {
  if (ideas.length === 0) {
    ideasList.innerHTML = '<div class="task-empty">No ideas yet. They\'ll appear as they\'re scanned.</div>';
    return;
  }
  
  ideasList.innerHTML = ideas.map(idea => `
    <div class="idea-card" data-id="${idea.id}">
      <div class="idea-header">
        <span class="confidence-badge">⭐ ${Math.round(idea.confidence * 100)}%</span>
        <span class="source-badge">${idea.source}</span>
      </div>
      <p class="idea-content">${escapeHtml(idea.content)}</p>
      ${idea.tags && idea.tags.length ? `<div class="idea-tags">${idea.tags.map(t => `<span class="idea-tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="idea-actions">
        <button onclick="updateIdea(${idea.id}, 'implementing')">Implement</button>
        <button onclick="updateIdea(${idea.id}, 'later')">Later</button>
        <button onclick="deleteIdea(${idea.id})">Dismiss</button>
      </div>
    </div>
  `).join('');
}

async function updateIdea(id, status) {
  try {
    await fetch(`${API_URL}/api/ideas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    await loadIdeas();
  } catch (err) {
    console.error('Failed to update idea:', err);
  }
}

async function deleteIdea(id) {
  try {
    await fetch(`${API_URL}/api/ideas/${id}`, { method: 'DELETE' });
    await loadIdeas();
  } catch (err) {
    console.error('Failed to delete idea:', err);
  }
}

// Journal
function setupJournal() {
  journalDate.value = currentJournalDate;
  journalDate.addEventListener('change', (e) => {
    currentJournalDate = e.target.value;
    loadJournal(currentJournalDate);
  });
  
  prevDayBtn.addEventListener('click', () => {
    const d = new Date(currentJournalDate);
    d.setDate(d.getDate() - 1);
    currentJournalDate = d.toISOString().split('T')[0];
    journalDate.value = currentJournalDate;
    loadJournal(currentJournalDate);
  });
  
  nextDayBtn.addEventListener('click', () => {
    const d = new Date(currentJournalDate);
    d.setDate(d.getDate() + 1);
    currentJournalDate = d.toISOString().split('T')[0];
    journalDate.value = currentJournalDate;
    loadJournal(currentJournalDate);
  });
  
  noteAddBtn.addEventListener('click', async () => {
    if (noteInput.value.trim()) {
      try {
        await fetch(`${API_URL}/api/journal/${currentJournalDate}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note_text: noteInput.value })
        });
        noteInput.value = '';
        await loadJournal(currentJournalDate);
      } catch (err) {
        console.error('Failed to add note:', err);
      }
    }
  });
}

async function loadJournal(date) {
  try {
    const res = await fetch(`${API_URL}/api/journal/${date}`);
    const entry = await res.json();
    document.getElementById('current-date').textContent = new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('entry-title').textContent = entry.title || 'Daily Summary';
    document.getElementById('entry-summary').textContent = entry.summary || 'No summary yet';
    document.getElementById('stat-tasks').textContent = entry.tasks_completed || 0;
    document.getElementById('stat-commits').textContent = entry.commits || 0;
    document.getElementById('stat-cost').textContent = (entry.cost_today || 0).toFixed(2);
    
    const notes = entry.notes || [];
    notesList.innerHTML = notes.length 
      ? notes.map(n => `<div class="note-item"><div class="note-text">${escapeHtml(n.note_text)}</div><div class="note-time">${formatTime(n.created_at)}</div></div>`).join('')
      : '<div class="notes-empty">No notes yet</div>';
  } catch (err) {
    console.error('Failed to load journal:', err);
  }
}

// Workshop
function setupWorkshop() {
  quickAdd.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && quickAdd.value.trim()) {
      createTask(quickAdd.value.trim());
      quickAdd.value = '';
    }
  });
  
  filterBar.addEventListener('click', (e) => {
    if (e.target.classList.contains('filter-tag')) {
      document.querySelectorAll('.filter-tag').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderTasks();
    }
  });
}

async function loadTasks() {
  try {
    const res = await fetch(`${API_URL}/api/tasks`);
    tasks = await res.json();
    renderTasks();
  } catch (err) {
    console.error('Failed to load tasks:', err);
  }
}

function renderTasks() {
  const filtered = currentFilter === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === currentFilter);
  
  if (filtered.length === 0) {
    taskList.innerHTML = '<div class="task-empty">No tasks yet. Create one to get started!</div>';
    return;
  }
  
  taskList.innerHTML = filtered.map(task => `
    <div class="task-card" data-id="${escapeHtml(task.id)}" onclick="openTaskDetail('${escapeHtml(task.id)}')">
      <div class="task-header">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        <span class="priority-badge ${task.priority || 'normal'}">${(task.priority || 'Normal').charAt(0).toUpperCase() + (task.priority || 'normal').slice(1)}</span>
      </div>
      <div class="task-progress">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${task.progress_percent || 0}%"></div>
        </div>
        <div class="progress-labels">
          <span>${task.progress_percent || 0}%</span>
          <span class="eta">${formatEta(task.eta_timestamp)}</span>
        </div>
      </div>
      <div class="task-meta">
        <span class="status-badge ${task.status}">${(task.status || 'queued').charAt(0).toUpperCase() + (task.status || 'queued').slice(1)}</span>
        <span class="cost">$${(task.actual_cost || 0).toFixed(2)} / $${(task.estimated_cost || 0).toFixed(2)}</span>
        ${task.assignee ? `<span>${escapeHtml(task.assignee)}</span>` : ''}
      </div>
      ${task.tags && task.tags.length ? `<div class="task-tags">${task.tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>` : ''}
    </div>
  `).join('');
}

async function createTask(title) {
  try {
    const res = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const task = await res.json();
    tasks.push(task);
    renderTasks();
    
    // Broadcast
    broadcast({
      type: 'activity',
      activity: {
        type: 'task',
        icon: '✅',
        title: 'Task created',
        description: title,
        timestamp: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('Failed to create task:', err);
  }
}

function openTaskDetail(taskId) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return;
  alert(`Task: ${task.title}\nStatus: ${task.status}\nProgress: ${task.progress_percent}%`);
}

function formatEta(etaTs) {
  if (!etaTs) return 'No ETA';
  const eta = new Date(etaTs);
  const now = new Date();
  const diff = eta - now;
  if (diff < 0) return 'Overdue';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

// Start
init();