// ── TAB BUILDER ────────────────────────────────────────────────────────────────
// AI-powered content builder for custom tabs.
// Features: text prompt · voice input · image / Excel / PDF upload
//           KPI cards · tables · charts · multi-turn conversation
// Global chart modal is injected once and works on EVERY table in every tab.

// ── Per-tab runtime state ─────────────────────────────────────────────────────
const _TB = {};           // tabId → { blocks, file, history }
const _tbChartReg = {};   // canvasId → Chart.js instance (builder blocks)
let   _tbModalChart = null;
let   _tbModalHeaders = [], _tbModalRows = [];
const _tbThinkTimers = {}; // tabId → interval handle for thinking animation

// ── Built-in KPI span ID → C.xxx formula reference map ───────────────────────
const _BUILTIN_KPI_REFS = {
  'kpi-init':       'C.totalInit',
  'kpi-cur':        'C.totalCur',
  'kpi-exp':        'C.totalExp',
  'kpi-s2-sub1':    'C.s2sub1',
  'kpi-s2-sub2':    'C.s2sub2',
  'kpi-s2-sub3':    'C.s2sub3',
  'kpi-s2-total':   '(C.s2sub1 + C.s2sub2 + C.s2sub3)',
  'kpi-s3-c1':      'C.s3committed1',
  'kpi-s3-c2':      'C.s3committed2',
  'kpi-s3-total':   'C.s3total',
  'kpi-facade-cur': '(C.facadeTotal / 1e7)',
  'kpi-facade-exp': '(C.facadeExp || 0)',
  'kpi-elev-incl':  '(C.elevInclGst / 1e7)',
  'kpi-elev-excl':  '(D.elevators.exclGst / 1e7)',
  'kpi-park-sub':   '(C.parkingSubtotal / 1e7)',
  'kpi-park-gst':   '(C.parkingGST / 1e7)',
  'kpi-park-total': '(C.parkingTotal / 1e7)',
  'kpi-mepf-total': '(C.mepfTotal / 1e7)',
  'kpi-land-total': '(C.landscapeTotal / 1e7)',
  'kpi-elev-incl2': '(C.elevInclGst / 1e7)',
};

// Assign data-tb-kpi="builtin:spanId" to built-in KPI cards for pick mode
function _tbAssignBuiltinKpiRefs() {
  document.querySelectorAll('.kpi-card:not([data-tb-kpi])').forEach(card => {
    const span = card.querySelector('.value span[id]');
    if (!span || !_BUILTIN_KPI_REFS[span.id]) return;
    card.dataset.tbKpi = 'builtin:' + span.id;
  });
}

// Add ⓘ info badges to KPI cards (built-in + custom with formulas)
function _tbAddKpiInfoBadges() {
  // Built-in KPI cards — show formula info popover with Excel-friendly display
  document.querySelectorAll('.kpi-card[data-tb-kpi^="builtin:"]').forEach(card => {
    if (card.querySelector('.tui-kpi-info')) return;
    const spanId = card.dataset.tbKpi.slice(8);
    const formula = _BUILTIN_KPI_REFS[spanId];
    if (!formula) return;
    const valEl = card.querySelector('.value');
    const currentVal = valEl ? valEl.textContent.replace(/fx|ⓘ/g, '').trim() : '';
    const label = card.querySelector('.label')?.textContent.trim() || 'KPI';
    const btn = document.createElement('button');
    btn.className = 'tui-kpi-info';
    btn.title = 'Where does this number come from?';
    btn.textContent = 'ⓘ';
    btn.onclick = e => {
      e.stopPropagation();
      document.querySelector('.tui-fml-pop')?.remove();
      if (typeof _buildFmlPop === 'function') {
        const pop = _buildFmlPop(formula, currentVal, label);
        document.body.appendChild(pop);
        if (typeof _positionFmlPop === 'function') _positionFmlPop(pop, btn);
      }
    };
    card.appendChild(btn);
  });

  // Custom tab KPI cards with formula values — ⓘ directly opens the KPI editor
  document.querySelectorAll('.kpi-card[data-tb-kpi]:not([data-tb-kpi^="builtin:"])').forEach(card => {
    if (card.querySelector('.tui-kpi-info')) return;
    const ref = card.dataset.tbKpi;                   // "tabId:bi:ci"
    const [tabId, biS, ciS] = ref.split(':');
    const bi = parseInt(biS), ci = parseInt(ciS);
    const st = (typeof _tbState === 'function') ? _tbState(tabId) : null;
    if (!st) return;
    const cardData = st.blocks[bi]?.cards?.[ci];
    if (!cardData) return;
    const rawVal = String(cardData.value ?? '');
    if (!rawVal.startsWith('=')) return;              // only formula cards
    const btn = document.createElement('button');
    btn.className = 'tui-kpi-info';
    btn.title = 'View / edit formula';
    btn.textContent = 'ⓘ';
    btn.onclick = e => {
      e.stopPropagation();
      document.querySelector('.tui-fml-pop')?.remove();
      // Open KPI formula panel directly — same as clicking the value
      if (typeof openKpiFp === 'function') {
        openKpiFp(card, tabId, bi, ci, cardData);
      }
    };
    card.appendChild(btn);
  });
}

function _tbState(id) {
  if (!_TB[id]) _TB[id] = { blocks: [], file: null, history: [] };
  return _TB[id];
}

// ── Panel HTML ────────────────────────────────────────────────────────────────
// Called from _updateTabBar in tableops.js for each custom tab.

function tbRenderPanel(tab) {
  const id = tab.id;
  const st = _tbState(id);
  if (Array.isArray(tab.blocks)) st.blocks = JSON.parse(JSON.stringify(tab.blocks));

  const chips = ['3 KPI boxes', 'Add table', 'Bar chart', 'Pie chart', 'Cost breakdown', 'Summary from file'];

  return `
<div class="tb-wrap" id="tb-${id}">

  <div class="card tb-input-card">
    <!-- Mode toggle -->
    <div class="tb-mode-bar">
      <button class="tb-mode-btn active" id="tb-mbtn-ai-${id}"   onclick="tbMode('${id}','ai')">🤖 AI</button>
      <button class="tb-mode-btn"        id="tb-mbtn-man-${id}"  onclick="tbMode('${id}','manual')">✏️ Manual</button>
      <span class="tb-tab-name">${escHtml(tab.name)}</span>
      <span style="margin-left:auto;font-size:10px;color:var(--muted)">Ctrl+Enter to send (AI mode)</span>
    </div>

    <!-- ── AI mode ── -->
    <div id="tb-ai-${id}">
      <div class="tb-prompt-row">
        <textarea id="tb-inp-${id}" class="tb-textarea"
          placeholder='Describe what to build…&#10;e.g. "3 KPI boxes: total cost, budget, variance" or&#10;"extract the table from the uploaded Excel and add a bar chart"'
          onkeydown="if(event.ctrlKey&&event.key==='Enter')tbSend('${id}')"></textarea>
        <div class="tb-side-btns">
          <button class="tb-mic-btn" id="tb-mic-${id}" onclick="tbVoice('${id}')" title="Voice input">🎤</button>
          <button class="tb-send-btn" onclick="tbSend('${id}')">Send</button>
        </div>
      </div>
      <div class="tb-upload-row">
        <label class="tb-upload-lbl" for="tb-file-${id}">📎 Attach — screenshot, Excel (.xlsx), or PDF</label>
        <input type="file" id="tb-file-${id}" class="tb-file-inp"
          accept="image/*,.xlsx,.xls,.pdf"
          onchange="tbFileChosen('${id}',this)">
        <span class="tb-fname" id="tb-fname-${id}"></span>
        <button class="tb-frm" id="tb-frm-${id}" style="display:none" onclick="tbFileClear('${id}')">✕</button>
      </div>
      <div class="tb-chips">
        <span class="tb-chip-lbl">Quick:</span>
        ${chips.map(c => `<button class="tb-chip" onclick="tbChip('${id}',this)">${escHtml(c)}</button>`).join('')}
      </div>
    </div>

    <!-- ── Manual mode ── -->
    <div id="tb-man-${id}" style="display:none">

      <!-- KPI Boxes -->
      <div class="tb-man-section">
        <div class="tb-man-heading">📦 KPI Boxes</div>
        <div id="tb-kpi-rows-${id}" class="tb-kpi-rows">
          ${_tbKpiRowHtml(0)}
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="tb-man-add-row" onclick="tbAddKpiRow('${id}')">+ Add box</button>
          <button class="tb-man-apply" onclick="tbApplyKpi('${id}')">Add KPI Grid to Tab</button>
        </div>
      </div>

      <!-- Table builder -->
      <div class="tb-man-section">
        <div class="tb-man-heading">📋 Table</div>
        <div class="tb-man-row">
          <input class="tb-man-inp" id="tb-tbl-title-${id}" placeholder="Table title (optional)">
          <label class="tb-man-lbl">Columns
            <select id="tb-tbl-cols-${id}" onchange="tbSetCols('${id}')">
              ${[2,3,4,5,6,7,8].map(n=>`<option value="${n}" ${n===4?'selected':''}>${n}</option>`).join('')}
            </select>
          </label>
        </div>
        <div id="tb-tbl-headers-${id}" class="tb-tbl-headers">
          ${[1,2,3,4].map(i=>`<input class="tb-hdr-inp" placeholder="Column ${i}">`).join('')}
        </div>
        <textarea id="tb-tbl-data-${id}" class="tb-tbl-data"
          placeholder="Paste or type data — one row per line, values separated by commas&#10;e.g.&#10;HVAC,12.5,13.2&#10;Electrical,8.4,9.1&#10;Plumbing,6.2,6.8"></textarea>
        <button class="tb-man-apply" onclick="tbApplyTable('${id}')">Add Table to Tab</button>
      </div>

      <!-- Manual chart -->
      <div class="tb-man-section">
        <div class="tb-man-heading">📊 Chart from existing table</div>
        <div class="tb-man-row" style="flex-wrap:wrap;gap:10px">
          <label class="tb-man-lbl">Table
            <select id="tb-crt-tbl-${id}"></select>
          </label>
          <label class="tb-man-lbl">Chart type
            <select id="tb-crt-type-${id}">
              <option value="bar">Bar</option>
              <option value="horizontalBar">Horizontal Bar</option>
              <option value="pie">Pie</option>
              <option value="doughnut">Doughnut</option>
              <option value="line">Line</option>
            </select>
          </label>
          <label class="tb-man-lbl">Label col
            <select id="tb-crt-lbl-${id}"></select>
          </label>
          <label class="tb-man-lbl">Value col(s)
            <div id="tb-crt-vals-${id}" class="tb-vcols" style="margin-top:4px"></div>
          </label>
          <input class="tb-man-inp" id="tb-crt-title-${id}" placeholder="Chart title" style="flex:1;min-width:140px">
        </div>
        <button class="tb-man-apply" onclick="tbApplyChart('${id}')">Add Chart to Tab</button>
      </div>

    </div>
  </div>

  <div class="tb-status" id="tb-st-${id}" style="display:none"></div>
  <div id="tb-content-${id}"></div>

</div>`;
}

// ── Manual mode helpers ───────────────────────────────────────────────────────

function _tbKpiRowHtml(idx) {
  const colors = ['auto','blue','green','red',''];
  const uid = `krow-${Date.now()}-${idx}`;
  return `<div class="tb-kpi-row" id="tb-krow-${idx}">
    <input class="tb-man-inp" placeholder="Label" style="flex:2">
    <div style="display:flex;flex:1;gap:3px;align-items:center">
      <input class="tb-man-inp tb-kpi-val-inp" placeholder="Value or =formula" style="flex:1;font-family:monospace"
        title="Plain value e.g. 450 or formula e.g. =C.totalCur.toFixed(1)">
      <button class="tb-fx-toggle" onclick="_tbToggleKpiFx(this)" title="Toggle formula mode">fx</button>
    </div>
    <input class="tb-man-inp" placeholder="Unit e.g. Cr" style="flex:1">
    <select class="tb-man-sel">
      ${colors.map(c => `<option value="${c === 'auto' ? '' : c}">${c}</option>`).join('')}
    </select>
    <button class="tb-krow-del" onclick="this.closest('.tb-kpi-row').remove()" title="Remove">✕</button>
  </div>`;
}

function _tbToggleKpiFx(btn) {
  const inp = btn.previousElementSibling;
  if (!inp) return;
  const on = btn.classList.toggle('active');
  inp.style.background = on ? '#fffbe6' : '';
  inp.style.borderColor = on ? '#f59e0b' : '';
  if (on && !inp.value.startsWith('=')) inp.value = '=' + inp.value;
  if (!on && inp.value.startsWith('=')) inp.value = inp.value.slice(1);
  inp.focus();
}

let _tbKpiRowCount = 1;
function tbAddKpiRow(tabId) {
  const container = document.getElementById(`tb-kpi-rows-${tabId}`);
  if (!container) return;
  const div = document.createElement('div');
  div.innerHTML = _tbKpiRowHtml(_tbKpiRowCount++);
  container.appendChild(div.firstElementChild);
}

function tbApplyKpi(tabId) {
  const rows = document.querySelectorAll(`#tb-kpi-rows-${tabId} .tb-kpi-row`);
  const cards = [...rows].map(row => {
    const labelInp = row.querySelector('input:first-of-type');
    const valInp   = row.querySelector('.tb-kpi-val-inp');
    const unitInp  = row.querySelectorAll('input')[2];
    const sel      = row.querySelector('select');
    return {
      label: labelInp?.value.trim() || '',
      value: valInp?.value.trim()   || '',
      unit:  unitInp?.value.trim()  || '',
      color: sel?.value || ''
    };
  }).filter(c => c.label || c.value);
  if (!cards.length) return;
  _tbAddBlock(tabId, { type: 'kpi-grid', cards });
}

function tbSetCols(tabId) {
  const n   = +document.getElementById(`tb-tbl-cols-${tabId}`).value;
  const div = document.getElementById(`tb-tbl-headers-${tabId}`);
  div.innerHTML = Array.from({length: n}, (_, i) => `<input class="tb-hdr-inp" placeholder="Column ${i+1}">`).join('');
}

function tbApplyTable(tabId) {
  const title   = document.getElementById(`tb-tbl-title-${tabId}`)?.value.trim() || '';
  const hdrs    = [...document.querySelectorAll(`#tb-tbl-headers-${tabId} input`)].map(i => i.value.trim() || `Col ${i}`);
  const rawData = document.getElementById(`tb-tbl-data-${tabId}`)?.value.trim() || '';
  if (!rawData) { tbSetStatus(tabId, '⚠ Enter some data rows first.', 3000); return; }
  const rows = rawData.split('\n').filter(Boolean).map(line =>
    line.split(/,|\t/).map(v => v.trim())
  );
  _tbAddBlock(tabId, { type: 'table', title, headers: hdrs, rows });
}

function tbApplyChart(tabId) {
  const st      = _tbState(tabId);
  const tblSel  = document.getElementById(`tb-crt-tbl-${tabId}`);
  const typeSel = document.getElementById(`tb-crt-type-${tabId}`);
  const lblSel  = document.getElementById(`tb-crt-lbl-${tabId}`);
  const valDiv  = document.getElementById(`tb-crt-vals-${tabId}`);
  const title   = document.getElementById(`tb-crt-title-${tabId}`)?.value.trim() || 'Chart';
  if (!tblSel || tblSel.value === '') { tbSetStatus(tabId, '⚠ Add a table first.', 3000); return; }
  const tbl     = st.blocks[+tblSel.value];
  if (!tbl) return;
  const valCols = [...(valDiv?.querySelectorAll('input:checked') || [])].map(cb => +cb.value);
  _tbAddBlock(tabId, {
    type: 'chart', chartType: typeSel.value, title,
    headers: tbl.headers, rows: tbl.rows,
    labelCol: +(lblSel?.value ?? 0), valueCols: valCols.length ? valCols : [1]
  });
}

// Refresh the table selector in manual chart section
function _tbRefreshChartSelector(tabId) {
  const st     = _tbState(tabId);
  const tblSel = document.getElementById(`tb-crt-tbl-${tabId}`);
  const lblSel = document.getElementById(`tb-crt-lbl-${tabId}`);
  const valDiv = document.getElementById(`tb-crt-vals-${tabId}`);
  if (!tblSel) return;
  const tables = st.blocks.map((b, i) => ({ i, b })).filter(({b}) => b.type === 'table');
  tblSel.innerHTML = tables.length
    ? tables.map(({i, b}) => `<option value="${i}">${b.title || 'Table ' + (i+1)}</option>`).join('')
    : '<option value="">— no tables yet —</option>';
  // Populate label/value cols for first table
  const first = tables[0]?.b;
  if (first && lblSel && valDiv) {
    lblSel.innerHTML = (first.headers || []).map((h, i) => `<option value="${i}">${h || 'Col '+(i+1)}</option>`).join('');
    valDiv.innerHTML = (first.headers || []).map((h, i) => `
      <label class="tb-vcb"><input type="checkbox" value="${i}" ${i > 0 ? 'checked' : ''}> ${escHtml(h || 'Col '+(i+1))}</label>`).join('');
  }
}

function tbMode(tabId, mode) {
  const aiDiv  = document.getElementById(`tb-ai-${tabId}`);
  const manDiv = document.getElementById(`tb-man-${tabId}`);
  const aiBtn  = document.getElementById(`tb-mbtn-ai-${tabId}`);
  const manBtn = document.getElementById(`tb-mbtn-man-${tabId}`);
  if (!aiDiv || !manDiv) return;
  if (mode === 'ai') {
    aiDiv.style.display  = '';  manDiv.style.display = 'none';
    aiBtn.classList.add('active');    manBtn.classList.remove('active');
  } else {
    aiDiv.style.display  = 'none';  manDiv.style.display = '';
    manBtn.classList.add('active');   aiBtn.classList.remove('active');
    _tbRefreshChartSelector(tabId);
  }
}

function _tbAddBlock(tabId, block) {
  const st = _tbState(tabId);
  if (block.type === 'kpi-grid') {
    const firstNonKpi = st.blocks.findIndex(b => b.type !== 'kpi-grid');
    if (firstNonKpi === -1) st.blocks.push(block);
    else st.blocks.splice(firstNonKpi, 0, block);
  } else {
    st.blocks.push(block);
  }
  const tab = TUI.customTabs.find(t => t.id === tabId);
  if (tab) tab.blocks = JSON.parse(JSON.stringify(st.blocks));
  tbPaintContent(tabId);
  _tbRefreshChartSelector(tabId);
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

// ── Paint content blocks ──────────────────────────────────────────────────────
function tbPaintContent(tabId) {
  const el = document.getElementById(`tb-content-${tabId}`);
  if (!el) return;
  const st = _tbState(tabId);

  // Destroy stale chart instances for this tab
  Object.keys(_tbChartReg).filter(k => k.startsWith(`tbc-${tabId}-`)).forEach(k => {
    try { _tbChartReg[k].destroy(); } catch(_) {}
    delete _tbChartReg[k];
  });

  if (!st.blocks.length) {
    el.innerHTML = `<div class="tb-empty">
      No content yet — describe what you want above, or attach a file.<br>
      <span style="font-size:11px;color:var(--muted)">You can paste a screenshot, upload an Excel sheet, or drop a PDF.</span>
    </div>`;
    return;
  }

  el.innerHTML = st.blocks.map((b, i) => _tbBlockHtml(b, tabId, i)).join('');

  // Instantiate Chart.js for chart blocks
  st.blocks.forEach((b, i) => {
    if (b.type !== 'chart') return;
    const cv = document.getElementById(`tbc-${tabId}-${i}`);
    if (cv) _tbChartReg[`tbc-${tabId}-${i}`] = _tbMakeChart(cv, b);
  });
}

// ── Block HTML ────────────────────────────────────────────────────────────────
function _tbBlockHtml(b, tabId, i) {
  const del = `<button class="tb-del-blk" onclick="tbDelBlock('${tabId}',${i})" title="Remove block">✕</button>`;

  if (b.type === 'kpi-grid') {
    const CLS = ['blue','green','red','','',''];
    const cards = (b.cards || []).map((c, ci) => {
      const rawVal = String(c.value ?? '—');
      const isFormula = rawVal.startsWith('=');
      const displayVal = isFormula ? _tbEvalKpiValue(rawVal) : rawVal;
      const fxBadge = isFormula
        ? `<span class="tb-fx-badge" title="Click to see formula" onclick="_tbShowKpiFxPop(this,'${escHtml(rawVal)}','${escHtml(displayVal)}')">fx</span>`
        : '';
      return `
      <div class="kpi-card ${c.color || CLS[ci % CLS.length]}" data-tb-kpi="${tabId}:${i}:${ci}">
        <div class="label tb-editable" contenteditable="true" spellcheck="false"
             onblur="_tbKpiFieldBlur(event,'${tabId}',${i},${ci},'label')"
             >${escHtml(c.label || '')}</div>
        <div class="value tb-kpi-val-cell"
             onclick="_tbKpiValClick(event,'${tabId}',${i},${ci})"
             title="${isFormula ? escHtml(rawVal) : 'Click to edit'}"
             >${escHtml(displayVal)}${fxBadge}</div>
        <div class="unit tb-editable" contenteditable="true" spellcheck="false"
             data-placeholder="unit…"
             onblur="_tbKpiFieldBlur(event,'${tabId}',${i},${ci},'unit')"
             >${escHtml(c.unit || '')}</div>
      </div>`;
    }).join('');
    return `<div class="kpi-grid tb-blk" data-bi="${i}" style="position:relative">
      ${cards}
      <div class="tb-blk-del">${del}</div>
    </div>`;
  }

  if (b.type === 'table') {
    const hdr = (b.headers || []).map((h, hi) =>
      `<th contenteditable="true" spellcheck="false"
           onblur="_tbHdrBlur(event,'${tabId}',${i},${hi})"
           >${escHtml(String(h))}</th>`
    ).join('');
    const body = (b.rows || []).map((r, ri) =>
      `<tr>${(r || []).map((c, ci) =>
        `<td contenteditable="true" spellcheck="false"
             onblur="_tbCellBlur(event,'${tabId}',${i},${ri},${ci})"
             >${escHtml(String(c ?? ''))}</td>`
      ).join('')}</tr>`
    ).join('');
    return `
<div class="card tb-blk" data-bi="${i}">
  <div class="card-title">
    <span class="tb-editable" contenteditable="true" spellcheck="false"
          onblur="_tbTitleBlur(event,'${tabId}',${i})">${escHtml(b.title || 'Table')}</span>
    <div style="display:flex;gap:6px;align-items:center">
      <button class="tb-from-tbl-btn" onclick="tbChartFromBlock('${tabId}',${i})" title="Visualize as chart">📊 Chart</button>
      ${del}
    </div>
  </div>
  <div class="table-wrap">
    <table class="data-table">
      <thead><tr>${hdr}</tr></thead>
      <tbody>${body}</tbody>
    </table>
  </div>
</div>`;
  }

  if (b.type === 'chart') {
    const cid = `tbc-${tabId}-${i}`;
    return `
<div class="card tb-blk" data-bi="${i}">
  <div class="card-title">
    <span class="tb-editable" contenteditable="true" spellcheck="false"
          onblur="_tbTitleBlur(event,'${tabId}',${i})">${escHtml(b.title || 'Chart')}</span>
    ${del}
  </div>
  <div class="chart-box" style="height:300px"><canvas id="${cid}"></canvas></div>
</div>`;
  }

  if (b.type === 'text') {
    return `<div class="card tb-blk" data-bi="${i}">
      <div class="tb-blk-del">${del}</div>
      <div style="font-size:13px;line-height:1.6">${b.html || escHtml(b.text || '')}</div>
    </div>`;
  }

  return '';
}

// ── Inline edit handlers for custom tab blocks ────────────────────────────────

function _tbSaveBlock(tabId, bi) {
  const st = _tbState(tabId);
  const tab = TUI.customTabs.find(t => t.id === tabId);
  if (tab) tab.blocks = JSON.parse(JSON.stringify(st.blocks));
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

function _tbHdrBlur(e, tabId, bi, hi) {
  const st = _tbState(tabId);
  const blk = st.blocks[bi];
  if (!blk || blk.type !== 'table') return;
  blk.headers[hi] = e.target.textContent.trim();
  _tbSaveBlock(tabId, bi);
}

function _tbCellBlur(e, tabId, bi, ri, ci) {
  const st = _tbState(tabId);
  const blk = st.blocks[bi];
  if (!blk || !blk.rows?.[ri]) return;
  blk.rows[ri][ci] = e.target.textContent.trim();
  _tbSaveBlock(tabId, bi);
}

function _tbTitleBlur(e, tabId, bi) {
  const st = _tbState(tabId);
  const blk = st.blocks[bi];
  if (!blk) return;
  blk.title = e.target.textContent.trim();
  _tbSaveBlock(tabId, bi);
}

function _tbKpiFieldBlur(e, tabId, bi, ci, field) {
  const st = _tbState(tabId);
  const blk = st.blocks[bi];
  if (!blk?.cards?.[ci]) return;
  blk.cards[ci][field] = e.target.textContent.trim();
  _tbSaveBlock(tabId, bi);
}

// ── KPI formula evaluator ─────────────────────────────────────────────────────
// Helper functions available inside KPI formulas (Excel-like names)
const _TB_FN = {
  SUM:   (...a) => a.flat().reduce((s, v) => s + (parseFloat(v) || 0), 0),
  AVG:   (...a) => { const f = a.flat(); const s = f.reduce((x, v) => x + (parseFloat(v) || 0), 0); return f.length ? s / f.length : 0; },
  MIN:   (...a) => Math.min(...a.flat().map(v => parseFloat(v) || 0)),
  MAX:   (...a) => Math.max(...a.flat().map(v => parseFloat(v) || 0)),
  IF:    (cond, t, f) => cond ? t : f,
  ROUND: (n, d) => d !== undefined ? +parseFloat(n).toFixed(Math.max(0, d)) : Math.round(n),
  ABS:   n => Math.abs(parseFloat(n) || 0),
  COUNT: (...a) => a.flat().filter(v => v !== null && v !== undefined && v !== '').length,
  SQRT:  n => Math.sqrt(parseFloat(n) || 0),
  POW:   (b, e) => Math.pow(parseFloat(b) || 0, parseFloat(e) || 1),
};

function _tbEvalKpiValue(val) {
  if (!val || !String(val).startsWith('=')) return val;
  try {
    const expr = String(val).slice(1);
    const fnNames = Object.keys(_TB_FN);
    const fnVals  = Object.values(_TB_FN);
    const fn = new Function('D', 'C', ...fnNames, `"use strict"; return (${expr})`);
    const result = fn(
      typeof D !== 'undefined' ? D : {},
      typeof C !== 'undefined' ? C : {},
      ...fnVals
    );
    if (result === null || result === undefined) return '—';
    return typeof result === 'number' ? result.toFixed(2) : String(result);
  } catch (e) {
    return '⚠ err';
  }
}

// ── Clarifying questions bubble ───────────────────────────────────────────────
function _tbShowClarify(tabId, questions, originalPrompt) {
  const contentEl = document.getElementById(`tb-content-${tabId}`);
  if (!contentEl) return;

  contentEl.querySelector('.tb-clarify-bubble')?.remove();

  // Normalise: accept plain strings or {q, opts} objects
  const items = (questions || []).map(q =>
    typeof q === 'string' ? { q, opts: [] } : q
  );

  const bubble = document.createElement('div');
  bubble.className = 'card tb-clarify-bubble';
  bubble.dataset.tabId = tabId;
  bubble.innerHTML = `
    <div class="tb-clarify-hdr">🤔 A few questions before I build:</div>
    <div class="tb-clarify-q-list">
      ${items.map((item, i) => `
        <div class="tb-clarify-item" data-qi="${i}">
          <div class="tb-clarify-q">
            <span class="tb-clarify-num">${i + 1}</span>
            <span>${escHtml(item.q)}</span>
          </div>
          <div class="tb-cq-opts">
            ${(item.opts || []).map(opt =>
              `<button class="tb-cq-opt" onclick="_tbToggleCqOpt(this)">${escHtml(opt)}</button>`
            ).join('')}
            <button class="tb-cq-other-btn" onclick="_tbClarifyOther(this)">Other…</button>
            <input class="tb-cq-other-inp" placeholder="Type your answer…" style="display:none">
          </div>
        </div>`
      ).join('')}
    </div>
    <div class="tb-clarify-build-row">
      <button class="tb-clarify-build" onclick="_tbClarifyBuild('${tabId}', this)">▶ Build with my answers</button>
      <span class="tb-clarify-skip">or type more detail above and Send ↑</span>
    </div>`;

  contentEl.insertBefore(bubble, contentEl.firstChild);

  const inp = document.getElementById(`tb-inp-${tabId}`);
  if (inp && originalPrompt) inp.value = originalPrompt + '\n';
  inp?.focus();
}

function _tbToggleCqOpt(btn) {
  // Deselect sibling opts (single-select per question)
  btn.closest('.tb-cq-opts')?.querySelectorAll('.tb-cq-opt.selected').forEach(b => {
    if (b !== btn) b.classList.remove('selected');
  });
  btn.classList.toggle('selected');
}

function _tbClarifyOther(btn) {
  const inp = btn.nextElementSibling;
  if (!inp) return;
  const show = inp.style.display === 'none';
  inp.style.display = show ? '' : 'none';
  btn.classList.toggle('active', show);
  if (show) inp.focus();
}

function _tbClarifyBuild(tabId, btn) {
  const bubble = btn.closest('.tb-clarify-bubble');
  if (!bubble) return;

  const answers = [...bubble.querySelectorAll('.tb-clarify-item')].map(item => {
    const qText   = item.querySelector('.tb-clarify-q span:last-child')?.textContent?.trim() || '';
    const selOpt  = item.querySelector('.tb-cq-opt.selected')?.textContent?.trim() || '';
    const otherEl = item.querySelector('.tb-cq-other-inp');
    const otherOn = otherEl && otherEl.style.display !== 'none';
    const answer  = (otherOn && otherEl.value.trim()) ? otherEl.value.trim() : selOpt;
    return answer ? `${qText}: ${answer}` : null;
  }).filter(Boolean);

  bubble.remove();

  const inp = document.getElementById(`tb-inp-${tabId}`);
  if (inp) {
    inp.value = answers.length
      ? `Here are my answers:\n${answers.join('\n')}\nPlease build the content now.`
      : inp.value || 'Please build the content now.';
  }
  tbSend(tabId);
}

// ── Build Chart.js instance ───────────────────────────────────────────────────
const _TB_COLORS = ['#ffc000','#0d6efd','#28a745','#dc3545','#fd7e14','#6610f2','#0dcaf0','#6c757d','#198754','#d63384','#20c997','#6f42c1'];

function _tbMakeChart(canvas, b) {
  const lc   = b.labelCol ?? 0;
  const vcs  = Array.isArray(b.valueCols) ? b.valueCols : [b.valueCol ?? 1];
  const rows  = b.rows || [];
  const labels = rows.map(r => String(r[lc] ?? ''));
  const isPolar = ['pie','doughnut'].includes(b.chartType);
  const isHoriz = b.chartType === 'horizontalBar';
  const type    = isHoriz ? 'bar' : (b.chartType || 'bar');

  const datasets = vcs.map((vc, di) => ({
    label: (b.headers || [])[vc] || `Col ${vc + 1}`,
    data: rows.map(r => parseFloat(String(r[vc] ?? '').replace(/[₹,\s]/g, '')) || 0),
    backgroundColor: isPolar ? _TB_COLORS : (_TB_COLORS[di % _TB_COLORS.length] + 'cc'),
    borderColor: isPolar ? _TB_COLORS.map(c => c) : _TB_COLORS[di % _TB_COLORS.length],
    borderWidth: 1
  }));

  return new Chart(canvas, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: isHoriz ? 'y' : 'x',
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } } },
      scales: isPolar ? {} : {
        x: { ticks: { font: { size: 9 } } },
        y: { ticks: { font: { size: 9 } } }
      }
    }
  });
}

// ── Thinking animation ────────────────────────────────────────────────────────
function _tbShowThinking(tabId) {
  _tbClearThinking(tabId);

  const stEl = document.getElementById(`tb-st-${tabId}`);
  if (stEl) {
    stEl.style.display = '';
    stEl.className = 'tb-status tb-thinking-bar';
    stEl.innerHTML = `
      <div class="tb-th-spinner"></div>
      <span class="tb-th-msg" id="tb-th-msg-${tabId}">Sending request…</span>
      <div class="tb-th-dots"><span></span><span></span><span></span></div>`;
  }

  // Skeleton placeholder — only when content is empty (no blocks built yet)
  const contentEl = document.getElementById(`tb-content-${tabId}`);
  if (contentEl && !contentEl.querySelector('.tb-blk')) {
    contentEl.innerHTML = `
      <div class="tb-skeleton-wrap">
        <div class="tb-skel-kpi-row">
          <div class="tb-skel tb-skel-kpi"></div>
          <div class="tb-skel tb-skel-kpi"></div>
          <div class="tb-skel tb-skel-kpi"></div>
        </div>
        <div class="tb-skel tb-skel-card" style="height:110px"></div>
        <div class="tb-skel tb-skel-card" style="height:190px"></div>
      </div>`;
  }

  const msgs = ['Sending request…', 'Analysing request…', 'Generating content…', 'Almost there…'];
  let i = 0;
  _tbThinkTimers[tabId] = setInterval(() => {
    const el = document.getElementById(`tb-th-msg-${tabId}`);
    if (!el) { clearInterval(_tbThinkTimers[tabId]); return; }
    i = (i + 1) % msgs.length;
    el.textContent = msgs[i];
  }, 1400);
}

function _tbClearThinking(tabId) {
  clearInterval(_tbThinkTimers[tabId]);
  delete _tbThinkTimers[tabId];
  const contentEl = document.getElementById(`tb-content-${tabId}`);
  contentEl?.querySelector('.tb-skeleton-wrap')?.remove();
  const stEl = document.getElementById(`tb-st-${tabId}`);
  if (stEl) stEl.className = 'tb-status';
}

// ── Send to AI ────────────────────────────────────────────────────────────────
async function tbSend(tabId) {
  const inp    = document.getElementById(`tb-inp-${tabId}`);
  const prompt = inp?.value.trim() || '';
  const st     = _tbState(tabId);

  if (!prompt && !st.file) { inp?.focus(); return; }

  inp.disabled = true;
  _tbShowThinking(tabId);

  try {
    const content = [];

    // Attach uploaded file
    if (st.file) {
      if (st.file.mediaType === 'application/pdf') {
        content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: st.file.data } });
      } else if (st.file.mediaType.startsWith('image/')) {
        content.push({ type: 'image', source: { type: 'base64', media_type: st.file.mediaType, data: st.file.data } });
      } else {
        content.push({ type: 'text', text: `File contents (${st.file.name}):\n\n${st.file.data}` });
      }
    }

    if (prompt) content.push({ type: 'text', text: prompt });
    if (!content.length) { tbSetStatus(tabId, ''); inp.disabled = false; return; }

    const system = `You are an AI assistant helping build dashboard content for a construction cost dashboard.
Return ONLY valid JSON — no markdown fences, no prose outside the JSON.

JSON structure:
{
  "clarify": [{"q": "question text", "opts": ["Option A", "Option B", "Option C"]}, ...] | null,
  "kpiCards": [{"label":"...","value":"...","unit":"...","color":"blue|green|red|"}] | null,
  "tables":   [{"title":"...","headers":["Col1","Col2"],"rows":[["v1","v2"],...]}],
  "charts":   [{"chartType":"bar|horizontalBar|pie|doughnut|line","title":"...","tableIndex":0,"labelCol":0,"valueCols":[1]}],
  "message":  "one-line summary"
}

CRITICAL RULES — read carefully:
1. If the user's request is VAGUE (they don't provide the actual data, labels, or values), set "clarify" to a list of 2-3 targeted questions. Each question must include 2-4 short option chips the user can pick from (keep opts concise, max 4 words each). Ask BEFORE generating. Do NOT invent fake/demo values.
   Examples of vague: "3 KPI boxes", "add a table 4x4", "create some charts"
   Examples of specific: "3 KPI boxes: Total Cost=450Cr, Budget=400Cr, Variance=+50Cr"

2. If a FILE is attached, extract the REAL data from it — never ask for clarification when a file is present.

3. If the user says "blank", "empty", "sample", "example", or "demo" — generate blank/placeholder content without asking.

4. If clarify is set, do NOT generate any kpiCards/tables/charts — just ask the questions.

5. For KPI values: if the user provides a formula like "=C.totalCur.toFixed(1)", store it as-is. The dashboard will evaluate it.

6. tables: always provide headers. Numbers without currency symbols.
7. charts: tableIndex is 0-based index into the tables array above.
8. kpiCards: max 6 boxes.`;

    const historyMessages = [
      ...st.history,
      { role: 'user', content }
    ];

    const raw = await _tbCallClaude(system, historyMessages);
    if (raw === null) {
      _tbClearThinking(tabId);
      tbSetStatus(tabId, '⚠ No API key — click "AI Key" in the top bar to set it.');
      inp.disabled = false;
      return;
    }

    // Extract JSON from response
    let parsed;
    try {
      const m = raw.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(m ? m[0] : raw);
    } catch (e) {
      _tbClearThinking(tabId);
      tbSetStatus(tabId, `⚠ Could not parse AI response. Try rephrasing. (${e.message})`);
      inp.disabled = false;
      return;
    }

    // Update conversation history
    st.history.push({ role: 'user', content: content.map(c => c.type === 'text' ? c : { type: 'text', text: `[${c.type} file attached]` }) });
    st.history.push({ role: 'assistant', content: [{ type: 'text', text: raw }] });
    if (st.history.length > 16) st.history.splice(0, 2);

    // If AI is asking clarifying questions, show them and stop
    if (parsed.clarify?.length) {
      inp.value = '';
      tbFileClear(tabId);
      _tbClearThinking(tabId);
      _tbShowClarify(tabId, parsed.clarify, prompt);
      inp.disabled = false;
      return;
    }

    // Build new blocks
    const newBlocks = [];
    if (parsed.kpiCards?.length) newBlocks.push({ type: 'kpi-grid', cards: parsed.kpiCards });
    (parsed.tables || []).forEach(t => newBlocks.push({ type: 'table', ...t }));
    (parsed.charts || []).forEach(ch => {
      const src = (parsed.tables || [])[ch.tableIndex ?? 0];
      newBlocks.push({
        type:       'chart',
        chartType:  ch.chartType || 'bar',
        title:      ch.title || 'Chart',
        headers:    src?.headers || [],
        rows:       src?.rows    || [],
        labelCol:   ch.labelCol  ?? 0,
        valueCols:  ch.valueCols || [1]
      });
    });

    // KPI grids always precede table/chart blocks
    const _kpiNew   = newBlocks.filter(b => b.type === 'kpi-grid');
    const _otherNew = newBlocks.filter(b => b.type !== 'kpi-grid');
    const _firstNonKpi = st.blocks.findIndex(b => b.type !== 'kpi-grid');
    if (_kpiNew.length) {
      if (_firstNonKpi === -1) st.blocks.push(..._kpiNew);
      else st.blocks.splice(_firstNonKpi, 0, ..._kpiNew);
    }
    st.blocks.push(..._otherNew);

    // Persist blocks to TUI
    const tab = TUI.customTabs.find(t => t.id === tabId);
    if (tab) tab.blocks = JSON.parse(JSON.stringify(st.blocks));

    inp.value = '';
    tbFileClear(tabId);
    _tbClearThinking(tabId);
    tbPaintContent(tabId);
    tbSetStatus(tabId, `✓ ${parsed.message || 'Done'}`, 4000);
    if (typeof fbScheduleSave === 'function') fbScheduleSave();

  } catch (e) {
    console.error('tbSend:', e);
    _tbClearThinking(tabId);
    tbSetStatus(tabId, `⚠ Error: ${e.message}`);
  } finally {
    inp.disabled = false;
  }
}

async function _tbCallClaude(system, messages) {
  const key = (typeof localStorage !== 'undefined' && localStorage.getItem('anthropic_api_key'))
            || window._LOCAL_API_KEY || '';
  if (!key) return null;

  // Check if any message content includes a PDF (needs beta header)
  const hasPdf = messages.some(m => Array.isArray(m.content) &&
    m.content.some(c => c.type === 'document' && c.source?.media_type === 'application/pdf'));

  const headers = {
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'content-type': 'application/json'
  };
  if (hasPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system,
      messages
    })
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error?.message || `HTTP ${resp.status}`);
  return data.content?.[0]?.text || '';
}

// ── File handling ─────────────────────────────────────────────────────────────
function tbFileChosen(tabId, input) {
  const file = input.files[0]; if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  tbSetStatus(tabId, `⏳ Reading ${file.name}…`);

  if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') {
      tbSetStatus(tabId, '⚠ Excel library not loaded yet — try again in a moment.');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const text = wb.SheetNames.map(name => {
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
          return `=== Sheet: ${name} ===\n${csv}`;
        }).join('\n\n');
        _tbSetFile(tabId, file.name, text, 'text/csv');
        tbSetStatus(tabId, `✓ ${file.name} (${wb.SheetNames.length} sheet${wb.SheetNames.length > 1 ? 's' : ''}) ready`);
      } catch (err) {
        tbSetStatus(tabId, `⚠ Could not read Excel: ${err.message}`);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    const mediaType = file.type || (ext === 'pdf' ? 'application/pdf' : 'image/png');
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target.result.split(',')[1];
      _tbSetFile(tabId, file.name, b64, mediaType);
      tbSetStatus(tabId, `✓ ${file.name} attached`);
    };
    reader.readAsDataURL(file);
  }
}

function _tbSetFile(tabId, name, data, mediaType) {
  _tbState(tabId).file = { name, data, mediaType };
  const fname = document.getElementById(`tb-fname-${tabId}`);
  const frm   = document.getElementById(`tb-frm-${tabId}`);
  if (fname) fname.textContent = name;
  if (frm)   frm.style.display = '';
}

function tbFileClear(tabId) {
  _tbState(tabId).file = null;
  const inp   = document.getElementById(`tb-file-${tabId}`);
  const fname = document.getElementById(`tb-fname-${tabId}`);
  const frm   = document.getElementById(`tb-frm-${tabId}`);
  if (inp)   inp.value = '';
  if (fname) fname.textContent = '';
  if (frm)   frm.style.display = 'none';
}

// ── Voice input ───────────────────────────────────────────────────────────────
let _tbVoiceOn = false;
let _tbVoiceRec = null;

function tbVoice(tabId) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert('Voice input requires Chrome or Edge.'); return; }

  const btn = document.getElementById(`tb-mic-${tabId}`);
  const inp = document.getElementById(`tb-inp-${tabId}`);

  if (_tbVoiceOn) {
    _tbVoiceRec?.stop(); _tbVoiceOn = false;
    if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; }
    return;
  }

  const r = new SR();
  r.lang = 'en-IN';
  r.interimResults = true;
  r.continuous = true;
  _tbVoiceRec = r; _tbVoiceOn = true;
  if (btn) { btn.classList.add('recording'); btn.textContent = '⏹'; }

  let accum = inp.value; // text accumulated across restarts
  r.onresult = e => {
    let final = '', interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    if (final) accum += final;
    inp.value = accum + interim;
  };
  r.onerror = ev => {
    // 'no-speech' is normal during pauses — ignore and let onend restart
    if (ev.error === 'no-speech' || ev.error === 'audio-capture') return;
    _tbVoiceOn = false; _tbVoiceRec = null;
    if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; }
  };
  r.onend = () => {
    if (_tbVoiceOn && _tbVoiceRec === r) {
      // Session ended (browser timeout) — restart immediately to stay continuous
      try { r.start(); } catch (_) {}
    } else {
      if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; }
    }
  };
  r.start();
}

// ── Quick chips ───────────────────────────────────────────────────────────────
function tbChip(tabId, btn) {
  const inp = document.getElementById(`tb-inp-${tabId}`);
  if (inp) { inp.value = btn.textContent; inp.focus(); }
}

// ── Block management ──────────────────────────────────────────────────────────
function tbDelBlock(tabId, idx) {
  const st = _tbState(tabId);
  st.blocks.splice(idx, 1);
  const tab = TUI.customTabs.find(t => t.id === tabId);
  if (tab) tab.blocks = JSON.parse(JSON.stringify(st.blocks));
  tbPaintContent(tabId);
  _tbRefreshChartSelector(tabId);
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

function tbChartFromBlock(tabId, tableIdx) {
  const st  = _tbState(tabId);
  const tbl = st.blocks[tableIdx];
  if (!tbl || tbl.type !== 'table') return;
  _tbOpenModal(tbl.headers, tbl.rows);
}

// ── Status bar ────────────────────────────────────────────────────────────────
function tbSetStatus(tabId, msg, clearAfter = 0) {
  const el = document.getElementById(`tb-st-${tabId}`);
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
  if (clearAfter) setTimeout(() => { el.textContent = ''; el.style.display = 'none'; }, clearAfter);
}

// ── Global chart modal (works on EVERY table in every tab) ────────────────────

function tbAddChartBtns() {
  document.querySelectorAll('.card').forEach(card => {
    const title = card.querySelector('.card-title');
    const tbl   = card.querySelector('table');
    if (!title || !tbl || title.querySelector('.tb-gchart-btn')) return;
    const btn = document.createElement('button');
    btn.className = 'tb-gchart-btn';
    btn.title = 'Visualize as chart';
    btn.innerHTML = '📊';
    btn.onclick = e => { e.stopPropagation(); tbOpenChartModal(tbl); };
    title.appendChild(btn);
  });
}

function tbOpenChartModal(tableEl) {
  const headers = [...tableEl.querySelectorAll('thead th')].map(th => th.textContent.trim());
  const rows    = [...tableEl.querySelectorAll('tbody tr')].map(tr =>
    [...tr.querySelectorAll('td')].map(td => td.textContent.trim())
  );
  _tbOpenModal(headers, rows);
}

function _tbOpenModal(headers, rows) {
  _tbModalHeaders = headers;
  _tbModalRows    = rows;

  const modal = document.getElementById('tb-chart-modal');
  if (!modal) return;

  const labelSel = document.getElementById('tb-modal-labelcol');
  labelSel.innerHTML = headers.map((h, i) =>
    `<option value="${i}">${h || 'Col ' + (i + 1)}</option>`
  ).join('');

  const valDiv = document.getElementById('tb-modal-valcols');
  valDiv.innerHTML = headers.map((h, i) => `
    <label class="tb-vcb">
      <input type="checkbox" value="${i}" ${i > 0 ? 'checked' : ''}
        onchange="tbUpdateModalChart()"> ${escHtml(h || 'Col ' + (i + 1))}
    </label>`).join('');

  modal.style.display = 'flex';
  tbUpdateModalChart();
}

function tbUpdateModalChart() {
  const typeSel  = document.getElementById('tb-modal-type');
  const labelSel = document.getElementById('tb-modal-labelcol');
  const valDiv   = document.getElementById('tb-modal-valcols');
  if (!typeSel || !labelSel || !valDiv) return;

  const chartType = typeSel.value;
  const labelCol  = +labelSel.value;
  const valCols   = [...valDiv.querySelectorAll('input:checked')].map(cb => +cb.value);
  if (!valCols.length) return;

  const isPolar = ['pie', 'doughnut'].includes(chartType);
  const isHoriz = chartType === 'horizontalBar';
  const type    = isHoriz ? 'bar' : chartType;

  const labels   = _tbModalRows.map(r => r[labelCol] || '');
  const datasets = valCols.map((vc, di) => ({
    label: _tbModalHeaders[vc] || `Col ${vc + 1}`,
    data:  _tbModalRows.map(r => parseFloat(String(r[vc] || '0').replace(/[₹,\sCr]/g, '')) || 0),
    backgroundColor: isPolar ? _TB_COLORS : _TB_COLORS[di % _TB_COLORS.length] + 'cc',
    borderColor:     isPolar ? _TB_COLORS : _TB_COLORS[di % _TB_COLORS.length],
    borderWidth: 1
  }));

  const cv = document.getElementById('tb-modal-canvas');
  if (!cv) return;
  if (_tbModalChart) { try { _tbModalChart.destroy(); } catch(_) {} _tbModalChart = null; }

  _tbModalChart = new Chart(cv, {
    type,
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: isHoriz ? 'y' : 'x',
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 }, boxWidth: 12 } } },
      scales: isPolar ? {} : {
        x: { ticks: { font: { size: 9 } } },
        y: { ticks: { font: { size: 9 } } }
      }
    }
  });
}

function tbCloseChartModal() {
  const modal = document.getElementById('tb-chart-modal');
  if (modal) modal.style.display = 'none';
  if (_tbModalChart) { try { _tbModalChart.destroy(); } catch(_) {} _tbModalChart = null; }
}

// ── Custom prompt dialog (replaces browser prompt()) ─────────────────────────
// Usage: tbPrompt({ title, label, placeholder, value, confirmText }).then(val => ...)
// Resolves with the entered string, or null if cancelled.

function tbPrompt({ title = 'Enter name', label = '', placeholder = '', value = '', confirmText = 'OK', icon = '✏️' } = {}) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'tbp-overlay';
    overlay.innerHTML = `
<div class="tbp-dialog" role="dialog" aria-modal="true">
  <div class="tbp-header">
    <span class="tbp-icon">${icon}</span>
    <span class="tbp-title">${escHtml(title)}</span>
  </div>
  <div class="tbp-body">
    ${label ? `<label class="tbp-label">${escHtml(label)}</label>` : ''}
    <input class="tbp-input" type="text" value="${escHtml(value)}" placeholder="${escHtml(placeholder)}" autocomplete="off" spellcheck="false">
  </div>
  <div class="tbp-footer">
    <button class="tbp-cancel">Cancel</button>
    <button class="tbp-confirm">${escHtml(confirmText)}</button>
  </div>
</div>`;

    const inp     = overlay.querySelector('.tbp-input');
    const confirm = overlay.querySelector('.tbp-confirm');
    const cancel  = overlay.querySelector('.tbp-cancel');

    const done = val => { overlay.remove(); resolve(val); };

    confirm.onclick = () => { const v = inp.value.trim(); if (v) done(v); else inp.focus(); };
    cancel.onclick  = () => done(null);
    overlay.onclick = e => { if (e.target === overlay) done(null); };
    inp.onkeydown   = e => {
      if (e.key === 'Enter')  { e.preventDefault(); confirm.click(); }
      if (e.key === 'Escape') { e.preventDefault(); cancel.click();  }
    };

    document.body.appendChild(overlay);
    requestAnimationFrame(() => { inp.focus(); inp.select(); });
  });
}

// ── KPI formula panel (mirrors formula-panel style) ───────────────────────────
let _tbPickActive = false;
let _tbPickInfo   = null; // { tabId, bi, ci }
let _kpiFpTarget  = null; // { tabId, bi, ci }

const _KFP_SHORTS = [
  { lbl: 'Total Current',  val: 'C.totalCur'            },
  { lbl: 'Total Initial',  val: 'C.totalInit'           },
  { lbl: 'Total Expected', val: 'C.totalExp'            },
  { lbl: 'S2 Sub-1',       val: 'C.s2sub1'              },
  { lbl: 'S2 Sub-2',       val: 'C.s2sub2'              },
  { lbl: 'S3 Committed',   val: 'C.s3total'             },
  { lbl: 'Façade Total',   val: '(C.facadeTotal/1e7)'   },
  { lbl: 'Parking Total',  val: '(C.parkingTotal/1e7)'  },
  { lbl: 'MEPF Total',     val: '(C.mepfTotal/1e7)'     },
  { lbl: 'Landscape',      val: '(C.landscapeTotal/1e7)'},
];

function _kpiFpGetPanel() {
  let p = document.getElementById('kpi-formula-panel');
  if (p) return p;
  p = document.createElement('div');
  p.id = 'kpi-formula-panel';
  p.className = 'formula-panel';
  p.style.display = 'none';
  p.innerHTML = `
  <div class="fp-header">
    <span class="fp-title">KPI — <strong id="kfp-label">Value</strong><span id="kfp-tab-name" class="fp-tbl-name"></span></span>
    <button class="fp-close-btn" onclick="closeKpiFp()" title="Close (Esc)">✕</button>
  </div>
  <div class="fp-modes">
    <button id="kfp-mode-formula" class="fp-mode-btn active" onclick="kpiFpSetMode('formula')">= Formula</button>
    <button id="kfp-mode-ai"      class="fp-mode-btn"        onclick="kpiFpSetMode('ai')">✨ Ask AI</button>
  </div>
  <div id="kfp-formula-area">
    <div class="fp-input-wrap">
      <span class="fp-eq">=</span>
      <textarea id="kfp-input" class="fp-textarea"
        placeholder="C.totalCur   or   C.totalCur * 1.15   or   450" rows="2"
        oninput="kpiFpPreview()"
        onkeydown="if(event.ctrlKey&&event.key==='Enter'){event.preventDefault();kpiFpApply();}"></textarea>
    </div>
    <div class="kfp-shortcuts-row" id="kfp-shortcuts"></div>
    <div class="fp-picker-row">
      <button class="fp-picker-btn" id="kfp-pick-btn" onclick="kpiFpTogglePick()">
        <span id="kfp-pick-icon">🎯</span> Pick KPI card
      </button>
    </div>
  </div>
  <div id="kfp-ai-area" style="display:none">
    <textarea id="kfp-ai-input" class="fp-textarea ai"
      placeholder='Describe the value: "15% above total current cost" or "sum of façade and parking"' rows="3"
      onkeydown="if(event.ctrlKey&&event.key==='Enter'){event.preventDefault();kpiFpAskAI();}"></textarea>
    <button class="fp-ai-gen-btn" onclick="kpiFpAskAI()">✨ Generate Formula</button>
    <div id="kfp-ai-result" class="fp-ai-result" style="display:none"></div>
  </div>
  <div class="fp-footer">
    <div id="kfp-preview" class="fp-preview"></div>
    <div class="fp-btns">
      <button class="fp-btn cancel" onclick="closeKpiFp()">Cancel</button>
      <button class="fp-btn clear"  onclick="kpiFpClear()">Clear</button>
      <button class="fp-btn apply"  onclick="kpiFpApply()">✓ Apply</button>
    </div>
  </div>`;
  document.body.appendChild(p);
  return p;
}

function _tbKpiValClick(e, tabId, bi, ci) {
  e.stopPropagation();
  if (_tbPickActive) return;
  const st   = _tbState(tabId);
  const card = st.blocks[bi]?.cards?.[ci];
  if (!card) return;
  openKpiFp(e.currentTarget, tabId, bi, ci, card);
}

function openKpiFp(anchor, tabId, bi, ci, card) {
  _kpiFpTarget = { tabId, bi, ci };
  const p = _kpiFpGetPanel();

  // Header
  const tab = TUI.customTabs.find(t => t.id === tabId);
  document.getElementById('kfp-label').textContent    = card.label || 'Value';
  document.getElementById('kfp-tab-name').textContent = tab ? ' — ' + tab.name : '';

  // Shortcut chips
  const row = document.getElementById('kfp-shortcuts');
  if (row) {
    row.innerHTML = _KFP_SHORTS
      .map(s => `<button class="kfp-shortcut" onclick="kpiFpInsert('${s.val}')" title="${escHtml(s.val)}">${escHtml(s.lbl)}</button>`)
      .join('');
  }

  // Pre-fill formula (strip leading = for display in textarea)
  const rawVal = String(card.value ?? '');
  const inp = document.getElementById('kfp-input');
  if (inp) {
    inp.value = rawVal.startsWith('=') ? rawVal.slice(1) : rawVal;
    inp.focus();
    inp.setSelectionRange(inp.value.length, inp.value.length);
  }
  document.getElementById('kfp-ai-input').value   = '';
  document.getElementById('kfp-ai-result').style.display = 'none';
  kpiFpSetMode('formula');
  kpiFpPreview();

  // Position
  const rect = anchor.closest('.kpi-card')?.getBoundingClientRect() || anchor.getBoundingClientRect();
  const pw = 460;
  let left = Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - pw - 12));
  let top  = rect.bottom + window.scrollY + 6;
  if (top + 400 > window.innerHeight + window.scrollY) top = Math.max(8, rect.top + window.scrollY - 406);
  p.style.left = left + 'px';
  p.style.top  = top + 'px';
  p.style.display = 'flex';
}

function closeKpiFp() {
  const p = document.getElementById('kpi-formula-panel');
  if (p) p.style.display = 'none';
  _kpiFpTarget = null;
  _tbExitPickMode();
}

function kpiFpSetMode(mode) {
  document.getElementById('kfp-formula-area').style.display = mode === 'formula' ? 'block' : 'none';
  document.getElementById('kfp-ai-area').style.display      = mode === 'ai'      ? 'block' : 'none';
  document.getElementById('kfp-mode-formula').classList.toggle('active', mode === 'formula');
  document.getElementById('kfp-mode-ai').classList.toggle('active',      mode === 'ai');
  const applyBtn = document.querySelector('#kpi-formula-panel .fp-btn.apply');
  if (applyBtn) applyBtn.style.display = mode === 'ai' ? 'none' : '';
}

function kpiFpInsert(val) {
  const ta = document.getElementById('kfp-input');
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const pad = val.startsWith('C.') || val.startsWith('D.') || val.startsWith('(') ? ` ${val} ` : val;
  ta.value = ta.value.slice(0, start) + pad + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + pad.length;
  ta.focus();
  kpiFpPreview();
}

function kpiFpPreview() {
  const el  = document.getElementById('kfp-preview');
  if (!el) return;
  const raw = document.getElementById('kfp-input')?.value.trim() || '';
  if (!raw) { el.textContent = ''; el.className = 'fp-preview'; return; }
  const formula = raw.startsWith('=') ? raw : '=' + raw;
  try {
    const result = (typeof _tbEvalKpiValue === 'function') ? _tbEvalKpiValue(formula) : eval(raw); // eslint-disable-line
    el.textContent = 'Preview: ' + result;
    el.className = 'fp-preview ok';
  } catch(e) {
    el.textContent = '⚠ ' + e.message;
    el.className = 'fp-preview err';
  }
}

function kpiFpApply() {
  if (!_kpiFpTarget) return;
  const { tabId, bi, ci } = _kpiFpTarget;
  const raw = document.getElementById('kfp-input')?.value.trim() || '';
  const st  = _tbState(tabId);
  if (!st.blocks[bi]?.cards?.[ci]) { closeKpiFp(); return; }
  // Store plain number as-is; formulas always with leading =
  const finalVal = raw === '' ? '' : (!isNaN(Number(raw)) ? raw : (raw.startsWith('=') ? raw : '=' + raw));
  st.blocks[bi].cards[ci].value = finalVal;
  _tbSaveBlock(tabId, bi);
  closeKpiFp();
  tbPaintContent(tabId);
  if (typeof _tbAddKpiInfoBadges === 'function') setTimeout(_tbAddKpiInfoBadges, 0);
}

function kpiFpClear() {
  const inp = document.getElementById('kfp-input');
  if (inp) { inp.value = ''; inp.focus(); }
  kpiFpPreview();
}

function kpiFpTogglePick() {
  if (!_kpiFpTarget) return;
  const { tabId, bi, ci } = _kpiFpTarget;
  if (_tbPickActive) { _tbExitPickMode(); return; }
  _tbPickActive = true;
  _tbPickInfo   = { tabId, bi, ci };
  _tbAssignBuiltinKpiRefs();
  document.body.classList.add('tb-pick-mode');
  document.querySelectorAll('.kpi-card').forEach(card => {
    const ref = card.dataset.tbKpi;
    if (ref === `${tabId}:${bi}:${ci}`) return;
    card.classList.add('tb-pickable');
  });
  const btn = document.getElementById('kfp-pick-btn');
  if (btn) { btn.innerHTML = '<span>⛔</span> Cancel pick'; btn.classList.add('active'); }
}

function _tbExitPickMode() {
  if (!_tbPickActive) return;
  _tbPickActive = false;
  _tbPickInfo   = null;
  document.body.classList.remove('tb-pick-mode');
  document.querySelectorAll('.kpi-card.tb-pickable').forEach(c => c.classList.remove('tb-pickable'));
  const btn = document.getElementById('kfp-pick-btn');
  if (btn) { btn.innerHTML = '<span id="kfp-pick-icon">🎯</span> Pick KPI card'; btn.classList.remove('active'); }
}

async function kpiFpAskAI() {
  if (!_kpiFpTarget) return;
  const { tabId, bi, ci } = _kpiFpTarget;
  const st   = _tbState(tabId);
  const card = st.blocks[bi]?.cards?.[ci];
  const desc = document.getElementById('kfp-ai-input')?.value.trim() || '';
  if (!desc) { document.getElementById('kfp-ai-input')?.focus(); return; }

  const genBtn = document.querySelector('#kpi-formula-panel .fp-ai-gen-btn');
  const resEl  = document.getElementById('kfp-ai-result');
  if (genBtn) { genBtn.disabled = true; genBtn.textContent = '…'; }
  if (resEl)  { resEl.style.display = 'none'; }

  // Build table context from the tab
  const tableCtx = st.blocks
    .filter(b => b.type === 'table')
    .map((b, ti) => `Table ${ti + 1} "${b.title || 'Untitled'}": columns [${(b.headers || []).join(', ')}], ${b.rows?.length || 0} rows`)
    .join('\n');

  const system = `You are a formula assistant for a construction cost dashboard (JavaScript evaluator).
Available globals: C.totalCur, C.totalInit, C.totalExp, C.s2sub1, C.s2sub2, C.s2sub3, C.s3total,
  C.facadeTotal, C.elevInclGst, C.parkingTotal, C.parkingSubtotal, C.mepfTotal, C.landscapeTotal
Helper functions: SUM(a,b,...), AVG(...), MIN(...), MAX(...), IF(cond,t,f), ROUND(n,d), ABS(n)${tableCtx ? '\nTables in this tab:\n' + tableCtx : ''}
Return ONLY the formula starting with = (no prose, no markdown).`;

  const userMsg = `KPI label: "${card?.label || 'unnamed'}"
Current value: "${document.getElementById('kfp-input')?.value || ''}"
Request: "${desc}"`;

  try {
    const result = await _tbCallClaude(system, [{ role: 'user', content: [{ type: 'text', text: userMsg }] }]);
    if (result) {
      const raw = result.trim().replace(/^```.*\n?/,'').replace(/\n?```$/,'').split('\n')[0].trim();
      const clean = raw.startsWith('=') ? raw.slice(1) : raw.replace(/^=/, '');
      const inp = document.getElementById('kfp-input');
      if (inp) { inp.value = clean; kpiFpPreview(); }
      if (resEl) { resEl.textContent = '✓ Formula ready — review and click ✓ Apply'; resEl.style.display = ''; }
      kpiFpSetMode('formula');
      document.getElementById('kfp-input')?.focus();
    }
  } catch (e) {
    if (resEl) { resEl.textContent = '⚠ ' + e.message; resEl.style.display = ''; }
  } finally {
    if (genBtn) { genBtn.disabled = false; genBtn.textContent = '✨ Generate Formula'; }
  }
}

// ── KPI formula popover ───────────────────────────────────────────────────────
function _tbShowKpiFxPop(badge, formula, currentVal) {
  document.querySelector('.tui-fml-pop')?.remove();
  if (typeof _buildFmlPop === 'function') {
    const pop = _buildFmlPop(formula, currentVal, 'KPI Formula');
    document.body.appendChild(pop);
    _positionFmlPop(pop, badge);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Pick-mode: capture-phase click handler intercepts card clicks during formula building
  document.addEventListener('click', ev => {
    if (!_tbPickActive) return;
    const card = ev.target.closest('.kpi-card.tb-pickable');
    if (!card) { _tbExitPickMode(); return; }
    ev.stopPropagation(); ev.preventDefault();

    // Derive a formula reference for this card
    const kpiRef = card.dataset.tbKpi; // "tabId:bi:ci" | "builtin:spanId" | absent
    let ref = '';
    if (kpiRef && kpiRef.startsWith('builtin:')) {
      // Built-in tab KPI card with a known C.xxx mapping
      const spanId = kpiRef.slice(8);
      ref = _BUILTIN_KPI_REFS[spanId] || null;
      if (!ref) {
        // Fallback to displayed value
        const txt = card.querySelector('.value')?.textContent.replace(/fx/g,'').trim() || '0';
        ref = parseFloat(txt.replace(/[₹,\s]/g,'')) || txt;
      }
    } else if (kpiRef && kpiRef.includes(':')) {
      // Custom tab KPI card
      const [srcTab, srcBi, srcCi] = kpiRef.split(':');
      const blk = _tbState(srcTab).blocks[+srcBi];
      const c   = blk?.cards?.[+srcCi];
      if (c) {
        const rv = String(c.value ?? '');
        ref = rv.startsWith('=') ? `(${rv.slice(1)})` : (rv || '0');
      }
    } else {
      // Built-in card with no ref mapping — use displayed numeric value
      const txt = card.querySelector('.value')?.textContent.replace(/fx/g,'').trim() || '0';
      ref = parseFloat(txt.replace(/[₹,\s]/g,'')) || txt;
    }

    if (!ref) { _tbExitPickMode(); return; }

    const inp = document.getElementById('kfp-input');
    if (inp) {
      const cur = inp.value.trim();
      inp.value = cur ? `${cur} + ${ref}` : String(ref);
      inp.focus();
      kpiFpPreview();
    }
    _tbExitPickMode();
  }, true); // capture phase so we intercept before card's own onclick

  // Escape / outside-click closes the KPI formula panel
  document.addEventListener('keydown', ev => {
    if (ev.key !== 'Escape') return;
    const p = document.getElementById('kpi-formula-panel');
    if (p && p.style.display !== 'none') { closeKpiFp(); ev.stopPropagation(); }
  }, { capture: true });
  document.addEventListener('mousedown', ev => {
    const p = document.getElementById('kpi-formula-panel');
    if (!p || p.style.display === 'none') return;
    if (!p.contains(ev.target) && !ev.target.closest('.kpi-card')) closeKpiFp();
  });

  // Inject the global chart modal into <body> once
  const modal = document.createElement('div');
  modal.id        = 'tb-chart-modal';
  modal.className = 'tb-modal-overlay';
  modal.style.display = 'none';
  modal.onclick = e => { if (e.target === modal) tbCloseChartModal(); };
  modal.innerHTML = `
<div class="tb-modal" onclick="event.stopPropagation()">
  <div class="tb-modal-hdr">
    📊 Visualize Data
    <button class="tb-modal-close" onclick="tbCloseChartModal()">✕</button>
  </div>
  <div class="tb-modal-body">
    <div class="tb-modal-opts">
      <label class="tb-opt-lbl">Chart type
        <select id="tb-modal-type" onchange="tbUpdateModalChart()">
          <option value="bar">Bar</option>
          <option value="horizontalBar">Horizontal Bar</option>
          <option value="pie">Pie</option>
          <option value="doughnut">Doughnut</option>
          <option value="line">Line</option>
        </select>
      </label>
      <label class="tb-opt-lbl">Label column
        <select id="tb-modal-labelcol" onchange="tbUpdateModalChart()"></select>
      </label>
      <label class="tb-opt-lbl" style="align-items:flex-start">Value columns
        <div id="tb-modal-valcols" class="tb-vcols"></div>
      </label>
    </div>
    <div class="chart-box" style="height:340px">
      <canvas id="tb-modal-canvas"></canvas>
    </div>
  </div>
</div>`;
  document.body.appendChild(modal);
});
