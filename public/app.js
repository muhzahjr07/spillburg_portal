// Spillburg Holdings Master Portal - Client Application (Executive Light Theme)
let currentUser = null;
let authToken = localStorage.getItem('spillburg_token') || '';

// App State
let operationsTasks = [];
let customerRecords = [];
let financialRecords = [];
let usersList = [];
let operationsStats = {};
let customerStats = {};
let currentView = 'dashboard';
let customerCupboardFilter = 'All';
let customerViewMode = 'table'; // 'table' or 'boxes'
let operationsViewMode = 'table'; // 'table' or 'kanban'
let operationsUserFilter = 'me'; // 'me', 'all', or specific userId

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  if (authToken) {
    const ok = await checkAuth();
    if (ok) {
      showPortalWorkspace();
      await loadInitialData();
      switchView('dashboard');
      return;
    }
  }
  // Launch to Login / Register Screen by default
  showAuthScreen();
});

// ================= AUTHENTICATION & RBAC =================
function showAuthScreen() {
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('portalWorkspace').classList.add('hidden');
  if (window.lucide) lucide.createIcons();
}

function showPortalWorkspace() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('portalWorkspace').classList.remove('hidden');
  updateUserUI();
  if (window.lucide) lucide.createIcons();
}

function showAuthError(msg) {
  const errBox = document.getElementById('authErrorBox');
  const errMsg = document.getElementById('authErrorMsg');
  if (errMsg && errBox) {
    errMsg.textContent = msg;
    errBox.classList.remove('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  await loginAs(username, password);
}

async function checkAuth() {
  if (!authToken) return false;
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      return true;
    }
  } catch (e) {
    console.warn('Auth check failed:', e);
  }
  return false;
}

async function loginAs(username, password) {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      authToken = data.token;
      localStorage.setItem('spillburg_token', authToken);
      currentUser = data.user;
      showPortalWorkspace();
      await loadInitialData();
      switchView(currentView || 'dashboard');
      return true;
    } else {
      showAuthError(data.error || 'Invalid credentials');
      return false;
    }
  } catch (e) {
    showAuthError('Unable to connect to portal server');
    return false;
  }
}

async function handleLogout() {
  if (authToken) {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
    } catch (e) {}
  }
  localStorage.removeItem('spillburg_token');
  authToken = '';
  currentUser = null;
  operationsTasks = [];
  customerRecords = [];
  financialRecords = [];
  showAuthScreen();
}

function updateUserUI() {
  if (!currentUser) return;
  
  document.getElementById('userNameDisplay').textContent = currentUser.fullName || currentUser.username;
  
  const roleBadge = document.getElementById('userRoleBadge');
  const avatar = document.getElementById('userAvatar');
  
  avatar.textContent = (currentUser.fullName || currentUser.username)[0].toUpperCase();

  const role = currentUser.role.toLowerCase();
  if (role === 'director') {
    roleBadge.textContent = 'DIRECTOR · FULL ACCESS';
    roleBadge.className = 'text-[10px] font-semibold leading-none text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200';
    avatar.className = 'w-6 h-6 rounded-full bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-bold text-xs';
  } else if (role === 'admin') {
    roleBadge.textContent = 'ADMIN · ACCESS CONTROLLER';
    roleBadge.className = 'text-[10px] font-semibold leading-none text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200';
    avatar.className = 'w-6 h-6 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 flex items-center justify-center font-bold text-xs';
  } else {
    // Staff
    const opsPerm = currentUser.permissions?.operations || 'viewer';
    roleBadge.textContent = `STAFF · ${opsPerm.toUpperCase()}`;
    roleBadge.className = 'text-[10px] font-semibold leading-none text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200';
    avatar.className = 'w-6 h-6 rounded-full bg-indigo-100 border border-indigo-300 text-indigo-800 flex items-center justify-center font-bold text-xs';
  }

  if (window.lucide) lucide.createIcons();
}

function canEdit(module) {
  if (!currentUser) return false;
  if (['director', 'admin'].includes(currentUser.role)) return true;
  const perm = currentUser.permissions?.[module];
  return perm === 'editor' || perm === 'full';
}

function canView(module) {
  if (!currentUser) return false;
  if (['director', 'admin'].includes(currentUser.role)) return true;
  const perm = currentUser.permissions?.[module];
  return ['viewer', 'editor', 'full'].includes(perm);
}

function isAdmin() {
  return currentUser && currentUser.role === 'admin';
}

// ================= DATA LOADING =================
async function loadInitialData() {
  if (!authToken) return;
  try {
    const headers = { 'Authorization': `Bearer ${authToken}` };

    const opsUrl = operationsUserFilter && operationsUserFilter !== 'me' ? `/api/operations?forUser=${encodeURIComponent(operationsUserFilter)}` : '/api/operations';
    const statsUrl = operationsUserFilter && operationsUserFilter !== 'me' ? `/api/operations/stats?forUser=${encodeURIComponent(operationsUserFilter)}` : '/api/operations/stats';

    const [opsRes, custRes, finRes, statsRes] = await Promise.all([
      fetch(opsUrl, { headers }).then(r => r.ok ? r.json() : { tasks: [] }),
      fetch('/api/customer-files', { headers }).then(r => r.ok ? r.json() : { records: [] }),
      fetch('/api/financial-files', { headers }).then(r => r.ok ? r.json() : { records: [] }),
      fetch(statsUrl, { headers }).then(r => r.ok ? r.json() : {})
    ]);

    operationsTasks = opsRes.tasks || [];
    customerRecords = custRes.records || [];
    financialRecords = finRes.records || [];
    operationsStats = statsRes || {};

    // Update sidebar counters
    document.getElementById('navOpsCount').textContent = operationsTasks.length;
    document.getElementById('navCustomerCount').textContent = customerRecords.length;
    document.getElementById('navFinCount').textContent = financialRecords.length;
  } catch (e) {
    console.error('Initial data load failed:', e);
  }
}

// ================= VIEW SWITCHING =================
function switchView(viewName) {
  currentView = viewName;
  
  // Update sidebar buttons styling for Light Theme
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.className = 'nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left text-slate-600 hover:bg-slate-50 hover:text-slate-900';
  });
  const activeBtn = document.getElementById(`nav-${viewName}`);
  if (activeBtn) {
    activeBtn.className = 'nav-btn w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left bg-emerald-50 text-emerald-700 border border-emerald-200';
  }

  const container = document.getElementById('mainContent');
  container.innerHTML = '';

  switch (viewName) {
    case 'dashboard':
      renderDashboard(container);
      break;
    case 'operations':
      renderOperations(container);
      break;
    case 'customer-files':
      renderCustomerFiles(container);
      break;
    case 'financial-files':
      renderFinancialFiles(container);
      break;
    case 'access-control':
      renderAccessControl(container);
      break;
    default:
      renderDashboard(container);
  }

  if (window.lucide) lucide.createIcons();
}

// ================= 1. EXECUTIVE DASHBOARD (LIGHT THEME) =================
function renderDashboard(container) {
  const totalOps = operationsTasks.length;
  const completedOps = operationsTasks.filter(t => t.status === 'Completed').length;
  const inProgressOps = operationsTasks.filter(t => t.status === 'In Progress').length;
  const pendingOps = operationsTasks.filter(t => t.status === 'Pending').length;
  const pctOps = totalOps ? Math.round((completedOps / totalOps) * 100) : 0;

  const totalCust = customerRecords.length;
  const origCust = customerRecords.filter(r => (r.Type || '').toLowerCase().includes('original')).length;
  const copyCust = customerRecords.filter(r => (r.Type || '').toLowerCase().includes('copy')).length;
  const totalFin = financialRecords.length;

  container.innerHTML = `
    <div class="space-y-6 fade-in">
      
      <!-- Welcome Hero Banner -->
      <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 md:p-8 shadow-lg">
        <div class="relative z-10 max-w-3xl space-y-3">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 border border-white/20 text-xs font-semibold text-emerald-100">
            <span class="w-2 h-2 rounded-full bg-emerald-300 animate-ping"></span>
            Enterprise Portal Active
          </div>
          <h1 class="font-display text-2xl md:text-3xl font-bold tracking-tight">
            Welcome, <span>${currentUser ? currentUser.fullName : 'Executive'}</span>
          </h1>
          <p class="text-sm md:text-base text-emerald-100/90 leading-relaxed">
            Spillburg Holdings enterprise portal integrating your personalized Operations Tracker, 
            Customer File archives (<span class="font-mono text-xs bg-black/20 px-1.5 py-0.5 rounded">Customer_Files_Active.accdb</span>), 
            and digitized client financial tax registers.
          </p>
          <div class="pt-2 flex flex-wrap items-center gap-3">
            <button onclick="switchView('operations')" class="px-4 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-semibold text-xs md:text-sm flex items-center gap-2 transition shadow-md">
              <i data-lucide="check-square" class="w-4 h-4 text-emerald-600"></i> My Operations Tracker
            </button>
            <button onclick="switchView('customer-files')" class="px-4 py-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 text-white border border-white/20 font-medium text-xs md:text-sm flex items-center gap-2 transition">
              <i data-lucide="folder-archive" class="w-4 h-4 text-amber-300"></i> Customer Files DB
            </button>
            <button onclick="switchView('financial-files')" class="px-4 py-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 text-white border border-white/20 font-medium text-xs md:text-sm flex items-center gap-2 transition">
              <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-300"></i> Financial Files DB
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <!-- Ops Card (Personal) -->
        <div class="glass-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">My Operations</span>
            <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <i data-lucide="activity" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-3xl font-display font-bold text-slate-900">${completedOps} <span class="text-sm font-normal text-slate-500">/ ${totalOps} Done</span></div>
            <div class="mt-2 w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div class="bg-blue-600 h-full rounded-full transition-all duration-500" style="width: ${pctOps}%"></div>
            </div>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2 font-medium">
            <span>${pendingOps} Pending &middot; ${inProgressOps} Active</span>
            <span class="text-blue-600 font-bold">${pctOps}%</span>
          </div>
        </div>

        <!-- Customer Files Card -->
        <div class="glass-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer Files</span>
            <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <i data-lucide="folder-archive" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-3xl font-display font-bold text-slate-900">${totalCust} <span class="text-sm font-normal text-slate-500">Active Files</span></div>
            <div class="mt-1 text-xs text-slate-500">Across Cupboards 1, 2 & 3</div>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2 font-medium">
            <span class="text-emerald-700 font-semibold">${origCust} Originals</span>
            <span class="text-blue-700 font-semibold">${copyCust} Copies</span>
          </div>
        </div>

        <!-- Financial Files Card -->
        <div class="glass-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Financial Register</span>
            <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <i data-lucide="file-spreadsheet" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-3xl font-display font-bold text-slate-900">${totalFin} <span class="text-sm font-normal text-slate-500">Entities</span></div>
            <div class="mt-1 text-xs text-slate-500">Digitized from 44 Notebook Photos</div>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2 font-medium">
            <span>TINs, IRD PINs & SSIDs</span>
            <span class="text-emerald-600 font-bold">100% Synced</span>
          </div>
        </div>

        <!-- Access / Role Card -->
        <div class="glass-card p-5 bg-white border border-slate-200 rounded-2xl flex flex-col justify-between shadow-sm">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-slate-500">Your Access Level</span>
            <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200">
              <i data-lucide="shield-check" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="mt-4">
            <div class="text-xl font-display font-bold text-slate-900 uppercase">${currentUser ? currentUser.role : 'Staff'}</div>
            <div class="mt-1 text-xs text-slate-500">${currentUser ? currentUser.title : 'Team Member'}</div>
          </div>
          <div class="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2 font-medium">
            <span>Editor: ${canEdit('operations') ? 'Ops' : ''} ${canEdit('customer_files') ? 'Cust' : ''} ${canEdit('financial_files') ? 'Fin' : ''}</span>
            <span class="text-purple-600 font-bold">${currentUser && currentUser.role === 'admin' ? 'Superuser' : 'Verified'}</span>
          </div>
        </div>

      </div>

      <!-- Quick Operational Shortcuts -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div class="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <div class="flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <i data-lucide="list-plus" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-semibold text-sm text-slate-900">Personal Tasks</h3>
              <p class="text-xs text-slate-500">Track and manage your daily deliverables</p>
            </div>
          </div>
          <button onclick="switchView('operations')" class="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition">
            Open My Tracker &rarr;
          </button>
        </div>

        <div class="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <div class="flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <i data-lucide="archive" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-semibold text-sm text-slate-900">Archive Cupboards</h3>
              <p class="text-xs text-slate-500">Locate physical boxes & file folders</p>
            </div>
          </div>
          <button onclick="switchView('customer-files')" class="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition">
            Search File Registry &rarr;
          </button>
        </div>

        <div class="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
          <div class="flex items-center gap-3">
            <div class="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <i data-lucide="camera" class="w-5 h-5"></i>
            </div>
            <div>
              <h3 class="font-semibold text-sm text-slate-900">Physical Photos</h3>
              <p class="text-xs text-slate-500">Inspect original handwritten registers</p>
            </div>
          </div>
          <button onclick="switchView('financial-files')" class="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 transition">
            View Register Photos &rarr;
          </button>
        </div>

      </div>

    </div>
  `;
}

// ================= 2. OPERATIONS TRACKER (UNIQUE PER USER) =================
function renderOperations(container) {
  const isDirectorOrAdmin = currentUser && ['director', 'admin'].includes(currentUser.role);
  const totalTasks = operationsTasks.length;

  container.innerHTML = `
    <div class="space-y-6 fade-in">
      
      <!-- Top Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display font-bold text-xl text-slate-900">Operations Tracker</h2>
            <span class="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              ${operationsUserFilter === 'all' ? 'All Team Tasks' : 'Personal Tracker'}
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            ${operationsUserFilter === 'all' ? 'Viewing combined tasks across all company personnel' : `Personal task log for ${currentUser ? currentUser.fullName : 'You'}`}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          
          <!-- Filter for Director/Admin to switch between personal and team trackers -->
          ${isDirectorOrAdmin ? `
            <div class="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs">
              <span class="text-slate-500 font-medium">Viewing:</span>
              <select onchange="changeOperationsUserFilter(this.value)" class="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer">
                <option value="me" ${operationsUserFilter === 'me' ? 'selected' : ''}>👤 My Personal Tasks</option>
                <option value="all" ${operationsUserFilter === 'all' ? 'selected' : ''}>👥 All Team Tasks</option>
                <option value="usr_dir_master" ${operationsUserFilter === 'usr_dir_master' ? 'selected' : ''}>Executive Director</option>
                <option value="usr_admin_master" ${operationsUserFilter === 'usr_admin_master' ? 'selected' : ''}>Admin</option>
                <option value="usr_admin_zaharan" ${operationsUserFilter === 'usr_admin_zaharan' ? 'selected' : ''}>Muhammad Zaharan</option>
                <option value="usr_staff_hemanthi" ${operationsUserFilter === 'usr_staff_hemanthi' ? 'selected' : ''}>Miss Hemanthi</option>
                <option value="usr_staff_insaaf" ${operationsUserFilter === 'usr_staff_insaaf' ? 'selected' : ''}>Insaaf</option>
                <option value="usr_staff_editor" ${operationsUserFilter === 'usr_staff_editor' ? 'selected' : ''}>Staff Editor</option>
                <option value="usr_staff_viewer" ${operationsUserFilter === 'usr_staff_viewer' ? 'selected' : ''}>Staff Viewer</option>
              </select>
            </div>
          ` : ''}

          <!-- View Toggle: Table vs Kanban -->
          <div class="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs">
            <button onclick="setOperationsViewMode('table')" class="px-3 py-1.5 rounded-lg transition font-medium ${operationsViewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
              <i data-lucide="table" class="w-3.5 h-3.5 inline mr-1"></i> Table
            </button>
            <button onclick="setOperationsViewMode('kanban')" class="px-3 py-1.5 rounded-lg transition font-medium ${operationsViewMode === 'kanban' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
              <i data-lucide="kanban" class="w-3.5 h-3.5 inline mr-1"></i> Kanban
            </button>
          </div>

          <!-- Add Task Button -->
          <button onclick="openAddOperationModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 ${!canEdit('operations') ? 'permission-locked' : ''}">
            <i data-lucide="plus" class="w-4 h-4"></i> Add Task
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div class="relative flex-1 w-full">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
          <input type="text" id="opsSearchInput" oninput="handleOperationsFilter()" placeholder="Search tasks by title, deliverable, or notes..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
        </div>
        <div class="flex items-center gap-2 w-full sm:w-auto">
          <select id="opsStatusFilter" onchange="handleOperationsFilter()" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="On Hold">On Hold</option>
          </select>
          <select id="opsPriorityFilter" onchange="handleOperationsFilter()" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
            <option value="">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      </div>

      <!-- Container for Table or Kanban -->
      <div id="operationsContainer">
        ${operationsViewMode === 'table' ? renderOperationsTable(operationsTasks) : renderOperationsKanban(operationsTasks)}
      </div>

    </div>
  `;
}

async function changeOperationsUserFilter(val) {
  operationsUserFilter = val;
  await loadInitialData();
  const container = document.getElementById('mainContent');
  renderOperations(container);
  if (window.lucide) lucide.createIcons();
}

function setOperationsViewMode(mode) {
  operationsViewMode = mode;
  const container = document.getElementById('operationsContainer');
  if (container) {
    container.innerHTML = mode === 'table' ? renderOperationsTable(operationsTasks) : renderOperationsKanban(operationsTasks);
    if (window.lucide) lucide.createIcons();
  }
}

function handleOperationsFilter() {
  const q = (document.getElementById('opsSearchInput')?.value || '').toLowerCase();
  const status = document.getElementById('opsStatusFilter')?.value || '';
  const priority = document.getElementById('opsPriorityFilter')?.value || '';

  const filtered = operationsTasks.filter(t => {
    const mSearch = !q || (t.title || '').toLowerCase().includes(q) || (t.notes || '').toLowerCase().includes(q) || (t.workstream || '').toLowerCase().includes(q);
    const mStatus = !status || (t.status || '').toLowerCase() === status.toLowerCase();
    const mPri = !priority || (t.priority || '').toLowerCase() === priority.toLowerCase();
    return mSearch && mStatus && mPri;
  });

  const container = document.getElementById('operationsContainer');
  if (container) {
    container.innerHTML = operationsViewMode === 'table' ? renderOperationsTable(filtered) : renderOperationsKanban(filtered);
    if (window.lucide) lucide.createIcons();
  }
}

function renderOperationsTable(tasks) {
  if (!tasks.length) {
    return `
      <div class="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2 shadow-sm">
        <i data-lucide="clipboard-list" class="w-10 h-10 mx-auto text-slate-300"></i>
        <div class="text-sm font-semibold text-slate-700">No tasks found in your tracker</div>
        <p class="text-xs text-slate-500">Click "Add Task" above to add your first personal deliverable.</p>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th class="py-3 px-4 w-12">#</th>
              <th class="py-3 px-4">Task Deliverable</th>
              <th class="py-3 px-4">Workstream</th>
              <th class="py-3 px-4">Priority</th>
              <th class="py-3 px-4">Status</th>
              <th class="py-3 px-4">Assigned To</th>
              <th class="py-3 px-4">Cost / Timeline</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${tasks.map(t => `
              <tr class="hover:bg-slate-50/70 transition">
                <td class="py-3 px-4 font-mono text-slate-400 font-medium">${t.no || t.id}</td>
                <td class="py-3 px-4">
                  <div class="font-semibold text-slate-900">${t.title}</div>
                  ${t.notes ? `<div class="text-[11px] text-slate-500 mt-0.5 line-clamp-1">${t.notes}</div>` : ''}
                </td>
                <td class="py-3 px-4 text-slate-600 font-medium">${t.workstream || 'Operations'}</td>
                <td class="py-3 px-4">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${getPriorityBadgeClass(t.priority)}">
                    ${t.priority || 'Medium'}
                  </span>
                </td>
                <td class="py-3 px-4">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadgeClass(t.status)}">
                    ${t.status || 'Pending'}
                  </span>
                </td>
                <td class="py-3 px-4 text-slate-600">${t.assignedTo || 'Self'}</td>
                <td class="py-3 px-4 text-slate-500">
                  ${t.estimatedCost ? `<div class="font-medium text-slate-700">${t.estimatedCost}</div>` : ''}
                  <div class="text-[11px]">${t.taskedDate || ''}</div>
                </td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button onclick="openEditOperationModal('${t.id}')" title="Edit Task" class="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition">
                    <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="deleteOperationTask('${t.id}')" title="Delete Task" class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderOperationsKanban(tasks) {
  const columns = ['Pending', 'In Progress', 'Completed'];

  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      ${columns.map(col => {
        const colTasks = tasks.filter(t => (t.status || 'Pending').toLowerCase() === col.toLowerCase());
        return `
          <div class="bg-slate-100/70 border border-slate-200 rounded-2xl p-4 flex flex-col h-full min-h-[450px]">
            <div class="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
              <span class="font-semibold text-xs uppercase tracking-wider text-slate-700">${col}</span>
              <span class="text-xs bg-white text-slate-600 font-bold px-2 py-0.5 rounded-full border border-slate-200 shadow-xs">${colTasks.length}</span>
            </div>

            <div class="space-y-3 flex-1 overflow-y-auto pr-1">
              ${colTasks.map(t => `
                <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-slate-300 transition space-y-2.5">
                  <div class="flex items-start justify-between gap-2">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${getPriorityBadgeClass(t.priority)}">
                      ${t.priority || 'Medium'}
                    </span>
                    <div class="flex items-center gap-1">
                      <button onclick="openEditOperationModal('${t.id}')" class="text-slate-400 hover:text-blue-600 p-1">
                        <i data-lucide="edit-2" class="w-3 h-3"></i>
                      </button>
                      <button onclick="deleteOperationTask('${t.id}')" class="text-slate-400 hover:text-red-600 p-1">
                        <i data-lucide="trash-2" class="w-3 h-3"></i>
                      </button>
                    </div>
                  </div>

                  <div class="font-semibold text-xs text-slate-900 leading-snug">${t.title}</div>
                  ${t.notes ? `<p class="text-[11px] text-slate-500 leading-relaxed">${t.notes}</p>` : ''}

                  <div class="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span>${t.assignedTo || 'Self'}</span>
                    <div class="flex items-center gap-1">
                      ${col !== 'Pending' ? `
                        <button onclick="quickUpdateTaskStatus('${t.id}', '${col === 'Completed' ? 'In Progress' : 'Pending'}')" class="text-slate-400 hover:text-slate-700" title="Move Back">
                          <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                        </button>
                      ` : ''}
                      ${col !== 'Completed' ? `
                        <button onclick="quickUpdateTaskStatus('${t.id}', '${col === 'Pending' ? 'In Progress' : 'Completed'}')" class="text-slate-400 hover:text-emerald-600" title="Move Forward">
                          <i data-lucide="chevron-right" class="w-3.5 h-3.5"></i>
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function getPriorityBadgeClass(p) {
  switch ((p || '').toLowerCase()) {
    case 'critical': return 'bg-red-50 text-red-700 border border-red-200';
    case 'high': return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'medium': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'low': return 'bg-slate-100 text-slate-600 border border-slate-200';
    default: return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function getStatusBadgeClass(s) {
  switch ((s || '').toLowerCase()) {
    case 'completed': return 'badge-completed';
    case 'in progress': return 'badge-in-progress';
    case 'pending': return 'badge-pending';
    case 'on hold': return 'badge-on-hold';
    default: return 'badge-pending';
  }
}

async function quickUpdateTaskStatus(id, newStatus) {
  try {
    const res = await fetch(`/api/operations/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        status: newStatus,
        completedDate: newStatus === 'Completed' ? new Date().toISOString().split('T')[0] : ''
      })
    });
    if (res.ok) {
      await loadInitialData();
      handleOperationsFilter();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to update task');
    }
  } catch (e) {
    alert('Error updating status');
  }
}

// ================= 3. CUSTOMER FILES DATABASE (LIGHT THEME) =================
function renderCustomerFiles(container) {
  const origCount = customerRecords.filter(r => (r.Type || '').toLowerCase().includes('original')).length;
  const copyCount = customerRecords.filter(r => (r.Type || '').toLowerCase().includes('copy')).length;

  container.innerHTML = `
    <div class="space-y-6 fade-in">
      
      <!-- Top Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display font-bold text-xl text-slate-900">Customer Files Database</h2>
            <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Active Database: Online
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Connected to duplicated live database <span class="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">Customer_Files_Active.accdb</span> (${customerRecords.length} records)
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <!-- View Toggle: Table vs Box Visualizer -->
          <div class="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 text-xs">
            <button onclick="setCustomerViewMode('table')" class="px-3 py-1.5 rounded-lg transition font-medium ${customerViewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
              <i data-lucide="list" class="w-3.5 h-3.5 inline mr-1"></i> Register Table
            </button>
            <button onclick="setCustomerViewMode('boxes')" class="px-3 py-1.5 rounded-lg transition font-medium ${customerViewMode === 'boxes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}">
              <i data-lucide="box" class="w-3.5 h-3.5 inline mr-1"></i> Cupboard & Boxes
            </button>
          </div>

          <!-- Dual Onboard -->
          <button onclick="openDualOnboardModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 ${!canEdit('customer_files') ? 'permission-locked' : ''}">
            <i data-lucide="user-plus" class="w-4 h-4"></i> Dual Onboarding
          </button>

          <!-- Backup DB -->
          ${currentUser && ['director', 'admin'].includes(currentUser.role) ? `
            <button onclick="backupCustomerDatabase()" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border border-slate-200 transition flex items-center gap-1.5">
              <i data-lucide="hard-drive-download" class="w-4 h-4 text-emerald-600"></i> Backup
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Cupboards Tabs & Filter Bar -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div class="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          ${['All', 'Cupboard 1', 'Cupboard 2', 'Cupboard 3'].map(c => `
            <button onclick="setCustomerCupboardFilter('${c}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${customerCupboardFilter === c ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'}">
              ${c === 'All' ? 'All Cupboards' : c}
            </button>
          `).join('')}
        </div>

        <div class="flex items-center gap-2 w-full sm:w-80">
          <div class="relative w-full">
            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
            <input type="text" id="custSearchInput" oninput="handleCustomerFilter()" placeholder="Search company, reg no, box..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
          </div>
          <select id="custTypeFilter" onchange="handleCustomerFilter()" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
            <option value="">All Types</option>
            <option value="original">Originals</option>
            <option value="copy">Copies</option>
          </select>
        </div>
      </div>

      <!-- Container -->
      <div id="customerContentContainer">
        ${customerViewMode === 'table' ? renderCustomerTable(customerRecords) : renderCustomerBoxes(customerRecords)}
      </div>

    </div>
  `;
}

function setCustomerViewMode(mode) {
  customerViewMode = mode;
  handleCustomerFilter();
}

function setCustomerCupboardFilter(c) {
  customerCupboardFilter = c;
  handleCustomerFilter();
}

function handleCustomerFilter() {
  const q = (document.getElementById('custSearchInput')?.value || '').toLowerCase();
  const type = (document.getElementById('custTypeFilter')?.value || '').toLowerCase();

  const filtered = customerRecords.filter(r => {
    const compMatch = !q || (r['Company Name'] || '').toLowerCase().includes(q) || (r['Registration No'] || '').toLowerCase().includes(q) || (r['Box No'] || '').toLowerCase().includes(q) || (r['No'] || '').toLowerCase().includes(q);
    const cupMatch = customerCupboardFilter === 'All' || (r['Cupboard'] || '').toLowerCase() === customerCupboardFilter.toLowerCase();
    const typeMatch = !type || (r['Type'] || '').toLowerCase().includes(type);
    return compMatch && cupMatch && typeMatch;
  });

  const container = document.getElementById('customerContentContainer');
  if (container) {
    container.innerHTML = customerViewMode === 'table' ? renderCustomerTable(filtered) : renderCustomerBoxes(filtered);
    if (window.lucide) lucide.createIcons();
  }
}

function renderCustomerTable(records) {
  if (!records.length) {
    return `
      <div class="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2 shadow-sm">
        <i data-lucide="folder-x" class="w-10 h-10 mx-auto text-slate-300"></i>
        <div class="text-sm font-semibold text-slate-700">No customer files match your criteria</div>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th class="py-3 px-4 w-12">No</th>
              <th class="py-3 px-4">Company Name</th>
              <th class="py-3 px-4">Registration No</th>
              <th class="py-3 px-4">Cupboard</th>
              <th class="py-3 px-4">Box No</th>
              <th class="py-3 px-4">Type</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${records.map(r => {
              const isOrig = (r['Type'] || '').toLowerCase().includes('original');
              return `
                <tr class="hover:bg-slate-50/70 transition">
                  <td class="py-3 px-4 font-mono text-slate-400 font-medium">${r['No'] || ''}</td>
                  <td class="py-3 px-4 font-semibold text-slate-900">${r['Company Name'] || ''}</td>
                  <td class="py-3 px-4 text-slate-600 font-mono">${r['Registration No'] || '-'}</td>
                  <td class="py-3 px-4 text-slate-700 font-medium">${r['Cupboard'] || '-'}</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200">
                      ${r['Box No'] || '-'}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${isOrig ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}">
                      ${r['Type'] || 'Standard'}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right space-x-1">
                    <button onclick="openEditCustomerModal('${r['No']}')" title="Edit File" class="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition ${!canEdit('customer_files') ? 'permission-locked' : ''}">
                      <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="deleteCustomerRecord('${r['No']}')" title="Delete File" class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition ${!canEdit('customer_files') ? 'permission-locked' : ''}">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderCustomerBoxes(records) {
  const boxGroups = {};
  for (let r of records) {
    const b = r['Box No'] || 'Unassigned';
    if (!boxGroups[b]) boxGroups[b] = [];
    boxGroups[b].push(r);
  }

  const sortedBoxes = Object.keys(boxGroups).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 999;
    const numB = parseInt(b.replace(/\D/g, '')) || 999;
    return numA - numB;
  });

  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      ${sortedBoxes.map(b => {
        const files = boxGroups[b];
        const cup = files[0]?.Cupboard || 'Cupboard';
        return `
          <div class="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition space-y-3">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
              <div class="flex items-center gap-2">
                <i data-lucide="box" class="w-4 h-4 text-amber-600"></i>
                <span class="font-bold text-sm text-slate-900">${b}</span>
              </div>
              <span class="text-xs text-slate-500 font-semibold bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">${files.length} files</span>
            </div>
            
            <div class="text-[11px] text-slate-500 font-medium">${cup}</div>

            <div class="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              ${files.map(f => `
                <div class="text-xs p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <span class="font-medium text-slate-800 truncate" title="${f['Company Name']}">${f['Company Name']}</span>
                  <span class="text-[10px] font-semibold text-slate-400 ml-1 flex-shrink-0">${f['Type']?.includes('Original') ? 'Orig' : 'Copy'}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ================= 4. FINANCIAL FILES DATABASE (LIGHT THEME & PHOTOS) =================
function renderFinancialFiles(container) {
  container.innerHTML = `
    <div class="space-y-6 fade-in">
      
      <!-- Top Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display font-bold text-xl text-slate-900">Financial Files Database</h2>
            <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Live Seed Database
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Digitized from 44 physical register photos in <span class="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">financial_records_active.json</span> (${financialRecords.length} profiles)
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button onclick="openAddFinancialModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 ${!canEdit('financial_files') ? 'permission-locked' : ''}">
            <i data-lucide="plus" class="w-4 h-4"></i> Add Entity Profile
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div class="relative flex-1 w-full">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
          <input type="text" id="finSearchInput" oninput="handleFinancialFilter()" placeholder="Search by entity name, TIN, SSID, director..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
        </div>
        <select id="finCategoryFilter" onchange="handleFinancialFilter()" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none w-full sm:w-auto">
          <option value="">All Categories</option>
          <option value="Corporate">Corporate Entities</option>
          <option value="Individual">Individual Directors</option>
          <option value="IRD Contacts">IRD Directory</option>
        </select>
      </div>

      <!-- Financial Table -->
      <div id="financialTableContainer">
        ${renderFinancialTable(financialRecords)}
      </div>

    </div>
  `;
}

function handleFinancialFilter() {
  const q = (document.getElementById('finSearchInput')?.value || '').toLowerCase();
  const cat = (document.getElementById('finCategoryFilter')?.value || '').toLowerCase();

  const filtered = financialRecords.filter(r => {
    const matchQ = !q || (r.entityName || '').toLowerCase().includes(q) || (r.tinNo || '').toLowerCase().includes(q) || (r.ssid || '').toLowerCase().includes(q) || (r.directorName || '').toLowerCase().includes(q) || (r.notes || '').toLowerCase().includes(q);
    const matchCat = !cat || (r.category || '').toLowerCase().includes(cat);
    return matchQ && matchCat;
  });

  const container = document.getElementById('financialTableContainer');
  if (container) {
    container.innerHTML = renderFinancialTable(filtered);
    if (window.lucide) lucide.createIcons();
  }
}

function renderFinancialTable(records) {
  if (!records.length) {
    return `
      <div class="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2 shadow-sm">
        <i data-lucide="file-x" class="w-10 h-10 mx-auto text-slate-300"></i>
        <div class="text-sm font-semibold text-slate-700">No financial records match your search</div>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th class="py-3 px-4">Entity / Director</th>
              <th class="py-3 px-4">Tax ID (TIN)</th>
              <th class="py-3 px-4">IRD Credentials</th>
              <th class="py-3 px-4">SSID / PIN</th>
              <th class="py-3 px-4">Filing Status</th>
              <th class="py-3 px-4">Notebook Photo</th>
              <th class="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${records.map(r => `
              <tr class="hover:bg-slate-50/70 transition">
                <td class="py-3 px-4">
                  <div class="font-semibold text-slate-900">${r.entityName || 'Unnamed'}</div>
                  <div class="text-[11px] text-slate-500 font-medium">${r.directorName ? `Director: ${r.directorName}` : (r.category || 'Corporate')}</div>
                </td>
                <td class="py-3 px-4">
                  ${r.tinNo ? `<div class="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">${r.tinNo}</div>` : '<span class="text-slate-400">-</span>'}
                  ${r.economicCode ? `<div class="text-[10px] text-slate-400 mt-0.5 font-mono">Code: ${r.economicCode}</div>` : ''}
                </td>
                <td class="py-3 px-4 text-slate-600">
                  ${r.irdPin ? `<div class="font-mono text-[11px]">PIN: <span class="text-slate-900 font-semibold">${r.irdPin}</span></div>` : ''}
                  ${r.irdPassword ? `<div class="font-mono text-[11px] text-slate-500">Pwd: ${r.irdPassword}</div>` : ''}
                </td>
                <td class="py-3 px-4 text-slate-600">
                  ${r.ssid ? `<div class="font-mono text-[11px]">SSID: <span class="text-slate-900 font-semibold">${r.ssid}</span></div>` : ''}
                  ${r.ssidPin ? `<div class="font-mono text-[11px] text-slate-500">PIN: ${r.ssidPin}</div>` : ''}
                </td>
                <td class="py-3 px-4 max-w-xs">
                  <div class="text-[11px] text-slate-600 line-clamp-2" title="${r.filingStatus || r.notes || ''}">
                    ${r.filingStatus || r.notes || 'Normal status'}
                  </div>
                </td>
                <td class="py-3 px-4">
                  ${r.photoFile ? `
                    <button onclick="openPhotoLightbox('${r.photoFile}', '${r.entityName || ''}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg border border-emerald-200 transition flex items-center gap-1 text-[11px]">
                      <i data-lucide="image" class="w-3.5 h-3.5"></i> View Photo
                    </button>
                  ` : '<span class="text-slate-400 text-[11px]">No Photo</span>'}
                </td>
                <td class="py-3 px-4 text-right space-x-1">
                  <button onclick="openEditFinancialModal('${r.id}')" title="Edit Profile" class="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition ${!canEdit('financial_files') ? 'permission-locked' : ''}">
                    <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="deleteFinancialRecord('${r.id}')" title="Delete Profile" class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition ${!canEdit('financial_files') ? 'permission-locked' : ''}">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Lightbox for Photos
function openPhotoLightbox(photoFile, caption) {
  const modal = document.getElementById('photoLightbox');
  const img = document.getElementById('lightboxImg');
  const cap = document.getElementById('lightboxCaption');

  img.src = `/api/financial-files/photos/${encodeURIComponent(photoFile)}`;
  cap.textContent = `Physical Register Notebook Capture — ${caption} (${photoFile})`;
  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closePhotoLightbox() {
  const modal = document.getElementById('photoLightbox');
  modal.classList.add('hidden');
}

// ================= 5. ACCESS CONTROL CENTER (LIGHT THEME) =================
async function renderAccessControl(container) {
  if (!isAdmin()) {
    container.innerHTML = `
      <div class="p-12 text-center bg-white rounded-2xl border border-red-200 space-y-3 shadow-sm fade-in">
        <i data-lucide="shield-alert" class="w-12 h-12 mx-auto text-red-500"></i>
        <h2 class="text-lg font-bold text-slate-900">Restricted Administrator Area</h2>
        <p class="text-xs text-slate-500 max-w-md mx-auto">Only users with Administrator privileges can modify user credentials and permissions.</p>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch('/api/users', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    usersList = data.users || [];
  } catch (e) {
    usersList = [];
  }

  container.innerHTML = `
    <div class="space-y-6 fade-in">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display font-bold text-xl text-slate-900">Access Control & Staff Directory</h2>
            <span class="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Admin Exclusive
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            Grant or take access, assign granular module permissions (Editor vs. Viewer), and manage staff accounts.
          </p>
        </div>

        <button onclick="openAddUserModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5">
          <i data-lucide="user-plus" class="w-4 h-4"></i> Create User Account
        </button>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-xs">
            <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th class="py-3 px-4">User</th>
                <th class="py-3 px-4">Role</th>
                <th class="py-3 px-4">Designation</th>
                <th class="py-3 px-4">Operations Perm</th>
                <th class="py-3 px-4">Customer DB Perm</th>
                <th class="py-3 px-4">Financial DB Perm</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${usersList.map(u => `
                <tr class="hover:bg-slate-50/70 transition">
                  <td class="py-3 px-4">
                    <div class="font-semibold text-slate-900">${u.fullName || u.username}</div>
                    <div class="text-[11px] text-slate-500 font-mono">@${u.username}</div>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.role === 'director' ? 'bg-amber-50 text-amber-800 border border-amber-200' : (u.role === 'admin' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200')}">
                      ${u.role}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-slate-600">${u.title || 'Staff Member'}</td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${u.permissions?.operations === 'editor' || u.role === 'director' || u.role === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
                      ${u.role in {director:1,admin:1} ? 'Full' : (u.permissions?.operations || 'none')}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${u.permissions?.customer_files === 'editor' || u.role === 'director' || u.role === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
                      ${u.role in {director:1,admin:1} ? 'Full' : (u.permissions?.customer_files || 'none')}
                    </span>
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${u.permissions?.financial_files === 'editor' || u.role === 'director' || u.role === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}">
                      ${u.role in {director:1,admin:1} ? 'Full' : (u.permissions?.financial_files || 'none')}
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right space-x-1">
                    <button onclick="openEditUserModal('${u.id}')" title="Edit Permissions" class="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition">
                      <i data-lucide="shield" class="w-3.5 h-3.5"></i>
                    </button>
                    ${u.username !== 'admin' && u.id !== currentUser.id ? `
                      <button onclick="deleteUserAccount('${u.id}')" title="Revoke Access" class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition">
                        <i data-lucide="user-x" class="w-3.5 h-3.5"></i>
                      </button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ================= MODAL CONTROLS & CRUD OPERATIONS =================
function closeModal() {
  const b = document.getElementById('modalBackdrop');
  b.classList.add('hidden');
}

function openAddOperationModal() {
  if (!canEdit('operations')) {
    alert('You have Viewer access only on Operations Tracker.');
    return;
  }
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <h3 class="font-display font-bold text-base text-slate-900">Add New Operation Task</h3>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitAddOperation(event)" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Task Deliverable Title *</label>
          <input type="text" id="mOpsTitle" required placeholder="e.g. Audit Cupboard 1 File Index" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Workstream</label>
            <input type="text" id="mOpsWorkstream" placeholder="e.g. Office Operations" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Priority</label>
            <select id="mOpsPriority" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Low">Low</option>
              <option value="Medium" selected>Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Status</label>
            <select id="mOpsStatus" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Pending" selected>Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Estimated Cost</label>
            <input type="text" id="mOpsCost" placeholder="e.g. 25,000 LKR" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Detailed Action Notes</label>
          <textarea id="mOpsNotes" rows="3" placeholder="Add specific requirements or steps..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"></textarea>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Save Task</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitAddOperation(e) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('mOpsTitle').value.trim(),
    workstream: document.getElementById('mOpsWorkstream').value.trim() || 'General Operations',
    priority: document.getElementById('mOpsPriority').value,
    status: document.getElementById('mOpsStatus').value,
    estimatedCost: document.getElementById('mOpsCost').value.trim(),
    notes: document.getElementById('mOpsNotes').value.trim()
  };

  try {
    const res = await fetch('/api/operations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      await loadInitialData();
      renderOperations(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
    } else {
      alert(data.error || 'Failed to add task');
    }
  } catch (err) {
    alert('Error saving task');
  }
}

function openEditOperationModal(taskId) {
  const task = operationsTasks.find(t => String(t.id) === String(taskId) || String(t.no) === String(taskId));
  if (!task) return;

  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <h3 class="font-display font-bold text-base text-slate-900">Edit Operation Task</h3>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitEditOperation(event, '${task.id}')" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Task Deliverable Title *</label>
          <input type="text" id="mEditOpsTitle" required value="${task.title || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Workstream</label>
            <input type="text" id="mEditOpsWorkstream" value="${task.workstream || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Priority</label>
            <select id="mEditOpsPriority" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
              <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
              <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
              <option value="Critical" ${task.priority === 'Critical' ? 'selected' : ''}>Critical</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Status</label>
            <select id="mEditOpsStatus" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="On Hold" ${task.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Estimated Cost</label>
            <input type="text" id="mEditOpsCost" value="${task.estimatedCost || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Action Notes</label>
          <textarea id="mEditOpsNotes" rows="3" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">${task.notes || ''}</textarea>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Save Changes</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitEditOperation(e, taskId) {
  e.preventDefault();
  const payload = {
    title: document.getElementById('mEditOpsTitle').value.trim(),
    workstream: document.getElementById('mEditOpsWorkstream').value.trim(),
    priority: document.getElementById('mEditOpsPriority').value,
    status: document.getElementById('mEditOpsStatus').value,
    estimatedCost: document.getElementById('mEditOpsCost').value.trim(),
    notes: document.getElementById('mEditOpsNotes').value.trim()
  };

  try {
    const res = await fetch(`/api/operations/${taskId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      await loadInitialData();
      renderOperations(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
    } else {
      alert(data.error || 'Failed to update task');
    }
  } catch (err) {
    alert('Error updating task');
  }
}

async function deleteOperationTask(taskId) {
  if (!confirm('Are you sure you want to delete this task from your tracker?')) return;
  try {
    const res = await fetch(`/api/operations/${taskId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      await loadInitialData();
      renderOperations(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
    } else {
      alert(data.error || 'Failed to delete task');
    }
  } catch (e) {
    alert('Error deleting task');
  }
}

// Dual Onboarding Modal (Customer Files)
function openDualOnboardModal() {
  if (!canEdit('customer_files')) {
    alert('You have Viewer access only on Customer Files.');
    return;
  }
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Dual Client File Onboarding</h3>
          <p class="text-[11px] text-slate-500">Automatically creates both Original File and Customer Copy records in Access database.</p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitDualOnboarding(event)" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Company / Client Name *</label>
          <input type="text" id="mDualCompName" required placeholder="e.g. Ceylon Prime Holdings (Pvt) Ltd" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Company Registration Number</label>
          <input type="text" id="mDualRegNo" placeholder="e.g. PV 00298172" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Cupboard Destination</label>
            <select id="mDualCupboard" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Cupboard 1">Cupboard 1</option>
              <option value="Cupboard 2" selected>Cupboard 2</option>
              <option value="Cupboard 3">Cupboard 3</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Archive Box Number *</label>
            <input type="text" id="mDualBox" required placeholder="e.g. Box 11" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Execute Dual Onboarding</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitDualOnboarding(e) {
  e.preventDefault();
  const payload = {
    CompanyName: document.getElementById('mDualCompName').value.trim(),
    RegistrationNo: document.getElementById('mDualRegNo').value.trim(),
    Cupboard: document.getElementById('mDualCupboard').value,
    BoxNo: document.getElementById('mDualBox').value.trim()
  };

  try {
    const res = await fetch('/api/customer-files/dual', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      await loadInitialData();
      renderCustomerFiles(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
      alert('Dual onboarding complete: Original and Customer Copy records generated in Access database.');
    } else {
      alert(data.error || 'Onboarding failed');
    }
  } catch (err) {
    alert('Error during dual onboarding');
  }
}

async function deleteCustomerRecord(no) {
  if (!canEdit('customer_files')) {
    alert('You have Viewer access only on Customer Files.');
    return;
  }
  if (!confirm(`Are you sure you want to delete file record #${no} from the Access database?`)) return;
  try {
    const res = await fetch(`/api/customer-files/${no}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      await loadInitialData();
      renderCustomerFiles(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
    } else {
      alert(data.error || 'Delete failed');
    }
  } catch (e) {
    alert('Error deleting customer record');
  }
}

async function backupCustomerDatabase() {
  try {
    const res = await fetch('/api/customer-files/backup', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      alert(`Database backup generated successfully!\nFile: ${data.filename}\nLocation: customer_file_db/backups/`);
    } else {
      alert(data.error || 'Backup failed');
    }
  } catch (e) {
    alert('Error triggering backup');
  }
}

// Financial Add Modal
function openAddFinancialModal() {
  if (!canEdit('financial_files')) {
    alert('You have Viewer access only on Financial Files.');
    return;
  }
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <h3 class="font-display font-bold text-base text-slate-900">Add Financial Tax Profile</h3>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitAddFinancial(event)" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Entity / Director Name *</label>
          <input type="text" id="mFinName" required placeholder="e.g. Lanka Prime Logistics Ltd" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tax ID Number (TIN)</label>
            <input type="text" id="mFinTin" placeholder="e.g. 101081753" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Economic Code</label>
            <input type="text" id="mFinEcon" placeholder="e.g. 5229" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">IRD Portal PIN</label>
            <input type="text" id="mFinIrdPin" placeholder="e.g. remi1753" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">IRD Password</label>
            <input type="text" id="mFinIrdPwd" placeholder="e.g. remi(1)12345" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">SSID Number</label>
            <input type="text" id="mFinSsid" placeholder="e.g. 1519446" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">SSID PIN</label>
            <input type="text" id="mFinSsidPin" placeholder="e.g. remi1234" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Filing Notes / Submission History</label>
          <textarea id="mFinFiling" rows="2" placeholder="Record audited accounts submission dates and officer contacts..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"></textarea>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Save Profile</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitAddFinancial(e) {
  e.preventDefault();
  const payload = {
    entityName: document.getElementById('mFinName').value.trim(),
    tinNo: document.getElementById('mFinTin').value.trim(),
    economicCode: document.getElementById('mFinEcon').value.trim(),
    irdPin: document.getElementById('mFinIrdPin').value.trim(),
    irdPassword: document.getElementById('mFinIrdPwd').value.trim(),
    ssid: document.getElementById('mFinSsid').value.trim(),
    ssidPin: document.getElementById('mFinSsidPin').value.trim(),
    filingStatus: document.getElementById('mFinFiling').value.trim()
  };

  try {
    const res = await fetch('/api/financial-files', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      await loadInitialData();
      renderFinancialFiles(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
    } else {
      alert(data.error || 'Failed to add financial profile');
    }
  } catch (err) {
    alert('Error saving financial profile');
  }
}

async function deleteFinancialRecord(id) {
  if (!canEdit('financial_files')) {
    alert('You have Viewer access only on Financial Files.');
    return;
  }
  if (!confirm('Are you sure you want to delete this financial record?')) return;
  try {
    const res = await fetch(`/api/financial-files/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      await loadInitialData();
      renderFinancialFiles(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
    } else {
      alert(data.error || 'Delete failed');
    }
  } catch (e) {
    alert('Error deleting financial record');
  }
}

// User Management Modals
function openAddUserModal() {
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Create New User Account</h3>
          <p class="text-[11px] text-slate-500">Add an executive, administrator, or staff member to the company portal.</p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitAddUser(event)" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Full Name *</label>
          <input type="text" id="mUserFullName" required placeholder="e.g. Radhika Senanayake" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Username *</label>
            <input type="text" id="mUserUsername" required placeholder="e.g. radhika" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Role *</label>
            <select id="mUserRole" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="staff" selected>Staff Member</option>
              <option value="director">Director (Executive Access)</option>
              <option value="admin">Administrator (Access Controller)</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Designation / Title</label>
            <input type="text" id="mUserTitle" placeholder="e.g. Legal & Secretarial Associate" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Corporate Email</label>
            <input type="email" id="mUserEmail" placeholder="e.g. user@spillburg.com" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Initial Password *</label>
          <input type="password" id="mUserPassword" required minlength="4" placeholder="Minimum 4 characters" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div class="font-bold text-slate-800">Module Access Level</div>
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Operations</label>
              <select id="mUserPermOps" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="editor" selected>Editor (Read/Write)</option>
                <option value="viewer">Viewer (Read Only)</option>
                <option value="full">Full Control</option>
                <option value="none">No Access</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Customer DB</label>
              <select id="mUserPermCust" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="viewer" selected>Viewer (Read Only)</option>
                <option value="editor">Editor (Read/Write)</option>
                <option value="full">Full Control</option>
                <option value="none">No Access</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Financial DB</label>
              <select id="mUserPermFin" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="viewer" selected>Viewer (Read Only)</option>
                <option value="editor">Editor (Read/Write)</option>
                <option value="full">Full Control</option>
                <option value="none">No Access</option>
              </select>
            </div>
          </div>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Create User Account</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitAddUser(e) {
  e.preventDefault();
  const payload = {
    fullName: document.getElementById('mUserFullName').value.trim(),
    username: document.getElementById('mUserUsername').value.trim(),
    role: document.getElementById('mUserRole').value,
    title: document.getElementById('mUserTitle').value.trim() || 'Staff Associate',
    email: document.getElementById('mUserEmail').value.trim(),
    password: document.getElementById('mUserPassword').value,
    permissions: {
      operations: document.getElementById('mUserPermOps').value,
      customer_files: document.getElementById('mUserPermCust').value,
      financial_files: document.getElementById('mUserPermFin').value
    }
  };

  try {
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      await loadInitialData();
      renderAccessControl(document.getElementById('mainContent'));
      alert(`User @${payload.username} created successfully.`);
    } else {
      alert(data.error || 'Failed to create user');
    }
  } catch (err) {
    alert('Error connecting to server while creating user');
  }
}

function openEditUserModal(userId) {
  const target = usersList.find(u => u.id === userId);
  if (!target) return;

  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Manage Account & Permissions</h3>
          <p class="text-[11px] text-slate-500 font-mono">@${target.username} &middot; ID: ${target.id}</p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitEditUser(event, '${target.id}')" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Full Name *</label>
          <input type="text" id="mEditUserFullName" value="${target.fullName || ''}" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Role *</label>
            <select id="mEditUserRole" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="staff" ${target.role === 'staff' ? 'selected' : ''}>Staff Member</option>
              <option value="director" ${target.role === 'director' ? 'selected' : ''}>Director (Executive Access)</option>
              <option value="admin" ${target.role === 'admin' ? 'selected' : ''}>Administrator (Access Controller)</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Designation</label>
            <input type="text" id="mEditUserTitle" value="${target.title || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Corporate Email</label>
            <input type="email" id="mEditUserEmail" value="${target.email || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Reset Password</label>
            <input type="password" id="mEditUserPassword" placeholder="Leave blank to keep unchanged" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div class="font-bold text-slate-800">Module Permissions</div>
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Operations</label>
              <select id="mEditPermOps" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="full" ${target.permissions?.operations === 'full' ? 'selected' : ''}>Full</option>
                <option value="editor" ${target.permissions?.operations === 'editor' ? 'selected' : ''}>Editor</option>
                <option value="viewer" ${target.permissions?.operations === 'viewer' ? 'selected' : ''}>Viewer</option>
                <option value="none" ${target.permissions?.operations === 'none' ? 'selected' : ''}>None</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Customer DB</label>
              <select id="mEditPermCust" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="full" ${target.permissions?.customer_files === 'full' ? 'selected' : ''}>Full</option>
                <option value="editor" ${target.permissions?.customer_files === 'editor' ? 'selected' : ''}>Editor</option>
                <option value="viewer" ${target.permissions?.customer_files === 'viewer' ? 'selected' : ''}>Viewer</option>
                <option value="none" ${target.permissions?.customer_files === 'none' ? 'selected' : ''}>None</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Financial DB</label>
              <select id="mEditPermFin" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="full" ${target.permissions?.financial_files === 'full' ? 'selected' : ''}>Full</option>
                <option value="editor" ${target.permissions?.financial_files === 'editor' ? 'selected' : ''}>Editor</option>
                <option value="viewer" ${target.permissions?.financial_files === 'viewer' ? 'selected' : ''}>Viewer</option>
                <option value="none" ${target.permissions?.financial_files === 'none' ? 'selected' : ''}>None</option>
              </select>
            </div>
          </div>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Save Changes</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitEditUser(e, userId) {
  e.preventDefault();
  const payload = {
    fullName: document.getElementById('mEditUserFullName').value.trim(),
    role: document.getElementById('mEditUserRole').value,
    title: document.getElementById('mEditUserTitle').value.trim(),
    email: document.getElementById('mEditUserEmail').value.trim(),
    permissions: {
      operations: document.getElementById('mEditPermOps').value,
      customer_files: document.getElementById('mEditPermCust').value,
      financial_files: document.getElementById('mEditPermFin').value
    }
  };

  const newPwd = document.getElementById('mEditUserPassword').value;
  if (newPwd) {
    payload.password = newPwd;
  }

  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      await loadInitialData();
      renderAccessControl(document.getElementById('mainContent'));
      alert('User details and permissions updated successfully.');
    } else {
      alert(data.error || 'Failed to update user');
    }
  } catch (err) {
    alert('Error updating user');
  }
}

async function deleteUserAccount(userId) {
  if (!confirm('Are you sure you want to permanently revoke this user account? This cannot be undone.')) return;
  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      await loadInitialData();
      renderAccessControl(document.getElementById('mainContent'));
      alert('User access revoked.');
    } else {
      alert(data.error || 'Failed to delete user');
    }
  } catch (e) {
    alert('Error deleting user');
  }
}
