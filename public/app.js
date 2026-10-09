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
let operationsMonthFilter = 'all'; // 'all', or 'sep', 'oct', 'nov', etc.
let operationsYearFilter = 'all'; // 'all', or '2026', '2025', etc.

// Payroll & Remittance State
let payrollData = null;
let activePayrollPeriod = null;
let selectedPayrollCompanyId = null;
let currentPayrollSubTab = 'sheet'; // 'sheet', 'letter', 'slips', 'staff'
let activePayslipEmployeeId = null;
let bankLetterheadEnabled = true;

function toggleBankLetterhead(enabled) {
  bankLetterheadEnabled = !!enabled;
  const sheet = document.querySelector('.bank-letter-sheet');
  if (sheet) {
    sheet.classList.toggle('no-letterhead', !bankLetterheadEnabled);
  }
}

// Universal Table Sorting State
const tableSortState = {
  operations: { col: 'no', asc: true },
  customer: { col: 'No', asc: true },
  financial: { col: 'entityName', asc: true },
  users: { col: 'fullName', asc: true }
};

// ================= DATE FORMATTING & CALENDAR UTILITIES =================
// Official Corporate Spillburg Standard: "22-Sep-2026" (DD-MMM-YYYY)
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL_MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const CALENDAR_MONTHS = [
  { key: 'jan', name: 'January', num: 1 },
  { key: 'feb', name: 'February', num: 2 },
  { key: 'mar', name: 'March', num: 3 },
  { key: 'apr', name: 'April', num: 4 },
  { key: 'may', name: 'May', num: 5 },
  { key: 'jun', name: 'June', num: 6 },
  { key: 'jul', name: 'July', num: 7 },
  { key: 'aug', name: 'August', num: 8 },
  { key: 'sep', name: 'September', num: 9 },
  { key: 'oct', name: 'October', num: 10 },
  { key: 'nov', name: 'November', num: 11 },
  { key: 'dec', name: 'December', num: 12 }
];
const MONTH_MAP = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
};

function formatDisplayDate(val) {
  if (!val || (typeof val !== 'string' && typeof val !== 'number' && !(val instanceof Date))) {
    return '';
  }
  const str = String(val).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') {
    return '';
  }

  // Already DD-MMM-YYYY or D-MMM-YYYY (e.g. 22-Sep-2026 or 3-Sep-2026)
  const m1 = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const monKey = m1[2].toLowerCase();
    const year = parseInt(m1[3], 10);
    if (MONTH_MAP[monKey] !== undefined) {
      return `${String(day).padStart(2, '0')}-${MONTH_NAMES[MONTH_MAP[monKey]]}-${year}`;
    }
  }

  // ISO or slash YYYY-MM-DD or YYYY/MM/DD (with optional time or timezone)
  const m2 = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m2) {
    const year = parseInt(m2[1], 10);
    const mon = parseInt(m2[2], 10) - 1;
    const day = parseInt(m2[3], 10);
    if (mon >= 0 && mon < 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, '0')}-${MONTH_NAMES[mon]}-${year}`;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const m3 = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m3) {
    const day = parseInt(m3[1], 10);
    const mon = parseInt(m3[2], 10) - 1;
    const year = parseInt(m3[3], 10);
    if (mon >= 0 && mon < 12 && day >= 1 && day <= 31) {
      return `${String(day).padStart(2, '0')}-${MONTH_NAMES[mon]}-${year}`;
    }
  }

  // Fallback to JS Date object
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = str.includes('Z') || str.includes('T') ? d.getUTCDate() : d.getDate();
    const mon = str.includes('Z') || str.includes('T') ? d.getUTCMonth() : d.getMonth();
    const year = str.includes('Z') || str.includes('T') ? d.getUTCFullYear() : d.getFullYear();
    return `${String(day).padStart(2, '0')}-${MONTH_NAMES[mon]}-${year}`;
  }

  return str;
}

// Convert any date format to YYYY-MM-DD for ISO needs
function toISODateString(val) {
  if (!val) return '';
  const str = String(val).trim();
  const m1 = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const d = parseInt(m1[1], 10);
    const m = MONTH_MAP[m1[2].toLowerCase()];
    const y = parseInt(m1[3], 10);
    if (m !== undefined) {
      return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  const m2 = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m2) {
    return `${m2[1]}-${String(m2[2]).padStart(2, '0')}-${String(m2[3]).padStart(2, '0')}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return '';
}

// Parse date to chronological millisecond timestamp for precise sorting
function parseDateTimestamp(val) {
  if (!val) return 0;
  const str = String(val).trim();
  const m1 = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const d = parseInt(m1[1], 10);
    const m = MONTH_MAP[m1[2].toLowerCase()];
    const y = parseInt(m1[3], 10);
    if (m !== undefined) return Date.UTC(y, m, d);
  }
  const m2 = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m2) {
    return Date.UTC(parseInt(m2[1], 10), parseInt(m2[2], 10) - 1, parseInt(m2[3], 10));
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? 0 : parsed;
}

function getTodayFormatted() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const mon = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${mon}-${year}`;
}

// Extract month information from a task's taskedDate
function extractTaskMonthInfo(taskedDateStr) {
  if (!taskedDateStr) return null;
  const str = String(taskedDateStr).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;

  // Pattern: DD-MMM-YYYY or D-MMM-YYYY (e.g. 03-Sep-2026, 3-Sep-2026)
  const m1 = str.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const monKey = m1[2].toLowerCase();
    const monIdx = MONTH_MAP[monKey];
    if (monIdx !== undefined) {
      return {
        monthKey: monKey,
        monthIndex: monIdx,
        monthName: FULL_MONTH_NAMES[monIdx],
        year: m1[3],
        monthYearKey: `${monKey}-${m1[3]}`.toLowerCase(),
        monthYearLabel: `${FULL_MONTH_NAMES[monIdx]} ${m1[3]}`
      };
    }
  }

  // Pattern: YYYY-MM-DD or YYYY/MM/DD
  const m2 = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m2) {
    const year = m2[1];
    const monIdx = parseInt(m2[2], 10) - 1;
    if (monIdx >= 0 && monIdx < 12) {
      const monKey = MONTH_NAMES[monIdx].toLowerCase();
      return {
        monthKey: monKey,
        monthIndex: monIdx,
        monthName: FULL_MONTH_NAMES[monIdx],
        year: year,
        monthYearKey: `${monKey}-${year}`.toLowerCase(),
        monthYearLabel: `${FULL_MONTH_NAMES[monIdx]} ${year}`
      };
    }
  }

  // Pattern: DD/MM/YYYY or DD-MM-YYYY
  const m3 = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (m3) {
    const year = m3[3];
    const monIdx = parseInt(m3[2], 10) - 1;
    if (monIdx >= 0 && monIdx < 12) {
      const monKey = MONTH_NAMES[monIdx].toLowerCase();
      return {
        monthKey: monKey,
        monthIndex: monIdx,
        monthName: FULL_MONTH_NAMES[monIdx],
        year: year,
        monthYearKey: `${monKey}-${year}`.toLowerCase(),
        monthYearLabel: `${FULL_MONTH_NAMES[monIdx]} ${year}`
      };
    }
  }

  // Fallback via JS Date
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const monIdx = str.includes('Z') || str.includes('T') ? d.getUTCMonth() : d.getMonth();
    const year = String(str.includes('Z') || str.includes('T') ? d.getUTCFullYear() : d.getFullYear());
    const monKey = MONTH_NAMES[monIdx].toLowerCase();
    return {
      monthKey: monKey,
      monthIndex: monIdx,
      monthName: FULL_MONTH_NAMES[monIdx],
      year: year,
      monthYearKey: `${monKey}-${year}`.toLowerCase(),
      monthYearLabel: `${FULL_MONTH_NAMES[monIdx]} ${year}`
    };
  }

  return null;
}

function matchesOperationsMonthFilter(task, filterVal) {
  if (!filterVal || filterVal.toLowerCase() === 'all') return true;
  const f = filterVal.toLowerCase().trim();
  const info = extractTaskMonthInfo(task.taskedDate);
  if (!info) {
    return f === 'unspecified' || f === 'none';
  }
  return info.monthKey === f || 
         info.monthName.toLowerCase() === f || 
         info.monthYearKey === f || 
         f.startsWith(info.monthKey) ||
         info.monthName.toLowerCase().startsWith(f);
}

function getOperationsMonthLabel(monthKey) {
  if (!monthKey || monthKey === 'all') return 'All Months';
  const found = CALENDAR_MONTHS.find(m => m.key === monthKey.toLowerCase());
  return found ? found.name : monthKey;
}

function extractTaskYear(taskedDateStr) {
  if (!taskedDateStr) return null;
  const str = String(taskedDateStr).trim();
  if (!str || str === '-' || str.toLowerCase() === 'n/a' || str.toLowerCase() === 'null') return null;
  const info = extractTaskMonthInfo(str);
  if (info && info.year) return String(info.year);
  const m = str.match(/\b(20\d\d)\b/);
  return m ? m[1] : null;
}

function matchesOperationsYearFilter(task, filterVal) {
  if (!filterVal || filterVal.toLowerCase() === 'all') return true;
  const f = filterVal.toLowerCase().trim();
  const yr = extractTaskYear(task.taskedDate);
  if (!yr) {
    return f === 'unspecified' || f === 'none';
  }
  return yr.toLowerCase() === f;
}

function getOperationsYearLabel(yearVal) {
  if (!yearVal || yearVal === 'all') return 'All Years';
  return `Year ${yearVal}`;
}

// Attach Flatpickr calendar picker with emerald styling and DD-MMM-YYYY format
function attachCalendarPicker(el, options = {}) {
  if (!el) return null;
  if (window.flatpickr) {
    if (el._flatpickr) {
      try { el._flatpickr.destroy(); } catch (err) {}
    }
    const currentVal = el.value || options.defaultDate || '';
    const formatted = formatDisplayDate(currentVal);
    if (formatted) el.value = formatted;

    const fp = window.flatpickr(el, {
      dateFormat: 'd-M-Y',
      defaultDate: formatted || undefined,
      allowInput: true,
      monthSelectorType: 'dropdown',
      animate: true,
      onOpen: function(selectedDates, dateStr, instance) {
        if (instance.calendarContainer) {
          instance.calendarContainer.style.zIndex = '99999';
        }
      },
      onChange: function(selectedDates, dateStr) {
        if (options.onChange) options.onChange(dateStr, selectedDates);
      },
      ...options
    });
    return fp;
  }
  return null;
}

// Auto-initialize all datepickers inside a container
function initAllDatePickers(container) {
  const root = container || document;
  const inputs = root.querySelectorAll('input[data-calendar="true"], input.date-picker-input');
  inputs.forEach(inp => {
    if (inp.value) {
      inp.value = formatDisplayDate(inp.value);
    }
    attachCalendarPicker(inp);
  });
}

function toggleTableSort(tableKey, col) {
  if (tableSortState[tableKey].col === col) {
    tableSortState[tableKey].asc = !tableSortState[tableKey].asc;
  } else {
    tableSortState[tableKey].col = col;
    tableSortState[tableKey].asc = true;
  }
}

function getSortHeaderIcon(tableKey, col) {
  if (tableSortState[tableKey].col !== col) {
    return `<span class="inline-block text-slate-300 ml-1 text-[11px] group-hover:text-slate-400">⇅</span>`;
  }
  return `<span class="inline-block text-emerald-600 font-bold ml-1 text-[11px]">${tableSortState[tableKey].asc ? '▲' : '▼'}</span>`;
}

function sortGenericRecords(list, col, asc) {
  return [...list].sort((a, b) => {
    let valA = a[col] ?? '';
    let valB = b[col] ?? '';

    if (typeof valA === 'object' && valA !== null) valA = JSON.stringify(valA);
    if (typeof valB === 'object' && valB !== null) valB = JSON.stringify(valB);

    valA = String(valA).trim();
    valB = String(valB).trim();

    // Check if chronological date
    const timeA = parseDateTimestamp(valA);
    const timeB = parseDateTimestamp(valB);
    if (timeA > 0 && timeB > 0 && (valA.includes('-') || valA.includes('/') || valB.includes('-') || valB.includes('/'))) {
      return asc ? timeA - timeB : timeB - timeA;
    }

    // Check if numeric (including currency like "Rs. 1,520.00" or numbers)
    const cleanA = valA.replace(/[^0-9.-]+/g, '');
    const cleanB = valB.replace(/[^0-9.-]+/g, '');
    const numA = parseFloat(cleanA);
    const numB = parseFloat(cleanB);
    const isNumA = cleanA !== '' && !isNaN(numA);
    const isNumB = cleanB !== '' && !isNaN(numB);

    if (isNumA && isNumB) {
      return asc ? numA - numB : numB - numA;
    }

    const cmp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
    return asc ? cmp : -cmp;
  });
}

function handleSort(tableKey, col) {
  toggleTableSort(tableKey, col);
  if (tableKey === 'operations') {
    handleOperationsFilter();
  } else if (tableKey === 'customer') {
    handleCustomerFilter();
  } else if (tableKey === 'financial') {
    handleFinancialFilter();
  } else if (tableKey === 'users') {
    handleUsersFilter();
  }
}

// ================= STICKY / FLOATING BOTTOM HORIZONTAL SCROLLBAR CONTROLLER =================
let stickyScrollbarEl = null;
let stickyScrollTrackEl = null;
let stickyScrollContentEl = null;
let stickyScrollPercentEl = null;
let stickyScrollLeftBtn = null;
let stickyScrollRightBtn = null;
let activeScrollTableContainer = null;
let isSyncingStickyScroll = false;
let stickyScrollRafId = null;

function initStickyBottomScrollbar() {
  stickyScrollbarEl = document.getElementById('stickyBottomScrollbar');
  if (!stickyScrollbarEl) return;

  stickyScrollTrackEl = document.getElementById('stickyScrollTrack');
  stickyScrollContentEl = document.getElementById('stickyScrollContent');
  stickyScrollPercentEl = document.getElementById('stickyScrollPercent');
  stickyScrollLeftBtn = document.getElementById('stickyScrollLeftBtn');
  stickyScrollRightBtn = document.getElementById('stickyScrollRightBtn');

  // Synchronize scroll from floating scrollbar -> active table
  if (stickyScrollTrackEl) {
    stickyScrollTrackEl.addEventListener('scroll', () => {
      if (isSyncingStickyScroll || !activeScrollTableContainer) return;
      isSyncingStickyScroll = true;
      activeScrollTableContainer.scrollLeft = stickyScrollTrackEl.scrollLeft;
      updateStickyPercent();
      requestAnimationFrame(() => { isSyncingStickyScroll = false; });
    }, { passive: true });

    // Handle mousewheel on floating scrollbar (convert vertical wheel to horizontal scroll)
    stickyScrollTrackEl.addEventListener('wheel', (e) => {
      if (!activeScrollTableContainer) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        activeScrollTableContainer.scrollLeft += e.deltaY;
      }
    }, { passive: false });
  }

  // Smooth nudge buttons
  if (stickyScrollLeftBtn) {
    stickyScrollLeftBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!activeScrollTableContainer) return;
      activeScrollTableContainer.scrollBy({ left: -300, behavior: 'smooth' });
    });
  }

  if (stickyScrollRightBtn) {
    stickyScrollRightBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!activeScrollTableContainer) return;
      activeScrollTableContainer.scrollBy({ left: 300, behavior: 'smooth' });
    });
  }

  // Listeners for window scroll, resize, and #mainContent scroll
  window.addEventListener('scroll', scheduleStickyScrollbarUpdate, { passive: true });
  window.addEventListener('resize', scheduleStickyScrollbarUpdate, { passive: true });

  const mainContent = document.getElementById('mainContent');
  if (mainContent) {
    mainContent.addEventListener('scroll', scheduleStickyScrollbarUpdate, { passive: true });

    // Observer to re-calculate whenever table DOM contents change or new views render
    if (window.MutationObserver) {
      const observer = new MutationObserver(() => {
        scheduleStickyScrollbarUpdate();
      });
      observer.observe(mainContent, { childList: true, subtree: true });
    }
  }

  scheduleStickyScrollbarUpdate();
}

function scheduleStickyScrollbarUpdate() {
  if (stickyScrollRafId) cancelAnimationFrame(stickyScrollRafId);
  stickyScrollRafId = requestAnimationFrame(updateStickyScrollbar);
}

function updateStickyPercent() {
  if (!activeScrollTableContainer) return;
  const maxScroll = activeScrollTableContainer.scrollWidth - activeScrollTableContainer.clientWidth;
  const currentScroll = activeScrollTableContainer.scrollLeft;

  if (stickyScrollPercentEl) {
    if (maxScroll <= 0) {
      stickyScrollPercentEl.textContent = '0%';
    } else {
      const pct = Math.min(100, Math.max(0, Math.round((currentScroll / maxScroll) * 100)));
      stickyScrollPercentEl.textContent = `${pct}%`;
    }
  }

  if (stickyScrollLeftBtn) {
    const atLeft = currentScroll <= 2;
    stickyScrollLeftBtn.style.opacity = atLeft ? '0.4' : '1';
    stickyScrollLeftBtn.style.pointerEvents = atLeft ? 'none' : 'auto';
  }
  if (stickyScrollRightBtn) {
    const atRight = currentScroll >= maxScroll - 2;
    stickyScrollRightBtn.style.opacity = atRight ? '0.4' : '1';
    stickyScrollRightBtn.style.pointerEvents = atRight ? 'none' : 'auto';
  }
}

function updateStickyScrollbar() {
  if (!stickyScrollbarEl) return;

  // 1. Hide if not in portal workspace (e.g. login screen)
  const portalWorkspace = document.getElementById('portalWorkspace');
  if (!portalWorkspace || portalWorkspace.classList.contains('hidden')) {
    hideStickyScrollbar();
    return;
  }

  // 2. Hide if modal or photo lightbox is open
  const modalBackdrop = document.getElementById('modalBackdrop');
  const photoLightbox = document.getElementById('photoLightbox');
  if ((modalBackdrop && !modalBackdrop.classList.contains('hidden')) ||
      (photoLightbox && !photoLightbox.classList.contains('hidden'))) {
    hideStickyScrollbar();
    return;
  }

  // 3. Find candidate table containers with horizontal scroll
  const containers = Array.from(document.querySelectorAll('.sticky-scrollable-table, .overflow-x-auto'))
    .filter(el => {
      return el.querySelector('table') && el.offsetParent !== null && el.clientWidth > 0;
    });

  if (!containers.length) {
    hideStickyScrollbar();
    return;
  }

  const vHeight = window.innerHeight;
  let targetContainer = null;
  let targetRect = null;

  for (const c of containers) {
    // Has meaningful horizontal overflow (> 4px)
    if (c.scrollWidth <= c.clientWidth + 4) continue;

    const r = c.getBoundingClientRect();
    // Conditions for sticky floating scrollbar:
    // a. The top of the table has started entering the viewport (r.top < vHeight - 40)
    // b. The bottom of the table is currently off-screen below the viewport (r.bottom > vHeight)
    // c. The table is still partially visible (not scrolled past the top: r.bottom > 80)
    if (r.top < vHeight - 40 && r.bottom > vHeight && r.bottom > 80) {
      targetContainer = c;
      targetRect = r;
      break;
    }
  }

  if (!targetContainer) {
    hideStickyScrollbar();
    return;
  }

  // 4. Bind listeners to active table
  if (activeScrollTableContainer !== targetContainer) {
    if (activeScrollTableContainer) {
      activeScrollTableContainer.removeEventListener('scroll', handleTableScroll);
    }
    activeScrollTableContainer = targetContainer;
    activeScrollTableContainer.addEventListener('scroll', handleTableScroll, { passive: true });
  }

  // 5. Update track inner width
  if (stickyScrollContentEl) {
    stickyScrollContentEl.style.width = `${targetContainer.scrollWidth}px`;
  }

  // 6. Synchronize current scroll position
  if (stickyScrollTrackEl && !isSyncingStickyScroll) {
    isSyncingStickyScroll = true;
    stickyScrollTrackEl.scrollLeft = targetContainer.scrollLeft;
    isSyncingStickyScroll = false;
  }
  updateStickyPercent();

  // 7. Calculate position and width matching the active table
  const pad = 12;
  const left = Math.max(pad, targetRect.left + pad);
  const maxWidth = targetRect.width - (2 * pad);
  const width = Math.max(180, Math.min(maxWidth, window.innerWidth - left - pad));

  stickyScrollbarEl.style.left = `${left}px`;
  stickyScrollbarEl.style.width = `${width}px`;

  // Responsive bottom placement (clear mobile bottom nav if screen < 768px)
  const isMobile = window.innerWidth < 768;
  stickyScrollbarEl.style.bottom = isMobile ? '76px' : '12px';

  // 8. Make visible
  stickyScrollbarEl.classList.remove('hidden');
}

function handleTableScroll() {
  if (isSyncingStickyScroll || !activeScrollTableContainer || !stickyScrollTrackEl) return;
  isSyncingStickyScroll = true;
  stickyScrollTrackEl.scrollLeft = activeScrollTableContainer.scrollLeft;
  updateStickyPercent();
  requestAnimationFrame(() => { isSyncingStickyScroll = false; });
}

function hideStickyScrollbar() {
  if (stickyScrollbarEl && !stickyScrollbarEl.classList.contains('hidden')) {
    stickyScrollbarEl.classList.add('hidden');
  }
  if (activeScrollTableContainer) {
    activeScrollTableContainer.removeEventListener('scroll', handleTableScroll);
    activeScrollTableContainer = null;
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', async () => {
  initStickyBottomScrollbar();
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
  initStickyBottomScrollbar();
  scheduleStickyScrollbarUpdate();
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

function toggleLoginPassword() {
  const pwdInput = document.getElementById('loginPassword');
  const icon = document.getElementById('togglePasswordIcon');
  if (!pwdInput) return;
  if (pwdInput.type === 'password') {
    pwdInput.type = 'text';
    if (icon) icon.setAttribute('data-lucide', 'eye-off');
  } else {
    pwdInput.type = 'password';
    if (icon) icon.setAttribute('data-lucide', 'eye');
  }
  if (window.lucide) lucide.createIcons();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const submitBtn = document.getElementById('loginSubmitBtn');
  const errBox = document.getElementById('authErrorBox');
  if (errBox) errBox.classList.add('hidden');

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-80', 'cursor-not-allowed');
    submitBtn.innerHTML = `<span>Signing In...</span><i data-lucide="loader" class="w-4 h-4 animate-spin"></i>`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    await loginAs(username, password);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-80', 'cursor-not-allowed');
      submitBtn.innerHTML = `<span>Sign In to Portal</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
      if (window.lucide) lucide.createIcons();
    }
  }
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
      document.cookie = `token=${encodeURIComponent(authToken)}; path=/; max-age=86400; SameSite=Lax`;
      currentUser = data.user;
      showPortalWorkspace();
      try {
        await loadInitialData();
        switchView(currentView || 'dashboard');
      } catch (uiErr) {
        console.error('Failed to initialize portal dashboard after login:', uiErr);
      }
      return true;
    } else {
      showAuthError(data.error || 'Invalid credentials');
      return false;
    }
  } catch (e) {
    showAuthError('Unable to connect to portal server. Please ensure the server is running.');
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
  document.cookie = 'token=; path=/; max-age=0; SameSite=Lax';
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

  // Restrict navigation buttons based on user permissions
  const navPayroll = document.getElementById('nav-payroll');
  if (navPayroll) {
    if (canView('payroll')) {
      navPayroll.classList.remove('hidden');
    } else {
      navPayroll.classList.add('hidden');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function canEdit(module) {
  if (!currentUser) return false;
  const perm = currentUser.permissions?.[module];
  if (perm === 'none') return false;
  if (['director', 'admin'].includes(currentUser.role)) return true;
  return perm === 'editor' || perm === 'full';
}

function canView(module) {
  if (!currentUser) return false;
  const perm = currentUser.permissions?.[module];
  if (perm === 'none') return false;
  if (['director', 'admin'].includes(currentUser.role)) return true;
  return ['viewer', 'editor', 'full'].includes(perm);
}

function isAdmin() {
  return currentUser && (currentUser.role === 'admin' || currentUser.role === 'director' || currentUser.permissions?.user_management === 'full');
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

    operationsTasks = (opsRes.tasks || []).map(t => ({
      ...t,
      taskedDate: formatDisplayDate(t.taskedDate),
      completedDate: formatDisplayDate(t.completedDate)
    }));
    customerRecords = (custRes.records || []).map(r => ({
      ...r,
      'Date of Incorporation': formatDisplayDate(r['Date of Incorporation'])
    }));
    financialRecords = (finRes.records || []).map(r => ({
      ...r,
      dateOfIncorp: formatDisplayDate(r.dateOfIncorp)
    }));
    operationsStats = statsRes || {};

    if (isAdmin()) {
      try {
        const uRes = await fetch('/api/users', { headers });
        if (uRes.ok) {
          const uData = await uRes.json();
          usersList = uData.users || [];
        }
      } catch (err) {}
    }

    // Update sidebar counters
    document.getElementById('navOpsCount').textContent = operationsTasks.length;
    document.getElementById('navCustomerCount').textContent = customerRecords.length;
    document.getElementById('navFinCount').textContent = financialRecords.length;

    if (canView('payroll')) {
      try {
        const payRes = await fetch('/api/payroll', { headers });
        if (payRes.ok) {
          payrollData = await payRes.json();
          activePayrollPeriod = payrollData.activePeriod || null;
          const countEl = document.getElementById('navPayrollCount');
          if (countEl && activePayrollPeriod) {
            countEl.textContent = activePayrollPeriod.employees?.length || 0;
          }
        }
      } catch (payErr) {
        console.warn('Failed to load payroll data:', payErr);
      }
    }
  } catch (e) {
    console.error('Initial data load failed:', e);
  }
}

// ================= VIEW SWITCHING =================
async function switchView(viewName) {
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
    case 'payroll':
      if (!canView('payroll')) {
        container.innerHTML = `
          <div class="p-12 text-center bg-white rounded-2xl border border-red-200 space-y-3 max-w-lg mx-auto my-12 shadow-sm">
            <div class="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <i data-lucide="lock" class="w-7 h-7"></i>
            </div>
            <h3 class="text-base font-bold text-slate-900">Payroll Access Restricted</h3>
            <p class="text-xs text-slate-600 leading-relaxed">Your account does not have authorization to view or manage corporate payroll records and bank remittance files. Please contact an Administrator or Director to update your permissions.</p>
          </div>
        `;
        if (window.lucide) lucide.createIcons();
      } else {
        await renderPayroll(container);
      }
      break;
    case 'access-control':
      await renderAccessControl(container);
      break;
    case 'know-it-all':
      renderDashboard(container);
      openKnowItAllModal();
      break;
    default:
      renderDashboard(container);
  }

  if (window.lucide) lucide.createIcons();
  initAllDatePickers(container);
  scheduleStickyScrollbarUpdate();
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

  // Active Payroll Metrics for Dashboard Integration
  const p = activePayrollPeriod;
  const payTotals = p?.totals || {};
  const payComp = (payrollData?.companies || []).find(c => c.id === p?.companyId) || (payrollData?.companies?.[0]) || { name: 'APADMI SL (PRIVATE) LIMITED', code: 'APADMI' };
  const payEmpCount = p?.employees?.length || 0;

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
            digitized client tax registers, and corporate dual-currency staff payroll cycles.
          </p>
          <div class="pt-2 flex flex-wrap items-center gap-3">
            <button onclick="switchView('operations')" class="px-4 py-2 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 font-semibold text-xs md:text-sm flex items-center gap-2 transition shadow-md">
              <i data-lucide="check-square" class="w-4 h-4 text-emerald-600"></i> My Operations Tracker
            </button>
            ${canView('payroll') ? `
              <button onclick="switchView('payroll')" class="px-4 py-2 rounded-xl bg-white text-teal-800 hover:bg-teal-50 font-semibold text-xs md:text-sm flex items-center gap-2 transition shadow-md">
                <i data-lucide="banknote" class="w-4 h-4 text-teal-600"></i> Corporate Payroll
              </button>
            ` : ''}
            <button onclick="switchView('customer-files')" class="px-4 py-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 text-white border border-white/20 font-medium text-xs md:text-sm flex items-center gap-2 transition">
              <i data-lucide="folder-archive" class="w-4 h-4 text-amber-300"></i> Customer Files DB
            </button>
            <button onclick="switchView('financial-files')" class="px-4 py-2 rounded-xl bg-emerald-900/40 hover:bg-emerald-900/60 text-white border border-white/20 font-medium text-xs md:text-sm flex items-center gap-2 transition">
              <i data-lucide="file-spreadsheet" class="w-4 h-4 text-emerald-300"></i> Financial Files DB
            </button>
            <button onclick="openKnowItAllModal()" class="px-4 py-2 rounded-xl bg-purple-900/50 hover:bg-purple-900/70 text-white border border-purple-300/30 font-medium text-xs md:text-sm flex items-center gap-2 transition group shadow-md">
              <i data-lucide="brain" class="w-4 h-4 text-purple-300 group-hover:rotate-12 transition-transform"></i>
              <span>Know It All</span>
              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-400/20 text-purple-200 border border-purple-300/30 font-semibold">To be done later</span>
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Overview Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        
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

        <!-- Corporate Payroll Card -->
        ${canView('payroll') ? `
          <div onclick="switchView('payroll')" class="glass-card p-5 bg-white border border-slate-200 hover:border-teal-400 rounded-2xl flex flex-col justify-between shadow-sm cursor-pointer transition group">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-teal-700 transition">Corporate Payroll</span>
              <div class="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200 group-hover:scale-110 transition-transform">
                <i data-lucide="banknote" class="w-4 h-4"></i>
              </div>
            </div>
            <div class="mt-4">
              <div class="text-2xl font-display font-bold text-slate-900 truncate">
                Rs ${formatMoney(payTotals.sumNetSalaryLkr || 5214427, 0)}
              </div>
              <div class="mt-1 text-xs text-slate-500 truncate flex items-center gap-1.5">
                <span class="font-semibold text-teal-700">${escapeHtml(p?.month || 'September 2026')}</span>
                <span>&bull;</span>
                <span>${payEmpCount || 17} Staff</span>
              </div>
            </div>
            <div class="mt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-2 font-medium">
              <span class="truncate">Rate: 1 GBP = ${formatMoney(p?.exchangeRate || 440, 0)} LKR</span>
              <span class="text-teal-700 font-bold group-hover:underline">Open &rarr;</span>
            </div>
          </div>
        ` : `
          <!-- Customer Files Card (Fallback if no payroll perms) -->
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
        `}

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
            <span>Editor: ${canEdit('operations') ? 'Ops' : ''} ${canEdit('payroll') ? 'Pay' : ''} ${canEdit('customer_files') ? 'Cust' : ''} ${canEdit('financial_files') ? 'Fin' : ''}</span>
            <span class="text-purple-600 font-bold">${currentUser && currentUser.role === 'admin' ? 'Superuser' : 'Verified'}</span>
          </div>
        </div>

      </div>

      <!-- Corporate Payroll Executive Summary Widget -->
      ${canView('payroll') ? `
        <div class="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 p-6 rounded-2xl text-white shadow-lg space-y-4 border border-slate-700/60 relative overflow-hidden">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div class="flex items-start sm:items-center gap-3.5">
              <div class="w-11 h-11 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-bold text-lg shadow-inner shrink-0">
                <i data-lucide="landmark" class="w-6 h-6"></i>
              </div>
              <div>
                <div class="flex items-center flex-wrap gap-2">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-teal-300 bg-teal-950 px-2 py-0.5 rounded border border-teal-700/60">Corporate Payroll Management</span>
                  <span class="text-xs text-slate-300 font-semibold">${escapeHtml(payComp.name)} (${escapeHtml(payComp.code || 'CO')})</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    Cycle: ${escapeHtml(p?.month || 'September 2026')} [${escapeHtml(p?.status || 'Finalized')}]
                  </span>
                </div>
                <h3 class="text-lg font-bold font-display tracking-tight text-white mt-1">
                  Salary Sheet &amp; Bank Remittance Overview
                </h3>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <button onclick="switchView('payroll')" class="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm">
                <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i>
                <span>Open Salary Sheet</span>
              </button>
              <button onclick="switchView('payroll'); setTimeout(() => switchPayrollSubTab('letter'), 150);" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition">
                <i data-lucide="file-text" class="w-3.5 h-3.5 text-amber-300"></i>
                <span>Bank Letter</span>
              </button>
              <button onclick="openManagePeriodsModal('${payComp.id}')" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs flex items-center gap-1.5 transition">
                <i data-lucide="calendar-range" class="w-3.5 h-3.5 text-teal-300"></i>
                <span>Manage Cycles</span>
              </button>
            </div>
          </div>

          <!-- Key Financial Metrics Bar -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-700/60 text-xs">
            <div class="p-3 rounded-xl bg-white/5 border border-white/10">
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Net Remittance (Bank Transfer)</span>
              <span class="text-lg sm:text-xl font-bold font-display text-emerald-300 block mt-0.5">
                Rs ${formatMoney(payTotals.sumNetSalaryLkr || 5214427, 2)}
              </span>
              <span class="text-[10px] text-slate-400">${payEmpCount || 17} Staff Members</span>
            </div>

            <div class="p-3 rounded-xl bg-white/5 border border-white/10">
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Contracted Base (GBP)</span>
              <span class="text-lg sm:text-xl font-bold font-display text-blue-300 block mt-0.5">
                &pound; ${formatMoney(payTotals.sumEarnedGbp || 13874.71, 2)}
              </span>
              <span class="text-[10px] text-slate-400">@ 1 GBP = Rs ${formatMoney(p?.exchangeRate || 440, 2)}</span>
            </div>

            <div class="p-3 rounded-xl bg-white/5 border border-white/10">
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Statutory EPF &amp; ETF</span>
              <span class="text-lg sm:text-xl font-bold font-display text-amber-300 block mt-0.5">
                Rs ${formatMoney((payTotals.sumEpf8Lkr || 468645.6) + (payTotals.sumEpf12Lkr || 702968.4) + (payTotals.sumEtf3Lkr || 175742.1), 2)}
              </span>
              <span class="text-[10px] text-slate-400">Total Statutory Liabilities</span>
            </div>

            <div class="p-3 rounded-xl bg-white/5 border border-white/10">
              <span class="text-slate-400 block text-[10px] uppercase font-semibold">Debit Account &amp; Branch</span>
              <span class="font-mono text-xs font-bold text-teal-300 truncate block mt-0.5">
                ${escapeHtml((p && p.debitAccountNo) || payComp.debitAccountNo || '1001 5000 7554')}
              </span>
              <span class="text-[10px] text-slate-400 truncate block">${escapeHtml((p && p.bankName) || payComp.bankName || 'Nations Trust Bank')} (${escapeHtml((p && p.bankBranch) || payComp.bankBranch || 'Borella')})</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Dedicated Know It All Section (In Development) -->
      <div class="bg-gradient-to-r from-purple-50 via-indigo-50/40 to-white p-5 rounded-2xl border border-purple-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="flex items-start gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-md">
            <i data-lucide="brain" class="w-5 h-5"></i>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-display font-bold text-base text-slate-900">Know It All — Corporate Intelligence Engine</h3>
              <span class="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded border border-purple-200">
                To Be Done Later
              </span>
            </div>
            <p class="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Centralized AI-powered knowledge repository connecting bilateral business council archives, standard operating procedures (SOPs), company charters, IRD compliance blueprints, and automated querying.
            </p>
          </div>
        </div>
        <button onclick="openKnowItAllModal()" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shrink-0 transition flex items-center gap-2 shadow-sm">
          <i data-lucide="sparkles" class="w-3.5 h-3.5"></i> Preview Scope
        </button>
      </div>

      <!-- Quick Operational Shortcuts -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
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

        ${canView('payroll') ? `
          <div class="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-3">
            <div class="flex items-center gap-3">
              <div class="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
                <i data-lucide="banknote" class="w-5 h-5"></i>
              </div>
              <div>
                <h3 class="font-semibold text-sm text-slate-900">Corporate Payroll</h3>
                <p class="text-xs text-slate-500">Staff salaries, EPF/ETF &amp; bank letters</p>
              </div>
            </div>
            <button onclick="switchView('payroll')" class="w-full py-2 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-semibold rounded-xl border border-teal-200 transition">
              Open Payroll &rarr;
            </button>
          </div>
        ` : ''}

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
  
  // Calculate Tracker Status Row exactly matching Google Sheet / Screenshot 2
  const total = operationsTasks.length;
  const pending = operationsTasks.filter(t => (t.status || '').toLowerCase() === 'pending').length;
  const inProgress = operationsTasks.filter(t => (t.status || '').toLowerCase() === 'in progress').length;
  const completed = operationsTasks.filter(t => (t.status || '').toLowerCase() === 'completed').length;
  const onHold = operationsTasks.filter(t => (t.status || '').toLowerCase() === 'on hold').length;
  const progressPct = total > 0 ? ((completed / total) * 100).toFixed(1) : '0.0';

  // Extract unique workstreams and requesters for dynamic filters
  const workstreams = [...new Set(operationsTasks.map(t => t.workstream).filter(Boolean))].sort();
  const requesters = [...new Set(operationsTasks.map(t => t.requestedBy).filter(Boolean))].sort();

  // Compute task counts per year and month based on taskedDate
  const yearCounts = {};
  const monthCounts = {};
  operationsTasks.forEach(t => {
    const yr = extractTaskYear(t.taskedDate);
    if (yr) {
      yearCounts[yr] = (yearCounts[yr] || 0) + 1;
    }
    const info = extractTaskMonthInfo(t.taskedDate);
    if (info) {
      monthCounts[info.monthKey] = (monthCounts[info.monthKey] || 0) + 1;
    }
  });

  const availableYears = Object.keys(yearCounts).sort().reverse();
  if (availableYears.length === 0) availableYears.push('2026');

  const monthOptions = CALENDAR_MONTHS.map(m => ({
    ...m,
    count: monthCounts[m.key] || 0
  }));


  container.innerHTML = `
    <div class="space-y-6 fade-in">
      
      <!-- Top Action Bar -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-display font-bold text-xl text-slate-900">Operations Tracker</h2>
            <span class="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              ${operationsUserFilter === 'all' ? 'All Team Tasks' : (operationsUserFilter === 'me' ? 'My Personal Tasks' : 'Filtered User Tasks')}
            </span>
          </div>
          <p class="text-xs text-slate-500 mt-1">
            ${operationsUserFilter === 'all' ? 'Viewing combined tasks across all company personnel' : (operationsUserFilter === 'me' ? `Personal task log for ${currentUser ? currentUser.fullName : 'You'}` : 'Viewing specific user deliverables')} &middot; Live synchronized with Google Sheet
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
                <option value="usr_admin_zaharan" ${operationsUserFilter === 'usr_admin_zaharan' ? 'selected' : ''}>Muhammad Zaharan</option>
                <option value="usr_dir_master" ${operationsUserFilter === 'usr_dir_master' ? 'selected' : ''}>Executive Director</option>
                <option value="usr_admin_master" ${operationsUserFilter === 'usr_admin_master' ? 'selected' : ''}>Admin</option>
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

      <!-- Tracker Status Summary Row (Screenshot 2 Match) -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <!-- Total -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Total Tasks</div>
            <div class="text-2xl font-bold font-display text-slate-900 mt-0.5">${total}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs"><i data-lucide="layers" class="w-4 h-4"></i></div>
        </div>
        <!-- Pending -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-amber-600 tracking-wider">Pending</div>
            <div class="text-2xl font-bold font-display text-amber-600 mt-0.5">${pending}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold text-xs"><i data-lucide="clock" class="w-4 h-4"></i></div>
        </div>
        <!-- In Progress -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-blue-600 tracking-wider">In Progress</div>
            <div class="text-2xl font-bold font-display text-blue-600 mt-0.5">${inProgress}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs"><i data-lucide="loader" class="w-4 h-4"></i></div>
        </div>
        <!-- Completed -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-emerald-600 tracking-wider">Completed</div>
            <div class="text-2xl font-bold font-display text-emerald-600 mt-0.5">${completed}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs"><i data-lucide="check-circle-2" class="w-4 h-4"></i></div>
        </div>
        <!-- On Hold -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-purple-600 tracking-wider">On Hold</div>
            <div class="text-2xl font-bold font-display text-purple-600 mt-0.5">${onHold}</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs"><i data-lucide="pause-circle" class="w-4 h-4"></i></div>
        </div>
        <!-- Progress % -->
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-teal-600 tracking-wider">Completion</div>
            <div class="text-2xl font-bold font-display text-teal-600 mt-0.5">${progressPct}%</div>
          </div>
          <div class="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-bold text-xs"><i data-lucide="trending-up" class="w-4 h-4"></i></div>
        </div>
      </div>

      <!-- Date Filter Pills Bar (Year & Month Quick Switcher) -->
      <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
        <!-- Year Switcher Row -->
        <div class="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-thin">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1.5">
            <i data-lucide="calendar-days" class="w-3.5 h-3.5 text-blue-600"></i>
            <span>Tasked Year:</span>
          </span>
          <button onclick="setOperationsYearFilter('all')" data-year="all" class="ops-year-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${operationsYearFilter === 'all' ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}">
            All Years (${total})
          </button>
          ${availableYears.map(yr => `
            <button onclick="setOperationsYearFilter('${yr}')" data-year="${yr}" class="ops-year-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${operationsYearFilter === yr ? 'bg-blue-600 text-white shadow-xs font-bold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}">
              ${yr} ${yearCounts[yr] > 0 ? `<span class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${operationsYearFilter === yr ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700 font-bold'}">${yearCounts[yr]}</span>` : ''}
            </button>
          `).join('')}
        </div>

        <!-- Month Switcher Row -->
        <div class="border-t border-slate-100 pt-2 flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-thin">
          <span class="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1.5">
            <i data-lucide="calendar" class="w-3.5 h-3.5 text-emerald-600"></i>
            <span>Tasked Month:</span>
          </span>
          <button onclick="setOperationsMonthFilter('all')" data-month="all" class="ops-month-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${operationsMonthFilter === 'all' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}">
            All Months (${total})
          </button>
          ${monthOptions.map(m => `
            <button onclick="setOperationsMonthFilter('${m.key}')" data-month="${m.key}" class="ops-month-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${operationsMonthFilter === m.key ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'}">
              ${m.name} ${m.count > 0 ? `<span class="ml-1 px-1.5 py-0.5 rounded-full text-[10px] ${operationsMonthFilter === m.key ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700 font-bold'}">${m.count}</span>` : ''}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- Search & Dynamic Filters -->
      <div class="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
          <div class="relative sm:col-span-2 lg:col-span-2">
            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
            <input type="text" id="opsSearchInput" oninput="handleOperationsFilter()" placeholder="Search tasks, deliverables, requesters, notes, costs..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
          </div>
          <div>
            <select id="opsYearFilter" onchange="setOperationsYearFilter(this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium cursor-pointer">
              <option value="all" ${operationsYearFilter === 'all' ? 'selected' : ''}>🗓️ All Years (${total})</option>
              ${availableYears.map(yr => `
                <option value="${yr}" ${operationsYearFilter === yr ? 'selected' : ''}>
                  Year ${yr} ${yearCounts[yr] ? `(${yearCounts[yr]})` : ''}
                </option>
              `).join('')}
            </select>
          </div>
          <div>
            <select id="opsMonthFilter" onchange="setOperationsMonthFilter(this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-medium cursor-pointer">
              <option value="all" ${operationsMonthFilter === 'all' ? 'selected' : ''}>📅 All Months (${total})</option>
              ${monthOptions.map(m => `
                <option value="${m.key}" ${operationsMonthFilter === m.key ? 'selected' : ''}>
                  ${m.name} ${m.count > 0 ? `(${m.count})` : ''}
                </option>
              `).join('')}
            </select>
          </div>
          <div>
            <select id="opsWorkstreamFilter" onchange="handleOperationsFilter()" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
              <option value="">All Workstreams (${workstreams.length})</option>
              ${workstreams.map(w => `<option value="${w}">${w}</option>`).join('')}
            </select>
          </div>
          <div>
            <select id="opsStatusFilter" onchange="handleOperationsFilter()" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
              <option value="">All Statuses</option>
              <option value="Completed">Completed</option>
              <option value="In Progress">In Progress</option>
              <option value="Pending">Pending</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
          <div>
            <select id="opsPriorityFilter" onchange="handleOperationsFilter()" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
              <option value="">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>


        <div class="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 gap-2">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-1.5">
              <span>Filter by Requester:</span>
              <select id="opsRequestedByFilter" onchange="handleOperationsFilter()" class="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px] text-slate-700 focus:outline-none">
                <option value="">All Requesters</option>
                ${requesters.map(r => `<option value="${r}">${r}</option>`).join('')}
              </select>
            </div>
            <span id="opsActiveFilterBadge" class="hidden inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <i data-lucide="filter" class="w-3 h-3 text-emerald-600"></i>
              <span id="opsActiveFilterText">Filtered</span>
              <button onclick="resetOperationsFilters()" class="ml-1 text-slate-400 hover:text-red-500 font-bold" title="Reset all filters">&times;</button>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span id="opsFilteredCountBadge" class="font-semibold text-slate-600">Showing all ${total} tasks</span>
            <span class="text-slate-300 hidden sm:inline">|</span>
            <span class="text-slate-400 hidden sm:inline">Click any column header to sort (&Delta;/&nabla;)</span>
          </div>
        </div>
      </div>

      <!-- Container for Table or Kanban -->
      <div id="operationsContainer">
        ${operationsViewMode === 'table' ? renderOperationsTable(getFilteredOperations()) : renderOperationsKanban(getFilteredOperations())}
      </div>

    </div>
  `;
}

function getFilteredOperations() {
  const q = (document.getElementById('opsSearchInput')?.value || '').toLowerCase();
  const status = document.getElementById('opsStatusFilter')?.value || '';
  const priority = document.getElementById('opsPriorityFilter')?.value || '';
  const workstream = document.getElementById('opsWorkstreamFilter')?.value || '';
  const requestedBy = document.getElementById('opsRequestedByFilter')?.value || '';
  const monthFilter = document.getElementById('opsMonthFilter')?.value || operationsMonthFilter || 'all';
  const yearFilter = document.getElementById('opsYearFilter')?.value || operationsYearFilter || 'all';

  let filtered = operationsTasks.filter(t => {
    const mSearch = !q || 
      (t.title || '').toLowerCase().includes(q) || 
      (t.notes || '').toLowerCase().includes(q) || 
      (t.workstream || '').toLowerCase().includes(q) ||
      (t.requestedBy || '').toLowerCase().includes(q) ||
      (t.estimatedCost || '').toLowerCase().includes(q) ||
      String(t.no || '').toLowerCase().includes(q);
    const mStatus = !status || (t.status || '').toLowerCase() === status.toLowerCase();
    const mPri = !priority || (t.priority || '').toLowerCase() === priority.toLowerCase();
    const mWork = !workstream || (t.workstream || '').toLowerCase() === workstream.toLowerCase();
    const mReq = !requestedBy || (t.requestedBy || '').toLowerCase() === requestedBy.toLowerCase();
    const mMonth = matchesOperationsMonthFilter(t, monthFilter);
    const mYear = matchesOperationsYearFilter(t, yearFilter);

    return mSearch && mStatus && mPri && mWork && mReq && mMonth && mYear;
  });

  const sortCol = tableSortState.operations.col;
  const sortAsc = tableSortState.operations.asc;
  return sortGenericRecords(filtered, sortCol, sortAsc);
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
    const filtered = getFilteredOperations();
    container.innerHTML = mode === 'table' ? renderOperationsTable(filtered) : renderOperationsKanban(filtered);
    if (window.lucide) lucide.createIcons();
  }
}

function handleOperationsFilter() {
  const filtered = getFilteredOperations();
  const container = document.getElementById('operationsContainer');
  if (container) {
    container.innerHTML = operationsViewMode === 'table' ? renderOperationsTable(filtered) : renderOperationsKanban(filtered);
    if (window.lucide) lucide.createIcons();
  }
  updateOperationsFilterBadges(filtered.length);
}

function updateOperationsFilterBadges(filteredCount) {
  const badge = document.getElementById('opsFilteredCountBadge');
  const activeBadge = document.getElementById('opsActiveFilterBadge');
  const activeText = document.getElementById('opsActiveFilterText');
  const total = operationsTasks.length;
  const mLabel = getOperationsMonthLabel(operationsMonthFilter);
  const yLabel = getOperationsYearLabel(operationsYearFilter);

  if (badge) {
    if (operationsMonthFilter !== 'all' || operationsYearFilter !== 'all') {
      const parts = [];
      if (operationsMonthFilter !== 'all') parts.push(mLabel);
      if (operationsYearFilter !== 'all') parts.push(operationsYearFilter);
      badge.innerHTML = `<span class="text-emerald-700 font-bold">${filteredCount}</span> of ${total} tasks (${parts.join(' ')})`;
    } else {
      badge.textContent = `Showing ${filteredCount} of ${total} tasks`;
    }
  }

  const q = document.getElementById('opsSearchInput')?.value?.trim();
  const status = document.getElementById('opsStatusFilter')?.value;
  const priority = document.getElementById('opsPriorityFilter')?.value;
  const workstream = document.getElementById('opsWorkstreamFilter')?.value;
  const req = document.getElementById('opsRequestedByFilter')?.value;
  const hasFilter = (operationsMonthFilter !== 'all') || (operationsYearFilter !== 'all') || q || status || priority || workstream || req;

  if (activeBadge) {
    if (hasFilter) {
      activeBadge.classList.remove('hidden');
      if (activeText) {
        const parts = [];
        if (operationsYearFilter !== 'all') parts.push(`Year ${operationsYearFilter}`);
        if (operationsMonthFilter !== 'all') parts.push(mLabel);
        if (status) parts.push(status);
        if (priority) parts.push(priority);
        if (workstream) parts.push(workstream);
        if (req) parts.push(req);
        if (q) parts.push(`"${q}"`);
        activeText.textContent = parts.join(' • ');
      }
    } else {
      activeBadge.classList.add('hidden');
    }
  }
}

function setOperationsMonthFilter(val) {
  operationsMonthFilter = val || 'all';
  const sel = document.getElementById('opsMonthFilter');
  if (sel && sel.value !== operationsMonthFilter) {
    sel.value = operationsMonthFilter;
  }

  // Synchronize pill button styles
  document.querySelectorAll('.ops-month-pill').forEach(btn => {
    const m = btn.getAttribute('data-month');
    if (m === operationsMonthFilter) {
      btn.className = 'ops-month-pill px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition bg-emerald-600 text-white shadow-xs';
    } else {
      btn.className = 'ops-month-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200';
    }
  });

  handleOperationsFilter();
}

function setOperationsYearFilter(val) {
  operationsYearFilter = val || 'all';
  const sel = document.getElementById('opsYearFilter');
  if (sel && sel.value !== operationsYearFilter) {
    sel.value = operationsYearFilter;
  }

  // Synchronize year pill button styles
  document.querySelectorAll('.ops-year-pill').forEach(btn => {
    const yr = btn.getAttribute('data-year');
    if (yr === operationsYearFilter) {
      btn.className = 'ops-year-pill px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition bg-blue-600 text-white shadow-xs';
    } else {
      btn.className = 'ops-year-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200';
    }
  });

  handleOperationsFilter();
}

function resetOperationsFilters() {
  const searchEl = document.getElementById('opsSearchInput');
  const statusEl = document.getElementById('opsStatusFilter');
  const priEl = document.getElementById('opsPriorityFilter');
  const workEl = document.getElementById('opsWorkstreamFilter');
  const reqEl = document.getElementById('opsRequestedByFilter');
  const monthEl = document.getElementById('opsMonthFilter');
  const yearEl = document.getElementById('opsYearFilter');

  if (searchEl) searchEl.value = '';
  if (statusEl) statusEl.value = '';
  if (priEl) priEl.value = '';
  if (workEl) workEl.value = '';
  if (reqEl) reqEl.value = '';
  if (monthEl) monthEl.value = 'all';
  if (yearEl) yearEl.value = 'all';

  operationsMonthFilter = 'all';
  operationsYearFilter = 'all';

  // Synchronize month pill button styles
  document.querySelectorAll('.ops-month-pill').forEach(btn => {
    const m = btn.getAttribute('data-month');
    if (m === 'all') {
      btn.className = 'ops-month-pill px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition bg-emerald-600 text-white shadow-xs';
    } else {
      btn.className = 'ops-month-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200';
    }
  });

  // Synchronize year pill button styles
  document.querySelectorAll('.ops-year-pill').forEach(btn => {
    const yr = btn.getAttribute('data-year');
    if (yr === 'all') {
      btn.className = 'ops-year-pill px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition bg-blue-600 text-white shadow-xs';
    } else {
      btn.className = 'ops-year-pill px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200';
    }
  });

  handleOperationsFilter();
}

// 10-Column Operations Tracker Table
function renderOperationsTable(tasks) {
  const isPrivileged = currentUser && ['director', 'admin'].includes(currentUser.role);
  if (!tasks.length) {
    const mLabel = getOperationsMonthLabel(operationsMonthFilter);
    const hasDateFilter = (operationsMonthFilter !== 'all') || (operationsYearFilter !== 'all');
    let filterPeriodDesc = '';
    if (operationsMonthFilter !== 'all' && operationsYearFilter !== 'all') {
      filterPeriodDesc = `${mLabel} ${operationsYearFilter}`;
    } else if (operationsMonthFilter !== 'all') {
      filterPeriodDesc = mLabel;
    } else if (operationsYearFilter !== 'all') {
      filterPeriodDesc = `Year ${operationsYearFilter}`;
    }

    return `
      <div class="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-3 shadow-sm">
        <div class="w-12 h-12 mx-auto rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
          <i data-lucide="calendar-x" class="w-6 h-6 text-slate-400"></i>
        </div>
        <div class="text-sm font-semibold text-slate-700">
          ${hasDateFilter ? `No tasks found tasked in ${filterPeriodDesc}` : 'No personal tasks recorded yet'}
        </div>
        <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          ${hasDateFilter 
            ? `There are no deliverables with a Tasked Date recorded for ${filterPeriodDesc}. You can view tasks from other dates or record a new deliverable.` 
            : (isPrivileged ? 'Select "👥 All Team Tasks" in the dropdown above to view company tasks, or click "Add Task" to record an executive deliverable.' : 'Click "Add Task" above to create your first deliverable.')}
        </p>
        <div class="pt-1 flex items-center justify-center gap-2">
          ${hasDateFilter ? `
            <button onclick="resetOperationsFilters()" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5">
              <i data-lucide="calendar" class="w-3.5 h-3.5"></i> View All Dates
            </button>
          ` : ''}
          <button onclick="openAddOperationModal()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 ${!canEdit('operations') ? 'permission-locked' : ''}">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i> Add Task
          </button>
        </div>
      </div>
    `;
  }



  return `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto sticky-scrollable-table" data-sticky-scroll="true">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th onclick="handleSort('operations', 'no')" class="py-3 px-3.5 w-12 cursor-pointer select-none hover:bg-slate-100 transition">
                No. ${getSortHeaderIcon('operations', 'no')}
              </th>
              <th onclick="handleSort('operations', 'title')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition min-w-[220px]">
                Task / Procurement Item ${getSortHeaderIcon('operations', 'title')}
              </th>
              <th onclick="handleSort('operations', 'requestedBy')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Requested By ${getSortHeaderIcon('operations', 'requestedBy')}
              </th>
              <th onclick="handleSort('operations', 'workstream')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Workstream ${getSortHeaderIcon('operations', 'workstream')}
              </th>
              <th onclick="handleSort('operations', 'taskedDate')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Tasked Date ${getSortHeaderIcon('operations', 'taskedDate')}
              </th>
              <th onclick="handleSort('operations', 'completedDate')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Completed Date ${getSortHeaderIcon('operations', 'completedDate')}
              </th>
              <th onclick="handleSort('operations', 'status')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Status ${getSortHeaderIcon('operations', 'status')}
              </th>
              <th onclick="handleSort('operations', 'priority')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Priority ${getSortHeaderIcon('operations', 'priority')}
              </th>
              <th onclick="handleSort('operations', 'estimatedCost')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Estimated Cost (LKR) ${getSortHeaderIcon('operations', 'estimatedCost')}
              </th>
              <th onclick="handleSort('operations', 'notes')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition min-w-[240px]">
                Notes / Action Details ${getSortHeaderIcon('operations', 'notes')}
              </th>
              <th class="py-3 px-3.5 text-right sticky right-0 bg-slate-50">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${tasks.map(t => `
              <tr class="hover:bg-slate-50/80 transition">
                <td class="py-3 px-3.5 font-mono text-slate-500 font-semibold">${t.no ?? t.id}</td>
                <td class="py-3 px-3.5">
                  <div class="font-semibold text-slate-900">${t.title || 'Untitled Task'}</div>
                  ${t.assignedTo ? `<div class="text-[10px] text-slate-400 mt-0.5">Assigned: ${t.assignedTo}</div>` : ''}
                </td>
                <td class="py-3 px-3.5 text-slate-700 font-medium">${t.requestedBy || '-'}</td>
                <td class="py-3 px-3.5">
                  <span class="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                    ${t.workstream || 'Operations'}
                  </span>
                      <td class="py-3 px-3.5 text-slate-600 font-mono text-[11px]">${formatDisplayDate(t.taskedDate) || '-'}</td>
                <td class="py-3 px-3.5 text-slate-600 font-mono text-[11px]">${formatDisplayDate(t.completedDate) || '-'}</td>
                <td class="py-3 px-3.5">
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${getStatusBadgeClass(t.status)}">
                    ${t.status || 'Pending'}
                  </span>
                </td>
                <td class="py-3 px-3.5">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${getPriorityBadgeClass(t.priority)}">
                    ${t.priority || 'Medium'}
                  </span>
                </td>
                <td class="py-3 px-3.5 font-medium text-slate-800">
                  ${t.estimatedCost ? `<span class="font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">${t.estimatedCost}</span>` : '<span class="text-slate-400">-</span>'}
                </td>
                <td class="py-3 px-3.5 max-w-xs whitespace-normal text-slate-600 text-[11px] leading-relaxed">
                  ${t.notes || '<span class="text-slate-400">-</span>'}
                </td>
                <td class="py-3 px-3.5 text-right sticky right-0 bg-white/95 backdrop-blur-xs space-x-1">
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
      <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
        <span>Showing ${tasks.length} of ${operationsTasks.length} tasks</span>
        <span class="font-mono">Sorted by: ${tableSortState.operations.col} (${tableSortState.operations.asc ? 'Ascending' : 'Descending'})</span>
      </div>
    </div>
  `;
}

function renderOperationsKanban(tasks) {
  const columns = ['Pending', 'In Progress', 'Completed', 'On Hold'];

  return `
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
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

                  <div class="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-slate-500 font-mono">
                    ${t.taskedDate ? `<span class="inline-flex items-center gap-1 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200" title="Tasked Date"><i data-lucide="calendar" class="w-3 h-3 text-slate-400"></i> ${formatDisplayDate(t.taskedDate)}</span>` : ''}
                    ${t.completedDate ? `<span class="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200" title="Completed Date"><i data-lucide="check-circle-2" class="w-3 h-3 text-emerald-600"></i> ${formatDisplayDate(t.completedDate)}</span>` : ''}
                  </div>

                  <div class="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                    <span class="truncate">${t.requestedBy || 'Self'}</span>
                    <div class="flex items-center gap-1 shrink-0">
                      ${col !== 'Pending' ? `
                        <button onclick="quickUpdateTaskStatus('${t.id}', 'Pending')" class="text-slate-400 hover:text-slate-700 p-1" title="Mark Pending">
                          <i data-lucide="chevron-left" class="w-3.5 h-3.5"></i>
                        </button>
                      ` : ''}
                      ${col !== 'Completed' ? `
                        <button onclick="quickUpdateTaskStatus('${t.id}', 'Completed')" class="text-slate-400 hover:text-emerald-600 p-1" title="Mark Completed">
                          <i data-lucide="check" class="w-3.5 h-3.5"></i>
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
    case 'low': return 'bg-slate-100 text-slate-700 border border-slate-200';
    default: return 'bg-slate-100 text-slate-700 border border-slate-200';
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
        completedDate: newStatus === 'Completed' ? getTodayFormatted() : ''
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
  const totalCount = customerRecords.length;
  const origCount = customerRecords.filter(r => (r.Type || '').toLowerCase().includes('original')).length;
  const copyCount = customerRecords.filter(r => (r.Type || '').toLowerCase().includes('copy')).length;
  const uniqueCompanies = [...new Set(customerRecords.map(r => r['Company Name']).filter(Boolean))].length;

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

      <!-- Physical Archive Counts Banner (Mentioning Number of Original and Copy Files) -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">Total Physical Files</div>
            <div class="text-2xl font-bold font-display text-slate-900 mt-0.5">${totalCount}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Across All Cupboards</div>
          </div>
          <div class="w-9 h-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs"><i data-lucide="archive" class="w-4 h-4"></i></div>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-emerald-700 tracking-wider">Original Files</div>
            <div class="text-2xl font-bold font-display text-emerald-700 mt-0.5">${origCount}</div>
            <div class="text-[10px] text-emerald-600 font-medium mt-0.5">Stored in Cupboard 1</div>
          </div>
          <div class="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs border border-emerald-200"><i data-lucide="file-check-2" class="w-4 h-4"></i></div>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-blue-700 tracking-wider">Customer Copies</div>
            <div class="text-2xl font-bold font-display text-blue-700 mt-0.5">${copyCount}</div>
            <div class="text-[10px] text-blue-600 font-medium mt-0.5">Stored in Cupboards 2 & 3</div>
          </div>
          <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-200"><i data-lucide="copy" class="w-4 h-4"></i></div>
        </div>
        <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div class="text-[11px] font-semibold uppercase text-purple-700 tracking-wider">Unique Companies</div>
            <div class="text-2xl font-bold font-display text-purple-700 mt-0.5">${uniqueCompanies}</div>
            <div class="text-[10px] text-purple-600 font-medium mt-0.5">Dual-Archived Portfolio</div>
          </div>
          <div class="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs border border-purple-200"><i data-lucide="building-2" class="w-4 h-4"></i></div>
        </div>
      </div>

      <!-- Cupboards Tabs & Filter Bar -->
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div class="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          ${['All', 'Cupboard 1', 'Cupboard 2', 'Cupboard 3'].map(c => `
            <button onclick="setCustomerCupboardFilter('${c}')" class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${customerCupboardFilter === c ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'}">
              ${c === 'All' ? `All Cupboards (${totalCount})` : c === 'Cupboard 1' ? `${c} (${origCount} Orig)` : `${c} (Copies)`}
            </button>
          `).join('')}
        </div>

        <div class="flex items-center gap-2 w-full sm:w-96">
          <div class="relative w-full">
            <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
            <input type="text" id="custSearchInput" oninput="handleCustomerFilter()" placeholder="Search company, reg no, box, no..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
          </div>
          <select id="custTypeFilter" onchange="handleCustomerFilter()" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none">
            <option value="">All Types</option>
            <option value="original">Originals (${origCount})</option>
            <option value="copy">Copies (${copyCount})</option>
          </select>
        </div>
      </div>

      <!-- Container -->
      <div id="customerContentContainer">
        ${customerViewMode === 'table' ? renderCustomerTable(getFilteredCustomerRecords()) : renderCustomerBoxes(getFilteredCustomerRecords())}
      </div>

    </div>
  `;
}

function getFilteredCustomerRecords() {
  const q = (document.getElementById('custSearchInput')?.value || '').toLowerCase();
  const type = (document.getElementById('custTypeFilter')?.value || '').toLowerCase();

  let filtered = customerRecords.filter(r => {
    const compMatch = !q || 
      (r['Company Name'] || '').toLowerCase().includes(q) || 
      (r['Registration No'] || '').toLowerCase().includes(q) || 
      (r['Box No'] || '').toLowerCase().includes(q) || 
      (r['No'] || '').toLowerCase().includes(q) ||
      (r['Category'] || '').toLowerCase().includes(q);
    const cupMatch = customerCupboardFilter === 'All' || (r['Cupboard'] || '').toLowerCase() === customerCupboardFilter.toLowerCase();
    const typeMatch = !type || (r['Type'] || '').toLowerCase().includes(type);
    return compMatch && cupMatch && typeMatch;
  });

  const sortCol = tableSortState.customer.col;
  const sortAsc = tableSortState.customer.asc;
  return sortGenericRecords(filtered, sortCol, sortAsc);
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
  const filtered = getFilteredCustomerRecords();
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

  const origCount = records.filter(r => (r.Type || '').toLowerCase().includes('original')).length;
  const copyCount = records.filter(r => (r.Type || '').toLowerCase().includes('copy')).length;

  return `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto sticky-scrollable-table" data-sticky-scroll="true">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th onclick="handleSort('customer', 'No')" class="py-3 px-3.5 w-12 cursor-pointer select-none hover:bg-slate-100 transition">
                No ${getSortHeaderIcon('customer', 'No')}
              </th>
              <th onclick="handleSort('customer', 'Company Name')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition min-w-[240px]">
                Company Name ${getSortHeaderIcon('customer', 'Company Name')}
              </th>
              <th onclick="handleSort('customer', 'Registration No')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Registration No ${getSortHeaderIcon('customer', 'Registration No')}
              </th>
              <th onclick="handleSort('customer', 'Date of Incorporation')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Incorporation ${getSortHeaderIcon('customer', 'Date of Incorporation')}
              </th>
              <th onclick="handleSort('customer', 'Cupboard')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Cupboard ${getSortHeaderIcon('customer', 'Cupboard')}
              </th>
              <th onclick="handleSort('customer', 'Box No')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Box No ${getSortHeaderIcon('customer', 'Box No')}
              </th>
              <th onclick="handleSort('customer', 'Type')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Type ${getSortHeaderIcon('customer', 'Type')}
              </th>
              <th onclick="handleSort('customer', 'Category')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Category ${getSortHeaderIcon('customer', 'Category')}
              </th>
              <th class="py-3 px-3.5 text-right sticky right-0 bg-slate-50">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${records.map(r => {
              const isOrig = (r['Type'] || '').toLowerCase().includes('original');
              return `
                <tr class="hover:bg-slate-50/80 transition">
                  <td class="py-3 px-3.5 font-mono text-slate-400 font-medium">${r['No'] || ''}</td>
                  <td class="py-3 px-3.5 font-semibold text-slate-900">${r['Company Name'] || ''}</td>
                  <td class="py-3 px-3.5 text-slate-600 font-mono">${r['Registration No'] || '-'}</td>
                  <td class="py-3 px-3.5 text-slate-600 font-mono text-[11px]">${formatDisplayDate(r['Date of Incorporation']) || '-'}</td>
                  <td class="py-3 px-3.5 text-slate-700 font-medium">${r['Cupboard'] || '-'}</td>
                  <td class="py-3 px-3.5">
                    <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px] border border-slate-200">
                      ${r['Box No'] || '-'}
                    </span>
                  </td>
                  <td class="py-3 px-3.5">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${isOrig ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}">
                      ${r['Type'] || 'Standard'}
                    </span>
                  </td>
                  <td class="py-3 px-3.5 text-slate-500 text-[11px]">${r['Category'] || 'Customer Files'}</td>
                  <td class="py-3 px-3.5 text-right sticky right-0 bg-white/95 backdrop-blur-xs space-x-1">
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
      <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
        <span>Showing ${records.length} of ${customerRecords.length} records (${origCount} Originals &middot; ${copyCount} Copies)</span>
        <span class="font-mono">Sorted by: ${tableSortState.customer.col} (${tableSortState.customer.asc ? 'Ascending' : 'Descending'})</span>
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
  const categories = [...new Set(financialRecords.map(r => r.category).filter(Boolean))];
  const withPhotos = financialRecords.filter(r => r.photoFile).length;

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
            Digitized from 44 physical register photos in <span class="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">financial_records_active.json</span> (${financialRecords.length} profiles &middot; ${withPhotos} photo pages linked)
          </p>
        </div>

        <div class="flex items-center gap-3">
          <button onclick="openAddFinancialModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5 ${!canEdit('financial_files') ? 'permission-locked' : ''}">
            <i data-lucide="plus" class="w-4 h-4"></i> Add Entity Profile
          </button>
        </div>
      </div>

      <!-- Search & Filters -->
      <div class="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div class="relative flex-1 w-full">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
          <input type="text" id="finSearchInput" oninput="handleFinancialFilter()" placeholder="Search entity name, TIN, SSID, director, filing notes..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500">
        </div>
        <select id="finCategoryFilter" onchange="handleFinancialFilter()" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none w-full sm:w-auto">
          <option value="">All Categories (${categories.length})</option>
          ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
        <div class="text-[11px] text-slate-400 hidden lg:block shrink-0">
          Click any column to sort (&Delta;/&nabla;)
        </div>
      </div>

      <!-- Financial Table -->
      <div id="financialTableContainer">
        ${renderFinancialTable(getFilteredFinancialRecords())}
      </div>

    </div>
  `;
}

function getFilteredFinancialRecords() {
  const q = (document.getElementById('finSearchInput')?.value || '').toLowerCase();
  const cat = (document.getElementById('finCategoryFilter')?.value || '').toLowerCase();

  let filtered = financialRecords.filter(r => {
    const matchQ = !q || 
      (r.entityName || '').toLowerCase().includes(q) || 
      (r.tinNo || '').toLowerCase().includes(q) || 
      (r.ssid || '').toLowerCase().includes(q) || 
      (r.directorName || '').toLowerCase().includes(q) || 
      (r.notes || '').toLowerCase().includes(q) ||
      (r.filingStatus || '').toLowerCase().includes(q);
    const matchCat = !cat || (r.category || '').toLowerCase().includes(cat);
    return matchQ && matchCat;
  });

  const sortCol = tableSortState.financial.col;
  const sortAsc = tableSortState.financial.asc;
  return sortGenericRecords(filtered, sortCol, sortAsc);
}

function handleFinancialFilter() {
  const filtered = getFilteredFinancialRecords();
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
        <div class="text-sm font-semibold text-slate-700">No financial records match your search criteria</div>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto sticky-scrollable-table" data-sticky-scroll="true">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th onclick="handleSort('financial', 'entityName')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition min-w-[220px]">
                Entity / Director ${getSortHeaderIcon('financial', 'entityName')}
              </th>
              <th onclick="handleSort('financial', 'category')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Category ${getSortHeaderIcon('financial', 'category')}
              </th>
              <th onclick="handleSort('financial', 'tinNo')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Tax ID (TIN) ${getSortHeaderIcon('financial', 'tinNo')}
              </th>
              <th onclick="handleSort('financial', 'irdPin')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                IRD Credentials ${getSortHeaderIcon('financial', 'irdPin')}
              </th>
              <th onclick="handleSort('financial', 'ssid')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                SSID / PIN ${getSortHeaderIcon('financial', 'ssid')}
              </th>
              <th onclick="handleSort('financial', 'filingStatus')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition min-w-[200px]">
                Filing Status & Notes ${getSortHeaderIcon('financial', 'filingStatus')}
              </th>
              <th onclick="handleSort('financial', 'photoFile')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Notebook Photo ${getSortHeaderIcon('financial', 'photoFile')}
              </th>
              <th class="py-3 px-3.5 text-right sticky right-0 bg-slate-50">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${records.map(r => {
              const chk = getFilingChecklistStats(r);
              return `
              <tr class="hover:bg-slate-50/80 transition">
                <td class="py-3 px-3.5">
                  <div class="font-semibold text-slate-900">${r.entityName || 'Unnamed'}</div>
                  <div class="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 flex-wrap">
                    ${r.directorName ? `<span>Director: ${r.directorName}</span>` : `<span>${r.category || 'Corporate'}</span>`}
                    ${r.dateOfIncorp ? `<span class="text-slate-300">&bull;</span><span class="text-slate-500 font-mono text-[10px]">Incorp: ${formatDisplayDate(r.dateOfIncorp)}</span>` : ''}
                  </div>
                </td>
                <td class="py-3 px-3.5">
                  <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${r.category === 'Corporate' ? 'bg-blue-50 text-blue-700 border border-blue-200' : (r.category === 'Individual' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-700 border border-slate-200')}">
                    ${r.category || 'Corporate'}
                  </span>
                </td>
                <td class="py-3 px-3.5">
                  ${r.tinNo ? `<div class="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block text-[11px]">${r.tinNo}</div>` : '<span class="text-slate-400">-</span>'}
                  ${r.economicCode ? `<div class="text-[10px] text-slate-400 mt-0.5 font-mono">Code: ${r.economicCode}</div>` : ''}
                </td>
                <td class="py-3 px-3.5 text-slate-600">
                  ${r.irdPin ? `<div class="font-mono text-[11px]">PIN: <span class="text-slate-900 font-semibold">${r.irdPin}</span></div>` : ''}
                  ${r.irdPassword ? `<div class="font-mono text-[10px] text-slate-500">Pwd: ${r.irdPassword}</div>` : ''}
                  ${!r.irdPin && !r.irdPassword ? '<span class="text-slate-400">-</span>' : ''}
                </td>
                <td class="py-3 px-3.5 text-slate-600">
                  ${r.ssid ? `<div class="font-mono text-[11px]">SSID: <span class="text-slate-900 font-semibold">${r.ssid}</span></div>` : ''}
                  ${r.ssidPin ? `<div class="font-mono text-[10px] text-slate-500">PIN: ${r.ssidPin}</div>` : ''}
                  ${!r.ssid && !r.ssidPin ? '<span class="text-slate-400">-</span>' : ''}
                </td>
                <td class="py-3 px-3.5 min-w-[240px] max-w-xs whitespace-normal">
                  <div class="space-y-1.5">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <button onclick="openFilingChecklistModal('${r.id}')" title="Click to view and edit statutory filing checklist" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition shadow-xs group ${chk.badgeClass}">
                        <i data-lucide="${chk.icon}" class="w-3.5 h-3.5"></i>
                        <span>Checklist: ${chk.badgeText}</span>
                        <i data-lucide="chevron-right" class="w-3 h-3 opacity-60 group-hover:translate-x-0.5 transition-transform"></i>
                      </button>
                      <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        ${chk.stage}
                      </span>
                    </div>
                    <div class="text-[11px] text-slate-600 line-clamp-2 leading-relaxed" title="${r.filingStatus || r.notes || ''}">
                      ${r.filingStatus || r.notes || '<span class="text-slate-400 italic">No filing status recorded</span>'}
                    </div>
                  </div>
                </td>
                <td class="py-3 px-3.5">
                  ${r.photoFile ? `
                    <button onclick="openPhotoLightbox('${r.photoFile}', '${(r.entityName || '').replace(/'/g, "\\'")}')" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg border border-emerald-200 transition flex items-center gap-1.5 text-[11px] shadow-xs">
                      <i data-lucide="image" class="w-3.5 h-3.5 text-emerald-600"></i> View Photo
                    </button>
                  ` : '<span class="text-slate-400 text-[11px]">No Photo</span>'}
                </td>
                <td class="py-3 px-3.5 text-right sticky right-0 bg-white/95 backdrop-blur-xs space-x-1">
                  <button onclick="openFilingChecklistModal('${r.id}')" title="Statutory Filing Checklist" class="p-1 rounded text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition">
                    <i data-lucide="clipboard-check" class="w-3.5 h-3.5 text-emerald-600"></i>
                  </button>
                  <button onclick="openEditFinancialModal('${r.id}')" title="Edit Profile" class="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition ${!canEdit('financial_files') ? 'permission-locked' : ''}">
                    <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                  </button>
                  <button onclick="deleteFinancialRecord('${r.id}')" title="Delete Profile" class="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition ${!canEdit('financial_files') ? 'permission-locked' : ''}">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                </td>
              </tr>
            `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
        <span>Showing ${records.length} of ${financialRecords.length} records</span>
        <span class="font-mono">Sorted by: ${tableSortState.financial.col} (${tableSortState.financial.asc ? 'Ascending' : 'Descending'})</span>
      </div>
    </div>
  `;
}

// Lightbox for Photos (with Token Query and Graceful Fallback)
function openPhotoLightbox(photoFile, caption) {
  const modal = document.getElementById('photoLightbox');
  const img = document.getElementById('lightboxImg');
  const cap = document.getElementById('lightboxCaption');

  const tokenParam = authToken ? `?token=${encodeURIComponent(authToken)}` : '';
  img.src = `/api/financial-files/photos/${encodeURIComponent(photoFile)}${tokenParam}`;
  img.alt = caption || 'Physical Register Notebook Page';
  img.onerror = function() {
    this.onerror = null;
    cap.innerHTML = `
      <div class="text-red-400 font-semibold">Could not load photo: ${photoFile}</div>
      <div class="text-slate-400 text-[11px] mt-1">Please verify the image exists in financial_files_db/</div>
    `;
  };
  cap.innerHTML = `
    <span class="font-semibold text-white">Physical Register Notebook Capture &mdash; ${caption}</span>
    <span class="text-slate-400 font-mono text-[11px] block mt-0.5">${photoFile}</span>
  `;
  modal.classList.remove('hidden');
  hideStickyScrollbar();
  if (window.lucide) lucide.createIcons();
}

function closePhotoLightbox() {
  const modal = document.getElementById('photoLightbox');
  modal.classList.add('hidden');
  scheduleStickyScrollbarUpdate();
}

// ================= 5. ACCESS CONTROL CENTER (LIGHT THEME) =================
// ================= 5. ACCESS CONTROL CENTER (LIGHT THEME) =================
async function renderAccessControl(container) {
  if (!isAdmin()) {
    container.innerHTML = `
      <div class="p-12 text-center bg-white rounded-2xl border border-red-200 space-y-3 shadow-sm fade-in">
        <i data-lucide="shield-alert" class="w-12 h-12 mx-auto text-red-500"></i>
        <h2 class="text-lg font-bold text-slate-900">Restricted Administrator Area</h2>
        <p class="text-xs text-slate-500 max-w-md mx-auto">Only users with Administrator or Director privileges can modify user credentials and permissions.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
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
            Grant or take access, assign granular module permissions (Editor vs. Viewer), and manage staff accounts (${usersList.length} accounts).
          </p>
        </div>

        <button onclick="openAddUserModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-sm transition flex items-center gap-1.5">
          <i data-lucide="user-plus" class="w-4 h-4"></i> Create User Account
        </button>
      </div>

      <!-- Search & Filters -->
      <div class="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
        <div class="relative flex-1 w-full">
          <i data-lucide="search" class="w-4 h-4 text-slate-400 absolute left-3 top-2.5"></i>
          <input type="text" id="userSearchInput" oninput="handleUsersFilter()" placeholder="Search staff by name, username, designation, email..." class="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500">
        </div>
        <select id="userRoleFilter" onchange="handleUsersFilter()" class="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none w-full sm:w-auto">
          <option value="">All Roles</option>
          <option value="admin">Administrator</option>
          <option value="director">Director</option>
          <option value="staff">Staff Member</option>
        </select>
        <div class="text-[11px] text-slate-400 hidden lg:block shrink-0">
          Click any column to sort (&Delta;/&nabla;)
        </div>
      </div>

      <!-- Users Table Container -->
      <div id="usersTableContainer">
        ${renderUsersTable(getFilteredUsers())}
      </div>

      <!-- Data Persistence & Cloud Deployment Safeguards Card -->
      <div class="bg-white p-5 md:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <i data-lucide="hard-drive-download" class="w-4 h-4"></i>
            </div>
            <div>
              <h3 class="font-display font-bold text-sm text-slate-900">Data Persistence & Deployment Safeguards</h3>
              <p class="text-[11px] text-slate-500">Protect user passwords, operations tasks, and payroll records across cloud rebuilds and git updates.</p>
            </div>
          </div>
          <div id="persistenceStatusBadge" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 self-start sm:self-auto">
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live Data Sync: Active</span>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">1-Click Full Backup</div>
              <div class="text-xs font-semibold text-slate-700 mt-1">Download System Snapshot</div>
              <p class="text-[11px] text-slate-500 mt-1">Exports all 9 user accounts, changed passwords, 38+ operations tasks, and statutory payroll sheets into a single JSON file.</p>
            </div>
            <button onclick="downloadSystemBackup()" class="mt-3 w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5">
              <i data-lucide="download" class="w-3.5 h-3.5 text-emerald-600"></i> Download Backup (.json)
            </button>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Instant Restoration</div>
              <div class="text-xs font-semibold text-slate-700 mt-1">Restore from Backup</div>
              <p class="text-[11px] text-slate-500 mt-1">Instantly applies your saved backup. Automatically creates a safety rollback snapshot before overwriting.</p>
            </div>
            <label class="mt-3 w-full py-2 px-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer">
              <i data-lucide="upload" class="w-3.5 h-3.5"></i> Restore Backup File
              <input type="file" id="systemRestoreFileInput" accept=".json" class="hidden" onchange="handleSystemRestoreFile(event)">
            </label>
          </div>

          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
            <div>
              <div class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Deployment Shield</div>
              <div class="text-xs font-semibold text-slate-700 mt-1">Why Changes Previously Reverted</div>
              <p class="text-[11px] text-slate-500 mt-1">Free cloud containers (Render) rebuild from git on deployment. <code>Push_To_GitHub.bat</code> now auto-commits live data, and persistent storage is fully supported.</p>
            </div>
            <button onclick="showPersistenceGuideModal()" class="mt-3 w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5">
              <i data-lucide="info" class="w-3.5 h-3.5 text-blue-600"></i> View Persistence Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function getFilteredUsers() {
  const q = (document.getElementById('userSearchInput')?.value || '').toLowerCase();
  const role = (document.getElementById('userRoleFilter')?.value || '').toLowerCase();

  let filtered = usersList.filter(u => {
    const matchQ = !q || 
      (u.fullName || '').toLowerCase().includes(q) || 
      (u.username || '').toLowerCase().includes(q) || 
      (u.title || '').toLowerCase().includes(q) || 
      (u.email || '').toLowerCase().includes(q);
    const matchRole = !role || (u.role || '').toLowerCase() === role;
    return matchQ && matchRole;
  });

  const sortCol = tableSortState.users.col;
  const sortAsc = tableSortState.users.asc;
  return sortGenericRecords(filtered, sortCol, sortAsc);
}

function handleUsersFilter() {
  const filtered = getFilteredUsers();
  const container = document.getElementById('usersTableContainer');
  if (container) {
    container.innerHTML = renderUsersTable(filtered);
    if (window.lucide) lucide.createIcons();
  }
}

function renderUsersTable(users) {
  if (!users.length) {
    return `
      <div class="p-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 space-y-2 shadow-sm">
        <i data-lucide="users" class="w-10 h-10 mx-auto text-slate-300"></i>
        <div class="text-sm font-semibold text-slate-700">No user accounts found</div>
      </div>
    `;
  }

  return `
    <div class="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div class="overflow-x-auto sticky-scrollable-table" data-sticky-scroll="true">
        <table class="w-full text-left text-xs whitespace-nowrap">
          <thead class="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
            <tr>
              <th onclick="handleSort('users', 'fullName')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition min-w-[200px]">
                User &amp; Username ${getSortHeaderIcon('users', 'fullName')}
              </th>
              <th onclick="handleSort('users', 'role')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Role ${getSortHeaderIcon('users', 'role')}
              </th>
              <th onclick="handleSort('users', 'title')" class="py-3 px-3.5 cursor-pointer select-none hover:bg-slate-100 transition">
                Designation ${getSortHeaderIcon('users', 'title')}
              </th>
              <th class="py-3 px-3.5">Operations</th>
              <th class="py-3 px-3.5">Customer DB</th>
              <th class="py-3 px-3.5">Financial DB</th>
              <th class="py-3 px-3.5">Payroll</th>
              <th class="py-3 px-3.5">User Mgmt</th>
              <th class="py-3 px-3.5 text-right sticky right-0 bg-slate-50 min-w-[140px]">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${users.map(u => {
              const isSelf = currentUser && u.id === currentUser.id;
              const isRootAdmin = u.username === 'admin';
              return `
                <tr class="hover:bg-slate-50/80 transition">
                  <td class="py-3 px-3.5">
                    <div class="font-semibold text-slate-900 flex items-center gap-1.5">
                      <span>${u.fullName || u.username}</span>
                      ${isSelf ? '<span class="text-[9px] px-1 py-0.2 bg-emerald-100 text-emerald-800 rounded font-semibold">You</span>' : ''}
                    </div>
                    <div class="text-[11px] text-slate-500 font-mono">@${u.username} &middot; <span class="text-slate-400">${u.email || 'No email'}</span>${u.createdAt ? ` &middot; <span class="text-slate-400">Joined ${formatDisplayDate(u.createdAt)}</span>` : ''}</div>
                  </td>
                  <td class="py-3 px-3.5">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${u.role === 'director' ? 'bg-amber-50 text-amber-800 border border-amber-200' : (u.role === 'admin' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-indigo-50 text-indigo-800 border border-indigo-200')}">
                      ${u.role}
                    </span>
                  </td>
                  <td class="py-3 px-3.5 text-slate-600 font-medium">${u.title || 'Staff Member'}</td>
                  <td class="py-3 px-3.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${['editor', 'full'].includes(u.permissions?.operations) || ['director', 'admin'].includes(u.role) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
                      ${['director', 'admin'].includes(u.role) ? 'Full' : (u.permissions?.operations || 'none')}
                    </span>
                  </td>
                  <td class="py-3 px-3.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${['editor', 'full'].includes(u.permissions?.customer_files) || ['director', 'admin'].includes(u.role) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
                      ${['director', 'admin'].includes(u.role) ? 'Full' : (u.permissions?.customer_files || 'none')}
                    </span>
                  </td>
                  <td class="py-3 px-3.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${['editor', 'full'].includes(u.permissions?.financial_files) || ['director', 'admin'].includes(u.role) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
                      ${['director', 'admin'].includes(u.role) ? 'Full' : (u.permissions?.financial_files || 'none')}
                    </span>
                  </td>
                  <td class="py-3 px-3.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${['editor', 'full'].includes(u.permissions?.payroll) || ['director', 'admin'].includes(u.role) ? 'bg-teal-50 text-teal-700 border border-teal-200' : (u.permissions?.payroll === 'viewer' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-rose-50 text-rose-700 border border-rose-200')}">
                      ${['director', 'admin'].includes(u.role) ? 'Full' : (u.permissions?.payroll || 'none')}
                    </span>
                  </td>
                  <td class="py-3 px-3.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${u.permissions?.user_management === 'full' || ['director', 'admin'].includes(u.role) ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-slate-100 text-slate-500'}">
                      ${['director', 'admin'].includes(u.role) ? 'Full' : (u.permissions?.user_management || 'none')}
                    </span>
                  </td>
                  <td class="py-3 px-3.5 text-right sticky right-0 bg-white/95 backdrop-blur-xs min-w-[140px] whitespace-nowrap">
                    <div class="inline-flex items-center justify-end gap-1.5">
                      <button onclick="openEditUserModal('${u.id}')" title="Edit Permissions & Details" class="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border border-blue-200 shadow-2xs transition">
                        <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                        <span>Edit</span>
                      </button>
                      ${!isSelf && !isRootAdmin ? `
                        <button onclick="deleteUserAccount('${u.id}')" title="Revoke User Access" class="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 border border-red-200 shadow-2xs transition">
                          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                          <span>Revoke</span>
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div class="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
        <span>Showing ${users.length} of ${usersList.length} accounts</span>
        <span class="font-mono">Sorted by: ${tableSortState.users.col} (${tableSortState.users.asc ? 'Ascending' : 'Descending'})</span>
      </div>
    </div>
  `;
}


// ================= 6. AUTOMATED PAYROLL & REMITTANCE SYSTEM =================

// Currency & Text Formatters
function formatGBP(val) {
  return '£ ' + Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLKR(val) {
  return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatLKRCurrency(val) {
  return 'LKR ' + formatLKR(val);
}

function numberToWordsRupees(num) {
  const n = Math.round(Number(num) || 0);
  if (n === 0) return 'Rupees Zero Only';

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertHundreds(val) {
    let str = '';
    if (val >= 100) {
      str += ones[Math.floor(val / 100)] + ' Hundred ';
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + ' ';
      val %= 10;
    }
    if (val > 0) {
      str += ones[val] + ' ';
    }
    return str.trim();
  }

  let words = '';
  let rem = n;

  if (rem >= 1000000000) {
    words += convertHundreds(Math.floor(rem / 1000000000)) + ' Billion ';
    rem %= 1000000000;
  }
  if (rem >= 1000000) {
    words += convertHundreds(Math.floor(rem / 1000000)) + ' Million ';
    rem %= 1000000;
  }
  if (rem >= 1000) {
    words += convertHundreds(Math.floor(rem / 1000)) + ' Thousand ';
    rem %= 1000;
  }
  if (rem > 0) {
    words += convertHundreds(rem) + ' ';
  }

  return 'Rupees ' + words.trim() + ' Only';
}


// ================= MODAL CONTROLS & CRUD OPERATIONS =================
function closeModal() {
  const b = document.getElementById('modalBackdrop');
  b.classList.add('hidden');
  scheduleStickyScrollbarUpdate();
}

// ================= OPERATIONS DROPDOWN & CREATE NEW HELPERS =================
function getAvailableRequesters() {
  const set = new Set();
  (operationsTasks || []).forEach(t => {
    if (t.requestedBy && typeof t.requestedBy === 'string') {
      const v = t.requestedBy.trim();
      if (v) set.add(v);
    }
  });
  if (currentUser && currentUser.fullName) set.add(currentUser.fullName);
  if (typeof systemUsers !== 'undefined' && Array.isArray(systemUsers)) {
    systemUsers.forEach(u => {
      if (u.fullName) set.add(u.fullName);
    });
  }
  // Standard corporate defaults
  ['Muhammad Zaharan', 'Mr. Hameez', 'Mr. Shameel', 'Mr. Azad', 'Miss. Hemanthi', 'Executive Director'].forEach(d => set.add(d));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function getAvailableWorkstreams() {
  const set = new Set();
  (operationsTasks || []).forEach(t => {
    if (t.workstream && typeof t.workstream === 'string') {
      const v = t.workstream.trim();
      if (v) set.add(v);
    }
  });
  // Standard corporate defaults
  ['Office Operations', 'Procurement', 'Designing & Editing', 'Digital Marketing', 'R&D', 'Workspace', 'IT & Infrastructure', 'Secretarial & Legal', 'Personal Tasks'].forEach(d => set.add(d));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function handleSelectOrCreateNew(selectEl, containerId, inputId) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (!container || !input) return;

  if (selectEl.value === '__CREATE_NEW__') {
    container.classList.remove('hidden');
    input.focus();
    if (window.lucide) lucide.createIcons();
  } else {
    container.classList.add('hidden');
    input.value = '';
  }
}

function cancelCreateNew(selectId, containerId, inputId) {
  const selectEl = document.getElementById(selectId);
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (container) container.classList.add('hidden');
  if (input) input.value = '';
  if (selectEl) {
    for (let opt of selectEl.options) {
      if (opt.value !== '__CREATE_NEW__' && opt.value !== '') {
        selectEl.value = opt.value;
        break;
      }
    }
  }
}

function getSelectedOrCreatedValue(selectId, customInputId, defaultVal = '') {
  const selectEl = document.getElementById(selectId);
  const inputEl = document.getElementById(customInputId);
  if (selectEl && selectEl.value === '__CREATE_NEW__') {
    const customVal = inputEl ? inputEl.value.trim() : '';
    return customVal || defaultVal;
  }
  if (inputEl && inputEl.value.trim() && (!selectEl || selectEl.value === '__CREATE_NEW__')) {
    return inputEl.value.trim();
  }
  if (selectEl && selectEl.value) {
    return selectEl.value.trim();
  }
  return defaultVal;
}

function openAddOperationModal() {
  if (!canEdit('operations')) {
    alert('You have Viewer access only on Operations Tracker.');
    return;
  }
  const defaultRequester = currentUser ? currentUser.fullName : 'Muhammad Zaharan';
  const todayStr = getTodayFormatted();
  const availableRequesters = getAvailableRequesters();
  const availableWorkstreams = getAvailableWorkstreams();

  const requesterOptionsHtml = availableRequesters.map(r => 
    `<option value="${r.replace(/"/g, '&quot;')}" ${r.toLowerCase() === defaultRequester.toLowerCase() ? 'selected' : ''}>${r.replace(/</g, '&lt;')}</option>`
  ).join('');

  const defaultWorkstream = 'Office Operations';
  const workstreamOptionsHtml = availableWorkstreams.map(w => 
    `<option value="${w.replace(/"/g, '&quot;')}" ${w.toLowerCase() === defaultWorkstream.toLowerCase() ? 'selected' : ''}>${w.replace(/</g, '&lt;')}</option>`
  ).join('');

  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Add New Operation Task</h3>
          <p class="text-[11px] text-slate-500">Track a new deliverable across all 10 corporate operations columns.</p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitAddOperation(event)" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Task / Procurement Item *</label>
          <input type="text" id="mOpsTitle" required placeholder="e.g. Purchase Heavy-duty Stapler & Pins" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Requested By</span>
              <span class="text-[10px] font-normal text-slate-400">Dropdown or Create New</span>
            </label>
            <select id="mOpsRequestedBy" onchange="handleSelectOrCreateNew(this, 'mOpsRequestedByCustomContainer', 'mOpsRequestedByCustom')" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer">
              ${requesterOptionsHtml}
              <option value="__CREATE_NEW__" class="font-bold text-emerald-600 bg-emerald-50">➕ + Create New Requester...</option>
            </select>
            <div id="mOpsRequestedByCustomContainer" class="hidden mt-1.5 flex items-center gap-1.5">
              <div class="relative flex-1">
                <input type="text" id="mOpsRequestedByCustom" placeholder="Enter new requester name..." class="w-full pl-7 pr-3 py-1.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 shadow-xs">
                <i data-lucide="plus" class="w-3.5 h-3.5 text-emerald-600 absolute left-2 top-2"></i>
              </div>
              <button type="button" onclick="cancelCreateNew('mOpsRequestedBy', 'mOpsRequestedByCustomContainer', 'mOpsRequestedByCustom')" class="px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 text-[11px] font-medium transition" title="Cancel & choose from list">Cancel</button>
            </div>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Workstream</span>
              <span class="text-[10px] font-normal text-slate-400">Dropdown or Create New</span>
            </label>
            <select id="mOpsWorkstream" onchange="handleSelectOrCreateNew(this, 'mOpsWorkstreamCustomContainer', 'mOpsWorkstreamCustom')" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer">
              ${workstreamOptionsHtml}
              <option value="__CREATE_NEW__" class="font-bold text-emerald-600 bg-emerald-50">➕ + Create New Workstream...</option>
            </select>
            <div id="mOpsWorkstreamCustomContainer" class="hidden mt-1.5 flex items-center gap-1.5">
              <div class="relative flex-1">
                <input type="text" id="mOpsWorkstreamCustom" placeholder="Enter new workstream name..." class="w-full pl-7 pr-3 py-1.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 shadow-xs">
                <i data-lucide="plus" class="w-3.5 h-3.5 text-emerald-600 absolute left-2 top-2"></i>
              </div>
              <button type="button" onclick="cancelCreateNew('mOpsWorkstream', 'mOpsWorkstreamCustomContainer', 'mOpsWorkstreamCustom')" class="px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 text-[11px] font-medium transition" title="Cancel & choose from list">Cancel</button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tasked Date</label>
            <div class="date-picker-wrapper">
              <input type="text" id="mOpsTaskedDate" value="${todayStr}" data-calendar="true" placeholder="DD-MMM-YYYY" class="date-picker-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
              <i data-lucide="calendar" class="date-picker-icon"></i>
            </div>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Completed Date</label>
            <div class="date-picker-wrapper">
              <input type="text" id="mOpsCompletedDate" data-calendar="true" placeholder="DD-MMM-YYYY" class="date-picker-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
              <i data-lucide="calendar" class="date-picker-icon"></i>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Status *</label>
            <select id="mOpsStatus" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Pending" selected>Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Priority</label>
            <select id="mOpsPriority" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium" selected>Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Estimated Cost (LKR)</label>
            <input type="text" id="mOpsCost" placeholder="e.g. 25,000 LKR" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Notes / Action Details</label>
          <textarea id="mOpsNotes" rows="3" placeholder="Add specific procurement details, vendor contact, or completion requirements..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"></textarea>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Save Task</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  initAllDatePickers(c);
  if (window.lucide) lucide.createIcons();
}

async function submitAddOperation(e) {
  e.preventDefault();
  const requestedBy = getSelectedOrCreatedValue('mOpsRequestedBy', 'mOpsRequestedByCustom', 'Executive');
  const workstream = getSelectedOrCreatedValue('mOpsWorkstream', 'mOpsWorkstreamCustom', 'Office Operations');

  if (document.getElementById('mOpsRequestedBy')?.value === '__CREATE_NEW__' && !requestedBy) {
    alert('Please enter a name for the new Requester, or cancel to choose an existing one.');
    document.getElementById('mOpsRequestedByCustom')?.focus();
    return;
  }
  if (document.getElementById('mOpsWorkstream')?.value === '__CREATE_NEW__' && !workstream) {
    alert('Please enter a name for the new Workstream, or cancel to choose an existing one.');
    document.getElementById('mOpsWorkstreamCustom')?.focus();
    return;
  }

  const payload = {
    title: document.getElementById('mOpsTitle').value.trim(),
    requestedBy: requestedBy,
    workstream: workstream,
    taskedDate: formatDisplayDate(document.getElementById('mOpsTaskedDate').value) || getTodayFormatted(),
    completedDate: formatDisplayDate(document.getElementById('mOpsCompletedDate').value),
    status: document.getElementById('mOpsStatus').value,
    priority: document.getElementById('mOpsPriority').value,
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

  const currentRequester = (task.requestedBy || 'Muhammad Zaharan').trim();
  const currentWorkstream = (task.workstream || 'Office Operations').trim();

  const availableRequesters = getAvailableRequesters();
  const availableWorkstreams = getAvailableWorkstreams();

  if (currentRequester && !availableRequesters.some(r => r.toLowerCase() === currentRequester.toLowerCase())) {
    availableRequesters.unshift(currentRequester);
  }
  if (currentWorkstream && !availableWorkstreams.some(w => w.toLowerCase() === currentWorkstream.toLowerCase())) {
    availableWorkstreams.unshift(currentWorkstream);
  }

  const editRequesterOptionsHtml = availableRequesters.map(r =>
    `<option value="${r.replace(/"/g, '&quot;')}" ${r.toLowerCase() === currentRequester.toLowerCase() ? 'selected' : ''}>${r.replace(/</g, '&lt;')}</option>`
  ).join('');

  const editWorkstreamOptionsHtml = availableWorkstreams.map(w =>
    `<option value="${w.replace(/"/g, '&quot;')}" ${w.toLowerCase() === currentWorkstream.toLowerCase() ? 'selected' : ''}>${w.replace(/</g, '&lt;')}</option>`
  ).join('');

  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-display font-bold text-base text-slate-900">Edit Operation Task</h3>
            <span class="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-mono font-bold text-xs border border-slate-200">
              No. ${task.no ?? task.id}
            </span>
          </div>
          <p class="text-[11px] text-slate-500">Update task status, priority, completed date, or cost estimates.</p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitEditOperation(event, '${task.id}')" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Task / Procurement Item *</label>
          <input type="text" id="mEditOpsTitle" required value="${task.title || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Requested By</span>
              <span class="text-[10px] font-normal text-slate-400">Dropdown or Create New</span>
            </label>
            <select id="mEditOpsReq" onchange="handleSelectOrCreateNew(this, 'mEditOpsReqCustomContainer', 'mEditOpsReqCustom')" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer">
              ${editRequesterOptionsHtml}
              <option value="__CREATE_NEW__" class="font-bold text-emerald-600 bg-emerald-50">➕ + Create New Requester...</option>
            </select>
            <div id="mEditOpsReqCustomContainer" class="hidden mt-1.5 flex items-center gap-1.5">
              <div class="relative flex-1">
                <input type="text" id="mEditOpsReqCustom" placeholder="Enter new requester name..." class="w-full pl-7 pr-3 py-1.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 shadow-xs">
                <i data-lucide="plus" class="w-3.5 h-3.5 text-emerald-600 absolute left-2 top-2"></i>
              </div>
              <button type="button" onclick="cancelCreateNew('mEditOpsReq', 'mEditOpsReqCustomContainer', 'mEditOpsReqCustom')" class="px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 text-[11px] font-medium transition" title="Cancel & choose from list">Cancel</button>
            </div>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
              <span>Workstream</span>
              <span class="text-[10px] font-normal text-slate-400">Dropdown or Create New</span>
            </label>
            <select id="mEditOpsWorkstream" onchange="handleSelectOrCreateNew(this, 'mEditOpsWorkstreamCustomContainer', 'mEditOpsWorkstreamCustom')" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer">
              ${editWorkstreamOptionsHtml}
              <option value="__CREATE_NEW__" class="font-bold text-emerald-600 bg-emerald-50">➕ + Create New Workstream...</option>
            </select>
            <div id="mEditOpsWorkstreamCustomContainer" class="hidden mt-1.5 flex items-center gap-1.5">
              <div class="relative flex-1">
                <input type="text" id="mEditOpsWorkstreamCustom" placeholder="Enter new workstream name..." class="w-full pl-7 pr-3 py-1.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 shadow-xs">
                <i data-lucide="plus" class="w-3.5 h-3.5 text-emerald-600 absolute left-2 top-2"></i>
              </div>
              <button type="button" onclick="cancelCreateNew('mEditOpsWorkstream', 'mEditOpsWorkstreamCustomContainer', 'mEditOpsWorkstreamCustom')" class="px-2 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 text-[11px] font-medium transition" title="Cancel & choose from list">Cancel</button>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tasked Date</label>
            <div class="date-picker-wrapper">
              <input type="text" id="mEditOpsTaskedDate" value="${formatDisplayDate(task.taskedDate)}" data-calendar="true" placeholder="DD-MMM-YYYY" class="date-picker-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
              <i data-lucide="calendar" class="date-picker-icon"></i>
            </div>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Completed Date</label>
            <div class="date-picker-wrapper">
              <input type="text" id="mEditOpsCompletedDate" value="${formatDisplayDate(task.completedDate)}" data-calendar="true" placeholder="DD-MMM-YYYY" class="date-picker-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
              <i data-lucide="calendar" class="date-picker-icon"></i>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Status *</label>
            <select id="mEditOpsStatus" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Pending" ${task.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="In Progress" ${task.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Completed" ${task.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="On Hold" ${task.status === 'On Hold' ? 'selected' : ''}>On Hold</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Priority</label>
            <select id="mEditOpsPriority" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Critical" ${task.priority === 'Critical' ? 'selected' : ''}>Critical</option>
              <option value="High" ${task.priority === 'High' ? 'selected' : ''}>High</option>
              <option value="Medium" ${task.priority === 'Medium' ? 'selected' : ''}>Medium</option>
              <option value="Low" ${task.priority === 'Low' ? 'selected' : ''}>Low</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Estimated Cost (LKR)</label>
            <input type="text" id="mEditOpsCost" value="${task.estimatedCost || ''}" placeholder="e.g. 25,000 LKR" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Notes / Action Details</label>
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
  initAllDatePickers(c);
  if (window.lucide) lucide.createIcons();
}

async function submitEditOperation(e, taskId) {
  e.preventDefault();
  const requestedBy = getSelectedOrCreatedValue('mEditOpsReq', 'mEditOpsReqCustom', 'Executive');
  const workstream = getSelectedOrCreatedValue('mEditOpsWorkstream', 'mEditOpsWorkstreamCustom', 'Office Operations');

  if (document.getElementById('mEditOpsReq')?.value === '__CREATE_NEW__' && !requestedBy) {
    alert('Please enter a name for the new Requester, or cancel to choose an existing one.');
    document.getElementById('mEditOpsReqCustom')?.focus();
    return;
  }
  if (document.getElementById('mEditOpsWorkstream')?.value === '__CREATE_NEW__' && !workstream) {
    alert('Please enter a name for the new Workstream, or cancel to choose an existing one.');
    document.getElementById('mEditOpsWorkstreamCustom')?.focus();
    return;
  }

  const payload = {
    title: document.getElementById('mEditOpsTitle').value.trim(),
    requestedBy: requestedBy,
    workstream: workstream,
    taskedDate: formatDisplayDate(document.getElementById('mEditOpsTaskedDate').value),
    completedDate: formatDisplayDate(document.getElementById('mEditOpsCompletedDate').value),
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

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Company Registration Number</label>
            <input type="text" id="mDualRegNo" placeholder="e.g. PV 00298172" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Date of Incorporation</label>
            <div class="date-picker-wrapper">
              <input type="text" id="mDualIncorp" data-calendar="true" placeholder="DD-MMM-YYYY" class="date-picker-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
              <i data-lucide="calendar" class="date-picker-icon"></i>
            </div>
          </div>
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
  initAllDatePickers(c);
  if (window.lucide) lucide.createIcons();
}

async function submitDualOnboarding(e) {
  e.preventDefault();
  const payload = {
    CompanyName: document.getElementById('mDualCompName').value.trim(),
    RegistrationNo: document.getElementById('mDualRegNo').value.trim(),
    DateOfIncorporation: formatDisplayDate(document.getElementById('mDualIncorp').value),
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

// Edit Customer File Record Modal
function openEditCustomerModal(no) {
  if (!canEdit('customer_files')) {
    alert('You have Viewer access only on Customer Files.');
    return;
  }
  const r = customerRecords.find(item => String(item.No) === String(no));
  if (!r) {
    alert(`File record #${no} not found.`);
    return;
  }

  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-display font-bold text-base text-slate-900">Edit Customer Archive File</h3>
            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-xs border border-emerald-200">
              Record #${r.No || no}
            </span>
          </div>
          <p class="text-[11px] text-slate-500">Update file metadata in the live Access database registry.</p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitEditCustomer(event, '${r.No || no}')" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Company / Entity Name *</label>
          <input type="text" id="mEditCustName" required value="${r['Company Name'] || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Company Registration No</label>
            <input type="text" id="mEditCustReg" value="${r['Registration No'] || ''}" placeholder="e.g. PV 00298172" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Date of Incorporation</label>
            <div class="date-picker-wrapper">
              <input type="text" id="mEditCustIncorp" value="${formatDisplayDate(r['Date of Incorporation'])}" data-calendar="true" placeholder="DD-MMM-YYYY" class="date-picker-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
              <i data-lucide="calendar" class="date-picker-icon"></i>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Cupboard Destination *</label>
            <select id="mEditCustCupboard" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Cupboard 1" ${r.Cupboard === 'Cupboard 1' ? 'selected' : ''}>Cupboard 1 (Originals)</option>
              <option value="Cupboard 2" ${r.Cupboard === 'Cupboard 2' ? 'selected' : ''}>Cupboard 2 (Copies)</option>
              <option value="Cupboard 3" ${r.Cupboard === 'Cupboard 3' ? 'selected' : ''}>Cupboard 3 (Copies)</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Box Number *</label>
            <input type="text" id="mEditCustBox" required value="${r['Box No'] || ''}" placeholder="e.g. Box 11" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">File Type *</label>
            <select id="mEditCustType" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Original File" ${(r.Type || '').toLowerCase().includes('original') ? 'selected' : ''}>Original File</option>
              <option value="Customer Copy" ${(r.Type || '').toLowerCase().includes('copy') ? 'selected' : ''}>Customer Copy</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Category</label>
          <input type="text" id="mEditCustCategory" value="${r.Category || 'Customer Files'}" placeholder="e.g. Customer Files" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Save Changes</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  initAllDatePickers(c);
  if (window.lucide) lucide.createIcons();
}

async function submitEditCustomer(e, no) {
  e.preventDefault();
  const payload = {
    No: no,
    'Company Name': document.getElementById('mEditCustName').value.trim(),
    'Registration No': document.getElementById('mEditCustReg').value.trim(),
    Cupboard: document.getElementById('mEditCustCupboard').value,
    'Box No': document.getElementById('mEditCustBox').value.trim(),
    Type: document.getElementById('mEditCustType').value,
    Category: document.getElementById('mEditCustCategory').value.trim() || 'Customer Files',
    'Date of Incorporation': formatDisplayDate(document.getElementById('mEditCustIncorp').value)
  };

  try {
    const res = await fetch(`/api/customer-files/${no}`, {
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
      renderCustomerFiles(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
      alert(`Record #${no} updated successfully.`);
    } else {
      alert(data.error || 'Update failed');
    }
  } catch (err) {
    alert('Error updating customer record');
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

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Registration No</label>
            <input type="text" id="mFinRegNo" placeholder="e.g. PV 11488" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Date of Incorp</label>
            <div class="date-picker-wrapper">
              <input type="text" id="mFinDateIncorp" data-calendar="true" placeholder="DD-MMM-YYYY" class="date-picker-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
              <i data-lucide="calendar" class="date-picker-icon"></i>
            </div>
          </div>
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
  initAllDatePickers(c);
  if (window.lucide) lucide.createIcons();
}

async function submitAddFinancial(e) {
  e.preventDefault();
  const payload = {
    entityName: document.getElementById('mFinName').value.trim(),
    regNo: document.getElementById('mFinRegNo') ? document.getElementById('mFinRegNo').value.trim() : '',
    dateOfIncorp: formatDisplayDate(document.getElementById('mFinDateIncorp')?.value),
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

// Edit Financial File Record Modal
function openEditFinancialModal(id) {
  if (!canEdit('financial_files')) {
    alert('You have Viewer access only on Financial Files.');
    return;
  }
  const r = financialRecords.find(item => String(item.id) === String(id));
  if (!r) {
    alert('Financial profile record not found.');
    return;
  }

  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-display font-bold text-base text-slate-900">Edit Financial Tax Profile</h3>
            <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono font-bold text-xs border border-emerald-200">
              ${r.category || 'Corporate'}
            </span>
          </div>
          <p class="text-[11px] text-slate-500">Update TIN, IRD credentials, SSID numbers, and director tax information.</p>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <form onsubmit="submitEditFinancial(event, '${r.id}')" class="space-y-3">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Entity / Director Name *</label>
          <input type="text" id="mEditFinName" required value="${r.entityName || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Category</label>
            <select id="mEditFinCategory" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none">
              <option value="Corporate" ${r.category === 'Corporate' ? 'selected' : ''}>Corporate Entity</option>
              <option value="Individual" ${r.category === 'Individual' ? 'selected' : ''}>Individual / Director</option>
              <option value="Bilateral Council" ${r.category === 'Bilateral Council' ? 'selected' : ''}>Bilateral Council</option>
            </select>
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Registration No</label>
            <input type="text" id="mEditFinRegNo" value="${r.regNo || ''}" placeholder="e.g. PV 11488" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Date of Incorp</label>
            <div class="date-picker-wrapper">
              <input type="text" id="mEditFinDateIncorp" value="${formatDisplayDate(r.dateOfIncorp)}" data-calendar="true" placeholder="DD-MMM-YYYY" class="date-picker-input w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
              <i data-lucide="calendar" class="date-picker-icon"></i>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Tax ID Number (TIN)</label>
            <input type="text" id="mEditFinTin" value="${r.tinNo || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Economic Code</label>
            <input type="text" id="mEditFinEcon" value="${r.economicCode || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">IRD Portal PIN</label>
            <input type="text" id="mEditFinIrdPin" value="${r.irdPin || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">IRD Password</label>
            <input type="text" id="mEditFinIrdPwd" value="${r.irdPassword || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">IRD Registered Email</label>
            <input type="text" id="mEditFinIrdEmail" value="${r.irdEmail || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">SSID Number</label>
            <input type="text" id="mEditFinSsid" value="${r.ssid || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">SSID PIN</label>
            <input type="text" id="mEditFinSsidPin" value="${r.ssidPin || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Director Name</label>
            <input type="text" id="mEditFinDirector" value="${r.directorName || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Director Passport / ID</label>
            <input type="text" id="mEditFinDirectorId" value="${r.directorPassportOrId || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Emails</label>
            <input type="text" id="mEditFinEmails" value="${r.emails || ''}" placeholder="Comma-separated emails" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Phones</label>
            <input type="text" id="mEditFinPhones" value="${r.phones || ''}" placeholder="Comma-separated numbers" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="block font-semibold text-slate-700">Filing Status / Audit History</label>
            <button type="button" onclick="closeModal(); setTimeout(() => openFilingChecklistModal('${r.id}'), 120);" class="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1 px-2.5 py-0.5 rounded-lg hover:bg-emerald-50 transition border border-emerald-200 shadow-2xs">
              <i data-lucide="clipboard-check" class="w-3.5 h-3.5"></i> Open Filing Checklist Modal
            </button>
          </div>
          <textarea id="mEditFinFiling" rows="2" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">${r.filingStatus || ''}</textarea>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">General Notes</label>
            <input type="text" id="mEditFinNotes" value="${r.notes || ''}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Linked Physical Register Photo</label>
            <input type="text" id="mEditFinPhoto" value="${r.photoFile || ''}" placeholder="e.g. Register_01_Remi_Dream_Lanka.jpeg" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 font-mono">
          </div>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-700 font-semibold transition shadow-sm">Save Profile</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  initAllDatePickers(c);
  if (window.lucide) lucide.createIcons();
}

async function submitEditFinancial(e, id) {
  e.preventDefault();
  const payload = {
    entityName: document.getElementById('mEditFinName').value.trim(),
    category: document.getElementById('mEditFinCategory').value,
    regNo: document.getElementById('mEditFinRegNo').value.trim(),
    dateOfIncorp: formatDisplayDate(document.getElementById('mEditFinDateIncorp').value),
    tinNo: document.getElementById('mEditFinTin').value.trim(),
    economicCode: document.getElementById('mEditFinEcon').value.trim(),
    irdPin: document.getElementById('mEditFinIrdPin').value.trim(),
    irdPassword: document.getElementById('mEditFinIrdPwd').value.trim(),
    irdEmail: document.getElementById('mEditFinIrdEmail').value.trim(),
    ssid: document.getElementById('mEditFinSsid').value.trim(),
    ssidPin: document.getElementById('mEditFinSsidPin').value.trim(),
    directorName: document.getElementById('mEditFinDirector').value.trim(),
    directorPassportOrId: document.getElementById('mEditFinDirectorId').value.trim(),
    emails: document.getElementById('mEditFinEmails').value.trim(),
    phones: document.getElementById('mEditFinPhones').value.trim(),
    filingStatus: document.getElementById('mEditFinFiling').value.trim(),
    notes: document.getElementById('mEditFinNotes').value.trim(),
    photoFile: document.getElementById('mEditFinPhoto').value.trim()
  };

  try {
    const res = await fetch(`/api/financial-files/${id}`, {
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
      renderFinancialFiles(document.getElementById('mainContent'));
      if (window.lucide) lucide.createIcons();
      alert('Financial profile updated successfully.');
    } else {
      alert(data.error || 'Update failed');
    }
  } catch (err) {
    alert('Error updating financial profile');
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

// ================= 4.1 STATUTORY FILING STATUS & COMPLIANCE CHECKLIST =================
const FILING_CHECKLIST_ITEMS = [
  { key: 'balanceSheet', label: 'Balance Sheet', subtitle: 'Statement of Financial Position', icon: 'scale' },
  { key: 'pnl', label: 'Profit & Loss (P&L)', subtitle: 'Income & Expenditure Statement', icon: 'trending-up' },
  { key: 'qt', label: 'Quarterly Tax (QT)', subtitle: 'Quarterly Advance Tax Schedules', icon: 'calendar' },
  { key: 'cashFlow', label: 'Cash Flow Statement', subtitle: 'Operating, Investing & Financing Cash Flow', icon: 'banknote' },
  { key: 'policies', label: 'Accounting Policies', subtitle: 'Significant Policies & Basis of Preparation', icon: 'book-open' },
  { key: 'taxation', label: 'Taxation Computation', subtitle: 'Taxable Income & CIT Computation Schedules', icon: 'calculator' },
  { key: 'notesToAccount', label: 'Notes to Accounts', subtitle: 'Disclosures, Fixed Asset & Ledger Schedules', icon: 'file-text' }
];

function getFilingChecklist(r) {
  if (r && r.filingChecklist && typeof r.filingChecklist === 'object' && r.filingChecklist.items) {
    return r.filingChecklist;
  }
  
  // Intelligent auto-detection from existing filingStatus text if available
  const text = (r && r.filingStatus ? r.filingStatus : '').toLowerCase();
  const isIrdSubmitted = text.includes('submitted') || text.includes('ird submitted');
  const isAudited = text.includes('audited') || text.includes('audit account');
  const isDraftDone = text.includes('draft account') || text.includes('final accounts') || isAudited || isIrdSubmitted;
  const isTaxDone = text.includes('tax') || text.includes('itr') || text.includes('ita') || text.includes('set') || text.includes('wht') || isIrdSubmitted;

  return {
    assessmentYear: "2024/2025",
    stages: {
      draftAccounts: { status: isDraftDone ? "Completed" : "Pending", date: "", notes: "" },
      audit: { status: isAudited ? "Completed" : (isIrdSubmitted ? "Completed" : "Pending"), date: "", auditor: "" },
      taxation: { status: isTaxDone ? "Completed" : "Pending", date: "", taxType: "CIT / ITR" },
      irdSubmission: { status: isIrdSubmitted ? "Completed" : "Pending", date: "", refNo: "" }
    },
    items: {
      balanceSheet: { checked: isDraftDone, status: isDraftDone ? "Done" : "Pending", date: "", notes: "" },
      pnl: { checked: isDraftDone, status: isDraftDone ? "Done" : "Pending", date: "", notes: "" },
      qt: { checked: isTaxDone, status: isTaxDone ? "Done" : "Pending", date: "", notes: "" },
      cashFlow: { checked: isDraftDone, status: isDraftDone ? "Done" : "Pending", date: "", notes: "" },
      policies: { checked: isDraftDone, status: isDraftDone ? "Done" : "Pending", date: "", notes: "" },
      taxation: { checked: isTaxDone, status: isTaxDone ? "Done" : "Pending", date: "", notes: "" },
      notesToAccount: { checked: isDraftDone, status: isDraftDone ? "Done" : "Pending", date: "", notes: "" }
    },
    customNotes: ""
  };
}

function getFilingChecklistStats(r) {
  const chk = getFilingChecklist(r);
  let completed = 0;
  FILING_CHECKLIST_ITEMS.forEach(it => {
    if (chk.items && chk.items[it.key] && chk.items[it.key].checked) {
      completed++;
    }
  });
  
  const total = FILING_CHECKLIST_ITEMS.length;
  const percent = Math.round((completed / total) * 100);
  
  let stage = 'Draft Accounts';
  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200';
  let icon = 'list-checks';
  let badgeText = `${completed}/${total} Ready`;

  if (chk.stages && chk.stages.irdSubmission && chk.stages.irdSubmission.status === 'Completed') {
    stage = 'IRD Submitted';
  } else if (chk.stages && chk.stages.taxation && chk.stages.taxation.status === 'Completed') {
    stage = 'Tax Finalized';
  } else if (chk.stages && chk.stages.audit && chk.stages.audit.status === 'Completed') {
    stage = 'Audited';
  } else if (chk.stages && chk.stages.draftAccounts && chk.stages.draftAccounts.status === 'Completed') {
    stage = 'Draft Accounts Done';
  }

  if (completed === total) {
    badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
    icon = 'check-circle-2';
    badgeText = '7/7 Complete';
  } else if (completed >= 4) {
    badgeClass = 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100';
    icon = 'clipboard-check';
  } else if (completed > 0) {
    badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100';
    icon = 'clipboard-check';
  }

  return { completedCount: completed, total, percent, stage, badgeClass, icon, badgeText };
}

function openFilingChecklistModal(recordId) {
  const r = financialRecords.find(x => x.id === recordId);
  if (!r) {
    alert('Financial entity not found.');
    return;
  }

  const chk = getFilingChecklist(r);
  const isEditor = canEdit('financial_files');
  const stats = getFilingChecklistStats(r);

  const modalContent = document.getElementById('modalContent');
  modalContent.className = "bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 md:p-8 shadow-2xl relative fade-in";

  modalContent.innerHTML = `
    <div class="space-y-6">
      <!-- Header Bar -->
      <div class="flex items-start justify-between pb-4 border-b border-slate-200">
        <div class="flex items-start gap-3">
          <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white flex items-center justify-center shadow-md shrink-0">
            <i data-lucide="clipboard-check" class="w-6 h-6"></i>
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h3 class="font-display font-bold text-lg text-slate-900">${r.entityName || 'Unnamed Entity'}</h3>
              <span class="px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${r.category === 'Corporate' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                ${r.category || 'Corporate'}
              </span>
              ${isEditor ? `
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <i data-lucide="shield-check" class="w-3 h-3"></i> Editor Access Active
                </span>
              ` : `
                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                  <i data-lucide="lock" class="w-3 h-3"></i> Viewer (Read-Only)
                </span>
              `}
            </div>
            <p class="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
              <span><strong>TIN:</strong> <span class="font-mono text-slate-700 font-bold">${r.tinNo || 'Not Assigned'}</span></span>
              <span>&bull;</span>
              <span><strong>SSID:</strong> <span class="font-mono text-slate-700">${r.ssid || 'None'}</span></span>
              ${r.directorName ? `<span>&bull;</span><span><strong>Director:</strong> <span class="text-slate-700">${r.directorName}</span></span>` : ''}
            </p>
          </div>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <!-- Executive Compliance & Progress Meter Card -->
      <div class="p-4 md:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white shadow-md">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <span class="text-emerald-400 text-xs font-bold uppercase tracking-wider">Statutory Financial Filing</span>
              <span class="text-slate-400 text-xs">&bull;</span>
              <span class="text-slate-300 text-xs font-medium">Compliance Pipeline</span>
            </div>
            <div class="text-xl md:text-2xl font-bold flex items-center gap-3">
              <span id="chkProgressText">${stats.completedCount} of 7 Deliverables Ready</span>
              <span id="chkProgressBadge" class="text-xs px-2.5 py-1 rounded-full font-semibold ${stats.percent === 100 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}">
                ${stats.percent}% Complete
              </span>
            </div>
          </div>

          <div class="flex items-center gap-3 bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10">
            <label class="text-xs font-semibold text-slate-300">Assessment Year:</label>
            <select id="chkAssessmentYear" ${!isEditor ? 'disabled' : ''} class="bg-slate-800 text-white border border-slate-600 rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-400">
              <option value="2024/2025" ${chk.assessmentYear === '2024/2025' ? 'selected' : ''}>Year 2024/2025</option>
              <option value="2023/2024" ${chk.assessmentYear === '2023/2024' ? 'selected' : ''}>Year 2023/2024</option>
              <option value="2025/2026" ${chk.assessmentYear === '2025/2026' ? 'selected' : ''}>Year 2025/2026</option>
              <option value="2022/2023" ${chk.assessmentYear === '2022/2023' ? 'selected' : ''}>Year 2022/2023</option>
            </select>
          </div>
        </div>

        <!-- Live Progress Bar -->
        <div class="w-full bg-slate-700/60 rounded-full h-2.5 mt-4 overflow-hidden p-0.5 border border-white/10">
          <div id="chkProgressBar" class="h-full rounded-full checklist-progress-bar ${stats.percent === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-blue-400 to-emerald-400'}" style="width: ${stats.percent}%"></div>
        </div>

        <!-- Visual 4-Stage Workflow Stepper -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
          <div class="flex items-center gap-2">
            <div id="stepDot_draft" class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${chk.stages.draftAccounts.status === 'Completed' ? 'bg-emerald-400 text-slate-900' : 'bg-slate-700 text-slate-300'}">1</div>
            <div>
              <div class="font-semibold text-slate-200">Draft Accounts</div>
              <div id="stepLbl_draft" class="text-[10px] text-slate-400">${chk.stages.draftAccounts.status || 'Pending'}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div id="stepDot_audit" class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${chk.stages.audit.status === 'Completed' ? 'bg-emerald-400 text-slate-900' : 'bg-slate-700 text-slate-300'}">2</div>
            <div>
              <div class="font-semibold text-slate-200">Audit</div>
              <div id="stepLbl_audit" class="text-[10px] text-slate-400">${chk.stages.audit.status || 'Pending'}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div id="stepDot_tax" class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${chk.stages.taxation.status === 'Completed' ? 'bg-emerald-400 text-slate-900' : 'bg-slate-700 text-slate-300'}">3</div>
            <div>
              <div class="font-semibold text-slate-200">Taxation</div>
              <div id="stepLbl_tax" class="text-[10px] text-slate-400">${chk.stages.taxation.status || 'Pending'}</div>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div id="stepDot_ird" class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${chk.stages.irdSubmission.status === 'Completed' ? 'bg-emerald-400 text-slate-900' : 'bg-slate-700 text-slate-300'}">4</div>
            <div>
              <div class="font-semibold text-slate-200">IRD Submission</div>
              <div id="stepLbl_ird" class="text-[10px] text-slate-400">${chk.stages.irdSubmission.status || 'Pending'}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 1: The 4 Core Workflow Milestones -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h4 class="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
            <i data-lucide="workflow" class="w-4 h-4 text-emerald-600"></i>
            Workflow Milestones (Draft Accounts, Audit, Taxation, IRD Submission)
          </h4>
          <span class="text-xs text-slate-400">Manage statutory timeline & dates</span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <!-- Milestone 1: Draft Accounts -->
          <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-emerald-300 transition space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <i data-lucide="file-text" class="w-3.5 h-3.5 text-blue-600"></i> Draft Accounts
              </span>
              <select id="mChkDraftStatus" onchange="handleMilestoneStatusChange('draft', this.value)" ${!isEditor ? 'disabled' : ''} class="text-[11px] font-semibold rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-800 focus:outline-none">
                <option value="Pending" ${chk.stages.draftAccounts.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${chk.stages.draftAccounts.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Completed" ${chk.stages.draftAccounts.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Completion Date</label>
              <div class="date-picker-wrapper">
                <input type="text" id="mChkDraftDate" value="${formatDisplayDate(chk.stages.draftAccounts.date)}" data-calendar="true" placeholder="DD-MMM-YYYY" ${!isEditor ? 'disabled' : ''} class="date-picker-input w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500">
                <i data-lucide="calendar" class="date-picker-icon"></i>
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Prepared By / Notes</label>
              <input type="text" id="mChkDraftNotes" value="${chk.stages.draftAccounts.notes || ''}" placeholder="e.g. In-house Accountant" ${!isEditor ? 'disabled' : ''} class="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500">
            </div>
          </div>

          <!-- Milestone 2: Audit -->
          <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-emerald-300 transition space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <i data-lucide="shield-check" class="w-3.5 h-3.5 text-purple-600"></i> Audit Process
              </span>
              <select id="mChkAuditStatus" onchange="handleMilestoneStatusChange('audit', this.value)" ${!isEditor ? 'disabled' : ''} class="text-[11px] font-semibold rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-800 focus:outline-none">
                <option value="Pending" ${chk.stages.audit.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${chk.stages.audit.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Completed" ${chk.stages.audit.status === 'Completed' ? 'selected' : ''}>Audited / Signed</option>
                <option value="Exempt" ${chk.stages.audit.status === 'Exempt' ? 'selected' : ''}>Exempt / N/A</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Audit Sign-Off Date</label>
              <div class="date-picker-wrapper">
                <input type="text" id="mChkAuditDate" value="${formatDisplayDate(chk.stages.audit.date)}" data-calendar="true" placeholder="DD-MMM-YYYY" ${!isEditor ? 'disabled' : ''} class="date-picker-input w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500">
                <i data-lucide="calendar" class="date-picker-icon"></i>
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Auditor / Firm</label>
              <input type="text" id="mChkAuditAuditor" value="${chk.stages.audit.auditor || ''}" placeholder="e.g. Audit firm / sign-off" ${!isEditor ? 'disabled' : ''} class="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500">
            </div>
          </div>

          <!-- Milestone 3: Taxation -->
          <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-emerald-300 transition space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <i data-lucide="calculator" class="w-3.5 h-3.5 text-amber-600"></i> Taxation
              </span>
              <select id="mChkTaxStatus" onchange="handleMilestoneStatusChange('tax', this.value)" ${!isEditor ? 'disabled' : ''} class="text-[11px] font-semibold rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-800 focus:outline-none">
                <option value="Pending" ${chk.stages.taxation.status === 'Pending' ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${chk.stages.taxation.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Completed" ${chk.stages.taxation.status === 'Completed' ? 'selected' : ''}>Finalized</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Tax Computation Date</label>
              <div class="date-picker-wrapper">
                <input type="text" id="mChkTaxDate" value="${formatDisplayDate(chk.stages.taxation.date)}" data-calendar="true" placeholder="DD-MMM-YYYY" ${!isEditor ? 'disabled' : ''} class="date-picker-input w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500">
                <i data-lucide="calendar" class="date-picker-icon"></i>
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Tax Type / Scheme</label>
              <input type="text" id="mChkTaxType" value="${chk.stages.taxation.taxType || ''}" placeholder="e.g. CIT / ITR / SET" ${!isEditor ? 'disabled' : ''} class="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500">
            </div>
          </div>

          <!-- Milestone 4: IRD Submission -->
          <div class="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:border-emerald-300 transition space-y-2">
            <div class="flex items-center justify-between">
              <span class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                <i data-lucide="send" class="w-3.5 h-3.5 text-emerald-600"></i> IRD Submission
              </span>
              <select id="mChkIrdStatus" onchange="handleMilestoneStatusChange('ird', this.value)" ${!isEditor ? 'disabled' : ''} class="text-[11px] font-semibold rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-800 focus:outline-none">
                <option value="Pending" ${chk.stages.irdSubmission.status === 'Pending' ? 'selected' : ''}>Not Submitted</option>
                <option value="Drafted" ${chk.stages.irdSubmission.status === 'Drafted' ? 'selected' : ''}>Drafted on RAMIS</option>
                <option value="Completed" ${chk.stages.irdSubmission.status === 'Completed' ? 'selected' : ''}>Submitted to IRD</option>
                <option value="Acknowledged" ${chk.stages.irdSubmission.status === 'Acknowledged' ? 'selected' : ''}>Acknowledged</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">IRD Submission Date</label>
              <div class="date-picker-wrapper">
                <input type="text" id="mChkIrdDate" value="${formatDisplayDate(chk.stages.irdSubmission.date)}" data-calendar="true" placeholder="DD-MMM-YYYY" ${!isEditor ? 'disabled' : ''} class="date-picker-input w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500">
                <i data-lucide="calendar" class="date-picker-icon"></i>
              </div>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">RAMIS DIN / Ref No</label>
              <input type="text" id="mChkIrdRef" value="${chk.stages.irdSubmission.refNo || ''}" placeholder="e.g. DIN #2026-88192" ${!isEditor ? 'disabled' : ''} class="w-full text-xs px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-500 font-mono">
            </div>
          </div>
        </div>
      </div>

      <!-- Section 2: The 7 Core Deliverables Checklist -->
      <div class="space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 class="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
              <i data-lucide="check-square" class="w-4 h-4 text-emerald-600"></i>
              Statutory Deliverables Checklist (7 Core Components)
            </h4>
            <p class="text-xs text-slate-500">Balance sheet, PNL, QT, Cash flow, policies, taxation, notes to account</p>
          </div>
          ${isEditor ? `
            <div class="flex items-center gap-2">
              <button type="button" onclick="handleBatchChecklistToggle(true)" class="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded-lg border border-emerald-200 text-xs transition flex items-center gap-1 shadow-2xs">
                <i data-lucide="check-check" class="w-3.5 h-3.5"></i> Mark All Ready
              </button>
              <button type="button" onclick="handleBatchChecklistToggle(false)" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-lg text-xs transition">
                Reset All
              </button>
            </div>
          ` : ''}
        </div>

        <!-- 7 Cards -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="checklistCardsContainer">
          ${FILING_CHECKLIST_ITEMS.map(it => {
            const itemData = (chk.items && chk.items[it.key]) ? chk.items[it.key] : { checked: false, status: 'Pending', date: '', notes: '' };
            return `
              <div id="card_${it.key}" class="checklist-card p-3.5 rounded-xl border ${itemData.checked ? 'checked border-emerald-300' : 'border-slate-200 bg-white'} space-y-2">
                <div class="flex items-start justify-between gap-3">
                  <label class="flex items-start gap-2.5 cursor-pointer select-none">
                    <input type="checkbox" id="chk_${it.key}" onchange="handleItemCheckChange('${it.key}')" ${itemData.checked ? 'checked' : ''} ${!isEditor ? 'disabled' : ''} class="w-4 h-4 mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300">
                    <div>
                      <div class="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                        <i data-lucide="${it.icon}" class="w-3.5 h-3.5 text-emerald-600"></i> ${it.label}
                      </div>
                      <div class="text-[11px] text-slate-500">${it.subtitle}</div>
                    </div>
                  </label>
                  <select id="stat_${it.key}" onchange="handleItemSelectChange('${it.key}')" ${!isEditor ? 'disabled' : ''} class="text-[11px] font-semibold rounded-lg px-2 py-1 border border-slate-200 bg-white text-slate-700 focus:outline-none">
                    <option value="Done" ${itemData.status === 'Done' ? 'selected' : ''}>Done / Ready</option>
                    <option value="In Progress" ${itemData.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                    <option value="Pending" ${itemData.status === 'Pending' ? 'selected' : ''}>Pending</option>
                    <option value="N/A" ${itemData.status === 'N/A' ? 'selected' : ''}>N/A</option>
                  </select>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-100/80">
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Date</label>
                    <div class="date-picker-wrapper">
                      <input type="text" id="date_${it.key}" value="${formatDisplayDate(itemData.date)}" data-calendar="true" placeholder="DD-MMM-YYYY" ${!isEditor ? 'disabled' : ''} class="date-picker-input w-full text-[11px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500">
                      <i data-lucide="calendar" class="date-picker-icon"></i>
                    </div>
                  </div>
                  <div>
                    <label class="block text-[10px] font-semibold text-slate-500 mb-0.5">Reference / Notes</label>
                    <input type="text" id="notes_${it.key}" value="${itemData.notes || ''}" placeholder="e.g. Audited BS signed" ${!isEditor ? 'disabled' : ''} class="w-full text-[11px] px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500">
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Section 3: Synchronized Filing Status & Notes -->
      <div class="space-y-3 pt-2 border-t border-slate-200">
        <div class="flex items-center justify-between">
          <label class="font-display font-bold text-sm text-slate-900 flex items-center gap-2">
            <i data-lucide="align-left" class="w-4 h-4 text-emerald-600"></i>
            Filing Status Text & Submission Log
          </label>
          ${isEditor ? `
            <button type="button" onclick="handleAutoGenerateSummary('${r.id}')" class="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shadow-2xs">
              <i data-lucide="sparkles" class="w-3.5 h-3.5 text-emerald-600"></i> Auto-Generate Summary from Checklist
            </button>
          ` : ''}
        </div>
        <div>
          <textarea id="mChkFilingStatus" rows="2" ${!isEditor ? 'disabled' : ''} placeholder="Year 2024/2025 Audited Accounts & Returns submitted to IRD..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">${r.filingStatus || ''}</textarea>
          <p class="text-[11px] text-slate-400 mt-1">This text updates the main Financial Files table, status filter, and search index.</p>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-700 mb-1">Additional Internal Compliance Notes</label>
          <textarea id="mChkCustomNotes" rows="2" ${!isEditor ? 'disabled' : ''} placeholder="Auditor contact details, liaison officer notes, tax queries..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500">${chk.customNotes || ''}</textarea>
        </div>
      </div>

      <!-- Modal Actions Footer -->
      <div class="pt-4 flex items-center justify-between border-t border-slate-200">
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold text-xs transition">
          Close
        </button>

        <div class="flex items-center gap-2">
          ${isEditor ? `
            <button type="button" onclick="submitFilingChecklist('${r.id}')" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition shadow-md flex items-center gap-2">
              <i data-lucide="save" class="w-4 h-4"></i> Save Filing Checklist & Status
            </button>
          ` : `
            <button disabled class="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-400 font-semibold text-xs cursor-not-allowed flex items-center gap-2">
              <i data-lucide="lock" class="w-4 h-4"></i> Read-Only Mode
            </button>
          `}
        </div>
      </div>
    </div>
  `;

  document.getElementById('modalBackdrop').classList.remove('hidden');
  initAllDatePickers(modalContent);
  if (window.lucide) lucide.createIcons();
}

function handleItemCheckChange(key) {
  const chk = document.getElementById(`chk_${key}`);
  const card = document.getElementById(`card_${key}`);
  const stat = document.getElementById(`stat_${key}`);
  if (!chk || !card || !stat) return;

  if (chk.checked) {
    card.classList.add('checked', 'border-emerald-300');
    card.classList.remove('border-slate-200', 'bg-white');
    if (stat.value === 'Pending') stat.value = 'Done';
  } else {
    card.classList.remove('checked', 'border-emerald-300');
    card.classList.add('border-slate-200', 'bg-white');
    if (stat.value === 'Done') stat.value = 'Pending';
  }

  updateChecklistLiveCount();
}

function handleItemSelectChange(key) {
  const chk = document.getElementById(`chk_${key}`);
  const card = document.getElementById(`card_${key}`);
  const stat = document.getElementById(`stat_${key}`);
  if (!chk || !card || !stat) return;

  if (stat.value === 'Done') {
    chk.checked = true;
    card.classList.add('checked', 'border-emerald-300');
    card.classList.remove('border-slate-200', 'bg-white');
  } else if (stat.value === 'Pending' || stat.value === 'N/A') {
    chk.checked = false;
    card.classList.remove('checked', 'border-emerald-300');
    card.classList.add('border-slate-200', 'bg-white');
  }

  updateChecklistLiveCount();
}

function handleMilestoneStatusChange(stage, value) {
  const lbl = document.getElementById(`stepLbl_${stage}`);
  const dot = document.getElementById(`stepDot_${stage}`);
  if (lbl) lbl.textContent = value;
  if (dot) {
    if (value === 'Completed') {
      dot.className = "w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-emerald-400 text-slate-900";
    } else if (value === 'In Progress' || value === 'Drafted') {
      dot.className = "w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-blue-400 text-slate-900";
    } else {
      dot.className = "w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] bg-slate-700 text-slate-300";
    }
  }
}

function handleBatchChecklistToggle(selectAll) {
  FILING_CHECKLIST_ITEMS.forEach(it => {
    const chk = document.getElementById(`chk_${it.key}`);
    const card = document.getElementById(`card_${it.key}`);
    const stat = document.getElementById(`stat_${it.key}`);
    if (chk && card && stat) {
      chk.checked = selectAll;
      stat.value = selectAll ? 'Done' : 'Pending';
      if (selectAll) {
        card.classList.add('checked', 'border-emerald-300');
        card.classList.remove('border-slate-200', 'bg-white');
      } else {
        card.classList.remove('checked', 'border-emerald-300');
        card.classList.add('border-slate-200', 'bg-white');
      }
    }
  });

  if (selectAll) {
    const draft = document.getElementById('mChkDraftStatus');
    const audit = document.getElementById('mChkAuditStatus');
    const tax = document.getElementById('mChkTaxStatus');
    const ird = document.getElementById('mChkIrdStatus');
    if (draft) { draft.value = 'Completed'; handleMilestoneStatusChange('draft', 'Completed'); }
    if (audit) { audit.value = 'Completed'; handleMilestoneStatusChange('audit', 'Completed'); }
    if (tax) { tax.value = 'Completed'; handleMilestoneStatusChange('tax', 'Completed'); }
    if (ird) { ird.value = 'Completed'; handleMilestoneStatusChange('ird', 'Completed'); }
  }

  updateChecklistLiveCount();
}

function updateChecklistLiveCount() {
  let completed = 0;
  FILING_CHECKLIST_ITEMS.forEach(it => {
    const chk = document.getElementById(`chk_${it.key}`);
    if (chk && chk.checked) completed++;
  });

  const total = FILING_CHECKLIST_ITEMS.length;
  const percent = Math.round((completed / total) * 100);

  const textEl = document.getElementById('chkProgressText');
  const badgeEl = document.getElementById('chkProgressBadge');
  const barEl = document.getElementById('chkProgressBar');

  if (textEl) textEl.textContent = `${completed} of ${total} Deliverables Ready`;
  if (badgeEl) {
    badgeEl.textContent = `${percent}% Complete`;
    if (percent === 100) {
      badgeEl.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
    } else {
      badgeEl.className = 'text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
  }
  if (barEl) {
    barEl.style.width = `${percent}%`;
    barEl.className = `h-full rounded-full checklist-progress-bar ${percent === 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-blue-400 to-emerald-400'}`;
  }
}

function handleAutoGenerateSummary(recordId) {
  const r = financialRecords.find(x => x.id === recordId);
  const year = document.getElementById('chkAssessmentYear')?.value || '2024/2025';
  
  const draftStatus = document.getElementById('mChkDraftStatus')?.value || 'Pending';
  const draftDate = formatDisplayDate(document.getElementById('mChkDraftDate')?.value);
  
  const auditStatus = document.getElementById('mChkAuditStatus')?.value || 'Pending';
  const auditDate = formatDisplayDate(document.getElementById('mChkAuditDate')?.value);
  
  const taxStatus = document.getElementById('mChkTaxStatus')?.value || 'Pending';
  const taxDate = formatDisplayDate(document.getElementById('mChkTaxDate')?.value);
  
  const irdStatus = document.getElementById('mChkIrdStatus')?.value || 'Pending';
  const irdDate = formatDisplayDate(document.getElementById('mChkIrdDate')?.value);
  const irdRef = document.getElementById('mChkIrdRef')?.value || '';

  const completedItems = [];
  FILING_CHECKLIST_ITEMS.forEach(it => {
    const chk = document.getElementById(`chk_${it.key}`);
    if (chk && chk.checked) {
      completedItems.push(it.label);
    }
  });

  const parts = [`Year ${year}`];
  if (draftStatus === 'Completed') {
    parts.push(`Draft Accounts Done${draftDate ? ' (' + draftDate + ')' : ''}`);
  }
  if (auditStatus === 'Completed') {
    parts.push(`Audited Account Done${auditDate ? ' (' + auditDate + ')' : ''}`);
  }
  if (taxStatus === 'Completed') {
    parts.push(`Tax Returns Finalized${taxDate ? ' (' + taxDate + ')' : ''}`);
  }
  if (irdStatus === 'Completed' || irdStatus === 'Acknowledged') {
    parts.push(`IRD Submitted${irdDate ? ' on ' + irdDate : ''}${irdRef ? ' (Ref: ' + irdRef + ')' : ''}`);
  } else if (irdStatus === 'Drafted') {
    parts.push(`Drafted on RAMIS System${irdDate ? ' (' + irdDate + ')' : ''}`);
  }

  if (completedItems.length > 0) {
    parts.push(`Checklist: [${completedItems.join(', ')} Ready]`);
  }

  const generated = parts.join('; ');
  const txtArea = document.getElementById('mChkFilingStatus');
  if (txtArea) {
    txtArea.value = generated;
  }
}

async function submitFilingChecklist(recordId) {
  if (!canEdit('financial_files')) {
    alert('Editor privileges required to update statutory filing checklist.');
    return;
  }

  const items = {};
  FILING_CHECKLIST_ITEMS.forEach(it => {
    const chk = document.getElementById(`chk_${it.key}`);
    const stat = document.getElementById(`stat_${it.key}`);
    const dt = document.getElementById(`date_${it.key}`);
    const nt = document.getElementById(`notes_${it.key}`);
    items[it.key] = {
      checked: chk ? chk.checked : false,
      status: stat ? stat.value : 'Pending',
      date: dt ? formatDisplayDate(dt.value) : '',
      notes: nt ? nt.value.trim() : ''
    };
  });

  const stages = {
    draftAccounts: {
      status: document.getElementById('mChkDraftStatus')?.value || 'Pending',
      date: formatDisplayDate(document.getElementById('mChkDraftDate')?.value),
      notes: document.getElementById('mChkDraftNotes')?.value.trim() || ''
    },
    audit: {
      status: document.getElementById('mChkAuditStatus')?.value || 'Pending',
      date: formatDisplayDate(document.getElementById('mChkAuditDate')?.value),
      auditor: document.getElementById('mChkAuditAuditor')?.value.trim() || ''
    },
    taxation: {
      status: document.getElementById('mChkTaxStatus')?.value || 'Pending',
      date: formatDisplayDate(document.getElementById('mChkTaxDate')?.value),
      taxType: document.getElementById('mChkTaxType')?.value.trim() || ''
    },
    irdSubmission: {
      status: document.getElementById('mChkIrdStatus')?.value || 'Pending',
      date: formatDisplayDate(document.getElementById('mChkIrdDate')?.value),
      refNo: document.getElementById('mChkIrdRef')?.value.trim() || ''
    }
  };

  const assessmentYear = document.getElementById('chkAssessmentYear')?.value || '2024/2025';
  const customNotes = document.getElementById('mChkCustomNotes')?.value.trim() || '';
  const filingStatus = document.getElementById('mChkFilingStatus')?.value.trim() || '';

  const filingChecklist = {
    assessmentYear,
    stages,
    items,
    customNotes,
    updatedAt: new Date().toISOString(),
    updatedBy: currentUser?.username || 'editor'
  };

  try {
    const res = await fetch(`/api/financial-files/${recordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        filingChecklist,
        filingStatus
      })
    });

    const data = await res.json();
    if (data.success) {
      // Update local cache
      const rec = financialRecords.find(x => x.id === recordId);
      if (rec) {
        rec.filingChecklist = filingChecklist;
        rec.filingStatus = filingStatus;
      }

      closeModal();
      // Re-render table
      const tbl = document.getElementById('financialTableContainer');
      if (tbl) {
        tbl.innerHTML = renderFinancialTable(getFilteredFinancialRecords());
      } else {
        renderFinancialFiles(document.getElementById('mainContent'));
      }
      if (window.lucide) lucide.createIcons();
      alert('Statutory filing checklist and status updated successfully.');
    } else {
      alert(data.error || 'Failed to save filing checklist.');
    }
  } catch (err) {
    alert('Network error while saving filing checklist: ' + err.message);
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
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Payroll</label>
              <select id="mUserPermPayroll" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="none" selected>No Access</option>
                <option value="viewer">Viewer (Read Only)</option>
                <option value="editor">Editor (Read/Write)</option>
                <option value="full">Full Control</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">User Mgmt</label>
              <select id="mUserPermUserMgmt" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="none" selected>No Access</option>
                <option value="viewer">Viewer (Read Only)</option>
                <option value="full">Full Control</option>
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
      financial_files: document.getElementById('mUserPermFin').value,
      payroll: document.getElementById('mUserPermPayroll').value,
      user_management: document.getElementById('mUserPermUserMgmt').value
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
      await renderAccessControl(document.getElementById('mainContent'));
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
          <p class="text-[11px] text-slate-500 font-mono">@${target.username} &middot; ID: ${target.id}${target.createdAt ? ` &middot; Member since ${formatDisplayDate(target.createdAt)}` : ''}</p>
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
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Payroll</label>
              <select id="mEditPermPayroll" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="full" ${target.permissions?.payroll === 'full' ? 'selected' : ''}>Full</option>
                <option value="editor" ${target.permissions?.payroll === 'editor' ? 'selected' : ''}>Editor</option>
                <option value="viewer" ${target.permissions?.payroll === 'viewer' ? 'selected' : ''}>Viewer</option>
                <option value="none" ${(!target.permissions?.payroll || target.permissions?.payroll === 'none') ? 'selected' : ''}>None</option>
              </select>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">User Mgmt</label>
              <select id="mEditPermUserMgmt" class="w-full p-1.5 bg-white border border-slate-200 rounded-lg text-xs">
                <option value="full" ${target.permissions?.user_management === 'full' ? 'selected' : ''}>Full</option>
                <option value="viewer" ${target.permissions?.user_management === 'viewer' ? 'selected' : ''}>Viewer</option>
                <option value="none" ${(!target.permissions?.user_management || target.permissions?.user_management === 'none') ? 'selected' : ''}>None</option>
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
      financial_files: document.getElementById('mEditPermFin').value,
      payroll: document.getElementById('mEditPermPayroll').value,
      user_management: document.getElementById('mEditPermUserMgmt').value
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
      await renderAccessControl(document.getElementById('mainContent'));
      alert('User details and permissions updated successfully.');
    } else {
      alert(data.error || 'Failed to update user');
    }
  } catch (err) {
    alert('Error updating user');
  }
}

async function deleteUserAccount(userId) {
  const target = usersList.find(u => u.id === userId);
  if (!target) return;
  if (currentUser && target.id === currentUser.id) {
    alert('Security Alert: You cannot delete your own active administrator account.');
    return;
  }
  if (target.username === 'admin') {
    alert('Security Alert: The root admin account cannot be deleted.');
    return;
  }
  if (!confirm(`Are you sure you want to permanently revoke access for @${target.username} (${target.fullName})? This cannot be undone.`)) return;

  try {
    const res = await fetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      await loadInitialData();
      await renderAccessControl(document.getElementById('mainContent'));
      alert(`User access for @${target.username} has been revoked.`);
    } else {
      alert(data.error || 'Failed to delete user');
    }
  } catch (e) {
    alert('Error deleting user');
  }
}

// ==========================================
// DATA PERSISTENCE & SYSTEM BACKUP / RESTORE
// ==========================================
async function downloadSystemBackup() {
  try {
    const res = await fetch('/api/system/backup', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (!res.ok) {
      alert('Failed to generate system backup. Please verify admin privileges.');
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.download = `spillburg_portal_backup_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert('Error exporting system backup: ' + err.message);
  }
}

async function handleSystemRestoreFile(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!confirm(`Are you sure you want to restore the portal state from "${file.name}"? This will update all users, passwords, operations tasks, and payroll records to match the backup.`)) {
    event.target.value = '';
    return;
  }

  try {
    const text = await file.text();
    const payload = JSON.parse(text);

    const res = await fetch('/api/system/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      alert(`System restore successful!\nRestored: ${JSON.stringify(data.restored, null, 2)}`);
      await loadInitialData();
      await renderAccessControl(document.getElementById('mainContent'));
    } else {
      alert('Restore failed: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    alert('Invalid backup file or restore failed: ' + err.message);
  } finally {
    event.target.value = '';
  }
}

function showPersistenceGuideModal() {
  openModal(`
    <div class="space-y-4">
      <div class="flex items-center gap-2 border-b border-slate-100 pb-3">
        <div class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
          <i data-lucide="shield-check" class="w-4 h-4"></i>
        </div>
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Cloud Data Persistence Architecture</h3>
          <p class="text-xs text-slate-500">How Spillburg Holdings protects data across deployments</p>
        </div>
      </div>

      <div class="space-y-3 text-xs text-slate-600 leading-relaxed">
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <span class="font-bold text-amber-800">Why Data Previously Reverted:</span>
          <p class="mt-1 text-amber-700">Cloud hosting services like Render run on ephemeral container disks. When a new deployment occurs, the old container is discarded and replaced with a fresh clone of the GitHub repository. Any password changes or tasks created were either uncommitted in git or stored only in the old container's disk, causing them to revert to default.</p>
        </div>

        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5">
          <span class="font-bold text-emerald-800">Four Permanent Protections Now Active:</span>
          <ol class="list-decimal pl-4 space-y-1 text-emerald-700">
            <li><strong>Render Free-Tier Deploy & Spin-Up Auto-Sync:</strong> Every Render deployment and instance wake-up automatically synchronizes data from your latest backup in <code>backup_files/</code> into the active portal database.</li>
            <li><strong>Auto-Sync in Push Script:</strong> Running <code>Push_To_GitHub.bat</code> automatically syncs your latest backup file into the data directory before staging, committing, and pushing to GitHub.</li>
            <li><strong>1-Click Backup & Restore:</strong> Download a complete JSON snapshot anytime. If a cloud server ever restarts fresh, click Restore to bring back all accounts and tasks in 2 seconds.</li>
            <li><strong>Persistent Cloud Volume Support:</strong> The server automatically binds to <code>PORTAL_DATA_DIR</code> or <code>/var/data</code> when a Render Persistent Disk is attached, keeping files permanent across all container cycles.</li>
          </ol>
        </div>
      </div>

      <div class="flex justify-end pt-2">
        <button onclick="closeModal()" class="px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg transition">Got it</button>
      </div>
    </div>
  `);
  if (window.lucide) lucide.createIcons();
}

// Know It All Section Roadmap Modal
function openKnowItAllModal() {
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-5 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-sm">
            <i data-lucide="brain" class="w-4 h-4"></i>
          </div>
          <div>
            <h3 class="font-display font-bold text-base text-slate-900">Know It All — Corporate Intelligence Engine</h3>
            <span class="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
              Scheduled Roadmap: Q4 2026 &middot; To Be Done Later
            </span>
          </div>
        </div>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <div class="p-4 rounded-xl bg-gradient-to-br from-purple-50/70 via-indigo-50/40 to-white border border-purple-200 space-y-2">
        <div class="font-bold text-slate-900 flex items-center gap-1.5 text-sm">
          <i data-lucide="sparkles" class="w-4 h-4 text-purple-600"></i> Next-Generation Knowledge Architecture
        </div>
        <p class="text-slate-600 leading-relaxed">
          The "Know It All" platform will unify Spillburg Holdings' cross-entity knowledge base, automated statutory compliance monitoring, bilateral business councils, and an executive AI query assistant.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
          <div class="font-semibold text-slate-900 flex items-center gap-2">
            <i data-lucide="building" class="w-4 h-4 text-emerald-600"></i> Bilateral Business Councils
          </div>
          <p class="text-slate-500 text-[11px] leading-relaxed">
            Sri Lanka - Greater Mekong, Sri Lanka - Nordic, and European chamber charters, secretariats, and member registers.
          </p>
        </div>

        <div class="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
          <div class="font-semibold text-slate-900 flex items-center gap-2">
            <i data-lucide="file-check" class="w-4 h-4 text-blue-600"></i> Corporate Secretarial SOPs
          </div>
          <p class="text-slate-500 text-[11px] leading-relaxed">
            ROC Form 1, Form 13, Form 15, Form 20 workflows, annual return deadlines, and notary public checklists.
          </p>
        </div>

        <div class="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
          <div class="font-semibold text-slate-900 flex items-center gap-2">
            <i data-lucide="landmark" class="w-4 h-4 text-amber-600"></i> Inland Revenue (RAMIS)
          </div>
          <p class="text-slate-500 text-[11px] leading-relaxed">
            Automated tax calculation guidelines, APIT, SSCL, VAT filing timetables, and IRD regional office directories.
          </p>
        </div>

        <div class="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-1.5">
          <div class="font-semibold text-slate-900 flex items-center gap-2">
            <i data-lucide="bot" class="w-4 h-4 text-purple-600"></i> Semantic Intelligence Search
          </div>
          <p class="text-slate-500 text-[11px] leading-relaxed">
            Instant vector search across all scanned agreements, physical archive records, and operational task notes.
          </p>
        </div>
      </div>

      <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
        <span>Status: Architectural planning in progress.</span>
        <span class="font-semibold text-purple-700">Sprint Target: Version 2.2</span>
      </div>

      <div class="pt-3 flex justify-end border-t border-slate-100">
        <button onclick="closeModal()" class="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold transition shadow-sm">
          Close Preview
        </button>
      </div>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// =========================================================================
// SPILLBURG HOLDINGS - PAYROLL & BANK REMITTANCE AUTOMATION MODULE
// Matching Original Sheet Designs: salary_sheet.pdf, bank_request.pdf, payroll.pdf
// =========================================================================

function formatMoney(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '-';
  const val = Number(num);
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function renderPayroll(container) {
  if (!payrollData) {
    try {
      const res = await fetch('/api/payroll', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        payrollData = await res.json();
        activePayrollPeriod = payrollData.activePeriod || null;
      }
    } catch (e) {
      console.error('Error fetching payroll:', e);
    }
  }

  if (!payrollData || !payrollData.companies || payrollData.companies.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-slate-500 space-y-3">
        <i data-lucide="alert-circle" class="w-10 h-10 text-amber-500 mx-auto"></i>
        <h3 class="text-base font-bold text-slate-800">Payroll Records Not Available</h3>
        <p class="text-xs">Unable to load payroll company data. Please verify server connection.</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  // Resolve currently active / selected company
  if (!selectedPayrollCompanyId) {
    selectedPayrollCompanyId = (activePayrollPeriod && activePayrollPeriod.companyId) || (payrollData.companies[0]?.id) || 'comp_apadmi';
  }

  const selectedComp = (payrollData.companies || []).find(c => c.id === selectedPayrollCompanyId) || payrollData.companies[0];
  selectedPayrollCompanyId = selectedComp.id;

  // Filter periods belonging to this company
  const compPeriods = (payrollData.periods || []).filter(per => per.companyId === selectedComp.id);

  // If active period doesn't belong to the selected company, switch to first period of that company
  if (!activePayrollPeriod || activePayrollPeriod.companyId !== selectedComp.id) {
    if (compPeriods.length > 0) {
      try {
        const pRes = await fetch(`/api/payroll/period?id=${encodeURIComponent(compPeriods[0].id)}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (pRes.ok) {
          const pData = await pRes.json();
          activePayrollPeriod = pData.period;
        }
      } catch (err) {}
    } else {
      activePayrollPeriod = null;
    }
  }

  const p = activePayrollPeriod;
  const totals = p ? (p.totals || {}) : {};

  // Build the complete HTML
  container.innerHTML = `
    <div class="space-y-6 fade-in">

      <!-- ================= COMPANY DASHBOARD & SELECTION HUB ================= -->
      <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 p-4 sm:p-5 rounded-2xl text-white shadow-md space-y-4 border border-slate-700/60">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-bold text-lg shadow-inner">
              <i data-lucide="building-2" class="w-6 h-6"></i>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wider text-teal-300 bg-teal-950 px-2 py-0.5 rounded border border-teal-700/60">Managed Client Company</span>
                <span class="text-xs text-slate-400 font-mono">${escapeHtml(selectedComp.code || 'CO')} &bull; Reg: ${escapeHtml(selectedComp.registrationNo || 'N/A')}</span>
              </div>
              <h2 class="text-lg sm:text-xl font-bold font-display tracking-tight text-white mt-0.5">${escapeHtml(selectedComp.name)}</h2>
            </div>
          </div>

          <!-- Company Actions Toolbar -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Select Company Dropdown -->
            <div class="relative">
              <select id="payrollCompanySelect" onchange="handlePayrollCompanyChange(this.value)"
                class="appearance-none pl-3 pr-8 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white shadow-sm hover:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/40 cursor-pointer">
                ${(payrollData.companies || []).map(c => `
                  <option value="${c.id}" ${c.id === selectedComp.id ? 'selected' : ''}>
                    ${escapeHtml(c.name)} (${escapeHtml(c.code || 'CO')})
                  </option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none"></i>
            </div>

            <!-- Add New Company Button -->
            <button onclick="openAddCompanyModal()"
              class="px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition">
              <i data-lucide="plus-circle" class="w-3.5 h-3.5"></i>
              <span>+ Add Company</span>
            </button>

            <!-- Edit Company Profile Button -->
            <button onclick="openEditCompanyModal('${selectedComp.id}')"
              class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
              <i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
              <span>Edit Company</span>
            </button>

            <!-- Directory Overview Button -->
            <button onclick="openCompanyDirectoryModal()"
              class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
              <i data-lucide="layout-grid" class="w-3.5 h-3.5"></i>
              <span>All Companies (${(payrollData.companies || []).length})</span>
            </button>
          </div>
        </div>

        <!-- Company Metadata Pill Row -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-700/60 text-[11px] text-slate-300">
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Bank / Branch:</span>
            <span class="font-medium truncate block">${escapeHtml(selectedComp.bankName || 'N/A')} - ${escapeHtml(selectedComp.bankBranch || '')}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Debit Account:</span>
            <span class="font-mono text-emerald-400 truncate block">${escapeHtml(selectedComp.debitAccountNo || 'N/A')}</span>
          </div>
          <div>
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Signatory:</span>
            <span class="font-medium truncate block">${escapeHtml(selectedComp.authorizedSignatory || 'Shaameel Mohideen')}</span>
          </div>
          <div onclick="openManagePeriodsModal('${selectedComp.id}')" class="cursor-pointer hover:bg-slate-800/80 p-1.5 rounded-lg transition" title="Click to manage all periods for this company">
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Payroll Periods:</span>
            <span class="font-bold text-teal-300 block flex items-center gap-1">
              <span>${compPeriods.length} active cycle${compPeriods.length === 1 ? '' : 's'}</span>
              <i data-lucide="external-link" class="w-3 h-3 text-teal-400"></i>
            </span>
          </div>
        </div>
      </div>

      ${compPeriods.length === 0 ? `
        <!-- Empty State for Company without periods -->
        <div class="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-4 my-4 shadow-sm">
          <div class="w-16 h-16 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center mx-auto border border-teal-200">
            <i data-lucide="folder-plus" class="w-8 h-8"></i>
          </div>
          <div class="max-w-md mx-auto space-y-1">
            <h3 class="text-base font-bold text-slate-900">No Payroll Periods Found for ${escapeHtml(selectedComp.name)}</h3>
            <p class="text-xs text-slate-500">This client company does not have any processed salary sheets or bank remittance cycles yet. Initialize the first payroll cycle to begin.</p>
          </div>
          <button onclick="openNewPeriodModal('${selectedComp.id}')"
            class="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition">
            <i data-lucide="plus" class="w-4 h-4"></i>
            <span>Create Initial Payroll Period for ${escapeHtml(selectedComp.code || 'Company')}</span>
          </button>
        </div>
      ` : `
        <!-- Top Header & Period Selector -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h2 class="font-display font-bold text-xl md:text-2xl text-slate-900 tracking-tight">
              Staff Salary &amp; Remittance Records
            </h2>
            <p class="text-xs text-slate-500">
              Active Period: <span class="font-semibold text-slate-800">${escapeHtml(p ? p.month : '')}</span> &bull; ${selectedComp?.currencyMode === 'single' ? '<span class="text-teal-700 font-semibold">Single Currency (LKR Only)</span>' : `Dual Currency (${escapeHtml(selectedComp?.foreignCurrency || 'GBP')} &amp; LKR) with Official Bank Letter`}
            </p>
          </div>

          <!-- Period Selector & Actions Toolbar -->
          <div class="flex flex-wrap items-center gap-2">
            <!-- Period Status Badge & Quick Dropdown -->
            <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold ${
              p?.status === 'Finalized' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              p?.status === 'Approved' ? 'bg-indigo-50 border-indigo-200 text-indigo-800' :
              p?.status === 'Under Review' ? 'bg-blue-50 border-blue-200 text-blue-800' :
              p?.status === 'Paid' ? 'bg-teal-50 border-teal-200 text-teal-800' :
              'bg-amber-50 border-amber-200 text-amber-800'
            }">
              <span class="w-2 h-2 rounded-full ${
                p?.status === 'Finalized' ? 'bg-emerald-500' :
                p?.status === 'Approved' ? 'bg-indigo-500' :
                p?.status === 'Under Review' ? 'bg-blue-500' :
                p?.status === 'Paid' ? 'bg-teal-500' :
                'bg-amber-500'
              }"></span>
              ${canEdit('payroll') && p ? `
                <select onchange="handleQuickPeriodStatusChange('${p.id}', this.value)" title="Change Period Status"
                  class="bg-transparent border-none text-xs font-bold text-slate-800 focus:outline-none cursor-pointer">
                  <option value="Draft" ${p.status === 'Draft' ? 'selected' : ''}>Draft</option>
                  <option value="Under Review" ${p.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
                  <option value="Approved" ${p.status === 'Approved' ? 'selected' : ''}>Approved</option>
                  <option value="Finalized" ${p.status === 'Finalized' ? 'selected' : ''}>Finalized</option>
                  <option value="Paid" ${p.status === 'Paid' ? 'selected' : ''}>Paid</option>
                </select>
              ` : `
                <span>${escapeHtml(p?.status || 'Draft')}</span>
              `}
            </div>

            <!-- Currency / Live Exchange Rate Badge -->
            ${selectedComp?.currencyMode === 'single' ? `
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-xs text-teal-900 shadow-2xs font-semibold">
                <i data-lucide="banknote" class="w-3.5 h-3.5 text-teal-600"></i>
                <span>Currency: LKR Only</span>
              </div>
            ` : `
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 shadow-2xs">
                <i data-lucide="trending-up" class="w-3.5 h-3.5 text-amber-600"></i>
                <span class="font-medium text-amber-700">1 ${escapeHtml(selectedComp?.foreignCurrency || 'GBP')} =</span>
                <span class="font-bold text-slate-900">${formatMoney(p ? p.exchangeRate : 440, 2)} LKR</span>
                ${canEdit('payroll') ? `
                  <button onclick="openExchangeRateModal()" title="Adjust Exchange Rate" class="ml-1 p-1 hover:bg-amber-100 rounded text-amber-700 transition">
                    <i data-lucide="edit-2" class="w-3 h-3"></i>
                  </button>
                ` : ''}
              </div>
            `}

            <!-- Month/Period Selector (Filtered to this company) -->
            <div class="relative">
              <select id="payrollPeriodSelect" onchange="handlePayrollPeriodChange(this.value)"
                class="appearance-none pl-3 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer">
                ${compPeriods.map(per => `
                  <option value="${per.id}" ${p && per.id === p.id ? 'selected' : ''}>
                    ${escapeHtml(per.month)} (${per.employeeCount || 0} Staff) [${per.status || 'Draft'}]
                  </option>
                `).join('')}
              </select>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-2.5 pointer-events-none"></i>
            </div>

            <!-- Manage Periods Button -->
            <button onclick="openManagePeriodsModal('${selectedComp.id}')"
              class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition"
              title="Manage, edit, duplicate, or delete payroll periods">
              <i data-lucide="calendar-range" class="w-3.5 h-3.5 text-teal-600"></i>
              <span>Manage Periods (${compPeriods.length})</span>
            </button>

            <!-- Edit Current Period Settings Button -->
            ${canEdit('payroll') && p ? `
              <button onclick="openEditPeriodModal('${p.id}')"
                class="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1 shadow-2xs transition"
                title="Edit period details, month code, letter date, and bank signatories">
                <i data-lucide="sliders" class="w-3.5 h-3.5 text-slate-600"></i>
                <span class="hidden sm:inline">Settings</span>
              </button>
            ` : ''}

            <!-- Add Period Button -->
            ${canEdit('payroll') ? `
              <button onclick="openNewPeriodModal('${selectedComp.id}')"
                class="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition">
                <i data-lucide="plus" class="w-3.5 h-3.5"></i>
                <span>New Period</span>
              </button>
            ` : ''}
          </div>
        </div>

        <!-- KPI Executive Stat Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- 1. Total Net Remittance to Bank -->
          <div class="glass-card p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white via-white to-emerald-50/40 relative overflow-hidden shadow-2xs">
            <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span class="font-semibold uppercase tracking-wider text-[10px] text-emerald-700">Bank Remittance</span>
              <i data-lucide="landmark" class="w-4 h-4 text-emerald-600"></i>
            </div>
            <div class="text-xl md:text-2xl font-bold font-display text-slate-900 tracking-tight">
              Rs ${formatMoney(totals.sumNetSalaryLkr, 2)}
            </div>
            <div class="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Net Staff Pay (${p?.employees?.length || 0} Members)</span>
              <span class="font-medium text-emerald-700">${escapeHtml((p && p.bankBranch) || selectedComp.bankBranch || 'Borella')}</span>
            </div>
          </div>

          <!-- 2. Total Earned Base GBP -->
          <div class="glass-card p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span class="font-semibold uppercase tracking-wider text-[10px] text-blue-700">Earned Base (GBP)</span>
              <i data-lucide="coins" class="w-4 h-4 text-blue-600"></i>
            </div>
            <div class="text-xl md:text-2xl font-bold font-display text-slate-900 tracking-tight">
              &pound; ${formatMoney(totals.sumEarnedGbp, 2)}
            </div>
            <div class="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Total GBP Base</span>
              <span class="font-medium text-slate-700">Contract &pound; ${formatMoney(totals.sumGbpSalary, 2)}</span>
            </div>
          </div>

          <!-- 3. Statutory Deductions (EPF 8% + APIT) -->
          <div class="glass-card p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span class="font-semibold uppercase tracking-wider text-[10px] text-amber-700">Statutory Deductions</span>
              <i data-lucide="receipt" class="w-4 h-4 text-amber-600"></i>
            </div>
            <div class="text-xl md:text-2xl font-bold font-display text-slate-900 tracking-tight">
              Rs ${formatMoney(totals.sumDeductionsLkr, 2)}
            </div>
            <div class="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>EPF 8%: Rs ${formatMoney(totals.sumEpf8Lkr, 0)}</span>
              <span class="font-medium text-amber-700">APIT: Rs ${formatMoney(totals.sumApitLkr, 0)}</span>
            </div>
          </div>

          <!-- 4. Employer Contributions (EPF 12% + ETF 3%) -->
          <div class="glass-card p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div class="flex items-center justify-between text-xs text-slate-500 mb-1">
              <span class="font-semibold uppercase tracking-wider text-[10px] text-indigo-700">Employer EPF/ETF</span>
              <i data-lucide="shield-check" class="w-4 h-4 text-indigo-600"></i>
            </div>
            <div class="text-xl md:text-2xl font-bold font-display text-slate-900 tracking-tight">
              Rs ${formatMoney((totals.sumEpf12Lkr || 0) + (totals.sumEtf3Lkr || 0), 2)}
            </div>
            <div class="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>EPF 12%: Rs ${formatMoney(totals.sumEpf12Lkr, 0)}</span>
              <span class="font-medium text-indigo-700">ETF 3%: Rs ${formatMoney(totals.sumEtf3Lkr, 0)}</span>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs (Sub-Views) -->
        <div class="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto tab-nav-bar">
          <button onclick="switchPayrollSubTab('sheet')" id="paytab-sheet"
            class="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${currentPayrollSubTab === 'sheet' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
            <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5"></i>
            <span>Staff Payroll Sheet (Dual Table)</span>
          </button>

          <button onclick="switchPayrollSubTab('letter')" id="paytab-letter"
            class="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${currentPayrollSubTab === 'letter' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
            <i data-lucide="mail" class="w-3.5 h-3.5"></i>
            <span>Bank Request Letter (Printed to Bank)</span>
          </button>

          <button onclick="switchPayrollSubTab('slips')" id="paytab-slips"
            class="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${currentPayrollSubTab === 'slips' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
            <i data-lucide="ticket" class="w-3.5 h-3.5"></i>
            <span>Individual Payslips (Vouchers)</span>
          </button>

          <button onclick="switchPayrollSubTab('staff')" id="paytab-staff"
            class="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${currentPayrollSubTab === 'staff' ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">
            <i data-lucide="users" class="w-3.5 h-3.5"></i>
            <span>Staff Directory &amp; Details</span>
          </button>
        </div>

        <!-- Active Tab Sub-View Container -->
        <div id="payrollSubContent" class="space-y-4">
          <!-- Injected via sub-tab handler -->
        </div>
      `}

    </div>
  `;

  if (compPeriods.length > 0 && p) {
    renderActivePayrollSubTab();
  }
  if (window.lucide) lucide.createIcons();
}

function switchPayrollSubTab(tab) {
  currentPayrollSubTab = tab;
  ['sheet', 'letter', 'slips', 'staff'].forEach(t => {
    const btn = document.getElementById(`paytab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition bg-teal-600 text-white shadow-sm';
      } else {
        btn.className = 'px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition bg-white text-slate-600 border border-slate-200 hover:bg-slate-50';
      }
    }
  });
  renderActivePayrollSubTab();
}

function renderActivePayrollSubTab() {
  const container = document.getElementById('payrollSubContent');
  if (!container) return;
  container.innerHTML = '';

  if (currentPayrollSubTab === 'sheet') {
    renderPayrollSheet(container);
  } else if (currentPayrollSubTab === 'letter') {
    renderBankRequestLetter(container);
  } else if (currentPayrollSubTab === 'slips') {
    renderIndividualPayslips(container);
  } else if (currentPayrollSubTab === 'staff') {
    renderPayrollStaffManager(container);
  }
  if (window.lucide) lucide.createIcons();
  scheduleStickyScrollbarUpdate();
}

// ---------------- 1. STAFF PAYROLL SHEET (DUAL / SINGLE TABLE) ----------------
function renderPayrollSheet(container) {
  const p = activePayrollPeriod;
  const emps = p.employees || [];
  const totals = p.totals || {};
  const currentComp = (payrollData?.companies || []).find(c => c.id === p.companyId) || (payrollData?.companies && payrollData.companies[0]) || { name: 'APADMI SL (PRIVATE) LIMITED' };
  const isSingleCurrency = (currentComp.currencyMode === 'single');
  const foreignCurr = currentComp.foreignCurrency || 'GBP';

  container.innerHTML = `
    <div class="space-y-4 fade-in">
      
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-800">Master Sheet:</span>
          <span class="text-xs text-slate-600 font-medium">${escapeHtml(p.month)} ${isSingleCurrency ? '(LKR Single Currency)' : `(Dual ${escapeHtml(foreignCurr)} &amp; LKR Tables)`}</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button onclick="printMasterSalarySheet()"
            class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            <span>Print Sheet (Landscape)</span>
          </button>

          <button onclick="exportPayrollExcel()"
            class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">
            <i data-lucide="download" class="w-3.5 h-3.5"></i>
            <span>Download Excel (.xlsx)</span>
          </button>

          <button onclick="exportPayrollCsv()"
            class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
            <i data-lucide="file-text" class="w-3.5 h-3.5"></i>
            <span>Export CSV</span>
          </button>

          <button onclick="openAddEmployeeModal()"
            class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition">
            <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      <!-- Excel Master Sheet Container -->
      <div class="payroll-sheet-wrap overflow-x-auto">

        ${isSingleCurrency ? `
          <!-- SINGLE CURRENCY: PURE LKR SALARY SHEET -->
          <div class="excel-header-title flex items-center justify-between">
            <span>SALARY SHEET (IN LKR) - ${p.month.toUpperCase()}</span>
            <span class="text-[11px] font-normal text-slate-500">Base Currency: LKR Only</span>
          </div>

          <table class="excel-payroll-table">
            <thead>
              <tr>
                <th style="width: 35px;">No</th>
                <th style="text-align: left; min-width: 190px;">Employee Name</th>
                <th style="text-align: left; min-width: 160px;">POSITION</th>
                <th>Basic Salary (LKR)</th>
                <th>Working Days</th>
                <th>Earned Salary (LKR)</th>
                <th>EPF 8%</th>
                <th>EPF 12%</th>
                <th>ETF 3%</th>
                <th style="min-width: 95px;">APIT (LKR)</th>
                <th>Other Deductions</th>
                <th>Net Remittance (LKR)</th>
                <th>BANK ACCOUNT NO</th>
                <th>TIN NO</th>
                <th>IDNO</th>
                <th>Date Joined</th>
                <th class="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              ${emps.map(e => `
                <tr>
                  <td style="text-align: center;">${e.no}</td>
                  <td style="font-weight: 600; text-align: left;">${escapeHtml(e.name)}</td>
                  <td style="text-align: left; color: #475569;">${escapeHtml(e.position)}</td>
                  <td style="text-align: right;">${formatMoney(e.lkrSalary || e.lkrGross || 0, 2)}</td>
                  <td style="text-align: center; color: #b45309; font-weight: 600;">${escapeHtml(e.workDays || '')}</td>
                  <td style="text-align: right; font-weight: 600;">${formatMoney(e.earnedLkr || e.lkrGross || 0, 2)}</td>
                  <td style="text-align: right;">${formatMoney(e.epf8Lkr, 0)}</td>
                  <td style="text-align: right;">${formatMoney(e.epf12Lkr, 0)}</td>
                  <td style="text-align: right;">${formatMoney(e.etf3Lkr, 0)}</td>
                  <td style="text-align: right; padding: 2px 4px;">
                    <input type="number" step="1" min="0"
                      value="${Math.round(e.apit || 0)}"
                      title="APIT Tax (LKR) - Editable. Press Enter to recalculate."
                      class="font-mono text-right text-red-600 font-semibold bg-transparent hover:bg-red-50 focus:bg-white focus:ring-1 focus:ring-red-400 border border-transparent hover:border-red-200 rounded px-1 py-0.5 transition"
                      style="width: 82px;"
                      onchange="updateEmployeeApitInline('${e.id}', this.value)"
                      onkeydown="if(event.key==='Enter'){this.blur();}"
                    />
                  </td>
                  <td style="text-align: right;">${e.otherDeductions ? formatMoney(e.otherDeductions, 2) : '-'}</td>
                  <td style="text-align: right; font-weight: 700; color: #047857; font-size: 11.5px;">${formatMoney(e.netSalaryLkr, 0)}</td>
                  <td style="text-align: left; font-family: monospace;">${escapeHtml(e.bankAccountNo)}${e.bankCode ? `(${escapeHtml(e.bankCode)})` : ''}</td>
                  <td style="text-align: center;">${escapeHtml(e.tinNo || '-')}</td>
                  <td style="text-align: center;">${escapeHtml(e.idNo || '-')}</td>
                  <td style="text-align: center;">${escapeHtml(e.dateJoined || '-')}</td>
                  <td class="no-print" style="text-align: center;">
                    <button onclick="openEditEmployeeModal('${e.id}')" title="Edit Staff Member" class="p-1 hover:text-teal-600 transition">
                      <i data-lucide="edit" class="w-3 h-3"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}

              <tr class="totals-row">
                <td colspan="3" style="text-align: center; font-weight: bold;">TOTAL</td>
                <td style="text-align: right;">${formatMoney(totals.sumLkrGross || 0, 2)}</td>
                <td></td>
                <td style="text-align: right;">${formatMoney(totals.sumLkrGross || 0, 2)}</td>
                <td style="text-align: right;">${formatMoney(totals.sumEpf8Lkr, 0)}</td>
                <td style="text-align: right;">${formatMoney(totals.sumEpf12Lkr, 0)}</td>
                <td style="text-align: right;">${formatMoney(totals.sumEtf3Lkr, 0)}</td>
                <td style="text-align: right; color: #dc2626; font-weight: 700;">${formatMoney(totals.sumApitLkr, 0)}</td>
                <td></td>
                <td style="text-align: right; font-size: 12px; color: #047857; font-weight: 800;">${formatMoney(totals.sumNetSalaryLkr, 0)}</td>
                <td colspan="5"></td>
              </tr>
            </tbody>
          </table>

          <!-- Sign-off Row -->
          <div class="excel-signoff-row">
            <div>
              <div class="font-bold text-slate-800">Checked by: ${escapeHtml(p.checkedBy || 'Hemanthi Basnayake')}</div>
              <div class="text-slate-500">${escapeHtml(p.checkedTitle || 'Accountant')}</div>
            </div>
            <div style="text-align: right;">
              <div class="font-bold text-slate-800">Authorized by: ${escapeHtml(p.authorizedSignatory || 'Shaameel Mohideen')}</div>
              <div class="text-slate-500">${escapeHtml(p.authorizedCompany || 'Spillburg Holdings (pvt)Ltd')}</div>
            </div>
          </div>
        ` : `
          <!-- DUAL CURRENCY: TABLE 1 (${foreignCurr}) -->
          <div class="excel-header-title flex items-center justify-between">
            <span>SALARY SHEET (IN ${foreignCurr} ) - ${p.month.toUpperCase()}</span>
            <span class="text-[11px] font-normal text-slate-500">Base Currency: ${foreignCurr}</span>
          </div>

          <table class="excel-payroll-table">
            <thead>
              <tr>
                <th style="width: 35px;">No</th>
                <th style="text-align: left; min-width: 200px;">Employee Name</th>
                <th style="text-align: left; min-width: 170px;">POSITION</th>
                <th>${foreignCurr} Salary</th>
                <th>Working Days</th>
                <th>Earned Base (${foreignCurr})</th>
                <th>EPF (12% )</th>
                <th>ETF(3% )</th>
                <th>Total Employer Cost (${foreignCurr})</th>
                <th>BANK ACCOUNT NO</th>
                <th>TIN NO</th>
                <th>IDNO</th>
                <th>Date Joined</th>
                <th class="no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              ${emps.map(e => `
                <tr>
                  <td style="text-align: center;">${e.no}</td>
                  <td style="font-weight: 600; text-align: left;">${escapeHtml(e.name)}</td>
                  <td style="text-align: left; color: #475569;">${escapeHtml(e.position)}</td>
                  <td style="text-align: right;">${formatMoney(e.gbpSalary, 2)}</td>
                  <td style="text-align: center; color: #b45309; font-weight: 600;">${escapeHtml(e.workDays || '')}</td>
                  <td style="text-align: right; font-weight: 600;">${formatMoney(e.earnedGbp, 2)}</td>
                  <td style="text-align: right;">${formatMoney(e.epf12Gbp, 0)}</td>
                  <td style="text-align: right;">${formatMoney(e.etf3Gbp, 0)}</td>
                  <td style="text-align: right; font-weight: 700; color: #1e3a8a;">${formatMoney(e.totalGbp, 2)}</td>
                  <td style="text-align: left; font-family: monospace;">${escapeHtml(e.bankAccountNo)}${e.bankCode ? `(${escapeHtml(e.bankCode)})` : ''}</td>
                  <td style="text-align: center;">${escapeHtml(e.tinNo || '-')}</td>
                  <td style="text-align: center;">${escapeHtml(e.idNo || '-')}</td>
                  <td style="text-align: center;">${escapeHtml(e.dateJoined || '-')}</td>
                  <td class="no-print" style="text-align: center;">
                    <button onclick="openEditEmployeeModal('${e.id}')" title="Edit Staff Member" class="p-1 hover:text-teal-600 transition">
                      <i data-lucide="edit" class="w-3 h-3"></i>
                    </button>
                  </td>
                </tr>
              `).join('')}

              <!-- Foreign Summary Totals Row -->
              <tr class="totals-row">
                <td colspan="3" style="text-align: center; font-weight: bold;">TOTAL</td>
                <td style="text-align: right;">${formatMoney(totals.sumGbpSalary, 2)}</td>
                <td></td>
                <td style="text-align: right;">${formatMoney(totals.sumEarnedGbp, 2)}</td>
                <td style="text-align: right;">${formatMoney(totals.sumEpf12Gbp, 0)}</td>
                <td style="text-align: right;">${formatMoney(totals.sumEtf3Gbp, 0)}</td>
                <td style="text-align: right; font-size: 11.5px;">${formatMoney(totals.sumTotalGbp, 2)}</td>
                <td colspan="5"></td>
              </tr>
            </tbody>
          </table>

          <!-- Sign-off Row -->
          <div class="excel-signoff-row">
            <div>
              <div class="font-bold text-slate-800">Checked by: ${escapeHtml(p.checkedBy || 'Hemanthi Basnayake')}</div>
              <div class="text-slate-500">${escapeHtml(p.checkedTitle || 'Accountant')}</div>
            </div>
            <div style="text-align: right;">
              <div class="font-bold text-slate-800">Authorized by: ${escapeHtml(p.authorizedSignatory || 'Shaameel Mohideen')}</div>
              <div class="text-slate-500">${escapeHtml(p.authorizedCompany || 'Spillburg Holdings (pvt)Ltd')}</div>
            </div>
          </div>

          <!-- TABLE 2: LKR SALARY SHEET -->
          <div class="excel-header-title flex items-center justify-between border-t-2 border-slate-300">
            <span>SALARY SHEET (IN LKR) - ${p.month.toUpperCase()} @ ${formatMoney(p.exchangeRate, 0)}</span>
            <span class="text-[11px] font-normal text-slate-500">Exchange Rate: @${formatMoney(p.exchangeRate, 2)} LKR/${foreignCurr}</span>
          </div>

          <table class="excel-payroll-table">
            <thead>
              <tr>
                <th style="width: 35px;">No</th>
                <th style="text-align: left; min-width: 200px;">Employee Name</th>
                <th style="text-align: left; min-width: 170px;">POSITION</th>
                <th>${foreignCurr} Salary</th>
                <th>Working Days</th>
                <th>Earned Base (${foreignCurr})</th>
                <th>LKR</th>
                <th>EPF 8%</th>
                <th>EPF12%</th>
                <th>ETF 3%</th>
                <th style="min-width: 95px;">APIT (LKR)</th>
                <th>Other Deductions</th>
                <th>Net Remittance (LKR)</th>
              </tr>
            </thead>
            <tbody>
              ${emps.map(e => `
                <tr>
                  <td style="text-align: center;">${e.no}</td>
                  <td style="font-weight: 600; text-align: left;">${escapeHtml(e.name)}</td>
                  <td style="text-align: left; color: #475569;">${escapeHtml(e.position)}</td>
                  <td style="text-align: right;">${formatMoney(e.gbpSalary, 2)}</td>
                  <td style="text-align: center; color: #b45309; font-weight: 600;">${escapeHtml(e.workDays || '')}</td>
                  <td style="text-align: right;">${formatMoney(e.earnedGbp, 2)}</td>
                  <td style="text-align: right; font-weight: 600;">${formatMoney(e.lkrGross, 0)}</td>
                  <td style="text-align: right;">${formatMoney(e.epf8Lkr, 0)}</td>
                  <td style="text-align: right;">${formatMoney(e.epf12Lkr, 0)}</td>
                  <td style="text-align: right;">${formatMoney(e.etf3Lkr, 0)}</td>
                  <td style="text-align: right; padding: 2px 4px;">
                    <input type="number" step="1" min="0"
                      value="${Math.round(e.apit || 0)}"
                      title="APIT Tax (LKR) - Editable. Press Enter to recalculate."
                      class="font-mono text-right text-red-600 font-semibold bg-transparent hover:bg-red-50 focus:bg-white focus:ring-1 focus:ring-red-400 border border-transparent hover:border-red-200 rounded px-1 py-0.5 transition"
                      style="width: 82px;"
                      onchange="updateEmployeeApitInline('${e.id}', this.value)"
                      onkeydown="if(event.key==='Enter'){this.blur();}"
                    />
                  </td>
                  <td></td>
                  <td style="text-align: right; font-weight: 700; color: #047857; font-size: 11.5px;">${formatMoney(e.netSalaryLkr, 0)}</td>
                </tr>
              `).join('')}

              <!-- LKR Summary Totals Row -->
              <tr class="totals-row">
                <td colspan="3" style="text-align: center; font-weight: bold;">TOTAL</td>
                <td style="text-align: right;">${formatMoney(totals.sumGbpSalary, 2)}</td>
                <td></td>
                <td style="text-align: right;">${formatMoney(totals.sumEarnedGbp, 2)}</td>
                <td style="text-align: right; font-weight: 700;">${formatMoney(totals.sumLkrGross, 0)}</td>
                <td style="text-align: right;">${formatMoney(totals.sumEpf8Lkr, 0)}</td>
                <td style="text-align: right;">${formatMoney(totals.sumEpf12Lkr, 0)}</td>
                <td style="text-align: right;">${formatMoney(totals.sumEtf3Lkr, 0)}</td>
                <td style="text-align: right; color: #dc2626; font-weight: 700;">${formatMoney(totals.sumApitLkr, 0)}</td>
                <td></td>
                <td style="text-align: right; font-size: 12px; color: #047857; font-weight: 800;">${formatMoney(totals.sumNetSalaryLkr, 0)}</td>
              </tr>
            </tbody>
          </table>
        `}

      </div>

    </div>
  `;
}

// ---------------- 2. BANK REQUEST LETTER ----------------
function renderBankRequestLetter(container) {
  const p = activePayrollPeriod;
  const emps = p.employees || [];
  const totals = p.totals || {};
  const currentComp = (payrollData?.companies || []).find(c => c.id === p.companyId) || (payrollData?.companies && payrollData.companies[0]) || { name: 'APADMI SL (PRIVATE) LIMITED' };

  container.innerHTML = `
    <div class="space-y-4 fade-in">
      
      <!-- Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 class="text-xs font-bold text-slate-800">Official Bank Remittance Presentation</h3>
          <p class="text-[11px] text-slate-500">Letter to ${escapeHtml(p.bankName || currentComp.bankName || 'Nations Trust Bank PLC')} for staff direct salary transfer</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Letterhead Toggle -->
          <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition border border-slate-200">
            <input type="checkbox" id="toggleLetterheadPreview" ${bankLetterheadEnabled ? 'checked' : ''} onchange="toggleBankLetterhead(this.checked)" class="rounded text-teal-600 focus:ring-teal-500">
            <span>Use Letterhead</span>
          </label>

          <button onclick="printBankRequestLetter()"
            class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-sm">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            <span>Print Bank Request Letter</span>
          </button>

          <button onclick="openEditBankDetailsModal()"
            class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
            <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
            <span>Edit Letter Details</span>
          </button>
        </div>
      </div>

      <!-- Visual Preview of Bank Request Letter on Letterhead -->
      <div class="bank-letter-container">
        <div class="bank-letter-sheet ${bankLetterheadEnabled ? '' : 'no-letterhead'}">

          <!-- Date -->
          <div style="margin-bottom: 18px; font-weight: 600;">
            ${escapeHtml(p.letterDate || '30.09.2026')}
          </div>

          <!-- Addressee -->
          <div style="line-height: 1.35; margin-bottom: 20px;">
            <div>The Manager</div>
            <div style="font-weight: 500;">${escapeHtml(p.bankName || currentComp.bankName || 'Nations Trust Bank PLC')},</div>
            <div>${escapeHtml(p.bankBranch || currentComp.bankBranch || 'Borella Branch')},</div>
            <div>${(p.bankAddress || currentComp.bankAddress || '67 D.S. Senanayake Mawatha,\nColombo 08.').split('\n').map(l => escapeHtml(l)).join('<br>')}</div>
          </div>

          <!-- Salutation -->
          <div style="margin-bottom: 12px;">Dear Sir,</div>

          <!-- Subject -->
          <div style="margin-bottom: 16px; font-weight: 700; text-decoration: underline;">
            SALARY FOR STAFF MEMBERS OF ${escapeHtml(currentComp.name || 'APADMI SL (PRIVATE) LIMITED').toUpperCase()}
          </div>

          <!-- Staff Table -->
          <table>
            <thead>
              <tr>
                <th style="width: 250px;">Name</th>
                <th style="width: 120px;">ID Number</th>
                <th style="width: 130px;">A/C Number</th>
                <th style="width: 210px;">Bank/ Branch</th>
                <th style="text-align: right; width: 110px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${emps.map((e, idx) => `
                <tr>
                  <td style="font-weight: 600;">${idx + 1}.${escapeHtml(e.name)}</td>
                  <td>${escapeHtml(e.idNo)}</td>
                  <td style="font-family: monospace;">${escapeHtml(e.bankAccountNo)}</td>
                  <td>${escapeHtml(e.bankBranch)}</td>
                  <td style="text-align: right; font-weight: 600;">${formatMoney(e.netSalaryLkr, 2)}</td>
                </tr>
              `).join('')}

              <tr class="letter-total-row">
                <td colspan="4" style="text-align: right; font-weight: 700; padding-right: 25px;">Total</td>
                <td style="text-align: right;" class="double-underline">
                  Rs ${formatMoney(totals.sumNetSalaryLkr, 2)}
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Debit Authorization Paragraph -->
          <div style="margin-top: 18px; line-height: 1.45; text-align: justify;">
            Please be kind enough to remit the respective amount for above mentioned staff members in their respective bank accounts. Kindly debit the amounts from the A/C Number ${escapeHtml(p.debitAccountNo || currentComp.debitAccountNo || '1001 5000 7554')} of ${escapeHtml(p.debitAccountName || currentComp.debitAccountName || 'Spillburg Holdings (Private) Limited')} and credit the same to the above A/C holders with immediate effects.
          </div>

          <!-- Sign-off Block -->
          <div style="margin-top: 25px;">
            <div>Thank You,</div>
            <div style="margin-bottom: 45px;">Yours faithfully,</div>
            <div style="font-weight: 700; color: #1e293b;">${escapeHtml(p.authorizedSignatory || currentComp.authorizedSignatory || 'Shaameel Mohideen')}</div>
            <div style="font-size: 11px; color: #475569;">${escapeHtml(p.authorizedTitle || currentComp.authorizedTitle || 'Director')} &middot; ${escapeHtml(p.authorizedCompany || currentComp.authorizedCompany || 'Spillburg Holdings (Private) Limited')}</div>
          </div>

        </div>
      </div>

    </div>
  `;
}

// ---------------- 3. INDIVIDUAL PAYSLIPS ----------------
function renderIndividualPayslips(container) {
  const p = activePayrollPeriod;
  const emps = p.employees || [];
  if (emps.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500">No staff members in this period.</div>`;
    return;
  }

  if (!activePayslipEmployeeId || !emps.find(e => e.id === activePayslipEmployeeId)) {
    activePayslipEmployeeId = emps[0].id;
  }

  const selectedEmp = emps.find(e => e.id === activePayslipEmployeeId) || emps[0];

  container.innerHTML = `
    <div class="space-y-4 fade-in">
      
      <!-- Top Action Bar -->
      <div class="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div class="flex items-center gap-2">
          <span class="text-xs font-bold text-slate-800">Select Employee:</span>
          <select onchange="selectPayslipEmployee(this.value)"
            class="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-teal-500">
            ${emps.map(e => `
              <option value="${e.id}" ${e.id === selectedEmp.id ? 'selected' : ''}>
                ${e.no}. ${escapeHtml(e.name)} (&pound;${formatMoney(e.gbpSalary, 0)})
              </option>
            `).join('')}
          </select>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="printSinglePayslip('${selectedEmp.id}')"
            class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">
            <i data-lucide="printer" class="w-3.5 h-3.5"></i>
            <span>Print This Payslip</span>
          </button>

          <button onclick="printAllPayslips()"
            class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-2xs">
            <i data-lucide="copy" class="w-3.5 h-3.5"></i>
            <span>Print All ${emps.length} Payslips</span>
          </button>
        </div>
      </div>

      <!-- Quick Employee Selector Chips -->
      <div class="flex items-center gap-1.5 overflow-x-auto pb-2">
        ${emps.map(e => `
          <button onclick="selectPayslipEmployee('${e.id}')"
            class="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${e.id === selectedEmp.id ? 'bg-teal-600 text-white font-semibold shadow-xs' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}">
            ${e.no}. ${escapeHtml(e.shortName || e.name.split(' ')[0])}
          </button>
        `).join('')}
      </div>

      <!-- Payslip Voucher Card (Matching payroll.pdf layout) -->
      <div class="p-6 bg-slate-100/70 rounded-2xl border border-slate-200 flex justify-center">
        ${generatePayslipHtml(selectedEmp, p)}
      </div>

    </div>
  `;
}

function selectPayslipEmployee(empId) {
  activePayslipEmployeeId = empId;
  const container = document.getElementById('payrollSubContent');
  if (container) renderIndividualPayslips(container);
  if (window.lucide) lucide.createIcons();
}

function generatePayslipHtml(emp, period) {
  const comp = (payrollData?.companies || []).find(c => c.id === period.companyId) || { name: 'APADMI SL (PRIVATE) LIMITED' };
  return `
    <div class="payslip-voucher p-5 bg-white shadow-md">
      <table>
        <tr>
          <td colspan="2" style="border-bottom: 2px solid #000; padding-bottom: 8px;">
            <div style="font-weight: 800; font-size: 13px; text-transform: uppercase;">${escapeHtml(comp.name)}</div>
            <div style="font-size: 11px; color: #475569;">Monthly Payroll ${escapeHtml(period.yearPeriod || comp.payrollYearPeriod || '2026-2027')}</div>
            <div style="font-size: 11px; font-weight: 600; margin-top: 2px;">EPF NO :${escapeHtml(emp.epfNo || String(emp.no).padStart(2, '0'))}</div>
          </td>
        </tr>
        <tr>
          <td style="width: 40%; font-weight: bold; background: #f8fafc;">Month</td>
          <td style="font-weight: 600; text-align: right;">${escapeHtml(period.monthCode || period.month)}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; background: #f8fafc; vertical-align: middle;">Name</td>
          <td style="font-weight: 700; text-align: right; text-transform: uppercase;">
            ${escapeHtml(emp.name)}
          </td>
        </tr>
        <tr>
          <td style="background: #f8fafc;"></td>
          <td style="font-weight: bold; text-align: right; background: #f1f5f9;">LKR</td>
        </tr>
        <tr>
          <td>${comp.currencyMode === 'single' ? 'Basic Pay' : `Basic Pay (${escapeHtml(comp.foreignCurrency || 'GBP')} ${formatMoney(emp.earnedGbp, 0)} @${formatMoney(period.exchangeRate, 0)})`}</td>
          <td style="text-align: right;">${formatMoney(emp.lkrGross, 2)}</td>
        </tr>
        <tr>
          <td>Special Allowance</td>
          <td style="text-align: right;">${emp.specialAllowance ? formatMoney(emp.specialAllowance, 2) : '-'}</td>
        </tr>
        <tr style="font-weight: bold; background: #f8fafc;">
          <td>Total (Gross)</td>
          <td style="text-align: right;">${formatMoney(emp.totalGrossLkr, 2)}</td>
        </tr>
        <tr>
          <td>(-) No Pay/Late</td>
          <td style="text-align: right;">${emp.noPayLate ? formatMoney(emp.noPayLate, 2) : '-'}</td>
        </tr>
        <tr style="font-weight: 600;">
          <td>Net total</td>
          <td style="text-align: right;">${formatMoney(emp.netTotalGross, 2)}</td>
        </tr>
        <tr style="font-weight: 600;">
          <td>Gross Pay</td>
          <td style="text-align: right;">${formatMoney(emp.netTotalGross, 2)}</td>
        </tr>
        <tr>
          <td>(-) EPF 8%</td>
          <td style="text-align: right;">${formatMoney(emp.epf8Lkr, 2)}</td>
        </tr>
        <tr>
          <td>(-) Advance</td>
          <td style="text-align: right;">${emp.advance ? formatMoney(emp.advance, 2) : '-'}</td>
        </tr>
        <tr>
          <td>(-) Loan</td>
          <td style="text-align: right;">${emp.loan ? formatMoney(emp.loan, 2) : '-'}</td>
        </tr>
        <tr>
          <td>(-) APIT</td>
          <td style="text-align: right; color: #dc2626;">${formatMoney(emp.apit, 2)}</td>
        </tr>
        <tr style="font-weight: bold; background: #fef2f2;">
          <td>Total Deduction</td>
          <td style="text-align: right; color: #dc2626;">${formatMoney(emp.totalDeductions, 2)}</td>
        </tr>
        <tr style="font-weight: 800; font-size: 13px; background: #ecfdf5;">
          <td style="color: #065f46;">Balance Pay</td>
          <td style="text-align: right; color: #065f46;">${formatMoney(emp.netSalaryLkr, 2)}</td>
        </tr>
        <tr>
          <td>EPF 12%</td>
          <td style="text-align: right;">${formatMoney(emp.epf12Lkr, 2)}</td>
        </tr>
        <tr>
          <td>ETF 3%</td>
          <td style="text-align: right;">${formatMoney(emp.etf3Lkr, 2)}</td>
        </tr>
        <tr>
          <td colspan="2" style="border-top: 2px solid #000; padding-top: 15px; font-size: 10.5px; line-height: 1.4;">
            <div style="margin-bottom: 25px;">Signature: ....................................................</div>
            <div style="font-weight: bold;">Spillburg Holdings (Pvt) Ltd</div>
            <div>Office 14, Basement Level</div>
            <div>Cinnamon Lakeside Hotel - Colombo 02</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

// ---------------- 4. STAFF DIRECTORY & DETAILS ----------------
function renderPayrollStaffManager(container) {
  const p = activePayrollPeriod;
  const emps = p.employees || [];
  const currentComp = (payrollData?.companies || []).find(c => c.id === p.companyId) || (payrollData?.companies && payrollData.companies[0]) || { name: 'APADMI SL (PRIVATE) LIMITED' };
  const isSingle = (currentComp.currencyMode === 'single');
  const foreignCurr = currentComp.foreignCurrency || 'GBP';

  container.innerHTML = `
    <div class="space-y-4 fade-in">
      
      <!-- Toolbar -->
      <div class="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h3 class="text-xs font-bold text-slate-800">Managed Staff Directory</h3>
          <p class="text-[11px] text-slate-500">Configure bank accounts, TIN numbers, national IDs &amp; ${isSingle ? 'basic staff salaries (LKR)' : `contracted ${escapeHtml(foreignCurr)} salaries`}</p>
        </div>

        <button onclick="openAddEmployeeModal()"
          class="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
          <i data-lucide="user-plus" class="w-3.5 h-3.5"></i>
          <span>Add New Staff</span>
        </button>
      </div>

      <!-- Staff Cards Table -->
      <div class="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <table class="w-full text-xs text-left">
          <thead class="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
            <tr>
              <th class="p-3 w-12 text-center">No</th>
              <th class="p-3">Staff Member</th>
              <th class="p-3">Position</th>
              <th class="p-3 text-right">${isSingle ? 'Basic Salary (LKR)' : `${escapeHtml(foreignCurr)} Base`}</th>
              <th class="p-3 text-right">APIT Tax (LKR)</th>
              <th class="p-3">Bank Remittance Account</th>
              <th class="p-3">TIN &amp; NIC / Passport</th>
              <th class="p-3">Date Joined</th>
              <th class="p-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            ${emps.map(e => `
              <tr class="hover:bg-slate-50/80 transition">
                <td class="p-3 text-center font-bold text-slate-400">${e.no}</td>
                <td class="p-3">
                  <div class="font-bold text-slate-900">${escapeHtml(e.name)}</div>
                  <div class="text-[11px] text-slate-400">EPF No: ${escapeHtml(e.epfNo || e.no)}</div>
                </td>
                <td class="p-3 font-medium text-slate-700">${escapeHtml(e.position)}</td>
                <td class="p-3 text-right font-bold text-slate-900">${isSingle ? `Rs ${formatMoney(e.lkrSalary || e.lkrGross || 0, 2)}` : `${foreignCurr === 'GBP' ? '&pound;' : foreignCurr} ${formatMoney(e.gbpSalary, 2)}`}</td>
                <td class="p-3 text-right font-mono font-semibold text-red-600">
                  ${e.apit !== null && e.apit !== undefined ? `Rs ${formatMoney(e.apit, 0)}` : '<span class="text-slate-400 italic font-sans text-[11px]">Auto</span>'}
                </td>
                <td class="p-3">
                  <div class="font-mono font-medium text-slate-800">${escapeHtml(e.bankAccountNo)}</div>
                  <div class="text-[11px] text-slate-500">${escapeHtml(e.bankBranch)}</div>
                </td>
                <td class="p-3">
                  <div class="text-slate-800">TIN: <span class="font-mono">${escapeHtml(e.tinNo || '-')}</span></div>
                  <div class="text-[11px] text-slate-500">ID: <span class="font-mono">${escapeHtml(e.idNo || '-')}</span></div>
                </td>
                <td class="p-3 text-slate-600">${escapeHtml(e.dateJoined || '-')}</td>
                <td class="p-3 text-center">
                  <div class="flex items-center justify-center gap-1">
                    <button onclick="openEditEmployeeModal('${e.id}')" title="Edit Staff Member"
                      class="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition">
                      <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="deleteEmployee('${e.id}')" title="Remove Staff Member"
                      class="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;
}


// ================= COMPANY MANAGEMENT DASHBOARD & ACTIONS =================

async function handlePayrollCompanyChange(compId) {
  selectedPayrollCompanyId = compId;
  const compPeriods = (payrollData?.periods || []).filter(p => p.companyId === compId);
  if (compPeriods.length > 0) {
    await handlePayrollPeriodChange(compPeriods[0].id);
  } else {
    activePayrollPeriod = null;
    const container = document.getElementById('mainContent');
    if (container) await renderPayroll(container);
  }
}

function openAddCompanyModal() {
  if (!canEdit('payroll')) {
    alert('You have read-only access to Corporate Payroll.');
    return;
  }
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Add New Managed Client Company</h3>
          <p class="text-[11px] text-slate-500">Configure corporate details, banking remittance parameters &amp; signatories</p>
        </div>
        <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form onsubmit="submitAddCompany(event)" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Company Full Legal Name *</label>
            <input type="text" id="newCompName" required placeholder="e.g. SPILLBURG GLOBAL (PVT) LTD" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Company Short Code *</label>
            <input type="text" id="newCompCode" required placeholder="e.g. GLOBAL" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Company Registration No</label>
            <input type="text" id="newCompRegNo" placeholder="e.g. PV 00298765" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div class="sm:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Registered Office Address</label>
            <input type="text" id="newCompAddress" placeholder="e.g. Level 12, West Tower, World Trade Center, Colombo 01" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
        </div>

        <!-- Currency Mode Setting -->
        <div class="p-3 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
          <div class="font-bold text-teal-900 flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <i data-lucide="coins" class="w-3.5 h-3.5 text-teal-600"></i>
              <span>Payroll Currency Mode *</span>
            </div>
            <span class="text-[10px] text-teal-700 font-normal">Single (LKR only) or Dual currency</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Currency Mode</label>
              <select id="newCompCurrencyMode" onchange="toggleCompanyCurrencyInputs('new')" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
                <option value="dual" selected>Dual Currency (LKR + Foreign Base)</option>
                <option value="single">Single Currency (LKR Only)</option>
              </select>
            </div>
            <div id="newForeignCurrencyWrap">
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Foreign Base Currency</label>
              <select id="newCompForeignCurrency" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
                <option value="GBP" selected>GBP - British Pound (£)</option>
                <option value="USD">USD - US Dollar ($)</option>
                <option value="EUR">EUR - Euro (€)</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="AUD">AUD - Australian Dollar</option>
                <option value="SGD">SGD - Singapore Dollar</option>
              </select>
            </div>
            <div id="newDefaultExchangeRateWrap" class="sm:col-span-2">
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Default Exchange Rate to LKR</label>
              <input type="number" step="0.01" id="newCompDefaultExchangeRate" value="400" placeholder="e.g. 400.00" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono">
              <span class="text-[10px] text-slate-500">Applied as initial rate when generating monthly periods</span>
            </div>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div class="font-bold text-slate-800 flex items-center gap-1.5">
            <i data-lucide="landmark" class="w-3.5 h-3.5 text-teal-600"></i>
            <span>Bank Remittance &amp; Debit Details</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Bank Name</label>
              <input type="text" id="newCompBankName" value="Nations Trust Bank PLC" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Branch Name</label>
              <input type="text" id="newCompBankBranch" placeholder="e.g. Borella Branch" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Branch Address</label>
              <input type="text" id="newCompBankAddress" placeholder="e.g. 67 D.S. Senanayake Mawatha, Colombo 08." class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Debit Account Number</label>
              <input type="text" id="newCompDebitAcctNo" placeholder="e.g. 1001 5000 7554" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Debit Account Holder Name</label>
              <input type="text" id="newCompDebitAcctName" placeholder="e.g. Spillburg Holdings (Private) Limited" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div class="font-bold text-slate-800 flex items-center gap-1.5">
            <i data-lucide="shield-check" class="w-3.5 h-3.5 text-teal-600"></i>
            <span>Authorized Signatories &amp; Period Settings</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Authorized Signatory Name</label>
              <input type="text" id="newCompSignatory" value="Shaameel Mohideen" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Signatory Title &amp; Company</label>
              <input type="text" id="newCompSignatoryTitle" value="Director · Spillburg Holdings (pvt)Ltd" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Prepared / Checked By</label>
              <input type="text" id="newCompCheckedBy" value="Hemanthi Basnayake" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Financial Year Period</label>
              <input type="text" id="newCompYearPeriod" value="2026-2027" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
          </div>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-semibold transition shadow-sm">Save &amp; Switch to Company</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function toggleCompanyCurrencyInputs(prefix) {
  const mode = document.getElementById(`${prefix}CompCurrencyMode`)?.value;
  const fWrap = document.getElementById(`${prefix}ForeignCurrencyWrap`);
  const rWrap = document.getElementById(`${prefix}DefaultExchangeRateWrap`);
  const isDual = (mode === 'dual');
  if (fWrap) fWrap.style.display = isDual ? 'block' : 'none';
  if (rWrap) rWrap.style.display = isDual ? 'block' : 'none';
}

async function submitAddCompany(e) {
  e.preventDefault();
  const currMode = document.getElementById('newCompCurrencyMode').value;
  const payload = {
    name: document.getElementById('newCompName').value.trim(),
    code: document.getElementById('newCompCode').value.trim().toUpperCase(),
    registrationNo: document.getElementById('newCompRegNo').value.trim(),
    address: document.getElementById('newCompAddress').value.trim(),
    currencyMode: currMode,
    baseCurrency: 'LKR',
    foreignCurrency: currMode === 'single' ? '' : (document.getElementById('newCompForeignCurrency')?.value || 'GBP'),
    defaultExchangeRate: currMode === 'single' ? 1.0 : (parseFloat(document.getElementById('newCompDefaultExchangeRate')?.value) || 400.0),
    bankName: document.getElementById('newCompBankName').value.trim(),
    bankBranch: document.getElementById('newCompBankBranch').value.trim(),
    bankAddress: document.getElementById('newCompBankAddress').value.trim(),
    debitAccountNo: document.getElementById('newCompDebitAcctNo').value.trim(),
    debitAccountName: document.getElementById('newCompDebitAcctName').value.trim(),
    authorizedSignatory: document.getElementById('newCompSignatory').value.trim(),
    authorizedTitle: document.getElementById('newCompSignatoryTitle').value.trim(),
    checkedBy: document.getElementById('newCompCheckedBy').value.trim(),
    payrollYearPeriod: document.getElementById('newCompYearPeriod').value.trim()
  };

  try {
    const res = await fetch('/api/payroll/company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success && data.company) {
      selectedPayrollCompanyId = data.company.id;
      closeModal();
      await refreshPayrollData();
      alert(`Company "${payload.name}" registered successfully.`);
    } else {
      alert(data.error || 'Failed to add company');
    }
  } catch (err) {
    alert('Network error adding company: ' + err.message);
  }
}

function openEditCompanyModal(compId) {
  if (!canEdit('payroll')) {
    alert('You have read-only access to Corporate Payroll.');
    return;
  }
  const targetComp = (payrollData?.companies || []).find(c => c.id === compId) || payrollData?.companies?.[0];
  if (!targetComp) return;

  const c = document.getElementById('modalContent');
  const currMode = targetComp.currencyMode || 'dual';
  const fCurr = targetComp.foreignCurrency || 'GBP';
  const defRate = targetComp.defaultExchangeRate || 400.0;

  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Edit Company Profile</h3>
          <p class="text-[11px] text-slate-500">Update company parameters, bank details &amp; signatories</p>
        </div>
        <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form onsubmit="submitEditCompany(event, '${targetComp.id}')" class="space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="sm:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Company Full Legal Name *</label>
            <input type="text" id="editCompName" value="${escapeHtml(targetComp.name || '')}" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Company Short Code *</label>
            <input type="text" id="editCompCode" value="${escapeHtml(targetComp.code || '')}" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Company Registration No</label>
            <input type="text" id="editCompRegNo" value="${escapeHtml(targetComp.registrationNo || '')}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div class="sm:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Registered Address</label>
            <input type="text" id="editCompAddress" value="${escapeHtml(targetComp.address || '')}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
        </div>

        <!-- Currency Mode Setting -->
        <div class="p-3 rounded-xl bg-teal-50/70 border border-teal-200 space-y-2">
          <div class="font-bold text-teal-900 flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <i data-lucide="coins" class="w-3.5 h-3.5 text-teal-600"></i>
              <span>Payroll Currency Mode *</span>
            </div>
            <span class="text-[10px] text-teal-700 font-normal">Single (LKR only) or Dual currency</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Currency Mode</label>
              <select id="editCompCurrencyMode" onchange="toggleCompanyCurrencyInputs('edit')" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
                <option value="dual" ${currMode === 'dual' ? 'selected' : ''}>Dual Currency (LKR + Foreign Base)</option>
                <option value="single" ${currMode === 'single' ? 'selected' : ''}>Single Currency (LKR Only)</option>
              </select>
            </div>
            <div id="editForeignCurrencyWrap" style="${currMode === 'single' ? 'display: none;' : ''}">
              <label class="block text-[11px] font-semibold text-slate-700 mb-1">Foreign Base Currency</label>
              <select id="editCompForeignCurrency" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
                <option value="GBP" ${fCurr === 'GBP' ? 'selected' : ''}>GBP - British Pound (£)</option>
                <option value="USD" ${fCurr === 'USD' ? 'selected' : ''}>USD - US Dollar ($)</option>
                <option value="EUR" ${fCurr === 'EUR' ? 'selected' : ''}>EUR - Euro (€)</option>
                <option value="AED" ${fCurr === 'AED' ? 'selected' : ''}>AED - UAE Dirham</option>
                <option value="AUD" ${fCurr === 'AUD' ? 'selected' : ''}>AUD - Australian Dollar</option>
                <option value="SGD" ${fCurr === 'SGD' ? 'selected' : ''}>SGD - Singapore Dollar</option>
              </select>
            </div>
            <div id="editDefaultExchangeRateWrap" class="sm:col-span-2" style="${currMode === 'single' ? 'display: none;' : ''}">
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Default Exchange Rate to LKR</label>
              <input type="number" step="0.01" id="editCompDefaultExchangeRate" value="${defRate}" placeholder="e.g. 400.00" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono">
              <span class="text-[10px] text-slate-500">Applied as initial rate when generating monthly periods</span>
            </div>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div class="font-bold text-slate-800 flex items-center gap-1.5">
            <i data-lucide="landmark" class="w-3.5 h-3.5 text-teal-600"></i>
            <span>Bank Remittance &amp; Debit Details</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Bank Name</label>
              <input type="text" id="editCompBankName" value="${escapeHtml(targetComp.bankName || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Branch Name</label>
              <input type="text" id="editCompBankBranch" value="${escapeHtml(targetComp.bankBranch || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Branch Address</label>
              <input type="text" id="editCompBankAddress" value="${escapeHtml(targetComp.bankAddress || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Debit Account Number</label>
              <input type="text" id="editCompDebitAcctNo" value="${escapeHtml(targetComp.debitAccountNo || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Debit Account Holder Name</label>
              <input type="text" id="editCompDebitAcctName" value="${escapeHtml(targetComp.debitAccountName || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
          </div>
        </div>

        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
          <div class="font-bold text-slate-800 flex items-center gap-1.5">
            <i data-lucide="shield-check" class="w-3.5 h-3.5 text-teal-600"></i>
            <span>Authorized Signatories &amp; Period Settings</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Authorized Signatory Name</label>
              <input type="text" id="editCompSignatory" value="${escapeHtml(targetComp.authorizedSignatory || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Signatory Title &amp; Company</label>
              <input type="text" id="editCompSignatoryTitle" value="${escapeHtml(targetComp.authorizedTitle || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Prepared / Checked By</label>
              <input type="text" id="editCompCheckedBy" value="${escapeHtml(targetComp.checkedBy || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Financial Year Period</label>
              <input type="text" id="editCompYearPeriod" value="${escapeHtml(targetComp.payrollYearPeriod || '2026-2027')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
          </div>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-semibold transition shadow-sm">Save Profile Changes</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitEditCompany(e, compId) {
  e.preventDefault();
  const currMode = document.getElementById('editCompCurrencyMode').value;
  const payload = {
    id: compId,
    name: document.getElementById('editCompName').value.trim(),
    code: document.getElementById('editCompCode').value.trim().toUpperCase(),
    registrationNo: document.getElementById('editCompRegNo').value.trim(),
    address: document.getElementById('editCompAddress').value.trim(),
    currencyMode: currMode,
    baseCurrency: 'LKR',
    foreignCurrency: currMode === 'single' ? '' : (document.getElementById('editCompForeignCurrency')?.value || 'GBP'),
    defaultExchangeRate: currMode === 'single' ? 1.0 : (parseFloat(document.getElementById('editCompDefaultExchangeRate')?.value) || 400.0),
    bankName: document.getElementById('editCompBankName').value.trim(),
    bankBranch: document.getElementById('editCompBankBranch').value.trim(),
    bankAddress: document.getElementById('editCompBankAddress').value.trim(),
    debitAccountNo: document.getElementById('editCompDebitAcctNo').value.trim(),
    debitAccountName: document.getElementById('editCompDebitAcctName').value.trim(),
    authorizedSignatory: document.getElementById('editCompSignatory').value.trim(),
    authorizedTitle: document.getElementById('editCompSignatoryTitle').value.trim(),
    checkedBy: document.getElementById('editCompCheckedBy').value.trim(),
    payrollYearPeriod: document.getElementById('editCompYearPeriod').value.trim()
  };

  try {
    const res = await fetch(`/api/payroll/company?id=${encodeURIComponent(compId)}`, {
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
      await refreshPayrollData();
      alert(`Company "${payload.name}" updated successfully.`);
    } else {
      alert(data.error || 'Failed to update company');
    }
  } catch (err) {
    alert('Network error updating company: ' + err.message);
  }
}

function openCompanyDirectoryModal() {
  const comps = payrollData?.companies || [];
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Managed Companies Directory</h3>
          <p class="text-[11px] text-slate-500">${comps.length} registered client corporate entities</p>
        </div>
        <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        ${comps.map(comp => {
          const compPers = (payrollData?.periods || []).filter(p => p.companyId === comp.id);
          const isSelected = comp.id === selectedPayrollCompanyId;
          return `
            <div class="p-3.5 rounded-xl border ${isSelected ? 'border-teal-500 bg-teal-50/40 ring-1 ring-teal-500/30' : 'border-slate-200 bg-white hover:border-slate-300'} transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="font-bold text-slate-900 text-sm">${escapeHtml(comp.name)}</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200">${escapeHtml(comp.code || 'CO')}</span>
                  ${isSelected ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white">Active</span>' : ''}
                </div>
                <div class="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                  <span>Reg: <b class="text-slate-700">${escapeHtml(comp.registrationNo || 'N/A')}</b></span>
                  <span>&bull;</span>
                  <span>Bank: <b class="text-slate-700">${escapeHtml(comp.bankName || 'N/A')} (${escapeHtml(comp.bankBranch || '')})</b></span>
                  <span>&bull;</span>
                  <span>A/C: <b class="font-mono text-slate-700">${escapeHtml(comp.debitAccountNo || 'N/A')}</b></span>
                  <span>&bull;</span>
                  <span>Cycles: <b class="text-teal-700 font-semibold">${compPers.length} period${compPers.length === 1 ? '' : 's'}</b></span>
                </div>
              </div>

              <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
                <button onclick="handlePayrollCompanyChange('${comp.id}'); closeModal();"
                  class="px-3 py-1.5 ${isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} rounded-lg text-xs font-semibold transition">
                  ${isSelected ? 'Currently Selected' : 'Switch To'}
                </button>
                <button onclick="openEditCompanyModal('${comp.id}')" title="Edit Company Details"
                  class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition">
                  <i data-lucide="edit-3" class="w-3.5 h-3.5"></i>
                </button>
                ${comps.length > 1 ? `
                  <button onclick="deletePayrollCompany('${comp.id}', '${escapeHtml(comp.name)}')" title="Delete Company"
                    class="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="pt-3 flex justify-between items-center border-t border-slate-100">
        <button onclick="openAddCompanyModal()" class="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs">
          <i data-lucide="plus" class="w-3.5 h-3.5"></i>
          <span>Add Another Company</span>
        </button>
        <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Close</button>
      </div>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function deletePayrollCompany(compId, compName) {
  if (!confirm(`Are you sure you want to delete company "${compName}" and all of its associated payroll periods? This cannot be undone.`)) {
    return;
  }
  try {
    const res = await fetch(`/api/payroll/company?id=${encodeURIComponent(compId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      if (selectedPayrollCompanyId === compId) {
        selectedPayrollCompanyId = data.companies?.[0]?.id || null;
      }
      closeModal();
      await refreshPayrollData();
      alert(`Company "${compName}" deleted.`);
    } else {
      alert(data.error || 'Failed to delete company');
    }
  } catch (err) {
    alert('Network error deleting company: ' + err.message);
  }
}


// ---------------- PERIOD SWITCHING & DATA SYNC ----------------
async function handlePayrollPeriodChange(periodId) {
  try {
    const res = await fetch(`/api/payroll/period?id=${encodeURIComponent(periodId)}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      activePayrollPeriod = data.period;
      // Refresh count
      const countEl = document.getElementById('navPayrollCount');
      if (countEl && activePayrollPeriod) {
        countEl.textContent = activePayrollPeriod.employees?.length || 0;
      }
      renderActivePayrollSubTab();
      // Update header info
      const sel = document.getElementById('payrollPeriodSelect');
      if (sel) sel.value = periodId;
      const mainCont = document.getElementById('mainContent');
      if (mainCont && currentView === 'payroll') {
        renderPayroll(mainCont);
      }
    }
  } catch (err) {
    console.error('Failed to change payroll period:', err);
  }
}

async function refreshPayrollData() {
  try {
    const res = await fetch('/api/payroll', {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      payrollData = await res.json();
      const curId = activePayrollPeriod ? activePayrollPeriod.id : null;
      if (curId) {
        const found = (payrollData.periods || []).find(p => p.id === curId);
        if (found) {
          const pRes = await fetch(`/api/payroll/period?id=${encodeURIComponent(curId)}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
          });
          if (pRes.ok) {
            const pData = await pRes.json();
            activePayrollPeriod = pData.period;
          }
        } else {
          activePayrollPeriod = payrollData.activePeriod || null;
        }
      } else {
        activePayrollPeriod = payrollData.activePeriod || null;
      }
      const countEl = document.getElementById('navPayrollCount');
      if (countEl && activePayrollPeriod) {
        countEl.textContent = activePayrollPeriod.employees?.length || 0;
      }
      if (currentView === 'payroll') {
        const mainCont = document.getElementById('mainContent');
        if (mainCont) renderPayroll(mainCont);
      }
    }
  } catch (e) {
    console.error('Failed to refresh payroll data:', e);
  }
}

// ---------------- MODALS & ACTIONS ----------------

// 1. Exchange Rate Modal
function openExchangeRateModal() {
  if (!activePayrollPeriod) return;
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Adjust Exchange Rate (LKR / GBP)</h3>
          <p class="text-[11px] text-slate-500">Changes will automatically recompute gross salaries, EPF, APIT, and net remittances.</p>
        </div>
        <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form onsubmit="submitExchangeRate(event)" class="space-y-4">
        <div>
          <label class="block font-semibold text-slate-700 mb-1">Exchange Rate (1 GBP in LKR)</label>
          <input type="number" id="payExchangeRateInput" step="0.01" min="1" required
            value="${activePayrollPeriod.exchangeRate || 440.0}"
            class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500">
          <p class="text-[11px] text-slate-400 mt-1">Default contractual rate for Sep 2026 is 440.00 LKR</p>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition">
            Cancel
          </button>
          <button type="submit" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-xs transition">
            Save &amp; Recalculate
          </button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitExchangeRate(e) {
  e.preventDefault();
  const rateVal = parseFloat(document.getElementById('payExchangeRateInput').value);
  if (!rateVal || isNaN(rateVal)) return;

  try {
    const res = await fetch('/api/payroll/period', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        id: activePayrollPeriod.id,
        exchangeRate: rateVal
      })
    });
    if (res.ok) {
      closeModal();
      await refreshPayrollData();
    } else {
      const err = await res.json();
      alert('Error updating exchange rate: ' + (err.error || 'Server error'));
    }
  } catch (err) {
    alert('Connection error: ' + err.message);
  }
}

// 2. Bank Details Modal
function openEditBankDetailsModal() {
  if (!activePayrollPeriod) return;
  const p = activePayrollPeriod;
  const c = document.getElementById('modalContent');
  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Edit Bank Remittance Letter Details</h3>
          <p class="text-[11px] text-slate-500">Official addressee, debit account, and authorized signatory presentation.</p>
        </div>
        <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form onsubmit="submitBankDetails(event)" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Letter Date</label>
            <input type="text" id="bankLetterDate" value="${escapeHtml(p.letterDate || '30.09.2026')}" required
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Bank Name</label>
            <input type="text" id="bankNameInput" value="${escapeHtml(p.bankName || 'Nations Trust Bank PLC')}" required
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Bank Branch</label>
            <input type="text" id="bankBranchInput" value="${escapeHtml(p.bankBranch || 'Borella Branch')}" required
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Debit Account Number</label>
            <input type="text" id="bankDebitAccInput" value="${escapeHtml(p.debitAccountNo || '1001 5000 7554')}" required
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono">
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Bank Branch Address (Multi-line)</label>
          <textarea id="bankAddressInput" rows="2" required
            class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">${escapeHtml(p.bankAddress || '67 D.S. Senanayake Mawatha,\nColombo 08.')}</textarea>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Debit Account Entity Name</label>
            <input type="text" id="bankDebitNameInput" value="${escapeHtml(p.debitAccountName || 'Spillburg Holdings (Private) Limited')}" required
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Authorized Signatory</label>
            <input type="text" id="bankSignatoryInput" value="${escapeHtml(p.authorizedSignatory || 'Shaameel Mohideen')}" required
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition">
            Cancel
          </button>
          <button type="submit" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-xs transition">
            Save Letter Details
          </button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitBankDetails(e) {
  e.preventDefault();
  const payload = {
    id: activePayrollPeriod.id,
    letterDate: document.getElementById('bankLetterDate').value.trim(),
    bankName: document.getElementById('bankNameInput').value.trim(),
    bankBranch: document.getElementById('bankBranchInput').value.trim(),
    bankAddress: document.getElementById('bankAddressInput').value.trim(),
    debitAccountNo: document.getElementById('bankDebitAccInput').value.trim(),
    debitAccountName: document.getElementById('bankDebitNameInput').value.trim(),
    authorizedSignatory: document.getElementById('bankSignatoryInput').value.trim()
  };

  try {
    const res = await fetch('/api/payroll/period', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal();
      await refreshPayrollData();
    } else {
      const err = await res.json();
      alert('Error updating bank details: ' + (err.error || 'Server error'));
    }
  } catch (err) {
    alert('Connection error: ' + err.message);
  }
}

// ---------------- PERIOD MANAGEMENT MODALS & WORKFLOWS ----------------

// 1. Manage Periods Directory Modal
function openManagePeriodsModal(targetCompanyId) {
  const compId = targetCompanyId || selectedPayrollCompanyId || activePayrollPeriod?.companyId || 'comp_apadmi';
  const comp = (payrollData?.companies || []).find(c => c.id === compId) || payrollData?.companies?.[0] || { name: 'Managed Company', code: 'CO' };
  const allCompanies = payrollData?.companies || [];
  const compPeriods = (payrollData?.periods || []).filter(p => p.companyId === comp.id);
  const curPeriodId = activePayrollPeriod ? activePayrollPeriod.id : null;
  const c = document.getElementById('modalContent');

  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <!-- Modal Header -->
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <div class="flex items-center gap-2">
            <h3 class="font-display font-bold text-base text-slate-900">Manage Payroll Cycles &amp; Periods</h3>
            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200">${escapeHtml(comp.code || 'CO')}</span>
          </div>
          <p class="text-[11px] text-slate-500">${escapeHtml(comp.name)} &bull; ${compPeriods.length} processed cycle${compPeriods.length === 1 ? '' : 's'}</p>
        </div>
        <div class="flex items-center gap-2">
          ${canEdit('payroll') ? `
            <button onclick="openNewPeriodModal('${comp.id}')" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>New Period</span>
            </button>
          ` : ''}
          <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>
      </div>

      <!-- Company Switcher Tabs if Multiple Companies -->
      ${allCompanies.length > 1 ? `
        <div class="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
          ${allCompanies.map(cp => {
            const isCur = cp.id === comp.id;
            const count = (payrollData?.periods || []).filter(p => p.companyId === cp.id).length;
            return `
              <button onclick="openManagePeriodsModal('${cp.id}')"
                class="px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap flex items-center gap-1.5 ${isCur ? 'bg-white text-teal-800 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'}">
                <span>${escapeHtml(cp.name)}</span>
                <span class="px-1.5 py-0.2 rounded-full text-[10px] ${isCur ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'}">${count}</span>
              </button>
            `;
          }).join('')}
        </div>
      ` : ''}

      <!-- Periods List -->
      ${compPeriods.length === 0 ? `
        <div class="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-3">
          <p class="text-slate-500">No payroll periods currently recorded for ${escapeHtml(comp.name)}.</p>
          ${canEdit('payroll') ? `
            <button onclick="openNewPeriodModal('${comp.id}')" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Create Initial Period</span>
            </button>
          ` : ''}
        </div>
      ` : `
        <div class="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          ${compPeriods.map(per => {
            const isCur = per.id === curPeriodId;
            const status = per.status || 'Draft';
            const statusClass =
              status === 'Finalized' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
              status === 'Approved' ? 'bg-indigo-50 text-indigo-800 border-indigo-200' :
              status === 'Under Review' ? 'bg-blue-50 text-blue-800 border-blue-200' :
              status === 'Paid' ? 'bg-teal-50 text-teal-800 border-teal-200' :
              'bg-amber-50 text-amber-800 border-amber-200';

            return `
              <div class="p-3.5 rounded-xl border ${isCur ? 'border-teal-500 bg-teal-50/30 ring-1 ring-teal-500/20' : 'border-slate-200 bg-white hover:border-slate-300'} transition flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                <!-- Left Details -->
                <div class="space-y-1.5">
                  <div class="flex items-center flex-wrap gap-2">
                    <span class="font-display font-bold text-slate-900 text-sm">${escapeHtml(per.month)}</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700 border border-slate-200">${escapeHtml(per.monthCode || 'Period')}</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">${escapeHtml(per.yearPeriod || '2026-2027')}</span>
                    ${isCur ? `
                      <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-600 text-white shadow-2xs flex items-center gap-1">
                        <i data-lucide="check-circle-2" class="w-3 h-3"></i> Active Default
                      </span>
                    ` : ''}
                  </div>

                  <div class="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>Staff: <b class="text-slate-800">${per.employeeCount || 0} members</b></span>
                    <span>&bull;</span>
                    <span>Rate: <b class="text-slate-800">1 GBP = Rs ${formatMoney(per.exchangeRate || 440, 2)}</b></span>
                    <span>&bull;</span>
                    <span>Net Bank Payout: <b class="text-emerald-700 font-bold">Rs ${formatMoney(per.totalNetRemittance || 0, 2)}</b></span>
                    <span>&bull;</span>
                    <span>Letter Date: <b class="text-slate-700">${escapeHtml(per.letterDate || 'N/A')}</b></span>
                  </div>
                </div>

                <!-- Right Controls & Actions -->
                <div class="flex items-center flex-wrap gap-2 self-end md:self-center shrink-0">
                  <!-- Quick Status Dropdown / Badge -->
                  ${canEdit('payroll') ? `
                    <select onchange="handleQuickPeriodStatusChange('${per.id}', this.value)"
                      class="px-2.5 py-1.5 rounded-lg text-xs font-bold border ${statusClass} cursor-pointer focus:outline-none">
                      <option value="Draft" ${status === 'Draft' ? 'selected' : ''}>Draft</option>
                      <option value="Under Review" ${status === 'Under Review' ? 'selected' : ''}>Under Review</option>
                      <option value="Approved" ${status === 'Approved' ? 'selected' : ''}>Approved</option>
                      <option value="Finalized" ${status === 'Finalized' ? 'selected' : ''}>Finalized</option>
                      <option value="Paid" ${status === 'Paid' ? 'selected' : ''}>Paid</option>
                    </select>
                  ` : `
                    <span class="px-2.5 py-1.5 rounded-lg text-xs font-bold border ${statusClass}">${escapeHtml(status)}</span>
                  `}

                  <!-- Switch To Button -->
                  <button onclick="handlePayrollPeriodChange('${per.id}'); closeModal();"
                    class="px-3 py-1.5 ${isCur ? 'bg-teal-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'} rounded-lg text-xs font-semibold transition">
                    ${isCur ? 'Currently Open' : 'Open Sheet'}
                  </button>

                  <!-- Set As Default (if not already current) -->
                  ${!isCur && canEdit('payroll') ? `
                    <button onclick="setPayrollPeriodAsDefault('${per.id}')" title="Set as primary default period"
                      class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition">
                      Set Default
                    </button>
                  ` : ''}

                  <!-- Edit Settings Button -->
                  ${canEdit('payroll') ? `
                    <button onclick="openEditPeriodModal('${per.id}')" title="Edit Period Configuration & Signatories"
                      class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition">
                      <i data-lucide="settings-2" class="w-3.5 h-3.5"></i>
                    </button>
                    <button onclick="openNewPeriodModal('${comp.id}', '${per.id}')" title="Duplicate / Clone this Period"
                      class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition">
                      <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                    </button>
                  ` : ''}

                  <!-- Delete Button -->
                  ${canEdit('payroll') && compPeriods.length > 1 ? `
                    <button onclick="deletePayrollPeriod('${per.id}', '${escapeHtml(per.month)}')" title="Delete Period"
                      class="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                    </button>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}

      <!-- Modal Footer -->
      <div class="pt-3 flex items-center justify-between border-t border-slate-100">
        <div class="text-[11px] text-slate-400">
          Total Cycles: <b class="text-slate-700">${compPeriods.length}</b> for ${escapeHtml(comp.name)}
        </div>
        <div class="flex items-center gap-2">
          ${canEdit('payroll') ? `
            <button onclick="openNewPeriodModal('${comp.id}')" class="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition">
              <i data-lucide="plus" class="w-3.5 h-3.5"></i>
              <span>Add Period</span>
            </button>
          ` : ''}
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Close</button>
        </div>
      </div>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

// 2. Edit Period Modal
function openEditPeriodModal(periodId) {
  if (!canEdit('payroll')) {
    alert('You have read-only access to Corporate Payroll.');
    return;
  }
  const per = (payrollData?.periods || []).find(p => p.id === periodId) || activePayrollPeriod;
  if (!per) return;
  const comp = (payrollData?.companies || []).find(c => c.id === per.companyId) || { name: 'Company' };
  const c = document.getElementById('modalContent');

  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Edit Payroll Period Details</h3>
          <p class="text-[11px] text-slate-500">${escapeHtml(per.month)} &bull; ${escapeHtml(comp.name)}</p>
        </div>
        <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form onsubmit="submitEditPeriod(event, '${per.id}')" class="space-y-3.5">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div class="sm:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Period Month &amp; Year *</label>
            <input type="text" id="editPeriodMonth" value="${escapeHtml(per.month || '')}" required
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Month Code *</label>
            <input type="text" id="editPeriodMonthCode" value="${escapeHtml(per.monthCode || 'Period')}" required
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono uppercase text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Exchange Rate (1 GBP in LKR) *</label>
            <input type="number" id="editPeriodRate" step="0.01" min="1" value="${per.exchangeRate || 440.0}" required
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Financial Year Period</label>
            <input type="text" id="editPeriodYearPeriod" value="${escapeHtml(per.yearPeriod || '2026-2027')}" required
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Cycle Status *</label>
            <select id="editPeriodStatus" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
              <option value="Draft" ${per.status === 'Draft' ? 'selected' : ''}>Draft</option>
              <option value="Under Review" ${per.status === 'Under Review' ? 'selected' : ''}>Under Review</option>
              <option value="Approved" ${per.status === 'Approved' ? 'selected' : ''}>Approved</option>
              <option value="Finalized" ${per.status === 'Finalized' ? 'selected' : ''}>Finalized</option>
              <option value="Paid" ${per.status === 'Paid' ? 'selected' : ''}>Paid</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block font-semibold text-slate-700 mb-1">Remittance Letter Date</label>
          <input type="text" id="editPeriodLetterDate" value="${escapeHtml(per.letterDate || '30.09.2026')}" required
            class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-teal-500">
        </div>

        <!-- Bank Letter & Signatory Overrides -->
        <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div class="font-bold text-slate-800 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <i data-lucide="landmark" class="w-3.5 h-3.5 text-teal-600"></i>
              <span>Period Bank Remittance Details &amp; Signatories</span>
            </span>
            <span class="text-[10px] text-slate-400 font-normal">Overrides company defaults for this period</span>
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Bank Name</label>
              <input type="text" id="editPeriodBankName" value="${escapeHtml(per.bankName || comp.bankName || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Bank Branch</label>
              <input type="text" id="editPeriodBankBranch" value="${escapeHtml(per.bankBranch || comp.bankBranch || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div class="sm:col-span-2">
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Branch Address</label>
              <textarea id="editPeriodBankAddress" rows="2" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">${escapeHtml(per.bankAddress || comp.bankAddress || '')}</textarea>
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Debit Account Number</label>
              <input type="text" id="editPeriodDebitAcctNo" value="${escapeHtml(per.debitAccountNo || comp.debitAccountNo || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-mono">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Debit Account Entity Name</label>
              <input type="text" id="editPeriodDebitAcctName" value="${escapeHtml(per.debitAccountName || comp.debitAccountName || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Authorized Signatory</label>
              <input type="text" id="editPeriodSignatory" value="${escapeHtml(per.authorizedSignatory || comp.authorizedSignatory || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold">
            </div>
            <div>
              <label class="block text-[11px] font-medium text-slate-600 mb-1">Prepared / Checked By</label>
              <input type="text" id="editPeriodCheckedBy" value="${escapeHtml(per.checkedBy || comp.checkedBy || '')}" class="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs">
            </div>
          </div>
        </div>

        <div class="pt-2">
          <label class="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
            <input type="checkbox" id="editPeriodSetActive" ${activePayrollPeriod?.id === per.id ? 'checked' : ''} class="rounded text-teal-600 focus:ring-teal-500">
            <span>Set as Current Active Period</span>
          </label>
        </div>

        <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-4 py-2 rounded-xl text-slate-600 bg-slate-100 hover:bg-slate-200 font-semibold transition">Cancel</button>
          <button type="submit" class="px-4 py-2 rounded-xl text-white bg-teal-600 hover:bg-teal-700 font-semibold transition shadow-sm">Save Period Changes</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitEditPeriod(e, periodId) {
  e.preventDefault();
  const payload = {
    id: periodId,
    month: document.getElementById('editPeriodMonth').value.trim(),
    monthCode: document.getElementById('editPeriodMonthCode').value.trim().toUpperCase(),
    exchangeRate: parseFloat(document.getElementById('editPeriodRate').value),
    yearPeriod: document.getElementById('editPeriodYearPeriod').value.trim(),
    status: document.getElementById('editPeriodStatus').value,
    letterDate: document.getElementById('editPeriodLetterDate').value.trim(),
    bankName: document.getElementById('editPeriodBankName').value.trim(),
    bankBranch: document.getElementById('editPeriodBankBranch').value.trim(),
    bankAddress: document.getElementById('editPeriodBankAddress').value.trim(),
    debitAccountNo: document.getElementById('editPeriodDebitAcctNo').value.trim(),
    debitAccountName: document.getElementById('editPeriodDebitAcctName').value.trim(),
    authorizedSignatory: document.getElementById('editPeriodSignatory').value.trim(),
    checkedBy: document.getElementById('editPeriodCheckedBy').value.trim(),
    setActive: document.getElementById('editPeriodSetActive').checked
  };

  try {
    const res = await fetch('/api/payroll/period', {
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
      await refreshPayrollData();
      if (payload.setActive) {
        await handlePayrollPeriodChange(periodId);
      }
      alert(`Period "${payload.month}" updated successfully.`);
    } else {
      alert(data.error || 'Failed to update period');
    }
  } catch (err) {
    alert('Network error updating period: ' + err.message);
  }
}

// 3. New Period Modal (Enhanced with Staff Clone & Settings)
function openNewPeriodModal(targetCompanyId, cloneFromId) {
  if (!canEdit('payroll')) {
    alert('You have read-only access to Corporate Payroll.');
    return;
  }
  const compId = targetCompanyId || selectedPayrollCompanyId || activePayrollPeriod?.companyId || 'comp_apadmi';
  const comp = (payrollData?.companies || []).find(c => c.id === compId) || { name: 'Managed Company', code: 'CO' };
  const compPeriods = (payrollData?.periods || []).filter(p => p.companyId === compId);
  const c = document.getElementById('modalContent');
  
  // Suggest next month
  let defaultMonth = "October 2026";
  let defaultMonthCode = "Oct-26";
  if (compPeriods.length > 0) {
    const lastP = compPeriods[compPeriods.length - 1];
    if (lastP.month.toLowerCase().includes("september")) {
      defaultMonth = "October 2026";
      defaultMonthCode = "Oct-26";
    } else if (lastP.month.toLowerCase().includes("october")) {
      defaultMonth = "November 2026";
      defaultMonthCode = "Nov-26";
    }
  }

  const curRate = activePayrollPeriod ? activePayrollPeriod.exchangeRate : 440.0;
  const preferredCloneId = cloneFromId || (activePayrollPeriod && activePayrollPeriod.companyId === compId ? activePayrollPeriod.id : (compPeriods[0]?.id || null));

  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">Create New Payroll Period</h3>
          <p class="text-[11px] text-slate-500">For <b>${escapeHtml(comp.name)}</b> (${escapeHtml(comp.code || 'CO')})</p>
        </div>
        <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form onsubmit="submitNewPeriod(event, '${compId}')" class="space-y-3.5">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Month &amp; Year *</label>
            <input type="text" id="newPeriodMonth" value="${defaultMonth}" required
              placeholder="e.g. October 2026"
              class="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-semibold">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Month Code *</label>
            <input type="text" id="newPeriodMonthCode" value="${defaultMonthCode}" required
              placeholder="e.g. Oct-26"
              class="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono uppercase">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Exchange Rate (1 GBP in LKR) *</label>
            <input type="number" id="newPeriodRate" step="0.01" min="1" value="${curRate}" required
              class="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Financial Year Period</label>
            <input type="text" id="newPeriodYearPeriod" value="${escapeHtml(comp.payrollYearPeriod || '2026-2027')}" required
              class="w-full px-3 py-2 border border-slate-200 rounded-xl">
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Remittance Letter Date</label>
            <input type="text" id="newPeriodLetterDate" value="31.10.2026" required
              class="w-full px-3 py-2 border border-slate-200 rounded-xl">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Initial Status</label>
            <select id="newPeriodStatus" class="w-full px-3 py-2 border border-slate-200 rounded-xl font-semibold">
              <option value="Draft" selected>Draft</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
            </select>
          </div>
        </div>

        <!-- Clone Roster Option -->
        <div class="p-3.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 space-y-2">
          <div class="font-bold flex items-center gap-1.5 text-teal-800">
            <i data-lucide="copy" class="w-3.5 h-3.5 text-teal-600"></i>
            <span>Staff Roster Pre-population</span>
          </div>
          <div>
            <label class="block text-[11px] font-medium text-teal-800 mb-1">Copy staff roster &amp; banking records from:</label>
            <select id="newPeriodCloneSelect" class="w-full p-2 bg-white border border-teal-300 rounded-lg text-xs font-semibold text-slate-800">
              <option value="">-- Start with Blank Sheet (No staff) --</option>
              ${compPeriods.map(p => `
                <option value="${p.id}" ${p.id === preferredCloneId ? 'selected' : ''}>
                  ${escapeHtml(p.month)} (${p.employeeCount || 0} Staff members)
                </option>
              `).join('')}
            </select>
            <p class="text-[11px] text-teal-700/80 mt-1">Staff names, bank account numbers, TIN, NIC, and contracted GBP salaries will be automatically duplicated.</p>
          </div>
        </div>

        <div class="pt-1">
          <label class="flex items-center gap-2 cursor-pointer font-semibold text-slate-700">
            <input type="checkbox" id="newPeriodSetActive" checked class="rounded text-teal-600 focus:ring-teal-500">
            <span>Set as current active period immediately</span>
          </label>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition">
            Cancel
          </button>
          <button type="submit" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-xs transition">
            Create Period
          </button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitNewPeriod(e, compId) {
  e.preventDefault();
  const month = document.getElementById('newPeriodMonth').value.trim();
  const monthCode = document.getElementById('newPeriodMonthCode').value.trim().toUpperCase();
  const rate = parseFloat(document.getElementById('newPeriodRate').value);
  const yearPeriod = document.getElementById('newPeriodYearPeriod').value.trim();
  const letterDate = document.getElementById('newPeriodLetterDate').value.trim();
  const status = document.getElementById('newPeriodStatus').value;
  const cloneFromId = document.getElementById('newPeriodCloneSelect').value;
  const setActive = document.getElementById('newPeriodSetActive').checked;

  const targetCompId = compId || selectedPayrollCompanyId || activePayrollPeriod?.companyId || 'comp_apadmi';

  const payload = {
    companyId: targetCompId,
    month: month,
    monthCode: monthCode,
    exchangeRate: rate,
    yearPeriod: yearPeriod,
    letterDate: letterDate,
    status: status,
    cloneFromId: cloneFromId || null,
    cloneFromPeriodId: cloneFromId || null,
    setActive: setActive
  };

  try {
    const res = await fetch('/api/payroll/period', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      closeModal();
      selectedPayrollCompanyId = targetCompId;
      await refreshPayrollData();
      if (data.period && setActive) {
        await handlePayrollPeriodChange(data.period.id);
      }
      alert(`Payroll period "${month}" created successfully.`);
    } else {
      const err = await res.json();
      alert('Error creating period: ' + (err.error || 'Server error'));
    }
  } catch (err) {
    alert('Connection error: ' + err.message);
  }
}

// 4. Quick Period Status Toggle
async function handleQuickPeriodStatusChange(periodId, newStatus) {
  try {
    const res = await fetch('/api/payroll/period', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: periodId, status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      await refreshPayrollData();
    } else {
      alert(data.error || 'Failed to update period status');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

// 5. Set Period as Primary Default Active Period
async function setPayrollPeriodAsDefault(periodId) {
  try {
    const res = await fetch('/api/payroll/period', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ id: periodId, setActive: true })
    });
    const data = await res.json();
    if (data.success) {
      await refreshPayrollData();
      await handlePayrollPeriodChange(periodId);
      closeModal();
    } else {
      alert(data.error || 'Failed to set default period');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
}

// 6. Delete Payroll Period with Safety Guard
async function deletePayrollPeriod(periodId, periodMonth) {
  if (!canEdit('payroll')) return;
  const periods = payrollData?.periods || [];
  if (periods.length <= 1) {
    alert('Cannot delete the only remaining payroll period in the system.');
    return;
  }
  if (!confirm(`Are you sure you want to delete payroll period "${periodMonth}" and all staff rows in it? This cannot be undone.`)) {
    return;
  }
  try {
    const res = await fetch(`/api/payroll/period?id=${encodeURIComponent(periodId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      await refreshPayrollData();
      if (data.activePeriodId) {
        await handlePayrollPeriodChange(data.activePeriodId);
      }
      alert(`Payroll period "${periodMonth}" deleted successfully.`);
    } else {
      alert(data.error || 'Failed to delete period');
    }
  } catch (err) {
    alert('Network error deleting period: ' + err.message);
  }
}

// 7. Employee Add/Edit Modals
function openAddEmployeeModal() {
  openEmployeeModal(null);
}

function openEditEmployeeModal(empId) {
  const emp = (activePayrollPeriod?.employees || []).find(e => e.id === empId);
  if (!emp) return;
  openEmployeeModal(emp);
}

function openEmployeeModal(emp) {
  const isEdit = !!emp;
  const c = document.getElementById('modalContent');
  const nextNo = (activePayrollPeriod?.employees?.length || 0) + 1;
  const comp = (payrollData?.companies || []).find(c => c.id === activePayrollPeriod?.companyId) || { name: 'APADMI SL (PRIVATE) LIMITED', currencyMode: 'dual' };
  const isSingle = (comp.currencyMode === 'single');
  const foreignCurr = comp.foreignCurrency || 'GBP';

  c.innerHTML = `
    <div class="space-y-4 text-xs">
      <div class="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h3 class="font-display font-bold text-base text-slate-900">${isEdit ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
          <p class="text-[11px] text-slate-500">${escapeHtml(activePayrollPeriod?.month || '')} &bull; ${escapeHtml(comp.name)}</p>
        </div>
        <button onclick="closeModal()" class="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <form onsubmit="submitEmployee(event, '${isEdit ? emp.id : ''}')" class="space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Sheet Row No</label>
            <input type="number" id="empNoInput" value="${isEdit ? emp.no : nextNo}" required
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
          <div class="md:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Employee Full Name</label>
            <input type="text" id="empNameInput" value="${isEdit ? escapeHtml(emp.name) : ''}" required
              placeholder="e.g. Wikum Jayasekara"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-semibold">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="md:col-span-2">
            <label class="block font-semibold text-slate-700 mb-1">Designation / Position</label>
            <input type="text" id="empPositionInput" value="${isEdit ? escapeHtml(emp.position) : ''}" required
              placeholder="e.g. Senior Software Engineer"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
          <div>
            ${isSingle ? `
              <label class="block font-semibold text-slate-700 mb-1">Monthly Basic (LKR) *</label>
              <input type="number" id="empLkrSalaryInput" step="0.01" min="0" value="${isEdit ? (emp.lkrSalary || emp.lkrGross || 0) : 100000}" required
                class="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold">
            ` : `
              <label class="block font-semibold text-slate-700 mb-1">Contract Base (${foreignCurr}) *</label>
              <input type="number" id="empGbpSalaryInput" step="0.01" min="0" value="${isEdit ? emp.gbpSalary : 1000}" required
                class="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-bold">
            `}
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Working Days (Col 1)</label>
            <input type="text" id="empWorkDaysInput" value="${isEdit ? escapeHtml(emp.workDays || '') : ''}"
              placeholder="e.g. 17 D or blank"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
          <div>
            ${isSingle ? `
              <label class="block font-semibold text-slate-700 mb-1">Earned Basic (LKR)</label>
              <input type="number" id="empEarnedLkrInput" step="0.01" min="0" value="${isEdit && emp.earnedLkr ? emp.earnedLkr : ''}"
                placeholder="Blank = Full Basic"
                class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
            ` : `
              <label class="block font-semibold text-slate-700 mb-1">Earned Base (${foreignCurr})</label>
              <input type="number" id="empEarnedGbpInput" step="0.01" min="0" value="${isEdit && emp.earnedGbp ? emp.earnedGbp : ''}"
                placeholder="Blank = Full Base"
                class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
            `}
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Date Joined</label>
            <input type="text" id="empDateJoinedInput" value="${isEdit ? escapeHtml(emp.dateJoined || '') : ''}"
              placeholder="e.g. 01.07.2023"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Bank Account Number</label>
            <input type="text" id="empBankAccInput" value="${isEdit ? escapeHtml(emp.bankAccountNo || '') : ''}" required
              placeholder="e.g. 8003180429"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Bank &amp; Branch</label>
            <input type="text" id="empBankBranchInput" value="${isEdit ? escapeHtml(emp.bankBranch || '') : ''}" required
              placeholder="e.g. Commercial Bank - Colombo 07"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">National ID / Passport</label>
            <input type="text" id="empIdNoInput" value="${isEdit ? escapeHtml(emp.idNo || '') : ''}"
              placeholder="e.g. 199321400215"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">TIN Number</label>
            <input type="text" id="empTinNoInput" value="${isEdit ? escapeHtml(emp.tinNo || '') : ''}"
              placeholder="e.g. 210815418"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono">
          </div>
          <div>
            <label class="block font-semibold text-slate-700 mb-1">EPF Registration No</label>
            <input type="text" id="empEpfNoInput" value="${isEdit ? escapeHtml(emp.epfNo || '') : ''}"
              placeholder="e.g. 01"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg">
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-red-50/70 rounded-xl border border-red-200">
          <div>
            <label class="block font-semibold text-slate-800 mb-1 flex items-center justify-between">
              <span>APIT Tax (LKR)</span>
              <span class="text-[10px] text-red-600 font-bold uppercase tracking-wider">Accountant / IRD Input</span>
            </label>
            <input type="number" id="empApitInput" step="1" min="0"
              value="${isEdit && emp.apit !== undefined && emp.apit !== null ? Math.round(emp.apit) : ''}"
              placeholder="Leave blank for auto-bracket tax"
              class="w-full px-3 py-1.5 border border-red-200 focus:border-red-500 rounded-lg font-mono font-bold text-red-700 bg-white">
            <p class="text-[10px] text-slate-500 mt-1">Directly editable APIT tax field. Enter manual IRD tax table value, or leave blank to auto-calculate with standard tax brackets.</p>
          </div>
          <div>
            <label class="block font-semibold text-slate-800 mb-1">Special Allowance (LKR)</label>
            <input type="number" id="empSpecialAllowanceInput" step="0.01" min="0"
              value="${isEdit && emp.specialAllowance ? emp.specialAllowance : ''}"
              placeholder="e.g. 25000"
              class="w-full px-3 py-1.5 border border-slate-200 rounded-lg font-mono bg-white">
            <p class="text-[10px] text-slate-500 mt-1">Non-contractual allowance added to monthly gross earnings.</p>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onclick="closeModal()" class="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition">
            Cancel
          </button>
          <button type="submit" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-xs transition">
            ${isEdit ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('modalBackdrop').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

async function submitEmployee(e, empId) {
  e.preventDefault();
  const comp = (payrollData?.companies || []).find(c => c.id === activePayrollPeriod?.companyId) || { currencyMode: 'dual' };
  const isSingle = (comp.currencyMode === 'single');

  let gbpSalary = 0;
  let earnedGbp = 0;
  let lkrSalary = 0;
  let earnedLkr = 0;

  if (isSingle) {
    lkrSalary = parseFloat(document.getElementById('empLkrSalaryInput').value) || 0;
    const earnedInput = document.getElementById('empEarnedLkrInput').value.trim();
    earnedLkr = earnedInput ? parseFloat(earnedInput) : lkrSalary;
  } else {
    gbpSalary = parseFloat(document.getElementById('empGbpSalaryInput').value) || 0;
    const earnedInput = document.getElementById('empEarnedGbpInput').value.trim();
    earnedGbp = earnedInput ? parseFloat(earnedInput) : gbpSalary;
  }

  const apitVal = document.getElementById('empApitInput').value.trim();
  const specVal = document.getElementById('empSpecialAllowanceInput').value.trim();

  const payload = {
    periodId: activePayrollPeriod.id,
    no: parseInt(document.getElementById('empNoInput').value, 10),
    name: document.getElementById('empNameInput').value.trim(),
    position: document.getElementById('empPositionInput').value.trim(),
    gbpSalary: gbpSalary,
    earnedGbp: earnedGbp,
    lkrSalary: lkrSalary,
    earnedLkr: earnedLkr,
    workDays: document.getElementById('empWorkDaysInput').value.trim(),
    bankAccountNo: document.getElementById('empBankAccInput').value.trim(),
    bankBranch: document.getElementById('empBankBranchInput').value.trim(),
    idNo: document.getElementById('empIdNoInput').value.trim(),
    tinNo: document.getElementById('empTinNoInput').value.trim(),
    dateJoined: document.getElementById('empDateJoinedInput').value.trim(),
    epfNo: document.getElementById('empEpfNoInput').value.trim(),
    apit: apitVal !== '' ? parseFloat(apitVal) : null,
    specialAllowance: specVal !== '' ? parseFloat(specVal) : 0.0
  };

  const isEdit = !!empId;
  if (isEdit) payload.id = empId;

  try {
    const res = await fetch('/api/payroll/employee', {
      method: isEdit ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      closeModal();
      await refreshPayrollData();
    } else {
      const err = await res.json();
      alert('Error saving staff member: ' + (err.error || 'Server error'));
    }
  } catch (err) {
    alert('Connection error: ' + err.message);
  }
}

async function updateEmployeeApitInline(empId, val) {
  const apitNum = val.trim() === '' ? null : parseFloat(val);
  try {
    const res = await fetch('/api/payroll/employee', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        periodId: activePayrollPeriod.id,
        id: empId,
        apit: apitNum
      })
    });
    if (res.ok) {
      await refreshPayrollData();
    } else {
      const err = await res.json();
      alert('Error updating APIT: ' + (err.error || 'Server error'));
    }
  } catch (err) {
    alert('Connection error: ' + err.message);
  }
}

async function deleteEmployee(empId) {
  if (!confirm('Are you sure you want to remove this staff member from the current period?')) return;
  try {
    const res = await fetch(`/api/payroll/employee?periodId=${encodeURIComponent(activePayrollPeriod.id)}&id=${encodeURIComponent(empId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    if (res.ok) {
      await refreshPayrollData();
    } else {
      const err = await res.json();
      alert('Error removing employee: ' + (err.error || 'Server error'));
    }
  } catch (err) {
    alert('Connection error: ' + err.message);
  }
}

// --------------// 1. Print Master Salary Sheet (A4 Landscape)
function printMasterSalarySheet() {
  const p = activePayrollPeriod;
  if (!p) return;
  const emps = p.employees || [];
  const totals = p.totals || {};
  const currentComp = (payrollData?.companies || []).find(c => c.id === p.companyId) || (payrollData?.companies && payrollData.companies[0]) || { name: 'APADMI SL (PRIVATE) LIMITED' };
  const isSingle = (currentComp.currencyMode === 'single');
  const foreignCurr = currentComp.foreignCurrency || 'GBP';

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('Please allow popups to open the print view.');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>SALARY SHEET - ${escapeHtml(p.month)} - ${escapeHtml(currentComp.name)}</title>
      <style>
        @page {
          size: A4 landscape;
          margin: 6mm 8mm;
        }
        body {
          font-family: Calibri, Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #000;
          background: #fff;
          font-size: 8pt;
        }
        .header-title {
          font-weight: 800;
          font-size: 10pt;
          margin: 6px 0 3px 0;
          text-align: left;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
        }
        th, td {
          border: 1px solid #777;
          padding: 3px 4px;
          font-size: 7.5pt;
        }
        th {
          background-color: #f1f5f9 !important;
          font-weight: 700;
          text-align: center;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .totals-row td {
          font-weight: 800;
          background-color: #f8fafc !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .signoff {
          display: flex;
          justify-content: space-between;
          margin: 6px 0 10px 0;
          font-size: 8pt;
        }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .text-center { text-align: center; }
        .bold { font-weight: bold; }
      </style>
    </head>
    <body>

      ${isSingle ? `
        <!-- SINGLE CURRENCY: LKR SALARY SHEET -->
        <div class="header-title">SALARY SHEET (IN LKR) - ${p.month.toUpperCase()} - ${escapeHtml(currentComp.name)}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;">No</th>
              <th class="text-left" style="width: 170px;">Employee Name</th>
              <th class="text-left" style="width: 140px;">POSITION</th>
              <th>Basic Salary (LKR)</th>
              <th>Working Days</th>
              <th>Earned Salary (LKR)</th>
              <th>EPF 8%</th>
              <th>EPF 12%</th>
              <th>ETF 3%</th>
              <th>APIT (LKR)</th>
              <th>Other Deductions</th>
              <th>Net Remittance (LKR)</th>
              <th>BANK ACCOUNT NO</th>
              <th>TIN NO</th>
              <th>IDNO</th>
              <th>Date Joined</th>
            </tr>
          </thead>
          <tbody>
            ${emps.map(e => `
              <tr>
                <td class="text-center">${e.no}</td>
                <td class="text-left bold">${escapeHtml(e.name)}</td>
                <td class="text-left">${escapeHtml(e.position)}</td>
                <td class="text-right">${formatMoney(e.lkrSalary || e.lkrGross || 0, 2)}</td>
                <td class="text-center bold">${escapeHtml(e.workDays || '')}</td>
                <td class="text-right bold">${formatMoney(e.earnedLkr || e.lkrGross || 0, 2)}</td>
                <td class="text-right">${formatMoney(e.epf8Lkr, 0)}</td>
                <td class="text-right">${formatMoney(e.epf12Lkr, 0)}</td>
                <td class="text-right">${formatMoney(e.etf3Lkr, 0)}</td>
                <td class="text-right">${formatMoney(e.apit, 0)}</td>
                <td class="text-right">${e.otherDeductions ? formatMoney(e.otherDeductions, 2) : '-'}</td>
                <td class="text-right bold">${formatMoney(e.netSalaryLkr, 0)}</td>
                <td class="text-left" style="font-family: monospace;">${escapeHtml(e.bankAccountNo)}${e.bankCode ? `(${escapeHtml(e.bankCode)})` : ''}</td>
                <td class="text-center">${escapeHtml(e.tinNo || '-')}</td>
                <td class="text-center">${escapeHtml(e.idNo || '-')}</td>
                <td class="text-center">${escapeHtml(e.dateJoined || '-')}</td>
              </tr>
            `).join('')}
            <tr class="totals-row">
              <td colspan="3" class="text-center bold">TOTAL</td>
              <td class="text-right">${formatMoney(totals.sumLkrGross || 0, 2)}</td>
              <td></td>
              <td class="text-right">${formatMoney(totals.sumLkrGross || 0, 2)}</td>
              <td class="text-right">${formatMoney(totals.sumEpf8Lkr, 0)}</td>
              <td class="text-right">${formatMoney(totals.sumEpf12Lkr, 0)}</td>
              <td class="text-right">${formatMoney(totals.sumEtf3Lkr, 0)}</td>
              <td class="text-right bold">${formatMoney(totals.sumApitLkr, 0)}</td>
              <td></td>
              <td class="text-right bold">${formatMoney(totals.sumNetSalaryLkr, 0)}</td>
              <td colspan="4"></td>
            </tr>
          </tbody>
        </table>

        <!-- Signoff -->
        <div class="signoff">
          <div>
            <div class="bold">Checked by: ${escapeHtml(p.checkedBy || 'Hemanthi Basnayake')}</div>
            <div>${escapeHtml(p.checkedTitle || 'Accountant')}</div>
          </div>
          <div class="text-right">
            <div class="bold">Authorized by: ${escapeHtml(p.authorizedSignatory || 'Shaameel Mohideen')}</div>
            <div>${escapeHtml(p.authorizedCompany || 'Spillburg Holdings (pvt)Ltd')}</div>
          </div>
        </div>
      ` : `
        <!-- DUAL CURRENCY: TABLE 1 (${foreignCurr}) -->
        <div class="header-title">SALARY SHEET (IN ${foreignCurr} ) - ${p.month.toUpperCase()}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;">No</th>
              <th class="text-left" style="width: 170px;">Employee Name</th>
              <th class="text-left" style="width: 140px;">POSITION</th>
              <th>${foreignCurr} Salary</th>
              <th>Working Days</th>
              <th>Earned Base (${foreignCurr})</th>
              <th>EPF (12% )</th>
              <th>ETF(3% )</th>
              <th>Total Employer Cost (${foreignCurr})</th>
              <th>BANK ACCOUNT NO</th>
              <th>TIN NO</th>
              <th>IDNO</th>
              <th>Date Joined</th>
            </tr>
          </thead>
          <tbody>
            ${emps.map(e => `
              <tr>
                <td class="text-center">${e.no}</td>
                <td class="text-left bold">${escapeHtml(e.name)}</td>
                <td class="text-left">${escapeHtml(e.position)}</td>
                <td class="text-right">${formatMoney(e.gbpSalary, 2)}</td>
                <td class="text-center bold">${escapeHtml(e.workDays || '')}</td>
                <td class="text-right bold">${formatMoney(e.earnedGbp, 2)}</td>
                <td class="text-right">${formatMoney(e.epf12Gbp, 0)}</td>
                <td class="text-right">${formatMoney(e.etf3Gbp, 0)}</td>
                <td class="text-right bold">${formatMoney(e.totalGbp, 2)}</td>
                <td class="text-left" style="font-family: monospace;">${escapeHtml(e.bankAccountNo)}${e.bankCode ? `(${escapeHtml(e.bankCode)})` : ''}</td>
                <td class="text-center">${escapeHtml(e.tinNo || '-')}</td>
                <td class="text-center">${escapeHtml(e.idNo || '-')}</td>
                <td class="text-center">${escapeHtml(e.dateJoined || '-')}</td>
              </tr>
            `).join('')}
            <tr class="totals-row">
              <td colspan="3" class="text-center bold">TOTAL</td>
              <td class="text-right">${formatMoney(totals.sumGbpSalary, 2)}</td>
              <td></td>
              <td class="text-right">${formatMoney(totals.sumEarnedGbp, 2)}</td>
              <td class="text-right">${formatMoney(totals.sumEpf12Gbp, 0)}</td>
              <td class="text-right">${formatMoney(totals.sumEtf3Gbp, 0)}</td>
              <td class="text-right bold">${formatMoney(totals.sumTotalGbp, 2)}</td>
              <td colspan="4"></td>
            </tr>
          </tbody>
        </table>

        <!-- Signoff -->
        <div class="signoff">
          <div>
            <div class="bold">Checked by: ${escapeHtml(p.checkedBy || 'Hemanthi Basnayake')}</div>
            <div>${escapeHtml(p.checkedTitle || 'Accountant')}</div>
          </div>
          <div class="text-right">
            <div class="bold">Authorized by: ${escapeHtml(p.authorizedSignatory || 'Shaameel Mohideen')}</div>
            <div>${escapeHtml(p.authorizedCompany || 'Spillburg Holdings (pvt)Ltd')}</div>
          </div>
        </div>

        <!-- TABLE 2: LKR SALARY SHEET -->
        <div class="header-title" style="margin-top: 10px;">SALARY SHEET (IN LKR) - ${p.month.toUpperCase()} @ ${formatMoney(p.exchangeRate, 0)}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25px;">No</th>
              <th class="text-left" style="width: 170px;">Employee Name</th>
              <th class="text-left" style="width: 140px;">POSITION</th>
              <th>${foreignCurr} Salary</th>
              <th>Working Days</th>
              <th>Earned Base (${foreignCurr})</th>
              <th>LKR</th>
              <th>EPF 8%</th>
              <th>EPF12%</th>
              <th>ETF 3%</th>
              <th>APIT (LKR)</th>
              <th>Other Deductions</th>
              <th>Net Remittance (LKR)</th>
            </tr>
          </thead>
          <tbody>
            ${emps.map(e => `
              <tr>
                <td class="text-center">${e.no}</td>
                <td class="text-left bold">${escapeHtml(e.name)}</td>
                <td class="text-left">${escapeHtml(e.position)}</td>
                <td class="text-right">${formatMoney(e.gbpSalary, 2)}</td>
                <td class="text-center bold">${escapeHtml(e.workDays || '')}</td>
                <td class="text-right bold">${formatMoney(e.earnedGbp, 2)}</td>
                <td class="text-right bold">${formatMoney(e.lkrGross, 0)}</td>
                <td class="text-right">${formatMoney(e.epf8Lkr, 0)}</td>
                <td class="text-right">${formatMoney(e.epf12Lkr, 0)}</td>
                <td class="text-right">${formatMoney(e.etf3Lkr, 0)}</td>
                <td class="text-right">${formatMoney(e.apit, 0)}</td>
                <td></td>
                <td class="text-right bold">${formatMoney(e.netSalaryLkr, 0)}</td>
              </tr>
            `).join('')}
            <tr class="totals-row">
              <td colspan="3" class="text-center bold">TOTAL</td>
              <td class="text-right">${formatMoney(totals.sumGbpSalary, 2)}</td>
              <td></td>
              <td class="text-right">${formatMoney(totals.sumEarnedGbp, 2)}</td>
              <td class="text-right bold">${formatMoney(totals.sumLkrGross, 0)}</td>
              <td class="text-right">${formatMoney(totals.sumEpf8Lkr, 0)}</td>
              <td class="text-right">${formatMoney(totals.sumEpf12Lkr, 0)}</td>
              <td class="text-right">${formatMoney(totals.sumEtf3Lkr, 0)}</td>
              <td class="text-right bold">${formatMoney(totals.sumApitLkr, 0)}</td>
              <td></td>
              <td class="text-right bold">${formatMoney(totals.sumNetSalaryLkr, 0)}</td>
            </tr>
          </tbody>
        </table>
      `}

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// 2. Print Official Bank Request Letter (A4 Portrait with Repeating Letterhead on All Pages)
function printBankRequestLetter() {
  const p = activePayrollPeriod;
  if (!p) return;
  const emps = p.employees || [];
  const totals = p.totals || {};
  const currentComp = (payrollData?.companies || []).find(c => c.id === p.companyId) || (payrollData?.companies && payrollData.companies[0]) || { name: 'APADMI SL (PRIVATE) LIMITED' };

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('Please allow popups to open the print view.');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Bank Remittance Request - ${escapeHtml(p.month)} - Spillburg Holdings</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 0;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #000;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        /* Fixed letterhead header on EVERY page */
        .letterhead-header {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 42mm;
          z-index: 10;
          pointer-events: none;
        }
        .letterhead-header img {
          width: 100%;
          height: 42mm;
          object-fit: cover;
          object-position: top;
          display: block;
        }

        /* Fixed letterhead footer on EVERY page */
        .letterhead-footer {
          position: fixed;
          bottom: 0;
          left: 0;
          width: 100%;
          height: 34mm;
          z-index: 10;
          pointer-events: none;
        }
        .letterhead-footer img {
          width: 100%;
          height: 34mm;
          object-fit: cover;
          object-position: bottom;
          display: block;
        }

        /* Browser print engine repeats thead & tfoot across all printed pages */
        .print-layout-table {
          width: 100%;
          border-collapse: collapse;
          border: none;
        }
        .print-layout-table > thead > tr > td {
          height: 44mm;
          padding: 0;
          border: none;
        }
        .print-layout-table > tfoot > tr > td {
          height: 36mm;
          padding: 0;
          border: none;
        }
        .print-layout-table > tbody > tr > td {
          padding: 0 20mm;
          border: none;
          vertical-align: top;
        }

        .doc-content {
          font-size: 9pt;
          line-height: 1.4;
          color: #111;
        }
        .date {
          margin-bottom: 3.5mm;
          font-weight: 600;
        }
        .recipient {
          margin-bottom: 3.5mm;
          line-height: 1.35;
        }
        .salutation {
          margin-bottom: 3mm;
        }
        .subject {
          font-weight: bold;
          text-decoration: underline;
          margin-bottom: 3.5mm;
          font-size: 9pt;
        }
        .staff-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 3.5mm;
          font-size: 8.5pt;
        }
        .staff-table th, .staff-table td {
          border: 1px solid #333;
          padding: 3px 5px;
        }
        .staff-table thead {
          display: table-header-group;
        }
        .staff-table tr {
          page-break-inside: avoid;
        }
        .staff-table th {
          font-weight: bold;
          text-align: center;
          background: #f8f8f8;
        }
        .staff-table .total-row td {
          font-weight: bold;
          border-top: 1.5px solid #000;
        }
        .double-underline {
          text-decoration: underline;
          text-decoration-style: double;
        }
        .debit-note {
          text-align: justify;
          margin-top: 3.5mm;
          line-height: 1.4;
          font-size: 8.5pt;
          page-break-inside: avoid;
        }
        .signoff-block {
          margin-top: 4mm;
          line-height: 1.3;
          page-break-inside: avoid;
        }
        .signature-space {
          height: 13mm;
        }
        .signatory-name {
          font-weight: bold;
          font-size: 9pt;
        }
        .signatory-title {
          font-size: 8pt;
          color: #333;
        }

        /* Interactive On-screen Toolbar (Hidden during print) */
        .no-print-toolbar {
          background: #1e293b;
          color: white;
          padding: 10px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: sans-serif;
          font-size: 13px;
        }
        @media print {
          .no-print-toolbar {
            display: none !important;
          }
        }
        body.no-letterhead .letterhead-header,
        body.no-letterhead .letterhead-footer {
          display: none !important;
        }
      </style>
    </head>
    <body class="${bankLetterheadEnabled ? '' : 'no-letterhead'}">
      <div class="no-print-toolbar">
        <div style="display: flex; align-items: center; gap: 8px;">
          <strong>Spillburg Holdings</strong>
          <span style="opacity: 0.8; font-size: 12px;">&bull; Bank Remittance Request (${escapeHtml(currentComp.name)})</span>
        </div>
        <div style="display: flex; gap: 14px; align-items: center;">
          <label style="cursor: pointer; display: flex; align-items: center; gap: 6px; font-weight: 500;">
            <input type="checkbox" id="toggleLh" ${bankLetterheadEnabled ? 'checked' : ''} onchange="document.body.classList.toggle('no-letterhead', !this.checked)">
            <span>Use Letterhead</span>
          </label>
          <button onclick="window.print()" style="background: #0d9488; color: white; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px;">Print</button>
          <button onclick="window.close()" style="background: #475569; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">Close</button>
        </div>
      </div>

      <div class="letterhead-header">
        <img src="/letterhead_header.png" alt="Header">
      </div>
      <div class="letterhead-footer">
        <img src="/letterhead_footer.png" alt="Footer">
      </div>

      <table class="print-layout-table">
        <thead>
          <tr>
            <td></td>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="doc-content">
                <div class="date">${escapeHtml(p.letterDate || '30.09.2026')}</div>

                <div class="recipient">
                  <div>The Manager</div>
                  <div style="font-weight: 600;">${escapeHtml(p.bankName || currentComp.bankName || 'Nations Trust Bank PLC')},</div>
                  <div>${escapeHtml(p.bankBranch || currentComp.bankBranch || 'Borella Branch')},</div>
                  <div>${(p.bankAddress || currentComp.bankAddress || '67 D.S. Senanayake Mawatha,\nColombo 08.').split('\n').map(l => escapeHtml(l)).join('<br>')}</div>
                </div>

                <div class="salutation">Dear Sir,</div>

                <div class="subject">SALARY FOR STAFF MEMBERS OF ${escapeHtml(currentComp.name || 'APADMI SL (PRIVATE) LIMITED').toUpperCase()}</div>

                <table class="staff-table">
                  <thead>
                    <tr>
                      <th style="width: 38%; text-align: left;">Name</th>
                      <th style="width: 17%;">ID Number</th>
                      <th style="width: 17%;">A/C Number</th>
                      <th style="width: 28%;">Bank/ Branch</th>
                      <th style="width: 18%; text-align: right;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${emps.map((e, idx) => `
                      <tr>
                        <td style="font-weight: 600;">${idx + 1}.${escapeHtml(e.name)}</td>
                        <td style="text-align: center;">${escapeHtml(e.idNo)}</td>
                        <td style="font-family: monospace; text-align: center;">${escapeHtml(e.bankAccountNo)}</td>
                        <td>${escapeHtml(e.bankBranch)}</td>
                        <td style="text-align: right; font-weight: 600;">${formatMoney(e.netSalaryLkr, 2)}</td>
                      </tr>
                    `).join('')}

                    <tr class="total-row">
                      <td colspan="4" style="text-align: right; padding-right: 15px;">Total</td>
                      <td style="text-align: right;" class="double-underline">
                        Rs ${formatMoney(totals.sumNetSalaryLkr, 2)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div class="debit-note">
                  Please be kind enough to remit the respective amount for above mentioned staff members in their respective bank accounts. Kindly debit the amounts from the A/C Number ${escapeHtml(p.debitAccountNo || currentComp.debitAccountNo || '1001 5000 7554')} of ${escapeHtml(p.debitAccountName || currentComp.debitAccountName || 'Spillburg Holdings (Private) Limited')} and credit the same to the above A/C holders with immediate effects.
                </div>

                <div class="signoff-block">
                  <div>Thank You,</div>
                  <div style="margin-top: 2.5mm;">Yours faithfully,</div>
                  <div class="signature-space"></div>
                  <div class="signatory-name">${escapeHtml(p.authorizedSignatory || currentComp.authorizedSignatory || 'Shaameel Mohideen')}</div>
                  <div class="signatory-title">${escapeHtml(p.authorizedTitle || currentComp.authorizedTitle || 'Director')} &middot; ${escapeHtml(p.authorizedCompany || currentComp.authorizedCompany || 'Spillburg Holdings (Private) Limited')}</div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td></td>
          </tr>
        </tfoot>
      </table>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// 3. Print Single Payslip (A4 Portrait Voucher - Long Rectangle View)
function printSinglePayslip(empId) {
  const p = activePayrollPeriod;
  if (!p) return;
  const emp = (p.employees || []).find(e => e.id === empId);
  if (!emp) return;

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('Please allow popups to open the print view.');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payslip - ${escapeHtml(emp.name)} - ${escapeHtml(p.month)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 15mm 0;
        }
        body {
          font-family: Calibri, Arial, sans-serif;
          margin: 0;
          padding: 10px 0;
          display: flex;
          justify-content: center;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .payslip-voucher {
          width: 115mm;
          max-width: 115mm;
          border: 1.5px solid #111;
          padding: 5mm;
          font-size: 8.5pt;
          box-sizing: border-box;
          margin: 0 auto;
          background: #fff;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td {
          padding: 3px 6px;
          border: 1px solid #475569;
        }
        .bold { font-weight: bold; }
        .text-right { text-align: right; }
      </style>
    </head>
    <body>
      ${generatePayslipHtml(emp, p)}
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        };
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// 4. Batch Print All Payslips (Continuous A4 with Page Breaks - Long Rectangle View)
function printAllPayslips() {
  const p = activePayrollPeriod;
  if (!p) return;
  const emps = p.employees || [];
  const currentComp = (payrollData?.companies || []).find(c => c.id === p.companyId) || { name: 'APADMI SL' };

  const printWin = window.open('', '_blank');
  if (!printWin) {
    alert('Please allow popups to open the print view.');
    return;
  }

  printWin.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>All Payslips - ${escapeHtml(p.month)} - ${escapeHtml(currentComp.name)}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 0;
        }
        body {
          font-family: Calibri, Arial, sans-serif;
          margin: 0;
          padding: 0;
          background: #fff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .payslip-page {
          page-break-after: always;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          padding-top: 8mm;
          min-height: 250mm;
          box-sizing: border-box;
        }
        .payslip-voucher {
          width: 115mm;
          max-width: 115mm;
          border: 1.5px solid #000;
          padding: 5mm;
          font-size: 8.5pt;
          box-sizing: border-box;
          margin: 0 auto;
          background: #fff;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        td {
          padding: 3px 6px;
          border: 1px solid #475569;
        }
      </style>
    </head>
    <body>
      ${emps.map(emp => `
        <div class="payslip-page">
          ${generatePayslipHtml(emp, p)}
        </div>
      `).join('')}
      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWin.document.close();
}

// ---------------- EXPORT HANDLERS ----------------
function exportPayrollExcel() {
  if (!activePayrollPeriod) return;
  window.location.href = `/api/payroll/export-xlsx?periodId=${encodeURIComponent(activePayrollPeriod.id)}`;
}

function exportPayrollCsv() {
  if (!activePayrollPeriod) return;
  window.location.href = `/api/payroll/export-csv?periodId=${encodeURIComponent(activePayrollPeriod.id)}`;
}

