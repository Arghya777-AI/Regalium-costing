// ── INLINE EDITING & CASCADE DIALOG ───────────────────────────────────────────
// Depends on: utils.js (escHtml, fmtInr, fmt)

// Edit handler registry — reset at start of each renderAll()
let EH = {}, EI = 0;
function resetEH() { EH = {}; EI = 0; }

/**
 * Returns a <td> HTML string and registers get/set handlers for it.
 * opts.cascade = { getQty, getRate, getOldAmt, setQty, setRate, setOverride, clearOverride }
 */
function edCell(getVal, setVal, opts = {}) {
  const { isStr = false, dec = 2, big = false, cascade = null } = opts;
  const id = ++EI;
  EH[id] = { getVal, setVal, isStr, cascade };

  const val = getVal();
  let disp;
  if (val == null)  disp = '—';
  else if (isStr)   disp = escHtml(val);
  else if (big)     disp = fmtInr(val);
  else              disp = fmt(val, dec);

  return `<td class="${isStr ? '' : 'num '}ed" data-eid="${id}">${disp}</td>`;
}

/**
 * Returns a <td> for a formula total that, when edited, scales all components proportionally.
 * components = [{getVal, setVal}, ...]  — the leaves that sum to this total.
 */
function edCascCell(getVal, components, opts = {}) {
  const { dec = 2, big = false } = opts;
  const id = ++EI;
  EH[id] = {
    getVal,
    setVal: (newVal) => {
      const oldVal = getVal();
      if (!oldVal || Math.abs(oldVal) < 0.0001) return;
      const factor = newVal / oldVal;
      components.forEach(c => c.setVal(c.getVal() * factor));
    },
    isStr: false,
    cascade: null
  };
  const val = getVal();
  const disp = val == null ? '—' : big ? fmtInr(val) : fmt(val, dec);
  return `<td class="num edcasc" data-eid="${id}">${disp}</td>`;
}

// ── Click-to-edit ─────────────────────────────────────────────────────────────
let activeCell = null, activeCellOrig = '';

function cancelEdit() {
  if (!activeCell) return;
  activeCell.innerHTML = activeCellOrig;
  activeCell = null; activeCellOrig = '';
}

document.addEventListener('mousedown', e => {
  if (activeCell && !activeCell.contains(e.target)) cancelEdit();
});

document.addEventListener('click', e => {
  const cell = e.target.closest('td.ed, td.edcasc');
  if (!cell || cell === activeCell) return;
  activateCell(cell);
});

function activateCell(cell) {
  cancelEdit();
  const id = +cell.dataset.eid;
  const handler = EH[id];
  if (!handler) return;

  activeCellOrig = cell.innerHTML;
  activeCell = cell;

  // If cell has a stored formula, show formula text for editing
  const existingFormula = (typeof FSTORE !== 'undefined' && cell.dataset.fkey)
    ? (FSTORE[cell.dataset.fkey]?.formula || null) : null;

  const val       = existingFormula || handler.getVal();
  const isFormula = !!existingFormula;

  const input = document.createElement('input');
  const isCasc = cell.classList.contains('edcasc');
  input.className = 'ed-input' + (handler.isStr ? ' str' : '') + (isCasc ? ' casc' : '');
  input.type  = (handler.isStr || isFormula) ? 'text' : 'number';
  input.step  = 'any';
  input.value = isFormula ? val : ((val == null) ? '' : (handler.isStr ? val : +val));
  cell.innerHTML = '';
  cell.appendChild(input);
  input.focus();
  if (isFormula) input.setSelectionRange(input.value.length, input.value.length);
  else input.select();

  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); input.blur(); }
    if (ev.key === 'Escape') { ev.stopPropagation(); cancelEdit(); }
    // = on an empty numeric cell → open formula panel
    if (ev.key === '=' && !handler.isStr && input.value === '') {
      ev.preventDefault();
      cancelEdit();
      if (typeof openFormulaPanel === 'function') openFormulaPanel(cell);
    }
  });

  input.addEventListener('blur', () => {
    if (!activeCell) return;  // already cancelled
    const raw = input.value.trim();
    activeCell = null;
    if (raw === '') { cancelEdit(); return; }

    // Formula detection: = prefix triggers formula system
    if (!handler.isStr && raw.startsWith('=') && typeof _handleFormulaEdit === 'function') {
      const result = _handleFormulaEdit(cell, raw);
      handler.setVal(result !== null ? result : 0);
      recompute(); renderAll();
      return;
    }

    let newVal;
    if (handler.isStr) {
      newVal = raw;
    } else {
      newVal = parseFloat(raw);
      if (isNaN(newVal)) { cancelEdit(); return; }
    }

    // If this cell has a cascade config and qty+rate exist, show dialog
    if (handler.cascade && !handler.isStr) {
      const c = handler.cascade;
      const qty = c.getQty(), rate = c.getRate(), oldAmt = c.getOldAmt();
      if (qty && rate && oldAmt !== newVal) {
        showCascadeDialog({ c, newAmt: newVal, qty, rate, oldAmt });
        return;
      }
    }

    handler.setVal(newVal);
    recompute();
    renderAll();
  });
}

// ── Cascade dialog ────────────────────────────────────────────────────────────
let pendingCascade = null;

function showCascadeDialog({ c, newAmt, qty, rate, oldAmt }) {
  pendingCascade = { c, newAmt, qty, rate, oldAmt };
  setText('casc-qty',    (+qty).toFixed(2));
  setText('casc-rate',   fmtInr(rate));
  setText('casc-newamt', fmtInr(newAmt));
  document.getElementById('cascade-overlay').style.display = 'flex';
}

function applyCascade(choice) {
  document.getElementById('cascade-overlay').style.display = 'none';
  if (!pendingCascade || choice === 'cancel') { renderAll(); return; }

  const { c, newAmt, qty, rate, oldAmt } = pendingCascade;
  pendingCascade = null;

  if (choice === 'rate') {
    c.setRate(newAmt / qty);
    if (c.clearOverride) c.clearOverride();
  } else if (choice === 'qty') {
    c.setQty(newAmt / rate);
    if (c.clearOverride) c.clearOverride();
  } else if (choice === 'both') {
    const s = Math.sqrt(newAmt / oldAmt);
    c.setQty(qty * s);
    c.setRate(rate * s);
    if (c.clearOverride) c.clearOverride();
  } else if (choice === 'override') {
    c.setOverride(newAmt);
  }

  recompute();
  renderAll();
}
