// ── KEYBOARD NAVIGATION & SHORTCUTS ───────────────────────────────────────────
// Excel-like keyboard control for all tables.
// Shortcuts: Arrow keys, Ctrl+Arrow, Tab, Enter, F2, Delete, Ctrl+C/V/Shift+C

// ── Selected cell ──────────────────────────────────────────────────────────────
let _kbTd = null;

function kbSel(td) {
  if (_kbTd) _kbTd.classList.remove('kb-sel');
  _kbTd = td || null;
  if (_kbTd) {
    _kbTd.classList.add('kb-sel');
    _kbTd.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

// Select cell on click (skip when clicking inside inputs or buttons)
document.addEventListener('click', e => {
  const td = e.target.closest('td, th');
  if (!td) { kbSel(null); return; }
  if (e.target.closest('input, textarea, button, [contenteditable="true"]')) return;
  kbSel(td);
}, { capture: false });

// ── Helpers ────────────────────────────────────────────────────────────────────
function _visRows(table) {
  return Array.from(table.querySelectorAll('tbody > tr, tfoot > tr'))
    .filter(tr => tr.style.display !== 'none');
}
function _visCells(tr) {
  return Array.from(tr.children).filter(c => c.style.display !== 'none');
}

// ── Navigation ─────────────────────────────────────────────────────────────────
function kbMove(dRow, dCol) {
  if (!_kbTd) return;
  const table = _kbTd.closest('table'); if (!table) return;
  const curTr = _kbTd.closest('tr');
  const rows  = _visRows(table);
  const rIdx  = rows.indexOf(curTr);
  const cells = _visCells(curTr);
  const cIdx  = cells.indexOf(_kbTd);
  if (rIdx < 0 || cIdx < 0) return;

  let nr = rIdx + dRow, nc = cIdx + dCol;

  // Wrap across rows on Tab-like horizontal overshoot
  if (dRow === 0 && nc >= cells.length)  { nr = rIdx + 1; nc = 0; }
  if (dRow === 0 && nc < 0)              { nr = rIdx - 1; nc = Infinity; }

  nr = Math.max(0, Math.min(nr, rows.length - 1));
  const targetRow   = rows[nr]; if (!targetRow) return;
  const targetCells = _visCells(targetRow);
  nc = Math.max(0, Math.min(nc === Infinity ? targetCells.length - 1 : nc, targetCells.length - 1));
  if (targetCells[nc]) kbSel(targetCells[nc]);
}

function kbMoveEdge(dRow, dCol) {
  if (!_kbTd) return;
  const table = _kbTd.closest('table'); if (!table) return;
  const curTr = _kbTd.closest('tr');
  const rows  = _visRows(table);
  const rIdx  = rows.indexOf(curTr);
  const cells = _visCells(curTr);
  const cIdx  = cells.indexOf(_kbTd);
  if (rIdx < 0 || cIdx < 0) return;

  if (dRow !== 0) {
    const tRow = rows[dRow > 0 ? rows.length - 1 : 0];
    const tCells = _visCells(tRow);
    kbSel(tCells[Math.min(cIdx, tCells.length - 1)]);
  } else {
    kbSel(cells[dCol > 0 ? cells.length - 1 : 0]);
  }
}

// ── Clipboard ──────────────────────────────────────────────────────────────────
function kbCopy(fullRow) {
  let text = '';
  if (!_kbTd) return;

  if (fullRow) {
    const tr = _kbTd.closest('tr');
    if (tr) text = _visCells(tr).map(c => {
      const inp = c.querySelector('input');
      return (inp ? inp.value : c.textContent).trim();
    }).join('\t');
  } else {
    const inp = _kbTd.querySelector('input');
    text = inp ? inp.value : _kbTd.textContent.trim();
  }

  if (!text) return;
  navigator.clipboard.writeText(text)
    .then(() => kbToast(fullRow ? '📋 Row copied' : '📋 Copied'))
    .catch(() => kbToast('⚠ Copy failed'));
}

async function kbPaste() {
  if (!_kbTd) return;
  const eid = _kbTd.dataset.eid;
  if (!eid || !EH[eid]) { kbToast('⚠ Cell is not editable'); return; }
  try {
    const text = (await navigator.clipboard.readText()).trim();
    const h = EH[eid];
    if (h.isStr) {
      h.setVal(text);
    } else {
      const n = parseFloat(text);
      if (isNaN(n)) { kbToast('⚠ Not a number'); return; }
      h.setVal(n);
    }
    kbToast('📋 Pasted');
    recompute(); renderAll(); applyTableOps();
  } catch {
    kbToast('⚠ Clipboard access denied');
  }
}

// ── Cell edit & clear ──────────────────────────────────────────────────────────
function kbActivateEdit() {
  if (!_kbTd) return;
  if (_kbTd.dataset.eid) {
    activateCell(_kbTd);
  } else if (_kbTd.contentEditable === 'true') {
    _kbTd.focus();
    // Move cursor to end
    const r = document.createRange(), s = window.getSelection();
    r.selectNodeContents(_kbTd); r.collapse(false);
    s.removeAllRanges(); s.addRange(r);
  }
}

function kbClearCell() {
  if (!_kbTd) return;
  const eid = _kbTd.dataset.eid;
  if (!eid || !EH[eid]) return;
  const h = EH[eid];
  // Don't clear null-init rows or formula-derived cells
  if (h.setVal) {
    h.setVal(h.isStr ? '' : 0);
    recompute(); renderAll(); applyTableOps();
  }
}

// ── Row/col shortcuts ──────────────────────────────────────────────────────────
function kbInsertRow(above) {
  if (!_kbTd) return;
  const tr = _kbTd.closest('tr');
  if (!tr) return;
  const tbid = tr.dataset.tbid, didx = parseInt(tr.dataset.didx ?? '-1');
  if (didx >= 0 && tbid && TREG[tbid]) _insertRow(tbid, didx, above === true);
  else kbToast('⚠ Cannot insert in a computed row');
}

function kbDeleteRow() {
  if (!_kbTd) return;
  const tr = _kbTd.closest('tr');
  if (!tr) return;
  const tbid = tr.dataset.tbid, didx = parseInt(tr.dataset.didx ?? '-1');
  if (didx >= 0 && tbid && TREG[tbid]) _deleteRow(tbid, didx);
  else kbToast('⚠ Cannot delete a computed row');
}

function kbHideRow() {
  if (!_kbTd) return;
  const tr = _kbTd.closest('tr');
  if (!tr) return;
  const tbid = tr.dataset.tbid, didx = parseInt(tr.dataset.didx ?? '-1');
  if (didx >= 0 && tbid) _toggleHideRow(tbid, didx);
}

function kbHideCol() {
  if (!_kbTd) return;
  const cidx = parseInt(_kbTd.dataset.cidx ?? '-1');
  const tbid = _kbTd.dataset.tbid || _kbTd.closest('table')?.querySelector('tbody')?.id || '';
  if (cidx > 0 && tbid) _toggleHideCol(tbid, cidx);
}

// ── Tab from within an edit input (commit + move to next) ─────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Tab' || !activeCell) return;
  e.preventDefault();
  e.stopPropagation();

  const td       = activeCell;
  const backward = e.shiftKey;

  // Record position BEFORE re-render (DOM will be rebuilt)
  const table   = td.closest('table');
  const tbodyId = table?.querySelector('tbody')?.id;
  const rows    = _visRows(table);
  const curTr   = td.closest('tr');
  const rIdx    = rows.indexOf(curTr);
  const cells   = _visCells(curTr);
  const cIdx    = cells.indexOf(td);

  // Compute target position
  let nr = rIdx, nc = backward ? cIdx - 1 : cIdx + 1;
  if (nc >= cells.length)  { nr = rIdx + 1; nc = 0; }
  else if (nc < 0)          { nr = rIdx - 1; nc = Infinity; }
  nr = Math.max(0, Math.min(nr, rows.length - 1));

  // Commit the current edit without triggering blur re-render
  const input = td.querySelector('input');
  if (input) {
    const raw = input.value.trim();
    if (raw !== '') {
      const eid = td.dataset.eid;
      if (eid && EH[eid]) {
        const h = EH[eid];
        activeCell = null;
        if (h.isStr) {
          h.setVal(raw);
        } else {
          const n = parseFloat(raw);
          if (!isNaN(n)) h.setVal(n);
        }
      } else {
        activeCell = null;
      }
    } else {
      activeCell = null;
    }
  } else {
    activeCell = null;
  }

  recompute(); renderAll(); applyTableOps();

  // Re-find the target cell after re-render
  setTimeout(() => {
    const tbody = document.getElementById(tbodyId);
    const newTable = tbody?.closest('table'); if (!newTable) return;
    const newRows = _visRows(newTable);
    const targetRow = newRows[Math.max(0, Math.min(nr, newRows.length - 1))];
    if (!targetRow) return;
    const tCells = _visCells(targetRow);
    const finalNc = nc === Infinity ? tCells.length - 1 : Math.min(nc, tCells.length - 1);
    const target = tCells[Math.max(0, finalNc)];
    if (!target) return;
    kbSel(target);
    // Auto-activate edit if next cell is also editable (Excel-like)
    if (target.dataset.eid) activateCell(target);
  }, 0);
}, { capture: true });

// ── Toast ──────────────────────────────────────────────────────────────────────
function kbToast(msg) {
  document.querySelectorAll('.kb-toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'kb-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 250); }, 2000);
}

// ── Keyboard shortcuts modal ───────────────────────────────────────────────────
function kbShowHelp() {
  const overlay = document.getElementById('kb-help-overlay');
  if (overlay) overlay.style.display = overlay.style.display === 'flex' ? 'none' : 'flex';
}

// ── Main keydown handler ───────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  const active  = document.activeElement;
  const inEdit  = !!activeCell; // from edit.js
  const inInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' ||
    (active.contentEditable === 'true' && active.tagName !== 'BODY');

  // ── Shortcuts that work even during editing ──
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'c' && !inInput) {
    kbCopy(false); e.preventDefault(); return;
  }
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c' && !inInput) {
    kbCopy(true); e.preventDefault(); return;
  }
  if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'v' && !inInput) {
    kbPaste(); e.preventDefault(); return;
  }
  if (e.key === 'F1') { kbShowHelp(); e.preventDefault(); return; }

  // All remaining shortcuts require no active edit
  if (inEdit || inInput) return;
  if (!_kbTd) return;

  const ctrl = e.ctrlKey, shift = e.shiftKey;

  switch (e.key) {
    // ── Navigation ──
    case 'ArrowRight': ctrl ? kbMoveEdge(0, 1)   : kbMove(0, 1);   e.preventDefault(); break;
    case 'ArrowLeft':  ctrl ? kbMoveEdge(0, -1)  : kbMove(0, -1);  e.preventDefault(); break;
    case 'ArrowDown':  ctrl ? kbMoveEdge(1, 0)   : kbMove(1, 0);   e.preventDefault(); break;
    case 'ArrowUp':    ctrl ? kbMoveEdge(-1, 0)  : kbMove(-1, 0);  e.preventDefault(); break;
    case 'Tab':                                   kbMove(0, shift ? -1 : 1); e.preventDefault(); break;
    case 'Home':       ctrl ? kbMoveEdge(-1, -1) : kbMoveEdge(0, -1); e.preventDefault(); break;
    case 'End':        ctrl ? kbMoveEdge(1, 1)   : kbMoveEdge(0, 1);  e.preventDefault(); break;
    case 'PageDown':   kbMove(10, 0);  e.preventDefault(); break;
    case 'PageUp':     kbMove(-10, 0); e.preventDefault(); break;

    // ── Edit ──
    case 'Enter':
    case 'F2':         kbActivateEdit(); e.preventDefault(); break;
    case 'Escape':     kbSel(null); e.preventDefault(); break;

    // ── Clear ──
    case 'Delete':
    case 'Backspace':  kbClearCell(); e.preventDefault(); break;

    // ── Row ops ──
    case 'Insert':     kbInsertRow(false); e.preventDefault(); break;  // Insert key → insert row below
    case '=':          if (ctrl && shift) { kbInsertRow(false); e.preventDefault(); } break; // Ctrl+Shift+= (same key as +)
    case '+':          if (ctrl)          { kbInsertRow(false); e.preventDefault(); } break; // Ctrl++ (numpad)
    case '-':          if (ctrl)          { kbDeleteRow();       e.preventDefault(); } break; // Ctrl+-
    case 'h':          if (ctrl && shift) { kbHideRow();         e.preventDefault(); } break; // Ctrl+Shift+H
    case 'j':          if (ctrl && shift) { kbHideCol();         e.preventDefault(); } break; // Ctrl+Shift+J (hide col)
  }
});

// Also handle printable characters starting a new value (like Excel: just type to begin editing)
document.addEventListener('keydown', e => {
  if (!_kbTd || activeCell) return;
  const active = document.activeElement;
  const inInput = active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' ||
    (active.contentEditable === 'true' && active.tagName !== 'BODY');
  if (inInput) return;

  // = key → open formula panel directly (no inline edit)
  if (e.key === '=' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const eid = _kbTd.dataset.eid;
    if (!eid || !EH[eid] || EH[eid].isStr) return;
    if (typeof openFormulaPanel === 'function') { openFormulaPanel(_kbTd); e.preventDefault(); }
    return;
  }

  // Single printable character (not a modifier combo) → start editing and pre-fill
  if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const eid = _kbTd.dataset.eid;
    if (!eid || !EH[eid]) return;
    activateCell(_kbTd);
    // After activateCell creates the input, pre-fill it with the typed char
    setTimeout(() => {
      const inp = _kbTd.querySelector('input');
      if (inp) { inp.value = e.key; inp.focus(); }
    }, 0);
    e.preventDefault();
  }
});
