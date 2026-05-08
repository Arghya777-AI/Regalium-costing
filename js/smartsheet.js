// ── SMART SHEET ────────────────────────────────────────────────────────────────
// Formula-enabled, AI-assisted, comment-rich spreadsheet table system.
// Self-contained: uses D.smartsheet, does NOT depend on C or the main EH system.

// ── State ─────────────────────────────────────────────────────────────────────
let ssActive   = null;   // { tIdx, rIdx, colId } — cell targeted for AI formulas
let ssCurEdit  = null;   // cleanup fn for the open cell input
let ssCmtPop   = null;   // reference to open comment popover element
let _ssSeq     = Date.now();

function ssId() { return 's' + (_ssSeq++).toString(36); }

// ── Formula Engine ─────────────────────────────────────────────────────────────
function ssEvalTable(table) {
  // Reset computed values
  table.rows.forEach(row =>
    table.cols.forEach(col => {
      if (!row.cells[col.id]) row.cells[col.id] = { val: '', formula: null, comment: '' };
      delete row.cells[col.id]._computed;
      row.cells[col.id]._err = false;
    })
  );

  // Pass 1: direct values
  table.rows.forEach(row =>
    table.cols.forEach(col => {
      const c = row.cells[col.id];
      if (c.formula) return;
      const n = parseFloat(c.val);
      c._computed = isNaN(n) ? String(c.val ?? '') : n;
    })
  );

  // Passes 2–8: formula cells (handles dependency chains)
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    table.rows.forEach((row, rIdx) => {
      table.cols.forEach(col => {
        const c = row.cells[col.id];
        if (!c.formula) return;
        try {
          // Build scope: column IDs → computed values of current row
          const scope = {};
          table.cols.forEach(sc => { scope[sc.id] = row.cells[sc.id]?._computed ?? 0; });

          // Aggregate helpers (operate on entire column)
          const agg = fn => cId => fn(
            table.rows.map(r => r.cells[cId]?._computed).filter(v => typeof v === 'number')
          );
          scope.SUM   = agg(vs => vs.reduce((a, v) => a + v, 0));
          scope.AVG   = agg(vs => vs.length ? vs.reduce((a, v) => a + v, 0) / vs.length : 0);
          scope.MAX   = agg(vs => vs.length ? Math.max(...vs) : 0);
          scope.MIN   = agg(vs => vs.length ? Math.min(...vs) : 0);
          scope.COUNT = cId => table.rows.filter(r => r.cells[cId]?._computed !== undefined).length;
          scope.ROW   = rIdx + 1;
          scope.ABS   = Math.abs;
          scope.ROUND = Math.round;
          scope.FLOOR = Math.floor;
          scope.CEIL  = Math.ceil;
          scope.SQRT  = Math.sqrt;
          scope.IF    = (cond, a, b) => cond ? a : b;

          // eslint-disable-next-line no-new-func
          const result = new Function(...Object.keys(scope), `"use strict";return(${c.formula.slice(1)});`)(...Object.values(scope));
          if (c._computed !== result) { c._computed = result; changed = true; }
        } catch {
          if (c._computed !== '#ERR') { c._computed = '#ERR'; c._err = true; changed = true; }
        }
      });
    });
    if (!changed) break;
  }
}

// ── Number formatting ──────────────────────────────────────────────────────────
function ssFmt(v) {
  if (v === '#ERR') return v;
  if (typeof v === 'number') {
    if (!isFinite(v)) return '#NUM';
    return v.toLocaleString('en-IN', { maximumFractionDigits: 4 });
  }
  return String(v ?? '');
}

// ── Render all tables ──────────────────────────────────────────────────────────
function renderSmartSheet() {
  const wrap = document.getElementById('ss-tables');
  if (!wrap) return;
  wrap.innerHTML = '';
  D.smartsheet.tables.forEach((t, i) => ssRenderOne(t, i, wrap));

  const addBtn = document.createElement('button');
  addBtn.className = 'ss-add-tbl-btn';
  addBtn.textContent = '+ Add New Table';
  addBtn.onclick = () => ssAddTable();
  wrap.appendChild(addBtn);

  ssUpdateAILabel();
}

// ── Render one table ───────────────────────────────────────────────────────────
function ssRenderOne(table, tIdx, wrap) {
  ssEvalTable(table);

  const card = document.createElement('div');
  card.className = 'ss-card';

  // ── Table title bar
  const bar = document.createElement('div');
  bar.className = 'ss-bar';

  const nameIn = document.createElement('input');
  nameIn.className = 'ss-tbl-name';
  nameIn.value = table.name;
  nameIn.onblur = () => { table.name = nameIn.value.trim() || table.name; };

  const delTbl = document.createElement('button');
  delTbl.className = 'ss-icon-btn danger';
  delTbl.title = 'Delete table';
  delTbl.textContent = '✕';
  delTbl.onclick = () => {
    if (confirm(`Delete table "${table.name}"?`)) {
      D.smartsheet.tables.splice(tIdx, 1);
      renderSmartSheet();
    }
  };

  bar.appendChild(nameIn);
  bar.appendChild(delTbl);
  card.appendChild(bar);

  // ── Table element
  const tbl = document.createElement('table');
  tbl.className = 'ss-tbl';

  // Header
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  htr.innerHTML = '<th class="ss-rc"></th>';

  table.cols.forEach((col, cIdx) => {
    const th = document.createElement('th');
    th.className = 'ss-ch';

    const lbl = document.createElement('input');
    lbl.className = 'ss-ch-input';
    lbl.value = col.label;
    lbl.title = `Column ID: ${col.id}`;
    lbl.onblur = () => { col.label = lbl.value.trim() || col.label; };

    const delCol = document.createElement('span');
    delCol.className = 'ss-del-col';
    delCol.textContent = '✕';
    delCol.title = 'Delete column';
    delCol.onclick = () => {
      table.cols.splice(cIdx, 1);
      table.rows.forEach(r => delete r.cells[col.id]);
      renderSmartSheet();
    };

    th.appendChild(lbl);
    th.appendChild(delCol);
    htr.appendChild(th);
  });

  const addColTh = document.createElement('th');
  addColTh.className = 'ss-add-col';
  addColTh.textContent = '+';
  addColTh.title = 'Add column';
  addColTh.onclick = () => ssAddCol(tIdx);
  htr.appendChild(addColTh);
  thead.appendChild(htr);
  tbl.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  table.rows.forEach((row, rIdx) => {
    const tr = document.createElement('tr');

    // Row delete button
    const rc = document.createElement('td');
    rc.className = 'ss-rc';
    const delRow = document.createElement('button');
    delRow.className = 'ss-del-row';
    delRow.textContent = '×';
    delRow.title = 'Delete row';
    delRow.onclick = () => { table.rows.splice(rIdx, 1); renderSmartSheet(); };
    rc.appendChild(delRow);
    tr.appendChild(rc);

    table.cols.forEach(col => {
      const td = ssRenderCell(table, tIdx, row, rIdx, col);
      tr.appendChild(td);
    });

    const spacer = document.createElement('td');
    spacer.className = 'ss-spacer';
    tr.appendChild(spacer);
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);

  // Footer
  const tfoot = document.createElement('tfoot');

  // Totals row (only numeric columns)
  const totTr = document.createElement('tr');
  totTr.innerHTML = '<td class="ss-rc"></td>';
  let anyNum = false;
  table.cols.forEach(col => {
    const vals = table.rows.map(r => r.cells[col.id]?._computed).filter(v => typeof v === 'number');
    const td = document.createElement('td');
    td.className = 'ss-tot';
    if (vals.length > 1) {
      td.textContent = 'Σ ' + ssFmt(vals.reduce((a, v) => a + v, 0));
      anyNum = true;
    }
    totTr.appendChild(td);
  });
  const spaceTot = document.createElement('td'); spaceTot.className = 'ss-spacer';
  totTr.appendChild(spaceTot);
  if (anyNum) tfoot.appendChild(totTr);

  // Add row button
  const addTr = document.createElement('tr');
  const addTd = document.createElement('td');
  addTd.colSpan = table.cols.length + 2;
  addTd.className = 'ss-add-row-td';
  const addBtn = document.createElement('button');
  addBtn.className = 'ss-add-row-btn';
  addBtn.textContent = '+ Add Row';
  addBtn.onclick = () => ssAddRow(tIdx);
  addTd.appendChild(addBtn);
  addTr.appendChild(addTd);
  tfoot.appendChild(addTr);

  tbl.appendChild(tfoot);
  card.appendChild(tbl);
  wrap.appendChild(card);
}

// ── Render a single cell ───────────────────────────────────────────────────────
function ssRenderCell(table, tIdx, row, rIdx, col) {
  const cell = row.cells[col.id];
  const isFormula = !!cell.formula;
  const isActive  = ssActive && ssActive.tIdx === tIdx && ssActive.rIdx === rIdx && ssActive.colId === col.id;
  const hasComment = !!(cell.comment && cell.comment.trim());

  const td = document.createElement('td');
  td.className = 'ss-cell' + (isFormula ? ' ss-fc' : '') + (isActive ? ' ss-sel' : '') + (cell._err ? ' ss-err-cell' : '');

  // Formula badge
  if (isFormula) {
    const badge = document.createElement('span');
    badge.className = 'ss-fbadge';
    badge.textContent = 'ƒ';
    badge.title = cell.formula;
    td.appendChild(badge);
  }

  // Value span
  const val = document.createElement('span');
  val.className = 'ss-val' + (cell._err ? ' ss-err' : '');
  val.textContent = ssFmt(cell._computed ?? (cell.val ?? ''));
  td.appendChild(val);

  // Comment dot
  const dot = document.createElement('span');
  dot.className = 'ss-dot' + (hasComment ? ' ss-dot-on' : '');
  dot.title = hasComment ? cell.comment : 'Add comment';
  dot.textContent = hasComment ? '💬' : '⋯';
  dot.onclick = e => { e.stopPropagation(); ssToggleCmt(td, cell); };
  td.appendChild(dot);

  // Click to edit cell value/formula
  td.onclick = () => ssEditCell(td, cell, tIdx, rIdx, col.id, table);

  return td;
}

// ── Cell editing ───────────────────────────────────────────────────────────────
function ssEditCell(td, cell, tIdx, rIdx, colId, table) {
  // Close any open comment popover
  if (ssCmtPop) { ssCmtPop.remove(); ssCmtPop = null; }

  // Close previous cell edit
  if (ssCurEdit) { ssCurEdit(); }

  // Update active target
  ssActive = { tIdx, rIdx, colId };
  ssUpdateAILabel();

  // Mark selection visually
  document.querySelectorAll('.ss-cell.ss-sel').forEach(el => el.classList.remove('ss-sel'));
  td.classList.add('ss-sel');

  // Build input
  const input = document.createElement('input');
  const startVal = cell.formula || (cell.val != null ? String(cell.val) : '');
  input.value = startVal;
  const isF = startVal.startsWith('=');
  input.className = 'ss-input' + (isF ? ' ss-input-f' : '');

  // Hide display elements
  td.querySelectorAll('.ss-val, .ss-fbadge').forEach(el => el.style.display = 'none');
  td.insertBefore(input, td.firstChild);
  input.focus();
  input.select();

  input.oninput = () => {
    const f = input.value.startsWith('=');
    input.className = 'ss-input' + (f ? ' ss-input-f' : '');
  };

  function commit() {
    ssCurEdit = null;
    const raw = input.value.trim();
    if (raw.startsWith('=')) {
      cell.formula = raw;
      cell.val     = null;
    } else if (raw === '') {
      cell.formula = null;
      cell.val     = '';
    } else {
      cell.formula = null;
      const n = parseFloat(raw);
      cell.val = isNaN(n) ? raw : n;
    }
    renderSmartSheet();
  }

  function cancel() {
    ssCurEdit = null;
    renderSmartSheet();
  }

  ssCurEdit = cancel;

  input.onblur  = commit;
  input.onkeydown = e => {
    if (e.key === 'Enter')  { e.preventDefault(); input.onblur = null; commit(); }
    if (e.key === 'Escape') { input.onblur = null; cancel(); }
    if (e.key === 'Tab') {
      e.preventDefault();
      input.onblur = null;
      commit();
      // Move to next column
      const cols = table.cols;
      const cIdx = cols.findIndex(c => c.id === colId);
      if (cIdx < cols.length - 1) {
        const nextCol = cols[cIdx + 1];
        const row = table.rows[rIdx];
        // Re-render then activate next
        setTimeout(() => {
          const nextTd = document.querySelector(`[data-tbl="${table.id}"] [data-rid="${row.id}"] [data-cid="${nextCol.id}"]`);
          if (nextTd) nextTd.click();
        }, 0);
      }
    }
  };
}

// ── Comment popover ────────────────────────────────────────────────────────────
function ssToggleCmt(td, cell) {
  if (ssCmtPop) { ssCmtPop.remove(); ssCmtPop = null; return; }

  const pop = document.createElement('div');
  pop.className = 'ss-cmt-pop';

  const hdr = document.createElement('div');
  hdr.className = 'ss-cmt-hdr';
  hdr.textContent = '💬 Cell Comment';

  const ta = document.createElement('textarea');
  ta.className = 'ss-cmt-ta';
  ta.value = cell.comment || '';
  ta.placeholder = 'Write a comment…';
  ta.rows = 3;

  const row = document.createElement('div');
  row.className = 'ss-cmt-row';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'ss-cmt-save';
  saveBtn.textContent = 'Save';
  saveBtn.onclick = () => {
    cell.comment = ta.value;
    pop.remove(); ssCmtPop = null;
    renderSmartSheet();
  };

  const clearBtn = document.createElement('button');
  clearBtn.className = 'ss-cmt-clear';
  clearBtn.textContent = 'Clear';
  clearBtn.onclick = () => {
    cell.comment = '';
    pop.remove(); ssCmtPop = null;
    renderSmartSheet();
  };

  row.appendChild(saveBtn);
  row.appendChild(clearBtn);
  pop.appendChild(hdr);
  pop.appendChild(ta);
  pop.appendChild(row);

  td.style.position = 'relative';
  td.appendChild(pop);
  ssCmtPop = pop;
  ta.focus();

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('mousedown', function handler(e) {
      if (!pop.contains(e.target)) {
        pop.remove(); ssCmtPop = null;
        document.removeEventListener('mousedown', handler);
      }
    });
  }, 0);
}

// ── Row / Column / Table operations ───────────────────────────────────────────
function ssAddRow(tIdx) {
  const table = D.smartsheet.tables[tIdx];
  const row = { id: ssId(), cells: {} };
  table.cols.forEach(col => { row.cells[col.id] = { val: '', formula: null, comment: '' }; });
  table.rows.push(row);
  renderSmartSheet();
}

function ssAddCol(tIdx) {
  const table = D.smartsheet.tables[tIdx];
  const label = prompt('Column name (will also be the formula ID):', 'New Column');
  if (!label) return;
  let id = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'col';
  let n = 2;
  while (table.cols.find(c => c.id === id)) id = id.replace(/_\d+$/, '') + '_' + n++;
  table.cols.push({ id, label });
  table.rows.forEach(r => { r.cells[id] = { val: '', formula: null, comment: '' }; });
  renderSmartSheet();
}

function ssAddTable() {
  const name = prompt('Table name:', 'New Table');
  if (!name) return;
  D.smartsheet.tables.push({
    id: ssId(),
    name: name.trim(),
    cols: [
      { id: 'item',   label: 'Item'     },
      { id: 'qty',    label: 'Qty'      },
      { id: 'rate',   label: 'Rate (₹)' },
      { id: 'amount', label: 'Amount'   },
      { id: 'notes',  label: 'Notes'    },
    ],
    rows: [
      {
        id: ssId(),
        cells: {
          item:   { val: '',  formula: null,       comment: '' },
          qty:    { val: 1,   formula: null,       comment: '' },
          rate:   { val: 0,   formula: null,       comment: '' },
          amount: { val: null, formula: '=qty*rate', comment: '' },
          notes:  { val: '',  formula: null,       comment: '' },
        }
      }
    ]
  });
  renderSmartSheet();
}

// ── AI Formula label ──────────────────────────────────────────────────────────
function ssUpdateAILabel() {
  const lbl = document.getElementById('ss-ai-cell-label');
  if (!lbl) return;
  if (!ssActive) { lbl.textContent = 'Click any cell below to target it'; return; }
  const t = D.smartsheet.tables[ssActive.tIdx];
  const col = t?.cols.find(c => c.id === ssActive.colId);
  if (t && col) lbl.innerHTML = `Target: <strong>${t.name}</strong> → <strong>${col.label}</strong> <span style="color:#bbb;font-size:9px">(id: ${col.id})</span>`;
}

// ── AI Formula generation ─────────────────────────────────────────────────────
async function ssAskAI() {
  const inputEl   = document.getElementById('ss-ai-input');
  const resultRow = document.getElementById('ss-ai-result-row');
  const resultTxt = document.getElementById('ss-ai-result-text');
  const applyBtn  = document.getElementById('ss-ai-apply');

  const prompt = inputEl.value.trim();
  if (!prompt) { ssShowResult('⚠ Enter a description first.', false); return; }

  if (!ssActive) { ssShowResult('⚠ Click a cell first to set the target.', false); return; }

  const table = D.smartsheet.tables[ssActive.tIdx];
  if (!table) return;
  const colDescs = table.cols.map(c => `${c.id} ("${c.label}")`).join(', ');

  const apiKey = (typeof getApiKey === 'function' ? getApiKey() : '') || D.smartsheet.apiKey || '';
  if (!apiKey) {
    ssShowResult('⚠ No API key set. Use the "AI Key" button in the top bar.', false);
    return;
  }

  ssShowResult('⏳ Generating formula…', false);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 128,
        messages: [{
          role: 'user',
          content:
            `You are a formula generator for a custom spreadsheet. Available column IDs: ${colDescs}. ` +
            `Supported: basic arithmetic (+,-,*,/), SUM(colId), AVG(colId), MAX(colId), MIN(colId), COUNT(colId), ROW (current row 1-based), IF(cond,a,b), ABS, ROUND, FLOOR, CEIL, SQRT. ` +
            `Formulas start with =. Respond with ONLY the formula, nothing else. ` +
            `Request: "${prompt}"`
        }]
      })
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      ssShowResult('✕ API error: ' + (err.error?.message || res.statusText), false);
      return;
    }

    const data = await res.json();
    const formula = (data.content?.[0]?.text || '').trim();
    ssShowResult(formula, true);
  } catch (e) {
    ssShowResult('✕ ' + e.message, false);
  }
}

function ssShowResult(text, showApply) {
  const resultRow = document.getElementById('ss-ai-result-row');
  const resultTxt = document.getElementById('ss-ai-result-text');
  const applyBtn  = document.getElementById('ss-ai-apply');
  resultRow.style.display = 'flex';
  resultTxt.textContent = text;
  if (showApply) {
    applyBtn.dataset.formula = text;
    applyBtn.style.display = 'inline-block';
  } else {
    applyBtn.style.display = 'none';
  }
}

function ssApplyAIFormula() {
  const formula = document.getElementById('ss-ai-apply').dataset.formula;
  if (!formula || !ssActive) return;
  const table = D.smartsheet.tables[ssActive.tIdx];
  const row   = table?.rows[ssActive.rIdx];
  const cell  = row?.cells[ssActive.colId];
  if (!cell) return;
  cell.formula = formula.startsWith('=') ? formula : '=' + formula;
  cell.val     = null;
  ssShowResult('✓ Applied: ' + cell.formula, false);
  renderSmartSheet();
}

function ssAICopy() {
  const text = document.getElementById('ss-ai-result-text')?.textContent || '';
  navigator.clipboard.writeText(text).catch(() => {});
}

// ── Voice input ────────────────────────────────────────────────────────────────
function ssStartVoice() {
  const inputEl  = document.getElementById('ss-ai-input');
  const voiceBtn = document.getElementById('ss-voice-btn');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Voice input requires Chrome or Edge.'); return; }

  const rec = new SR();
  rec.lang = 'en-IN';
  rec.continuous = false;
  rec.interimResults = true;

  voiceBtn.textContent = '🔴 Listening…';
  voiceBtn.classList.add('recording');

  rec.onresult = e => {
    inputEl.value = Array.from(e.results).map(r => r[0].transcript).join('');
  };
  rec.onend = () => {
    voiceBtn.textContent = '🎤 Voice';
    voiceBtn.classList.remove('recording');
  };
  rec.onerror = () => {
    voiceBtn.textContent = '🎤 Voice';
    voiceBtn.classList.remove('recording');
  };
  rec.start();
}

// ── Settings (API key) ─────────────────────────────────────────────────────────
function ssOpenSettings() {
  const overlay = document.getElementById('ss-settings-overlay');
  if (!overlay) return;
  // Pre-fill from shared localStorage key
  const current = (typeof getApiKey === 'function' ? getApiKey() : '') || D.smartsheet.apiKey || '';
  document.getElementById('ss-api-key').value = current;
  overlay.style.display = 'flex';
}

function ssSaveSettings() {
  const key = document.getElementById('ss-api-key').value.trim();
  D.smartsheet.apiKey = key;
  // Save to shared localStorage so all AI features can use it
  if (typeof apiKeyLiveSet === 'function') apiKeyLiveSet(key);
  document.getElementById('ss-settings-overlay').style.display = 'none';
}
