// ── TABLE OPS ─────────────────────────────────────────────────────────────────
// Excel-like row / column / tab management for every table in the dashboard.
// Attached once via event delegation; re-applied after every renderAll().

// ── Global UI state ────────────────────────────────────────────────────────────
const TUI = {
  hiddenRows: {},      // tbodyId → Set<Number didx>
  hiddenCols: {},      // tbodyId → Set<Number cidx (1-based)>
  hiddenTabs: new Set(),
  customTabs: [],      // [{id, name, notes}]
  extraCols: {},       // tbodyId → [{id, label, cells:{rowKey:value}}]
  hiddenElements: {},  // hideId → true  (KPI cards, table cards, chart cards)
};

// Per-tbody data registry — direct links to D arrays for row insert/delete
const TREG = {
  'tbl-mepf-body':     { arr: () => D.mepf.rows,          blank: () => ({ sno: '—', label: 'New Item', amt: 0, status: 'Pending', cls: 'pending' }) },
  'tbl-facade-body':   { arr: () => D.facade.rows,         blank: () => ({ sno: '—', type: '', desc: 'New Item', qty: 1, rate: 0 }) },
  'tbl-park-body':     { arr: () => D.parking.rows,        blank: () => ({ sno: '—', label: 'New Item', unit: 'LS', qty: 1, rate: 0 }) },
  'tbl-sign-body':     { arr: () => D.signages.rows,       blank: () => ({ sno: '—', label: 'New Item', amt: 0 }) },
  'tbl-con-body':      { arr: () => D.consultant.main,     blank: () => ({ sno: '—', label: 'New Item', amt: 0 }) },
  'tbl-con2-body':     { arr: () => D.consultant.struct,   blank: () => ({ label: 'New Item', amt: 0 }) },
  'tbl-finishes-body': { arr: () => D.finishes.rows,       blank: () => ({ sno: '—', label: 'New Item', amt: 0 }) },
  'tbl-light-body':    { arr: () => D.lighting.rows,       blank: () => ({ sno: '—', label: 'New Item', exclGst: 0, inclGst: 0 }) },
  'tbl-elev-body':     { arr: () => D.elevators.main,      blank: () => ({ sno: '—', desc: 'New Item', tot: 0, cA: 0, cB: null, amtCr: 0 }) },
  'tbl-elev-oos':      { arr: () => D.elevators.oos,       blank: () => ({ sno: '—', label: 'New Item', amt: 0 }) },
  'tbl-land-body':     { arr: () => D.landscape.groups,    blank: () => ({ key: '—', label: 'New Item', amt: 0 }) },
  'tbl-land-det-body': { arr: () => D.landscape.details,   blank: () => ({ sno: '—', label: 'New Item', unit: 'LS', qty: 1, rate: 0 }) },
  'tbl-mep-body':      { arr: () => D.mepCostplan,         blank: () => ({ code: '', label: 'New Item', init: null, r2: null, r3: null, r4: null, r5: null, internal: null, consultant: null, rmk: '', level: 'S' }) },
};

// ── Context menu ───────────────────────────────────────────────────────────────
let _cmEl = null;

function _showMenu(e, items) {
  e.preventDefault();
  e.stopPropagation();
  _closeMenu();
  const div = document.createElement('div');
  div.className = 'tui-menu';
  items.filter(Boolean).forEach(item => {
    if (item === '—') {
      div.appendChild(Object.assign(document.createElement('div'), { className: 'tui-sep' }));
      return;
    }
    const row = document.createElement('div');
    row.className = 'tui-item' + (item.dim ? ' tui-dim' : '');
    row.innerHTML = `<span class="tui-ico">${item.icon || ''}</span><span>${item.label}</span>`;
    if (!item.dim) row.onclick = () => { _closeMenu(); item.fn(); };
    div.appendChild(row);
  });
  document.body.appendChild(div);
  _cmEl = div;

  // Position within viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  let x = e.clientX + window.scrollX, y = e.clientY + window.scrollY;
  setTimeout(() => {
    const r = div.getBoundingClientRect();
    if (e.clientX + r.width > vw - 4)  x = e.clientX + window.scrollX - r.width;
    if (e.clientY + r.height > vh - 4) y = e.clientY + window.scrollY - r.height;
    div.style.left = x + 'px';
    div.style.top  = y + 'px';
  }, 0);
  div.style.left = x + 'px';
  div.style.top  = y + 'px';
}

function _closeMenu() { if (_cmEl) { _cmEl.remove(); _cmEl = null; } }
document.addEventListener('mousedown', e => { if (_cmEl && !_cmEl.contains(e.target)) _closeMenu(); });
document.addEventListener('keydown',   e => { if (e.key === 'Escape') _closeMenu(); });

// ── Row context menu ───────────────────────────────────────────────────────────
function _rowMenu(e, tr) {
  const tbid  = tr.dataset.tbid;
  const didx  = parseInt(tr.dataset.didx ?? '-1');
  const reg   = tbid ? TREG[tbid] : null;
  const isData = didx >= 0;
  const isHidden = isData && TUI.hiddenRows[tbid]?.has(didx);
  const anyHidden = (TUI.hiddenRows[tbid]?.size || 0) > 0;

  _showMenu(e, [
    isData && reg ? { icon: '⬆', label: 'Insert Row Above', fn: () => _insertRow(tbid, didx, true)  } : null,
    isData && reg ? { icon: '⬇', label: 'Insert Row Below', fn: () => _insertRow(tbid, didx, false) } : null,
    isData && reg ? '—' : null,
    isData && reg ? { icon: '🗑', label: 'Delete Row',       fn: () => _deleteRow(tbid, didx) } : null,
    '—',
    isData ? { icon: isHidden ? '👁' : '🙈', label: isHidden ? 'Show Row' : 'Hide Row', fn: () => _toggleHideRow(tbid, didx) } : null,
    anyHidden ? { icon: '👁', label: `Show All Hidden Rows (${TUI.hiddenRows[tbid].size})`, fn: () => _showAllRows(tbid) } : null,
    !isData && !reg ? { icon: '', label: 'Computed row — no data ops', dim: true } : null,
  ]);
}

// ── Column context menu ────────────────────────────────────────────────────────
function _colMenu(e, th) {
  const tbid   = th.dataset.tbid;
  const cidx   = parseInt(th.dataset.cidx ?? '-1');
  const isHidden = tbid && TUI.hiddenCols[tbid]?.has(cidx);
  const anyHidden = (TUI.hiddenCols[tbid]?.size || 0) > 0;
  const isExtra = th.classList.contains('tui-extra-th');

  _showMenu(e, [
    !isExtra ? { icon: '◁+', label: 'Insert Column Left',  fn: () => _addCol(tbid, cidx - 1) } : null,
    !isExtra ? { icon: '+▷', label: 'Insert Column Right', fn: () => _addCol(tbid, cidx)     } : null,
    isExtra  ? { icon: '🗑', label: 'Delete Column', fn: () => {
      const arr = TUI.extraCols[tbid];
      const col = arr?.find(c => c.id === th.dataset.ecid);
      if (col) arr.splice(arr.indexOf(col), 1);
      applyTableOps();
    }} : null,
    '—',
    !isExtra ? { icon: isHidden ? '👁' : '🙈', label: isHidden ? 'Show Column' : 'Hide Column', fn: () => _toggleHideCol(tbid, cidx) } : null,
    anyHidden ? { icon: '👁', label: `Show All Columns (${TUI.hiddenCols[tbid].size} hidden)`, fn: () => _showAllCols(tbid) } : null,
  ]);
}

// ── Tab context menu ───────────────────────────────────────────────────────────
function _tabMenu(e, btn) {
  e.preventDefault();
  const tabId  = btn.dataset.tabId;
  const custom = TUI.customTabs.find(t => t.id === tabId);
  const isAdmin = (typeof _fbIsAdmin !== 'undefined') ? _fbIsAdmin : true;
  const isHidden = TUI.hiddenTabs.has(tabId);

  const _save = () => { if (typeof fbScheduleSave === 'function') fbScheduleSave(); };

  _showMenu(e, [
    { icon: '✏', label: 'Rename Tab', fn: () => {
      const current = btn.textContent.replace(/\s*🙈\s*/, '').trim();
      const _apply = newName => {
        if (!newName) return;
        if (custom) { custom.name = newName; recompute(); renderAll(); }
        else { btn.textContent = newName; }
        _save();
      };
      if (typeof tbPrompt === 'function') {
        tbPrompt({ title: 'Rename Tab', label: 'New name', placeholder: current, value: current, confirmText: 'Rename', icon: '✏️' }).then(_apply);
      } else {
        _apply(prompt('Tab name:', current));
      }
    }},
    '—',
    // Only admins can hide / unhide tabs
    isAdmin ? { icon: '👁', label: 'Tab Visibility…', fn: () => tuiOpenTabVisDialog() } : null,
    custom && isAdmin ? '—' : null,
    custom && isAdmin ? { icon: '🗑', label: 'Delete Tab', fn: () => {
      if (!confirm(`Delete custom tab "${custom.name}"?`)) return;
      TUI.customTabs.splice(TUI.customTabs.indexOf(custom), 1);
      applyTableOps();
      _save();
    }} : null,
  ]);
}

// ── Row operations ─────────────────────────────────────────────────────────────
function _insertRow(tbid, didx, above) {
  const reg = TREG[tbid]; if (!reg) return;
  reg.arr().splice(above ? didx : didx + 1, 0, reg.blank());
  // Shift hidden row indices
  if (TUI.hiddenRows[tbid]) {
    const ins = above ? didx : didx + 1;
    const next = new Set();
    TUI.hiddenRows[tbid].forEach(d => next.add(d >= ins ? d + 1 : d));
    TUI.hiddenRows[tbid] = next;
  }
  recompute(); renderAll(); applyTableOps();
}

function _deleteRow(tbid, didx) {
  const reg = TREG[tbid]; if (!reg) return;
  if (!confirm('Delete this row?')) return;
  reg.arr().splice(didx, 1);
  if (TUI.hiddenRows[tbid]) {
    const next = new Set();
    TUI.hiddenRows[tbid].forEach(d => { if (d < didx) next.add(d); else if (d > didx) next.add(d - 1); });
    TUI.hiddenRows[tbid] = next;
  }
  recompute(); renderAll(); applyTableOps();
}

function _toggleHideRow(tbid, didx) {
  if (!TUI.hiddenRows[tbid]) TUI.hiddenRows[tbid] = new Set();
  if (TUI.hiddenRows[tbid].has(didx)) TUI.hiddenRows[tbid].delete(didx);
  else TUI.hiddenRows[tbid].add(didx);
  applyTableOps();
}

function _showAllRows(tbid) { delete TUI.hiddenRows[tbid]; applyTableOps(); }

// ── Column operations ──────────────────────────────────────────────────────────
function _toggleHideCol(tbid, cidx) {
  if (!TUI.hiddenCols[tbid]) TUI.hiddenCols[tbid] = new Set();
  if (TUI.hiddenCols[tbid].has(cidx)) TUI.hiddenCols[tbid].delete(cidx);
  else TUI.hiddenCols[tbid].add(cidx);
  applyTableOps();
}

function _showAllCols(tbid) { delete TUI.hiddenCols[tbid]; applyTableOps(); }

function _addCol(tbid, afterCidx) {
  const label = prompt('Column name:', 'New Column'); if (!label) return;
  if (!TUI.extraCols[tbid]) TUI.extraCols[tbid] = [];
  TUI.extraCols[tbid].push({ id: 'ec_' + Date.now(), label, afterCidx, cells: {} });
  applyTableOps();
}

// ── Tab operations ─────────────────────────────────────────────────────────────
function tuiCreateTab() {
  const _create = name => {
    if (!name) return;
    const id = 'ct_' + Date.now();
    TUI.customTabs.push({ id, name, notes: '', blocks: [] });
    applyTableOps();
    // Flush immediately so new tab is visible to all users without debounce delay
    if (typeof fbFlushSave === 'function') fbFlushSave();
    else if (typeof fbScheduleSave === 'function') fbScheduleSave();
    setTimeout(() => { document.querySelector(`[data-tab-id="${id}"]`)?.click(); }, 0);
  };
  if (typeof tbPrompt === 'function') {
    tbPrompt({ title: 'New Tab', label: 'Tab name', placeholder: 'e.g. Procurement, Schedule…', value: '', confirmText: 'Create', icon: '＋' }).then(_create);
  } else {
    _create(prompt('New tab name:', 'My Tab'));
  }
}

// ── SVG Eye icons (used by tab visibility dialog) ─────────────────────────────
const _SVG_EYE_ON  = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
const _SVG_EYE_OFF = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function tuiOpenTabVisDialog() {
  const isAdmin = (typeof _fbIsAdmin !== 'undefined') ? _fbIsAdmin : true;
  if (!isAdmin) return;

  // Collect all tabs — built-in + custom (hidden buttons still in DOM)
  const allTabs = [];
  document.querySelectorAll('.tab-btn:not(.tui-special)').forEach(btn => {
    const tid = btn.dataset.tabId;
    if (!tid) return;
    const name = btn.textContent.trim().replace(/\s*🙈\s*$/, '');
    allTabs.push({ id: tid, name, isHidden: TUI.hiddenTabs.has(tid) });
  });

  const hiddenCount = allTabs.filter(t => t.isHidden).length;

  const overlay = document.createElement('div');
  overlay.className = 'tui-vis-overlay';
  overlay.innerHTML = `
<div class="tui-vis-dialog">
  <div class="tui-vis-hdr">
    <span>Tab Visibility</span>
    <span class="tui-vis-sub" id="tui-vis-sub">${hiddenCount === 0 ? 'All tabs visible' : hiddenCount + ' hidden'}</span>
  </div>
  <div class="tui-vis-list" id="tui-vis-list">
    ${allTabs.map(t => `
      <div class="tui-vis-row">
        <span class="tui-vis-name">${escHtml(t.name)}</span>
        <button class="tui-vis-eye ${t.isHidden ? 'eye-off' : 'eye-on'}"
                data-tid="${escHtml(t.id)}"
                title="${t.isHidden ? 'Show tab' : 'Hide tab'}"
                onclick="tuiToggleVisRow(this)">
          ${t.isHidden ? _SVG_EYE_OFF : _SVG_EYE_ON}
        </button>
      </div>`).join('')}
  </div>
  <div class="tui-vis-footer">
    <button class="tui-vis-showall" onclick="tuiVisShowAll()">Show All</button>
    <button class="tui-vis-done" onclick="this.closest('.tui-vis-overlay').remove()">Done</button>
  </div>
</div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function tuiToggleVisRow(btn) {
  const tid = btn.dataset.tid;
  if (!tid) return;
  const nowHidden = TUI.hiddenTabs.has(tid);
  if (nowHidden) {
    TUI.hiddenTabs.delete(tid);
    btn.className = 'tui-vis-eye eye-on';
    btn.title = 'Hide tab';
    btn.innerHTML = _SVG_EYE_ON;
  } else {
    TUI.hiddenTabs.add(tid);
    btn.className = 'tui-vis-eye eye-off';
    btn.title = 'Show tab';
    btn.innerHTML = _SVG_EYE_OFF;
    // If the active tab just got hidden, switch to the first visible tab
    const activeBtn = document.querySelector(`.tab-btn[data-tab-id="${tid}"].active`);
    if (activeBtn) {
      const first = document.querySelector('.tab-btn:not(.tui-special):not([data-tab-id="' + tid + '"])');
      if (first) first.click();
    }
  }
  // Update subtitle counter
  const sub = document.getElementById('tui-vis-sub');
  if (sub) {
    const n = TUI.hiddenTabs.size;
    sub.textContent = n === 0 ? 'All tabs visible' : n + ' hidden';
  }
  applyTableOps();
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

function tuiVisShowAll() {
  TUI.hiddenTabs.clear();
  const list = document.getElementById('tui-vis-list');
  if (list) {
    list.querySelectorAll('.tui-vis-eye').forEach(btn => {
      btn.className = 'tui-vis-eye eye-on';
      btn.title = 'Hide tab';
      btn.innerHTML = _SVG_EYE_ON;
    });
  }
  const sub = document.getElementById('tui-vis-sub');
  if (sub) sub.textContent = 'All tabs visible';
  applyTableOps();
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

// ── Post-render hook ───────────────────────────────────────────────────────────
function applyTableOps() {
  _assignDidx();
  _assignCidx();
  _applyHiddenRows();
  _applyHiddenCols();
  _injectExtraCols();
  _addTableActionBars();
  _updateTabBar();
  if (typeof assignCellAddrs          === 'function') assignCellAddrs();
  if (typeof applyFormulas            === 'function') applyFormulas();
  if (typeof tbAddChartBtns           === 'function') tbAddChartBtns();
  if (typeof _tbAssignBuiltinKpiRefs  === 'function') _tbAssignBuiltinKpiRefs();
  if (typeof _tbAddKpiInfoBadges      === 'function') _tbAddKpiInfoBadges();
  _assignHideIds();
  _applyHiddenElements();
  _addAdminHideButtons();
  _addFormulaIndicators();
}

// ── Element-level hide (KPI cards, table cards, chart cards) ───────────────────

function _assignHideIds() {
  // KPI cards — scoped by tab panel + label text
  document.querySelectorAll('.kpi-card').forEach(card => {
    const label = card.querySelector('.label')?.textContent.trim() || '';
    if (!label) return;
    const panel  = card.closest('.tab-panel');
    const scope  = panel?.id || 'root';
    const slug   = label.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().slice(0, 36);
    card.dataset.hideId = `kpi-${scope}-${slug}`;
  });

  // Built-in table cards — use tbody ID as stable anchor
  document.querySelectorAll('.card').forEach(card => {
    if (card.dataset.hideId) return;
    const tbody = card.querySelector('tbody[id]');
    if (!tbody) return;
    card.dataset.hideId = `card-${tbody.id}`;
  });

  // Chart canvas cards (built-in tabs with named canvases)
  document.querySelectorAll('.card .chart-box canvas[id]').forEach(cv => {
    const card = cv.closest('.card');
    if (!card || card.dataset.hideId) return;
    card.dataset.hideId = `chart-${cv.id}`;
  });
}

// SVG for the hide button on visible elements
const _SVG_HIDE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

function _applyHiddenElements() {
  const hidden = TUI.hiddenElements || {};
  document.querySelectorAll('[data-hide-id]').forEach(el => {
    const id = el.dataset.hideId;
    // Completely hidden for everyone when flagged — no skeleton, full reflow
    el.style.display = hidden[id] ? 'none' : '';
  });
  _updateHiddenElsBtn();
}

function _addAdminHideButtons() {
  const _isAdmin = (typeof _fbIsAdmin !== 'undefined') ? _fbIsAdmin : true;
  if (!_isAdmin) return;
  // Only add "Hide" buttons to VISIBLE elements (hidden ones are display:none)
  document.querySelectorAll('[data-hide-id]').forEach(el => {
    if ((TUI.hiddenElements || {})[el.dataset.hideId]) return; // skip hidden
    el.querySelector('.tui-hide-el-btn')?.remove();
    const id = el.dataset.hideId;
    const btn = document.createElement('button');
    btn.className = 'tui-hide-el-btn';
    btn.title = 'Hide this element';
    btn.innerHTML = _SVG_HIDE;
    btn.onclick = e => { e.stopPropagation(); tuiToggleHideElement(id); };
    el.appendChild(btn);
  });
}

function tuiToggleHideElement(id) {
  if (!TUI.hiddenElements) TUI.hiddenElements = {};
  if (TUI.hiddenElements[id]) delete TUI.hiddenElements[id];
  else TUI.hiddenElements[id] = true;
  _applyHiddenElements();
  _addAdminHideButtons();
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

function _updateHiddenElsBtn() {
  const _isAdmin = (typeof _fbIsAdmin !== 'undefined') ? _fbIsAdmin : true;
  let btn = document.getElementById('tui-hidden-els-btn');
  if (!btn) {
    // Inject next to hidden-tabs button
    const ref = document.getElementById('tui-hidden-tabs-btn');
    if (!ref) return;
    btn = document.createElement('button');
    btn.id = 'tui-hidden-els-btn';
    btn.className = 'tab-btn tui-special tui-hidden-els-btn';
    btn.title = 'Restore hidden elements';
    btn.onclick = tuiOpenHiddenElsDialog;
    ref.parentNode.insertBefore(btn, ref.nextSibling);
  }
  const n = Object.keys(TUI.hiddenElements || {}).length;
  btn.style.display = (n > 0 && _isAdmin) ? '' : 'none';
  btn.textContent = n === 1 ? '1 element hidden' : `${n} elements hidden`;
}

function tuiOpenHiddenElsDialog() {
  const hidden = TUI.hiddenElements || {};
  const ids = Object.keys(hidden);
  if (!ids.length) return;

  // Build friendly label for each hidden-id
  function _elLabel(id) {
    if (id.startsWith('kpi-')) {
      const slug = id.replace(/^kpi-[^-]+-/, '').replace(/-/g, ' ');
      return 'KPI: ' + slug.replace(/\b\w/g, c => c.toUpperCase());
    }
    if (id.startsWith('card-tbl-')) return 'Table: ' + id.replace('card-tbl-', '').replace(/-/g, ' ');
    if (id.startsWith('chart-'))   return 'Chart: ' + id.replace('chart-', '').replace(/-/g, ' ');
    return id;
  }

  const overlay = document.createElement('div');
  overlay.className = 'tui-vis-overlay';
  overlay.innerHTML = `
<div class="tui-vis-dialog">
  <div class="tui-vis-hdr">
    <span>Hidden Elements</span>
    <span class="tui-vis-sub">${ids.length} hidden</span>
  </div>
  <div class="tui-vis-list" id="tui-els-list">
    ${ids.map(id => `
      <div class="tui-vis-row" data-el-id="${escHtml(id)}">
        <span class="tui-vis-name">${escHtml(_elLabel(id))}</span>
        <button class="tui-vis-eye eye-off" data-el-id="${escHtml(id)}"
                title="Restore element"
                onclick="tuiRestoreHiddenEl(this)">
          ${_SVG_EYE_ON}
        </button>
      </div>`).join('')}
  </div>
  <div class="tui-vis-footer">
    <button class="tui-vis-showall" onclick="tuiRestoreAllEls(this)">Restore All</button>
    <button class="tui-vis-done" onclick="this.closest('.tui-vis-overlay').remove()">Done</button>
  </div>
</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function tuiRestoreHiddenEl(btn) {
  const id = btn.dataset.elId;
  if (!id) return;
  delete (TUI.hiddenElements || {})[id];
  btn.closest('.tui-vis-row')?.remove();
  const list = document.getElementById('tui-els-list');
  if (list && !list.querySelector('.tui-vis-row')) {
    list.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px">All elements restored</div>';
  }
  _applyHiddenElements();
  _addAdminHideButtons();
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

function tuiRestoreAllEls(btn) {
  TUI.hiddenElements = {};
  const list = document.getElementById('tui-els-list');
  if (list) list.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;font-size:12px">All elements restored</div>';
  _applyHiddenElements();
  _addAdminHideButtons();
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

// ── Formula / link indicators ─────────────────────────────────────────────────

function _addFormulaIndicators() {
  // Inject ℹ button into edcasc cells — clicking opens the formula panel directly for edit
  document.querySelectorAll('td.edcasc[data-fkey]').forEach(td => {
    if (td.querySelector('.tui-fml-btn')) return;
    const key = td.dataset.fkey;
    if (typeof FSTORE === 'undefined' || !FSTORE[key]) return;
    const btn = document.createElement('button');
    btn.className = 'tui-fml-btn';
    btn.title = 'View / edit formula';
    btn.textContent = 'ℹ';
    btn.onclick = e => {
      e.stopPropagation();
      // Open the formula panel directly so user can view AND edit
      if (typeof openFormulaPanel === 'function') {
        openFormulaPanel(td);
      } else {
        // Fallback: show popover
        document.querySelector('.tui-fml-pop')?.remove();
        const formula = FSTORE[key] || '';
        const currentVal = td.textContent.replace('ℹ', '').trim();
        const pop = _buildFmlPop(formula, currentVal, 'Cascade Formula');
        document.body.appendChild(pop);
        _positionFmlPop(pop, btn);
      }
    };
    td.appendChild(btn);
  });
}

// D.xxx prefix → tab label for traceability display
const _D_TAB_LABELS = {
  mepf:        'MEPF',
  facade:      'Façade',
  parking:     'Parking',
  elevators:   'Elevators',
  landscape:   'Landscape',
  lighting:    'Lighting',
  finishes:    'Finishes',
  signages:    'Signage',
  consultant:  'Consultant',
  mepCostplan: 'MEP Cost Plan',
};

// C.xxx internal variable → Excel-style named-range label
const _C_FRIENDLY = {
  'C.totalInit':       'InitialBudget',
  'C.totalCur':        'CurrentAmount',
  'C.totalExp':        'ExpectedAmount',
  'C.s2sub1':          'Stage2_Sub1',
  'C.s2sub2':          'Stage2_Sub2',
  'C.s2sub3':          'Stage2_Sub3',
  'C.s3total':         'Stage3_Total',
  'C.s3committed1':    'Stage3_CommittedA',
  'C.s3committed2':    'Stage3_CommittedB',
  'C.facadeTotal':     'FacadeTotal',
  'C.elevInclGst':     'ElevatorsInclGST',
  'C.parkingTotal':    'ParkingTotal',
  'C.parkingSubtotal': 'ParkingSubtotal',
  'C.parkingGST':      'ParkingGST',
  'C.mepfTotal':       'MEPFTotal',
  'C.landscapeTotal':  'LandscapeTotal',
};

// Translate internal JS formula to Excel-like named-range notation
function _friendlyFormula(formula) {
  if (!formula) return '= —';
  let f = formula.startsWith('=') ? formula.slice(1) : formula;
  // Replace C.xxx longest-first to avoid partial matches
  Object.entries(_C_FRIENDLY)
    .sort((a, b) => b[0].length - a[0].length)
    .forEach(([code, name]) => { f = f.split(code).join(name); });
  // D.module.field → Module_Field
  f = f.replace(/D\.([a-zA-Z]+)\.([a-zA-Z]+)/g, (_, mod, field) =>
    mod.charAt(0).toUpperCase() + mod.slice(1) + '_' + field);
  // D.module → Module
  f = f.replace(/D\.([a-zA-Z]+)/g, (_, mod) =>
    mod.charAt(0).toUpperCase() + mod.slice(1));
  // Numeric scale shortcuts
  f = f.replace(/\/\s*1e7/g,      ' / 1Cr');
  f = f.replace(/\/\s*10000000/g, ' / 1Cr');
  f = f.replace(/\*\s*1e7/g,      ' * 1Cr');
  // Tidy whitespace
  f = f.replace(/\s+/g, ' ').trim();
  return '= ' + f;
}

// Shared popover builder (used by tableops + tab-builder)
// editFn: optional function — if provided, shows an "Edit formula" button
function _buildFmlPop(formula, currentVal, title, editFn) {
  const pop = document.createElement('div');
  pop.className = 'tui-fml-pop';

  const friendlyExpr = _friendlyFormula(formula);

  // Derive source tabs from raw formula
  const refs = [...new Set((formula.match(/[DC]\.[a-zA-Z0-9_.[\]]+/g) || []))].slice(0, 8);
  const tabSet = new Set();
  refs.forEach(r => {
    const m = r.match(/^D\.([a-zA-Z0-9]+)/);
    if (m && _D_TAB_LABELS[m[1]]) tabSet.add(_D_TAB_LABELS[m[1]]);
  });
  if (refs.some(r => r.startsWith('C.'))) tabSet.add('Summary');

  const tabsHtml = tabSet.size
    ? `<div class="tui-fml-pop-tabs">
        <span class="tui-fml-pop-refs-lbl">Source tabs:</span>
        ${[...tabSet].map(t => `<span class="tui-fml-tab-badge">${escHtml(t)}</span>`).join('')}
       </div>`
    : '';

  pop.innerHTML = `
    <div class="tui-fml-pop-hdr">
      <span>ℹ ${escHtml(title)}</span>
      <button class="tui-fml-pop-x" onclick="this.closest('.tui-fml-pop').remove()">✕</button>
    </div>
    <div class="tui-fml-pop-expr"><code>${escHtml(friendlyExpr)}</code></div>
    ${tabsHtml}
    <div class="tui-fml-pop-val">Current value: <strong>${escHtml(String(currentVal))}</strong></div>
    ${editFn ? '<div class="tui-fml-pop-edit-row"><button class="tui-fml-pop-edit-btn">✏ Edit Formula</button></div>' : ''}`;

  if (editFn) {
    pop.querySelector('.tui-fml-pop-edit-btn').onclick = () => { pop.remove(); editFn(); };
  }

  setTimeout(() => {
    const close = ev => {
      if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', close); }
    };
    document.addEventListener('mousedown', close);
  }, 0);

  return pop;
}

function _positionFmlPop(pop, anchor) {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  pop.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
  pop.style.left = Math.min(rect.left + window.scrollX, vw - 300) + 'px';
}

// Assign data-didx to rows in every registered tbody
function _assignDidx() {
  const SKIP = new Set(['total-row', 'committed-sep', 'note-row', 'group-header']);
  Object.keys(TREG).forEach(tbid => {
    const tbody = document.getElementById(tbid); if (!tbody) return;
    let didx = 0;
    Array.from(tbody.querySelectorAll(':scope > tr')).forEach(tr => {
      const skip = [...SKIP].some(c => tr.classList.contains(c));
      tr.dataset.tbid = tbid;
      tr.dataset.didx = skip ? '-1' : String(didx++);
    });
  });
  // For unregistered tbodies, just mark tbid
  document.querySelectorAll('tbody').forEach(tbody => {
    if (!tbody.id || TREG[tbody.id]) return;
    Array.from(tbody.querySelectorAll(':scope > tr')).forEach(tr => {
      tr.dataset.tbid = tbody.id || '';
      tr.dataset.didx = '-1';
    });
  });
}

// Assign data-cidx to all th and td cells (1-based, tracks original column position)
function _assignCidx() {
  document.querySelectorAll('table').forEach(tbl => {
    const tbodyId = tbl.querySelector('tbody')?.id || '';
    tbl.querySelectorAll('thead tr').forEach(tr => {
      Array.from(tr.children).forEach((th, i) => {
        if (!th.classList.contains('tui-extra-th')) {
          th.dataset.cidx = String(i + 1);
          th.dataset.tbid = tbodyId;
        }
      });
    });
    tbl.querySelectorAll('tbody > tr, tfoot > tr').forEach(tr => {
      Array.from(tr.children).forEach((td, i) => {
        if (!td.classList.contains('tui-extra-td')) td.dataset.cidx = String(i + 1);
      });
    });
  });
}

// Apply hidden rows
function _applyHiddenRows() {
  Object.entries(TUI.hiddenRows).forEach(([tbid, hiddenSet]) => {
    if (!hiddenSet?.size) return;
    const tbody = document.getElementById(tbid); if (!tbody) return;
    Array.from(tbody.querySelectorAll(':scope > tr')).forEach(tr => {
      const d = parseInt(tr.dataset.didx ?? '-1');
      if (d >= 0 && hiddenSet.has(d)) tr.style.display = 'none';
    });
  });
}

// Apply hidden columns
function _applyHiddenCols() {
  Object.entries(TUI.hiddenCols).forEach(([tbid, hiddenSet]) => {
    if (!hiddenSet?.size) return;
    const tbody = document.getElementById(tbid);
    const table = tbody?.closest('table'); if (!table) return;
    hiddenSet.forEach(cidx => {
      table.querySelectorAll(`[data-cidx="${cidx}"]`).forEach(el => { el.style.display = 'none'; });
    });
  });
}

// Inject user-added extra columns
function _injectExtraCols() {
  Object.entries(TUI.extraCols).forEach(([tbid, cols]) => {
    if (!cols.length) return;
    const tbody = document.getElementById(tbid);
    const table = tbody?.closest('table'); if (!table) return;
    const headTr = table.querySelector('thead tr'); if (!headTr) return;
    const dataRows = Array.from(tbody.querySelectorAll(':scope > tr'));

    cols.forEach(col => {
      // Header cell
      const th = document.createElement('th');
      th.className = 'tui-extra-th';
      th.dataset.ecid = col.id;
      th.dataset.tbid = tbid;
      th.contentEditable = 'true';
      th.textContent = col.label;
      th.onblur = () => { col.label = th.textContent.trim() || col.label; };

      const refTh = headTr.querySelector(`[data-cidx="${col.afterCidx}"]`);
      refTh ? refTh.insertAdjacentElement('afterend', th) : headTr.appendChild(th);

      // Body + foot cells
      table.querySelectorAll('tbody > tr, tfoot > tr').forEach((tr, pos) => {
        const d = tr.dataset.didx;
        const key = (d !== undefined && d !== '-1') ? `d${d}` : `m${pos}`;
        const td = document.createElement('td');
        td.className = 'tui-extra-td num';
        td.contentEditable = 'true';
        td.textContent = col.cells[key] ?? '';
        td.oninput = () => { col.cells[key] = td.textContent; };

        const refTd = tr.querySelector(`[data-cidx="${col.afterCidx}"]`);
        refTd ? refTd.insertAdjacentElement('afterend', td) : tr.appendChild(td);
      });
    });
  });
}

// Add "+ Add Row" and hidden-count banners below each registered table
function _addTableActionBars() {
  Object.keys(TREG).forEach(tbid => {
    const tbody = document.getElementById(tbid); if (!tbody) return;
    const table = tbody.closest('table');
    const wrap  = table?.closest('.card') || table?.closest('.tbl-wrap') || table?.parentElement;
    if (!wrap) return;

    wrap.querySelectorAll('.tui-action-bar').forEach(el => el.remove());
    const bar = document.createElement('div');
    bar.className = 'tui-action-bar';

    const hiddenR = TUI.hiddenRows[tbid]?.size || 0;
    const hiddenC = TUI.hiddenCols[tbid]?.size || 0;

    if (hiddenR) {
      const btn = document.createElement('button');
      btn.className = 'tui-info-btn';
      btn.textContent = `👁 ${hiddenR} row${hiddenR > 1 ? 's' : ''} hidden`;
      btn.onclick = () => _showAllRows(tbid);
      bar.appendChild(btn);
    }
    if (hiddenC) {
      const btn = document.createElement('button');
      btn.className = 'tui-info-btn';
      btn.textContent = `👁 ${hiddenC} column${hiddenC > 1 ? 's' : ''} hidden`;
      btn.onclick = () => _showAllCols(tbid);
      bar.appendChild(btn);
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'tui-add-row-btn';
    addBtn.textContent = '+ Add Row';
    addBtn.onclick = () => {
      const reg = TREG[tbid];
      reg.arr().push(reg.blank());
      recompute(); renderAll(); applyTableOps();
    };
    bar.appendChild(addBtn);
    wrap.appendChild(bar);
  });
}

// Update tab bar: hide/show tabs, render custom tabs
function _updateTabBar() {
  const _isAdmin = (typeof _fbIsAdmin !== 'undefined') ? _fbIsAdmin : true;

  // Attach data-tab-id and right-click to every built-in tab button
  document.querySelectorAll('.tab-btn:not(.tui-special)').forEach(btn => {
    if (!btn.dataset.tabId) {
      const m = (btn.getAttribute('onclick') || '').match(/showTab\(['"]([^'"]+)['"]/);
      if (m) btn.dataset.tabId = m[1];
    }
    const tid = btn.dataset.tabId;
    if (!tid) return;
    const hidden = TUI.hiddenTabs.has(tid);
    // Hidden tabs are fully invisible for ALL users — managed via the eye dialog
    btn.style.display = hidden ? 'none' : '';
    btn.classList.remove('tb-admin-hidden-btn');
  });

  // Hidden tab count button — only shown to admins (who can restore them)
  const hBtn = document.getElementById('tui-hidden-tabs-btn');
  const n = TUI.hiddenTabs.size;
  if (hBtn) {
    hBtn.style.display = (n > 0 && _isAdmin) ? '' : 'none';
    hBtn.textContent = n === 1 ? `1 tab hidden` : `${n} tabs hidden`;
  }

  // Render custom tab buttons and panels
  // Save any in-progress AI prompt text so re-renders don't wipe it
  const _savedPrompts = {};
  document.querySelectorAll('.tui-custom-panel').forEach(el => {
    const id = el.id.replace('tab-tui_', '');
    const ta = el.querySelector(`#tb-inp-${id}`);
    if (ta) _savedPrompts[id] = ta.value;
  });

  document.querySelectorAll('.tui-custom-btn, .tui-custom-panel').forEach(el => el.remove());
  const tabsWrap   = document.querySelector('.tabs-wrap');
  const contentDiv = document.querySelector('.content');
  const plusBtn    = document.getElementById('tui-add-tab-btn');

  TUI.customTabs.forEach(tab => {
    // Button
    const btn = document.createElement('button');
    btn.className = 'tab-btn tui-custom-btn';
    btn.textContent = tab.name;
    btn.dataset.tabId = tab.id;
    const _tabHidden = TUI.hiddenTabs.has(tab.id);
    btn.style.display = _tabHidden ? 'none' : '';
    btn.classList.remove('tb-admin-hidden-btn');
    btn.onclick = () => showTab('tui_' + tab.id, btn);
    plusBtn ? tabsWrap.insertBefore(btn, plusBtn) : tabsWrap.appendChild(btn);

    // Panel — use AI builder if available, otherwise fall back to notes textarea
    const panel = document.createElement('div');
    panel.id = 'tab-tui_' + tab.id;
    panel.className = 'tab-panel tui-custom-panel';

    if (typeof tbRenderPanel === 'function') {
      panel.innerHTML = tbRenderPanel(tab);
    } else {
      panel.innerHTML = `
        <div class="card">
          <div class="card-title"><span>${escHtml(tab.name)}</span></div>
          <textarea class="tui-notes-ta" placeholder="Add notes…">${escHtml(tab.notes || '')}</textarea>
        </div>`;
      panel.querySelector('textarea').oninput = function() { tab.notes = this.value; };
    }

    contentDiv.appendChild(panel);

    // Restore saved prompt text if any
    if (_savedPrompts[tab.id]) {
      const inp = panel.querySelector(`#tb-inp-${tab.id}`);
      if (inp) inp.value = _savedPrompts[tab.id];
    }

    // Paint AI content blocks
    if (typeof tbPaintContent === 'function') tbPaintContent(tab.id);
  });
}

// ── One-time init (called from DOMContentLoaded) ───────────────────────────────
function initTableOps() {
  // Delegated right-click for rows and column headers
  document.querySelector('.content').addEventListener('contextmenu', e => {
    const tr = e.target.closest('tbody > tr');
    if (tr) { _rowMenu(e, tr); return; }
    const th = e.target.closest('thead th');
    if (th) { _colMenu(e, th); }
  });
  // Delegated right-click for tabs
  document.querySelector('.tabs-wrap').addEventListener('contextmenu', e => {
    const btn = e.target.closest('.tab-btn:not(.tui-special)');
    if (btn) _tabMenu(e, btn);
  });
}
