// ── CELL FORMATTING ───────────────────────────────────────────────────────────
// Depends on: formula.js (_fkey, assignCellAddrs)
// CFORMAT is keyed by the same fkey as FSTORE: tbid__CADDR

const CFORMAT = {};

// ── Selection state (stored as fkeys so they survive re-render) ──────────────
let _fmtAnchorKey = null;  // fkey of anchor cell
let _fmtSelKeys   = new Set(); // Set<fkey> for range selection

// ── Color palette data (Excel Office theme) ──────────────────────────────────
const _FMT_PALETTE_ROWS = [
  // Base theme colors
  ['#FFFFFF','#000000','#E7E6E6','#44546A','#4472C4','#ED7D31','#A5A5A5','#FFC000','#5B9BD5','#70AD47'],
  // Tint 80%
  ['#F2F2F2','#808080','#AEAAAA','#D6DCE4','#D9E1F2','#FCE4D6','#EDEDED','#FFF2CC','#DDEBF7','#E2EFDA'],
  // Tint 60%
  ['#D9D9D9','#595959','#757070','#ADB9CA','#B4C6E7','#F8CBAD','#DBDBDB','#FFE699','#BDD7EE','#C6E0B4'],
  // Tint 40%
  ['#BFBFBF','#404040','#3A3838','#8497B0','#8EA9DB','#F4B183','#C9C9C9','#FFD966','#9DC3E6','#A9D18E'],
  // Shade 25%
  ['#A6A6A6','#262626','#171616','#323F4F','#2E75B6','#C55A11','#7B7B7B','#BF8F00','#2F75B6','#538135'],
  // Shade 50%
  ['#808080','#0D0D0D','#0C0C0C','#222A35','#1F4E79','#833C00','#525252','#7F6000','#1F4E79','#375623'],
];
const _FMT_STD_COLORS = [
  '#C00000','#FF0000','#FFC000','#FFFF00','#92D050',
  '#00B050','#00B0F0','#0070C0','#002060','#7030A0',
];

// ── Palette dropdown state ────────────────────────────────────────────────────
let _fmtActivePalette = null; // { el, type }

function fmtOpenPalette(type, anchorEl) {
  if (_fmtActivePalette?.type === type) { _fmtClosePalette(); return; }
  _fmtClosePalette();

  const pal = document.createElement('div');
  pal.className = 'fmt-palette';

  // ── No Color ──
  const noRow = document.createElement('div');
  noRow.className = 'fmt-palette-nocolor';
  const noBtn = document.createElement('button');
  noBtn.className = 'fmt-palette-action-btn';
  noBtn.innerHTML = '<span style="text-decoration:line-through;opacity:.5">A</span>&nbsp; No Color';
  noBtn.onclick = () => { _fmtClosePalette(); _applyColorPick(type, null); };
  noRow.appendChild(noBtn);
  pal.appendChild(noRow);

  // ── Theme colors ──
  const themeLabel = document.createElement('div');
  themeLabel.className = 'fmt-palette-label';
  themeLabel.textContent = 'Theme Colors';
  pal.appendChild(themeLabel);

  _FMT_PALETTE_ROWS.forEach((row, ri) => {
    const rowEl = document.createElement('div');
    rowEl.className = 'fmt-palette-row';
    row.forEach(color => {
      const sw = _makeSwatch(color, type, ri === 0);
      rowEl.appendChild(sw);
    });
    pal.appendChild(rowEl);
  });

  // ── Standard colors ──
  const stdLabel = document.createElement('div');
  stdLabel.className = 'fmt-palette-label';
  stdLabel.style.marginTop = '6px';
  stdLabel.textContent = 'Standard Colors';
  pal.appendChild(stdLabel);

  const stdRow = document.createElement('div');
  stdRow.className = 'fmt-palette-row';
  _FMT_STD_COLORS.forEach(color => stdRow.appendChild(_makeSwatch(color, type, false)));
  pal.appendChild(stdRow);

  // ── More Colors ──
  const moreRow = document.createElement('div');
  moreRow.className = 'fmt-palette-nocolor';
  moreRow.style.marginTop = '4px';
  const moreBtn = document.createElement('button');
  moreBtn.className = 'fmt-palette-action-btn';
  moreBtn.textContent = '⊕  More Colors…';
  moreBtn.onclick = () => {
    _fmtClosePalette();
    const inp = document.getElementById(type === 'text' ? 'fmt-color-custom-in' : 'fmt-bg-custom-in');
    if (inp) inp.click();
  };
  moreRow.appendChild(moreBtn);
  pal.appendChild(moreRow);

  document.body.appendChild(pal);

  // Position below button
  const rect = anchorEl.getBoundingClientRect();
  const palW = 196;
  let left = rect.left + window.scrollX;
  if (left + palW > window.innerWidth - 8) left = window.innerWidth - palW - 8;
  pal.style.left = left + 'px';
  pal.style.top  = (rect.bottom + window.scrollY + 3) + 'px';

  _fmtActivePalette = { el: pal, type };
  setTimeout(() => document.addEventListener('mousedown', _fmtPaletteOutside), 0);
}

function _makeSwatch(color, type, needBorder) {
  const sw = document.createElement('button');
  sw.className = 'fmt-swatch';
  sw.style.background = color;
  sw.title = color;
  if (needBorder) sw.style.outline = '1px solid #ccc';
  sw.onclick = () => { _fmtClosePalette(); _applyColorPick(type, color); };
  return sw;
}

function _applyColorPick(type, color) {
  if (type === 'text') fmtSetColor(color);
  else                 fmtSetBg(color);
}

function _fmtClosePalette() {
  if (!_fmtActivePalette) return;
  _fmtActivePalette.el.remove();
  _fmtActivePalette = null;
  document.removeEventListener('mousedown', _fmtPaletteOutside);
}

function _fmtPaletteOutside(e) {
  if (!_fmtActivePalette || _fmtActivePalette.el.contains(e.target)) return;
  // Don't close if click is on any color trigger button (they toggle)
  const triggerIds = ['fmt-textcolor-btn','fmt-fillcolor-btn','fmt-mini-textbtn','fmt-mini-fillbtn'];
  if (triggerIds.some(id => { const el = document.getElementById(id); return el && e.target.closest(`#${id}`) === el; })) return;
  _fmtClosePalette();
}

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
  // Clear previous inline styles (use removeProperty so !important styles are also cleared)
  document.querySelectorAll('td[data-fmt-applied], th[data-fmt-applied]').forEach(el => {
    el.style.removeProperty('font-weight');
    el.style.removeProperty('color');
    el.style.removeProperty('background');
    delete el.dataset.fmtApplied;
  });

  // Apply with setProperty('important') so user colours override CSS !important rules
  // on .ed (yellow bg), .formula-cell, sub-header rows, etc.
  Object.entries(CFORMAT).forEach(([key, fmt]) => {
    if (!fmt || (!fmt.bold && !fmt.color && !fmt.bg)) return;
    const td = _tdByKey(key);
    if (!td) return;
    td.dataset.fmtApplied = '1';
    if (fmt.bold)  td.style.setProperty('font-weight', 'bold',     'important');
    if (fmt.color) td.style.setProperty('color',       fmt.color,  'important');
    if (fmt.bg)    td.style.setProperty('background',  fmt.bg,     'important');
  });

  // Re-apply selection highlight (cells rebuilt after render)
  _fmtHighlight();
}

// ── Selection highlight ───────────────────────────────────────────────────────
function _fmtHighlight() {
  document.querySelectorAll('td.fmt-selected, th.fmt-selected').forEach(el => el.classList.remove('fmt-selected'));
  const keys = _fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? new Set([_fmtAnchorKey]) : new Set());
  keys.forEach(key => {
    const td = _tdByKey(key);
    if (td) td.classList.add('fmt-selected');
  });
  _fmtUpdateBar();
  _fmtShowMiniBar();
}

// ── Update formula-bar toolbar to reflect current selection ───────────────────
function _fmtUpdateBar() {
  const boldBtn  = document.getElementById('fmt-bold-btn');
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

  if (textIcon) textIcon.style.borderBottomColor = textColor;
  if (fillIcon) fillIcon.style.color = bgColor || '#e0a020';
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

// ── Public formatting API ─────────────────────────────────────────────────────
function fmtToggleBold() {
  const keys = [...(_fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? [_fmtAnchorKey] : []))];
  const allBold = keys.every(k => CFORMAT[k]?.bold);
  _applyFmtToSel(fmt => { if (allBold) delete fmt.bold; else fmt.bold = true; });
}

function fmtSetColor(color) {
  _applyFmtToSel(fmt => {
    if (!color) delete fmt.color;
    else fmt.color = color;
  });
}

function fmtSetBg(color) {
  _applyFmtToSel(fmt => {
    if (!color) delete fmt.bg;
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
  const all = Array.from(tableA.querySelectorAll('td[data-caddr], th[data-caddr]'));
  const iA  = all.indexOf(tdA), iB = all.indexOf(tdB);
  if (iA < 0 || iB < 0) return [tdA, tdB];
  const [lo, hi] = iA < iB ? [iA, iB] : [iB, iA];
  return all.slice(lo, hi + 1);
}

// ── Format Painter ────────────────────────────────────────────────────────────
let _fmtPainterBuf    = null;
let _fmtPainterActive = false;

function fmtCopyPaint() {
  const keys = [...(_fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? [_fmtAnchorKey] : []))];
  if (!keys.length) return;
  _fmtPainterBuf    = CFORMAT[keys[0]] ? { ...CFORMAT[keys[0]] } : {};
  _fmtPainterActive = true;
  document.body.classList.add('fmt-painter-mode');
  document.getElementById('fmt-paint-btn')?.classList.add('fmt-btn-active');
  document.getElementById('fmt-mini-paint')?.classList.add('fmt-btn-active');
}

function _fmtCancelPainter() {
  _fmtPainterActive = false;
  _fmtPainterBuf    = null;
  document.body.classList.remove('fmt-painter-mode');
  document.getElementById('fmt-paint-btn')?.classList.remove('fmt-btn-active');
  document.getElementById('fmt-mini-paint')?.classList.remove('fmt-btn-active');
}

// ── Mini floating toolbar (appears above/below selected cell) ─────────────────
let _fmtMiniBar   = null;
let _fmtMiniTimer = null;

function _fmtShowMiniBar() {
  clearTimeout(_fmtMiniTimer);
  const keys = [...(_fmtSelKeys.size ? _fmtSelKeys : (_fmtAnchorKey ? [_fmtAnchorKey] : []))];
  if (!keys.length) { if (_fmtMiniBar) _fmtMiniBar.style.display = 'none'; return; }

  // Small delay so activateCell() runs first — hide if a cell opened for editing
  _fmtMiniTimer = setTimeout(() => {
    if (typeof isEditActive === 'function' && isEditActive()) return;

    // Build once
    if (!_fmtMiniBar) {
      _fmtMiniBar = document.createElement('div');
      _fmtMiniBar.id = 'fmt-mini-bar';
      _fmtMiniBar.className = 'fmt-mini-bar';
      _fmtMiniBar.innerHTML =
        `<button class="fmt-btn" id="fmt-mini-bold" title="Bold (Ctrl+B)" onclick="fmtToggleBold()"><b>B</b></button>` +
        `<button class="fmt-btn fmt-color-trigger" id="fmt-mini-textbtn" title="Text color" onclick="fmtOpenPalette('text',this)"><span class="fmt-color-icon fmt-mini-text-icon">A</span><span class="fmt-arr">&#9660;</span></button>` +
        `<button class="fmt-btn fmt-color-trigger" id="fmt-mini-fillbtn" title="Fill color" onclick="fmtOpenPalette('bg',this)"><span class="fmt-color-icon fmt-mini-fill-icon">&#9632;</span><span class="fmt-arr">&#9660;</span></button>` +
        `<button id="fmt-mini-paint" class="fmt-btn" title="Format Painter: copy this cell's style, then click another cell" onclick="fmtCopyPaint()">&#x1F58C;</button>` +
        `<button class="fmt-btn fmt-clear-btn" title="Clear formatting" onclick="fmtClear()">&#10005;</button>`;
      document.body.appendChild(_fmtMiniBar);
    }

    const anchorTd = _fmtAnchorKey ? _tdByKey(_fmtAnchorKey) : null;
    if (!anchorTd) { _fmtMiniBar.style.display = 'none'; return; }

    const rect = anchorTd.getBoundingClientRect();
    if (!rect.width || rect.bottom < 0 || rect.top > window.innerHeight) {
      _fmtMiniBar.style.display = 'none'; return;
    }

    // position: fixed — use viewport coords (no scrollX/Y needed)
    const BAR_H = 34, barW = 180;
    // Prefer above the cell; fall back to below if not enough room
    let top = rect.top - BAR_H - 6;
    if (top < 55) top = rect.bottom + 4;
    let left = rect.left;
    if (left + barW > window.innerWidth - 8) left = window.innerWidth - barW - 8;

    _fmtMiniBar.style.left    = Math.max(4, left) + 'px';
    _fmtMiniBar.style.top     = top + 'px';
    _fmtMiniBar.style.display = 'flex';

    const allBold = keys.every(k => CFORMAT[k]?.bold);
    document.getElementById('fmt-mini-bold')?.classList.toggle('fmt-btn-active', allBold);
    document.getElementById('fmt-mini-paint')?.classList.toggle('fmt-btn-active', _fmtPainterActive);

    const firstFmt = CFORMAT[keys[0]] || {};
    const textIcon = _fmtMiniBar.querySelector('.fmt-mini-text-icon');
    const fillIcon = _fmtMiniBar.querySelector('.fmt-mini-fill-icon');
    if (textIcon) textIcon.style.borderBottomColor = firstFmt.color || '#212529';
    if (fillIcon) fillIcon.style.color             = firstFmt.bg    || '#e0a020';
  }, 60);
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
    // Ignore clicks inside the mini toolbar or palette (they have their own handlers)
    if (e.target.closest('#fmt-mini-bar, .fmt-palette')) return;

    const td = e.target.closest('td[data-caddr], th[data-caddr]');
    if (!td || td.classList.contains('tui-dh-td')) return;

    const key = _fmtKey(td);
    if (!key) return;

    // Format Painter: apply buffered format to clicked cell
    if (_fmtPainterActive) {
      e.preventDefault(); e.stopPropagation();
      if (_fmtPainterBuf && Object.keys(_fmtPainterBuf).length > 0) {
        CFORMAT[key] = { ..._fmtPainterBuf };
      } else {
        delete CFORMAT[key];
      }
      applyFormatting();
      if (typeof fbScheduleSave === 'function') fbScheduleSave();
      _fmtCancelPainter();
      return;
    }

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
  }, true);

  // Click (capture): prevent edit from opening on Shift+click (range select only)
  document.addEventListener('click', e => {
    if (!e.shiftKey) return;
    const td = e.target.closest('td[data-caddr], th[data-caddr]');
    if (td && !td.classList.contains('tui-dh-td')) e.stopPropagation();
  }, true);

  // Escape: cancel painter first, then clear range selection
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      _fmtClosePalette();
      if (_fmtPainterActive) { _fmtCancelPainter(); return; }
      _fmtAnchorKey = null;
      _fmtSelKeys   = new Set();
      _fmtHighlight();
    }
  });

  // Hide mini bar on scroll/resize — it will reappear on next cell click
  const _hideMiniOnScroll = () => {
    clearTimeout(_fmtMiniTimer);
    if (_fmtMiniBar) _fmtMiniBar.style.display = 'none';
  };
  window.addEventListener('scroll',  _hideMiniOnScroll, { passive: true, capture: true });
  window.addEventListener('resize',  _hideMiniOnScroll, { passive: true });
}

document.addEventListener('DOMContentLoaded', _initFormatting);
