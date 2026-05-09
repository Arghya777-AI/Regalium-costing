// ── CELL FORMATTING ───────────────────────────────────────────────────────────
// Depends on: formula.js (_fkey, assignCellAddrs)
// CFORMAT is keyed by the same fkey as FSTORE: tbid__CADDR

const CFORMAT = {};

// ── Selection state (stored as fkeys so they survive re-render) ──────────────
let _fmtAnchorKey = null;  // fkey of anchor cell
let _fmtSelKeys   = new Set(); // Set<fkey> for range selection

// ── Key helpers ───────────────────────────────────────────────────────────────
function _fmtKey(td) {
  if (typeof _fkey === 'function') return _fkey(td);
  const tbody = td.closest('tbody');
  const tbid  = tbody?.id || '';
  const addr  = td.dataset.caddr || '';
  return (tbid && addr) ? `${tbid}__${addr}` : null;
}

function _tdByKey(key) {
  if (!key) return null;
  const sep = key.indexOf('__');
  if (sep < 0) return null;
  const tbid = key.slice(0, sep);
  const addr = key.slice(sep + 2);
  return document.getElementById(tbid)?.querySelector(`[data-caddr="${addr}"]`) || null;
}

// ── Apply stored CFORMAT to cells after every render ─────────────────────────
function applyFormatting() {
  // Clear previous inline styles set by this system
  document.querySelectorAll('td[data-fmt-applied]').forEach(td => {
    td.style.fontWeight = '';
    td.style.color      = '';
    td.style.background = '';
    delete td.dataset.fmtApplied;
  });

  // Apply stored formats
  Object.entries(CFORMAT).forEach(([key, fmt]) => {
    if (!fmt || (!fmt.bold && !fmt.color && !fmt.bg)) return;
    const td = _tdByKey(key);
    if (!td) return;
    td.dataset.fmtApplied = '1';
    if (fmt.bold)  td.style.fontWeight = 'bold';
    if (fmt.color) td.style.color      = fmt.color;
    if (fmt.bg)    td.style.background = fmt.bg;
  });

  // Re-apply selection highlight (cells rebuilt after render)
  _fmtHighlight();
}

// ── Selection highlight ───────────────────────────────────────────────────────
function _fmtHighlight() {
  document.querySelectorAll('td.fmt-selected').forEach(td => td.classList.remove('fmt-selected'));
  const keys = _fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? new Set([_fmtAnchorKey]) : new Set());
  keys.forEach(key => {
    const td = _tdByKey(key);
    if (td) td.classList.add('fmt-selected');
  });
  _fmtUpdateBar();
}

// ── Update formula-bar toolbar to reflect current selection ───────────────────
function _fmtUpdateBar() {
  const boldBtn  = document.getElementById('fmt-bold-btn');
  const colorIn  = document.getElementById('fmt-color-in');
  const bgIn     = document.getElementById('fmt-bg-in');
  const textIcon = document.querySelector('.fmt-text-icon');
  const fillIcon = document.querySelector('.fmt-fill-icon');
  if (!boldBtn) return;

  const keys = [...(_fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? [_fmtAnchorKey] : []))];
  if (!keys.length) {
    boldBtn.classList.remove('fmt-btn-active');
    if (textIcon) textIcon.style.borderBottomColor = '#212529';
    if (fillIcon) fillIcon.style.color = '#e0a020';
    return;
  }

  const allBold = keys.every(k => CFORMAT[k]?.bold);
  boldBtn.classList.toggle('fmt-btn-active', allBold);

  const firstFmt  = CFORMAT[keys[0]] || {};
  const textColor = firstFmt.color || '#212529';
  const bgColor   = firstFmt.bg    || null;

  colorIn.value = textColor;
  if (textIcon) textIcon.style.borderBottomColor = textColor;

  if (bgColor) {
    bgIn.value = bgColor;
    if (fillIcon) fillIcon.style.color = bgColor;
  } else {
    bgIn.value = '#ffffff';
    if (fillIcon) fillIcon.style.color = '#e0a020';
  }
}

// ── Apply a transform to all selected cells ───────────────────────────────────
function _applyFmtToSel(transform) {
  const keys = [...(_fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? [_fmtAnchorKey] : []))];
  if (!keys.length) return;
  keys.forEach(key => {
    if (!CFORMAT[key]) CFORMAT[key] = {};
    transform(CFORMAT[key]);
    const f = CFORMAT[key];
    if (!f.bold && !f.color && !f.bg) delete CFORMAT[key];
  });
  applyFormatting();
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

// ── Public formatting API (called from toolbar buttons) ────────────────────────
function fmtToggleBold() {
  const keys = [...(_fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? [_fmtAnchorKey] : []))];
  const allBold = keys.every(k => CFORMAT[k]?.bold);
  _applyFmtToSel(fmt => { if (allBold) delete fmt.bold; else fmt.bold = true; });
}

function fmtSetColor(color) {
  _applyFmtToSel(fmt => {
    if (!color || color === '#212529' || color === '#000000') delete fmt.color;
    else fmt.color = color;
  });
}

function fmtSetBg(color) {
  _applyFmtToSel(fmt => {
    if (!color || color === '#ffffff' || color === '#ffffffff') delete fmt.bg;
    else fmt.bg = color;
  });
}

function fmtClear() {
  const keys = [...(_fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? [_fmtAnchorKey] : []))];
  keys.forEach(key => delete CFORMAT[key]);
  applyFormatting();
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

// ── Range selection helper ────────────────────────────────────────────────────
function _cellsBetween(tdA, tdB) {
  const tableA = tdA.closest('table');
  const tableB = tdB.closest('table');
  if (!tableA || tableA !== tableB) return [tdA, tdB];
  const all = Array.from(tableA.querySelectorAll('td[data-caddr]'));
  const iA  = all.indexOf(tdA), iB = all.indexOf(tdB);
  if (iA < 0 || iB < 0) return [tdA, tdB];
  const [lo, hi] = iA < iB ? [iA, iB] : [iB, iA];
  return all.slice(lo, hi + 1);
}

// ── Init: event listeners ─────────────────────────────────────────────────────
function _initFormatting() {
  // Ctrl+B → bold toggle
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      fmtToggleBold();
    }
  });

  // Mousedown (capture): update anchor / extend range selection
  document.addEventListener('mousedown', e => {
    const td = e.target.closest('td[data-caddr]');
    if (!td || td.classList.contains('tui-dh-td')) return;

    const key = _fmtKey(td);
    if (!key) return;

    if (e.shiftKey && _fmtAnchorKey) {
      e.preventDefault();
      const anchorTd = _tdByKey(_fmtAnchorKey);
      if (anchorTd) {
        const range = _cellsBetween(anchorTd, td);
        _fmtSelKeys = new Set(range.map(t => _fmtKey(t)).filter(Boolean));
      } else {
        _fmtAnchorKey = key;
        _fmtSelKeys   = new Set();
      }
      _fmtHighlight();
    } else if (!e.shiftKey) {
      _fmtAnchorKey = key;
      _fmtSelKeys   = new Set();
      _fmtHighlight();
    }
  }, true);  // capture — runs before edit.js handlers

  // Click (capture): prevent edit from opening on Shift+click (range select only)
  document.addEventListener('click', e => {
    if (!e.shiftKey) return;
    const td = e.target.closest('td[data-caddr]');
    if (td && !td.classList.contains('tui-dh-td')) {
      e.stopPropagation();
    }
  }, true);

  // Escape clears selection
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      _fmtSelKeys = new Set();
      _fmtHighlight();
    }
  });
}

document.addEventListener('DOMContentLoaded', _initFormatting);
