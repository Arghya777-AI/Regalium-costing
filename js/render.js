// ── RENDER FUNCTIONS ──────────────────────────────────────────────────────────
// All table-rendering functions. Depends on: utils.js, data.js (D/C), edit.js (edCell)

// ── SHARED HELPER: cascade components for each OS row's sheet-derived cur ─────
// Returns the leaf data components that sum to produce the row's current value.
// Used both to make individual derived-cur cells cascade-editable in the overview,
// and to build the total-cur cascade that touches every section at once.
function _curCascComps(sno) {
  switch (sno) {
    case 2:  return D.finishes.rows.map((_, i) => ({
               getVal: () => D.finishes.rows[i].amt,
               setVal: v => { D.finishes.rows[i].amt = v; }
             }));
    case 3:  return D.lighting.rows.map((_, i) => ({
               getVal: () => D.lighting.rows[i].inclGst,
               setVal: v => { D.lighting.rows[i].inclGst = v; }
             }));
    case 4:  return [
               ...D.facade.rows.map((_, i) => ({
                 getVal: () => D.facade.rows[i].amtOverride != null
                   ? D.facade.rows[i].amtOverride
                   : D.facade.rows[i].qty * D.facade.rows[i].rate,
                 setVal: v => {
                   if (D.facade.rows[i].amtOverride != null) D.facade.rows[i].amtOverride = v;
                   else D.facade.rows[i].rate = D.facade.rows[i].qty ? v / D.facade.rows[i].qty : v;
                 }
               })),
               { getVal: () => D.facade.remaining, setVal: v => { D.facade.remaining = v; } }
             ];
    case 5:  return D.mepf.rows.map((_, i) => ({
               getVal: () => D.mepf.rows[i].amt,
               setVal: v => { D.mepf.rows[i].amt = v; }
             }));
    case 6:  return [{ getVal: () => D.elevators.exclGst, setVal: v => { D.elevators.exclGst = v; } }];
    case 7:  return D.parking.rows.map((_, i) => ({
               getVal: () => D.parking.rows[i].amtOverride != null
                 ? D.parking.rows[i].amtOverride
                 : D.parking.rows[i].qty * D.parking.rows[i].rate,
               setVal: v => {
                 if (D.parking.rows[i].amtOverride != null) D.parking.rows[i].amtOverride = v;
                 else D.parking.rows[i].rate = D.parking.rows[i].qty ? v / D.parking.rows[i].qty : v;
               }
             }));
    case 9:  return [
               ...D.landscape.groups.map((_, gi) => ({
                 getVal: () => D.landscape.groups[gi].amt,
                 setVal: v => { D.landscape.groups[gi].amt = v; }
               })),
               { getVal: () => D.landscape.otherItems, setVal: v => { D.landscape.otherItems = v; } }
             ];
    case 10: return D.signages.rows.map((_, i) => ({
               getVal: () => D.signages.rows[i].amt,
               setVal: v => { D.signages.rows[i].amt = v; }
             }));
    case 13: return [
               ...D.consultant.main.map((_, i) => ({
                 getVal: () => D.consultant.main[i].amt,
                 setVal: v => { D.consultant.main[i].amt = v; }
               })),
               ...D.consultant.struct.map((_, i) => ({
                 getVal: () => D.consultant.struct[i].amt,
                 setVal: v => { D.consultant.struct[i].amt = v; }
               }))
             ];
    default: return null;
  }
}

// Shared helper: editable exp cell for an OS row (sets expFixed to pin the value)
function _expEdCell(r) {
  const osRow = D.os.rows.find(x => x.sno === r.sno);
  if (r.sno === 14 || r.sno === 15) {
    return `<td class="num derived">${r.exp != null ? fmt(r.exp, 1) : '—'}</td>`;
  }
  if (osRow) {
    return edCell(
      () => { const cr = C.osRowsFull.find(x => x.sno === r.sno); return cr ? cr.exp : null; },
      v  => { osRow.expFixed = v; },
      { dec: 1 }
    );
  }
  return `<td class="num">${r.exp != null ? fmt(r.exp, 1) : '—'}</td>`;
}

// Shared helper: editable init cell for an OS row
function _initEdCell(r) {
  if (r.sno === 14) return edCell(() => D.os.contingencyInit, v => { D.os.contingencyInit = v; }, { dec: 1 });
  if (r.sno === 15) return edCell(() => D.os.labourInit,      v => { D.os.labourInit = v;      }, { dec: 1 });
  const osRow = D.os.rows.find(x => x.sno === r.sno);
  if (osRow) return edCell(() => osRow.init, v => { osRow.init = v; }, { dec: 1 });
  return `<td class="num">${r.init != null ? fmt(r.init, 1) : '—'}</td>`;
}

// Shared helper: editable cur cell for an OS row
function _curEdCell(r, dec = 1) {
  const osRow = D.os.rows.find(x => x.sno === r.sno);
  if ([1, 8, 11].includes(r.sno) && osRow)
    return edCell(() => osRow.curDirect, v => { osRow.curDirect = v; }, { dec });
  if (r.sno === 12 && osRow)
    return edCell(() => osRow.curDirect, v => { osRow.curDirect = (v || null); }, { dec });
  const comps = (r.sno !== 14 && r.sno !== 15) ? _curCascComps(r.sno) : null;
  return comps
    ? edCascCell(() => r.cur != null ? r.cur : 0, comps, { dec })
    : `<td class="num derived">${r.cur != null ? fmt(r.cur, dec) : '—'}</td>`;
}

// ── OVERALL SUMMARY ───────────────────────────────────────────────────────────
// ── Overview per-cell note helpers (global so onclick= survives innerHTML round-trips) ──
// col = 'sno' | 'label' | 'init' | 'cur' | 'diff' | 'exp'
function _ovNoteEdit(el, e) {
  e.stopPropagation();
  if (el.contentEditable === 'true') return;
  el.contentEditable = 'true';
  el.focus();
  const r = document.createRange(); r.selectNodeContents(el);
  window.getSelection().removeAllRanges(); window.getSelection().addRange(r);
}
function _ovNoteBlur(el) {
  el.contentEditable = 'false';
  const sno = +el.dataset.sno || el.dataset.sno;
  const col = el.dataset.col;
  const txt = el.textContent.trim();
  if (!D.os.cellNotes)       D.os.cellNotes = {};
  if (!D.os.cellNotes[sno])  D.os.cellNotes[sno] = {};
  if (txt) D.os.cellNotes[sno][col] = txt;
  else     delete D.os.cellNotes[sno][col];
  el.classList.toggle('os-note-empty', !txt);
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

function renderOverview() {
  const tb = clearTbody('tbl-overall-body'); if (!tb) return;

  C.osRowsFull.forEach(r => {
    const diff  = (r.init || 0) - (r.cur || 0);
    const osRow = D.os.rows.find(x => x.sno === r.sno);

    // ── S No cell: editable display override (doesn't affect internal computation sno)
    let snoCell;
    if (osRow) {
      const snoEid = ++EI;
      EH[snoEid] = {
        getVal:  () => osRow.displaySno != null ? String(osRow.displaySno) : String(r.sno),
        setVal:  v  => { osRow.displaySno = v && v !== String(r.sno) ? v : undefined; },
        isStr:   true,
        cascade: null
      };
      const snoDisp = osRow.displaySno != null ? escHtml(String(osRow.displaySno)) : r.sno;
      snoCell = `<td class="ctr ed" data-eid="${snoEid}">${snoDisp}</td>`;
    } else {
      snoCell = `<td class="ctr">${r.sno}</td>`;
    }

    // ── Label cell
    const labelCell = osRow
      ? edCell(() => osRow.label, v => { osRow.label = v; }, { isStr: true })
      : `<td style="font-weight:600">${escHtml(r.label)}</td>`;

    // ── initial
    let initCell;
    if (r.sno === 14) initCell = edCell(() => D.os.contingencyInit, v => { D.os.contingencyInit = v; }, { dec: 1 });
    else if (r.sno === 15) initCell = edCell(() => D.os.labourInit, v => { D.os.labourInit = v; }, { dec: 1 });
    else if (osRow) initCell = edCell(() => osRow.init, v => { osRow.init = v; }, { dec: 1 });
    else initCell = `<td class="num">${r.init != null ? fmt(r.init, 1) : '—'}</td>`;

    // ── current: direct for rows 1/8/11/12; cascade-editable for sheet-derived rows
    let curCell;
    if ([1, 8, 11].includes(r.sno) && osRow) {
      curCell = edCell(() => osRow.curDirect, v => { osRow.curDirect = v; }, { dec: 2 });
    } else if (r.sno === 12 && osRow) {
      curCell = edCell(() => osRow.curDirect, v => { osRow.curDirect = (v || null); }, { dec: 2 });
    } else {
      const comps = (r.sno !== 14 && r.sno !== 15) ? _curCascComps(r.sno) : null;
      curCell = comps
        ? edCascCell(() => r.cur != null ? r.cur : 0, comps, { dec: 2 })
        : `<td class="num derived">${r.cur != null ? fmt(r.cur, 2) : '—'}</td>`;
    }

    // ── expected: editable for rows 1–13
    const expCell = _expEdCell(r);

    const tr = document.createElement('tr');
    if (!osRow) tr.classList.add('os-comp-row');
    tr.innerHTML = `${snoCell}${labelCell}${initCell}${curCell}<td class="num">${diffFmt(diff)}</td>${expCell}`;
    tb.appendChild(tr);

    // Inject per-cell note div into every td of data rows (not computed rows 14/15)
    if (osRow) {
      const rowNotes = (D.os.cellNotes || {})[r.sno] || {};
      const colKeys  = ['sno', 'label', 'init', 'cur', 'diff', 'exp'];
      Array.from(tr.children).forEach((td, i) => {
        const col = colKeys[i]; if (!col) return;
        const txt = rowNotes[col] || '';
        const cls = 'os-note-inline' + (txt ? '' : ' os-note-empty');
        td.innerHTML += `<div class="${cls}" data-sno="${r.sno}" data-col="${col}" data-placeholder="+" onclick="_ovNoteEdit(this,event)" onblur="_ovNoteBlur(this)">${escHtml(txt)}</div>`;
      });
    }
  });

  // ── TOTAL row: cascade-editable for init, cur, and exp ──────────────────────
  // Init: scale all non-null row inits + contingency/labour inits
  const initTotalComps = [
    ...D.os.rows
      .map((r, i) => r.init != null
        ? { getVal: () => D.os.rows[i].init, setVal: v => { D.os.rows[i].init = v; } }
        : null)
      .filter(Boolean),
    { getVal: () => D.os.contingencyInit, setVal: v => { D.os.contingencyInit = v; } },
    { getVal: () => D.os.labourInit,      setVal: v => { D.os.labourInit = v; } }
  ];
  // Cur: direct-editable rows + all sheet components for derived rows
  const curTotalComps = [
    ...D.os.rows
      .filter(r => [1, 8, 11, 12].includes(r.sno) && r.curDirect != null)
      .map(r => ({ getVal: () => r.curDirect, setVal: v => { r.curDirect = v; } })),
    ...[2, 3, 4, 5, 6, 7, 9, 10, 13].flatMap(sno => _curCascComps(sno))
  ];
  // Exp: pin expFixed for all rows 1–13 (14/15 are percentage-derived, left alone)
  const expTotalComps = D.os.rows.map((r, i) => ({
    getVal: () => { const cr = C.osRowsFull.find(x => x.sno === r.sno); return cr ? (cr.exp || 0) : 0; },
    setVal: v  => { D.os.rows[i].expFixed = v; }
  }));

  const tot = document.createElement('tr'); tot.className = 'total-row';
  tot.innerHTML = `<td></td><td>TOTAL</td>`
    + edCascCell(() => C.totalInit, initTotalComps, { dec: 1 })
    + edCascCell(() => C.totalCur,  curTotalComps,  { dec: 1 })
    + `<td class="num">${diffFmt(C.totalInit - C.totalCur)}</td>`
    + edCascCell(() => C.totalExp,  expTotalComps,  { dec: 1 });
  tb.appendChild(tot);
}

// ── SUMMARY 2 ─────────────────────────────────────────────────────────────────
function renderSummary2() {
  const tb = clearTbody('tbl-s2-body'); if (!tb) return;
  function addRows(rows, sub, subLabel) {
    rows.forEach((r, i) => {
      const diff = (r.init || 0) - (r.cur || 0);
      const isLast = i === rows.length - 1;
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="ctr">${r.sno}</td><td style="font-weight:600">${escHtml(r.label)}</td>`
        + _initEdCell(r)
        + _curEdCell(r)
        + `<td class="num">${diffFmt(diff)}</td>`
        + _expEdCell(r)
        + `<td class="num">${isLast ? `<strong>${fmt(sub, 1)}</strong>` : '—'}</td>`;
      tb.appendChild(tr);
    });
    const sep = document.createElement('tr'); sep.className = 'committed-sep';
    sep.innerHTML = `<td colspan="7">▶ ${escHtml(subLabel)} — <strong>${fmt(sub, 1)} Cr</strong></td>`;
    tb.appendChild(sep);
  }
  addRows(C.s2g1, C.s2sub1, 'COST COMMITTED (STRUCTURAL)');
  addRows(C.s2g2, C.s2sub2, 'SUB-TOTAL (INTERIORS + REMAINING)');
  addRows(C.s2g3, C.s2sub3, 'ADD-ONS (CONTINGENCY + LABOUR CESS)');
  const allRows = [...C.s2g1, ...C.s2g2, ...C.s2g3];
  const tI = allRows.reduce((a, r) => a + (r.init || 0), 0);
  const tC = allRows.reduce((a, r) => a + (r.cur || 0), 0);
  const tot = document.createElement('tr'); tot.className = 'total-row';
  tot.innerHTML = `<td></td><td>TOTAL</td><td class="num">${fmt(tI, 1)}</td><td class="num derived">${fmt(tC, 1)}</td><td class="num">${diffFmt(tI - tC)}</td><td class="num derived">${fmt(C.totalExp, 1)}</td><td></td>`;
  tb.appendChild(tot);
}

// ── SUMMARY 3 ─────────────────────────────────────────────────────────────────
function renderSummary3() {
  const tb = clearTbody('tbl-s3-body'); if (!tb) return;
  const notes3 = {
    4: 'Current: Alufit 75.5 + SKK 5.9\nExpected: Alufit 79.6 + SKK 5.9',
    3: 'Façade & landscape 6.5 + Interiors 7.0 + BOH 0.9',
    2: 'Current: BOH/Service 13.3 + Lobby/Retail 63.3\nExpected: BOH/Service 13.3 + Lobby/Retail 81.7',
  };
  function addGroup(rows) {
    rows.forEach(r => {
      const diff = (r.init || 0) - (r.cur || 0);
      const noteStr = (notes3[r.sno] || '').replace(/\n/g, '<br>');
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="ctr">${r.sno}</td><td style="font-weight:600">${escHtml(r.label)}</td>`
        + _initEdCell(r)
        + _curEdCell(r)
        + `<td class="num">${diffFmt(diff)}</td>`
        + _expEdCell(r)
        + `<td style="font-size:10px;color:var(--muted)">${noteStr}</td>`;
      tb.appendChild(tr);
    });
  }
  function sep(label, val) {
    const sr = document.createElement('tr'); sr.className = 'committed-sep';
    sr.innerHTML = `<td colspan="7">▶ ${escHtml(label)} — <strong>${fmt(val, 1)} Cr</strong></td>`;
    tb.appendChild(sr);
  }
  addGroup(C.s3g1);
  sep('COST COMMITTED TILL NOW (Group 1)', C.s3committed1);
  addGroup(C.s3g2);
  sep('COST COMMITTED TILL NOW (Group 1+2)', C.s3committed2);
  addGroup(C.s3g3);
  const awTr = document.createElement('tr');
  const awCell = edCell(() => D.summary3.artWorks, v => { D.summary3.artWorks = v; }, { dec: 1 });
  awTr.innerHTML = `<td class="ctr">—</td><td style="font-weight:600">ART WORKS</td><td class="num">—</td><td class="num">—</td><td class="num">—</td>${awCell}<td style="font-size:10px;color:var(--muted)">Estimate</td>`;
  tb.appendChild(awTr);
  const tot = document.createElement('tr'); tot.className = 'total-row';
  tot.innerHTML = `<td></td><td>TOTAL</td><td class="num">—</td><td class="num">—</td><td class="num">—</td><td class="num">${fmt(C.s3total, 1)}</td><td style="font-size:11px;color:var(--muted)">Budget Cap: 600 Cr</td>`;
  tb.appendChild(tot);
}

// ── FAÇADE ────────────────────────────────────────────────────────────────────
function renderFacade() {
  const tb = clearTbody('tbl-facade-body'); if (!tb) return;
  D.facade.rows.forEach((r, i) => {
    const isHeader = Number.isInteger(+r.sno) && +r.sno > 0 && +r.sno < 10;
    const tr = document.createElement('tr');
    if (isHeader) tr.className = 'sub-header';
    const cascadeOpts = {
      getQty:       () => D.facade.rows[i].qty,
      getRate:      () => D.facade.rows[i].rate,
      getOldAmt:    () => C.facadeRowAmts[i],
      setQty:       v => { D.facade.rows[i].qty = v;  delete D.facade.rows[i].amtOverride; },
      setRate:      v => { D.facade.rows[i].rate = v; delete D.facade.rows[i].amtOverride; },
      setOverride:  v => { D.facade.rows[i].amtOverride = v; },
      clearOverride: () => { delete D.facade.rows[i].amtOverride; }
    };
    tr.innerHTML = `<td class="ctr">${escHtml(r.sno)}</td>`
      + edCell(() => D.facade.rows[i].type, v => { D.facade.rows[i].type = v; }, { isStr: true })
      + edCell(() => D.facade.rows[i].desc, v => { D.facade.rows[i].desc = v; }, { isStr: true })
      + edCell(() => D.facade.rows[i].qty,  v => { D.facade.rows[i].qty = v;  delete D.facade.rows[i].amtOverride; }, { dec: 2 })
      + edCell(() => D.facade.rows[i].rate, v => { D.facade.rows[i].rate = v; delete D.facade.rows[i].amtOverride; }, { big: true })
      + edCell(() => C.facadeRowAmts[i], () => {}, { big: true, cascade: cascadeOpts });
    tb.appendChild(tr);
  });
  const ell = document.createElement('tr');
  ell.innerHTML = `<td class="ctr">…</td><td colspan="4" style="color:var(--muted);font-style:italic">Additional façade types (FT-03 through FT-09+) — 322 rows total. Edit "Remaining Balance" below or via Data Studio.</td><td></td>`;
  tb.appendChild(ell);
  const remTr = document.createElement('tr'); remTr.className = 'sub-header';
  remTr.innerHTML = `<td></td><td colspan="4" style="text-align:right">Remaining Balance (unlisted rows)</td>`
    + edCell(() => D.facade.remaining, v => { D.facade.remaining = v; }, { big: true });
  tb.appendChild(remTr);
  // Cascade from facade total: scales each row's rate (keeping qty) + remaining
  const facadeComps = [
    ...D.facade.rows.map((_, i) => ({
      getVal: () => D.facade.rows[i].amtOverride != null
        ? D.facade.rows[i].amtOverride
        : D.facade.rows[i].qty * D.facade.rows[i].rate,
      setVal: v => {
        if (D.facade.rows[i].amtOverride != null) {
          D.facade.rows[i].amtOverride = v;
        } else {
          D.facade.rows[i].rate = D.facade.rows[i].qty ? v / D.facade.rows[i].qty : v;
        }
      }
    })),
    { getVal: () => D.facade.remaining, setVal: v => { D.facade.remaining = v; } }
  ];
  const tot = document.createElement('tr'); tot.className = 'total-row';
  tot.innerHTML = `<td colspan="5" style="text-align:right">TOTAL (incl. all rows)</td>`
    + edCascCell(() => C.facadeTotal, facadeComps, { big: true });
  tb.appendChild(tot);
}

// ── PARKING ───────────────────────────────────────────────────────────────────
function renderParking() {
  const tb = clearTbody('tbl-park-body'); if (!tb) return;
  D.parking.rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    const cascadeOpts = {
      getQty:       () => D.parking.rows[i].qty,
      getRate:      () => D.parking.rows[i].rate,
      getOldAmt:    () => C.parkingRowAmts[i],
      setQty:       v => { D.parking.rows[i].qty = v; },
      setRate:      v => { D.parking.rows[i].rate = v; },
      setOverride:  v => { D.parking.rows[i].amtOverride = v; },
      clearOverride: () => { delete D.parking.rows[i].amtOverride; }
    };
    const rowAmt = (D.parking.rows[i].amtOverride != null) ? D.parking.rows[i].amtOverride : C.parkingRowAmts[i];
    tr.innerHTML = `<td class="ctr">${escHtml(r.sno)}</td>`
      + edCell(() => D.parking.rows[i].label, v => { D.parking.rows[i].label = v; }, { isStr: true })
      + edCell(() => D.parking.rows[i].unit,  v => { D.parking.rows[i].unit = v; },  { isStr: true })
      + edCell(() => D.parking.rows[i].qty,   v => { D.parking.rows[i].qty = v;   delete D.parking.rows[i].amtOverride; }, { dec: 0 })
      + edCell(() => D.parking.rows[i].rate,  v => { D.parking.rows[i].rate = v;  delete D.parking.rows[i].amtOverride; }, { big: true })
      + edCell(() => rowAmt, () => {}, { big: true, cascade: cascadeOpts });
    tb.appendChild(tr);
  });
  // Cascade from parking subtotal: scales each row's rate (keeping qty)
  const parkSubComps = D.parking.rows.map((_, i) => ({
    getVal: () => D.parking.rows[i].amtOverride != null
      ? D.parking.rows[i].amtOverride
      : D.parking.rows[i].qty * D.parking.rows[i].rate,
    setVal: v => {
      if (D.parking.rows[i].amtOverride != null) {
        D.parking.rows[i].amtOverride = v;
      } else {
        D.parking.rows[i].rate = D.parking.rows[i].qty ? v / D.parking.rows[i].qty : v;
      }
    }
  }));
  const s = document.createElement('tr'); s.className = 'total-row';
  s.innerHTML = `<td></td><td colspan="4" style="text-align:right">Sub Total</td>`
    + edCascCell(() => C.parkingSubtotal, parkSubComps, { big: true });
  tb.appendChild(s);
  const gstTr = document.createElement('tr'); gstTr.className = 'total-row';
  gstTr.innerHTML = `<td></td><td colspan="2" style="text-align:right;font-weight:700">GST @</td>`
    + edCell(() => D.parking.gstRate * 100, v => { D.parking.gstRate = v / 100; }, { dec: 1 })
    + `<td style="text-align:right;font-weight:700">%</td><td class="num derived">${fmtInr(C.parkingGST)}</td>`;
  tb.appendChild(gstTr);
  // Cascade from grand total: same row components (GST rate stays fixed, subtotal scales)
  const g = document.createElement('tr'); g.className = 'total-row';
  g.innerHTML = `<td></td><td colspan="4" style="text-align:right">Grand Total (incl. GST)</td>`
    + edCascCell(() => C.parkingTotal, parkSubComps, { big: true });
  tb.appendChild(g);
}

// ── LANDSCAPE ─────────────────────────────────────────────────────────────────
function renderLandscape() {
  const tb = clearTbody('tbl-land-body'); if (!tb) return;
  D.landscape.groups.forEach((g, gi) => {
    const hTr = document.createElement('tr'); hTr.className = 'group-header';
    hTr.innerHTML = `<td class="ctr">${escHtml(g.key)}</td>`
      + edCell(() => D.landscape.groups[gi].label, v => { D.landscape.groups[gi].label = v; }, { isStr: true })
      + `<td></td><td></td><td></td>`
      + edCell(() => D.landscape.groups[gi].amt, v => { D.landscape.groups[gi].amt = v; }, { big: true });
    tb.appendChild(hTr);
    D.landscape.details.forEach((dr, di) => {
      if (!dr.sno.startsWith(g.key + '.')) return;
      const cascOpts = {
        getQty:       () => D.landscape.details[di].qty,
        getRate:      () => D.landscape.details[di].rate,
        getOldAmt:    () => C.landscapeDetailAmts[di],
        setQty:       v => { D.landscape.details[di].qty = v; },
        setRate:      v => { D.landscape.details[di].rate = v; },
        setOverride:  v => { D.landscape.details[di].amtOverride = v; },
        clearOverride: () => { delete D.landscape.details[di].amtOverride; }
      };
      const dTr = document.createElement('tr');
      dTr.innerHTML = `<td class="ctr" style="padding-left:20px">${escHtml(dr.sno)}</td>`
        + edCell(() => D.landscape.details[di].label, v => { D.landscape.details[di].label = v; }, { isStr: true })
        + edCell(() => D.landscape.details[di].unit || '', v => { D.landscape.details[di].unit = v; }, { isStr: true })
        + edCell(() => D.landscape.details[di].qty,  v => { D.landscape.details[di].qty = v; },  { dec: 2 })
        + edCell(() => D.landscape.details[di].rate, v => { D.landscape.details[di].rate = v; }, { big: true })
        + edCell(() => D.landscape.details[di].amtOverride ?? C.landscapeDetailAmts[di], () => {}, { big: true, cascade: cascOpts });
      tb.appendChild(dTr);
    });
  });
  const oTr = document.createElement('tr'); oTr.className = 'sub-header';
  oTr.innerHTML = `<td></td><td colspan="4" style="text-align:right">Other Items / Unlisted BOQ Balance</td>`
    + edCell(() => D.landscape.otherItems, v => { D.landscape.otherItems = v; }, { big: true });
  tb.appendChild(oTr);
  // Cascade from landscape total: scales all group amounts + otherItems
  const landComps = [
    ...D.landscape.groups.map((_, gi) => ({
      getVal: () => D.landscape.groups[gi].amt,
      setVal: v  => { D.landscape.groups[gi].amt = v; }
    })),
    { getVal: () => D.landscape.otherItems, setVal: v => { D.landscape.otherItems = v; } }
  ];
  const tot = document.createElement('tr'); tot.className = 'total-row';
  tot.innerHTML = `<td colspan="5" style="text-align:right">GRAND TOTAL (incl. GST)</td>`
    + edCascCell(() => C.landscapeTotal, landComps, { big: true });
  tb.appendChild(tot);
}

// ── FINISHES ──────────────────────────────────────────────────────────────────
function renderFinishes() {
  const tb = clearTbody('tbl-fin-body'); if (!tb) return;
  D.finishes.rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="ctr">${r.sno}</td>`
      + edCell(() => D.finishes.rows[i].label, v => { D.finishes.rows[i].label = v; }, { isStr: true })
      + edCell(() => D.finishes.rows[i].amt,   v => { D.finishes.rows[i].amt = v; },   { big: true })
      + `<td class="num derived">${(r.amt / 1e7).toFixed(2)} Cr</td>`;
    tb.appendChild(tr);
  });
  const cascComps = D.finishes.rows.map((_, i) => ({
    getVal: () => D.finishes.rows[i].amt,
    setVal: v  => { D.finishes.rows[i].amt = v; }
  }));
  const tot = document.createElement('tr'); tot.className = 'total-row';
  tot.innerHTML = `<td></td><td>TOTAL (INCL. GST)</td>`
    + edCascCell(() => C.finishesTotal, cascComps, { big: true })
    + `<td class="num derived">${(C.finishesTotal / 1e7).toFixed(2)} Cr</td>`;
  tb.appendChild(tot);
}

// ── LIGHTING ──────────────────────────────────────────────────────────────────
function renderLighting() {
  const tb = clearTbody('tbl-light-body'); if (!tb) return;
  D.lighting.rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="ctr">${r.sno}</td>`
      + edCell(() => D.lighting.rows[i].label,   v => { D.lighting.rows[i].label = v; },   { isStr: true })
      + edCell(() => D.lighting.rows[i].exclGst, v => { D.lighting.rows[i].exclGst = v; }, { big: true })
      + edCell(() => D.lighting.rows[i].inclGst, v => { D.lighting.rows[i].inclGst = v; }, { big: true });
    tb.appendChild(tr);
  });
  const exclSum = D.lighting.rows.reduce((a, r) => a + r.exclGst, 0);
  const exclComps = D.lighting.rows.map((_, i) => ({
    getVal: () => D.lighting.rows[i].exclGst,
    setVal: v  => { D.lighting.rows[i].exclGst = v; }
  }));
  const inclComps = D.lighting.rows.map((_, i) => ({
    getVal: () => D.lighting.rows[i].inclGst,
    setVal: v  => { D.lighting.rows[i].inclGst = v; }
  }));
  const tExcl = document.createElement('tr'); tExcl.className = 'total-row';
  tExcl.innerHTML = `<td></td><td>TOTAL (EXCL. GST)</td>`
    + edCascCell(() => D.lighting.rows.reduce((a, r) => a + r.exclGst, 0), exclComps, { big: true })
    + `<td class="num derived">${fmtInr(exclSum)}</td>`;
  tb.appendChild(tExcl);
  const tIncl = document.createElement('tr'); tIncl.className = 'total-row';
  tIncl.innerHTML = `<td></td><td>TOTAL (INCL. GST)</td>`
    + edCascCell(() => C.lightingTotal, inclComps, { big: true })
    + `<td class="num derived">${fmtInr(C.lightingTotal)}</td>`;
  tb.appendChild(tIncl);
}

// ── MEPF ─────────────────────────────────────────────────────────────────────
function renderMEPF() {
  const tb = clearTbody('tbl-mepf-body'); if (!tb) return;
  D.mepf.rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    const pill = { awarded: 'pill-awarded', progress: 'pill-progress', pending: 'pill-pending' }[r.cls] || '';
    const statusId = ++EI;
    EH[statusId] = {
      getVal: () => D.mepf.rows[i].status,
      setVal: v => {
        D.mepf.rows[i].status = v;
        const lo = v.toLowerCase();
        D.mepf.rows[i].cls = lo.includes('award') ? 'awarded' : lo.includes('progress') || lo.includes('tender') ? 'progress' : 'pending';
      },
      isStr: true, cascade: null
    };
    tr.innerHTML = `<td class="ctr">${r.sno}</td>`
      + edCell(() => D.mepf.rows[i].label, v => { D.mepf.rows[i].label = v; }, { isStr: true })
      + edCell(() => D.mepf.rows[i].amt,   v => { D.mepf.rows[i].amt = v; },   { big: true })
      + `<td class="num derived">${(r.amt / 1e7).toFixed(2)} Cr</td>`
      + `<td class="ed" data-eid="${statusId}"><span class="badge-pill ${pill}">${escHtml(r.status)}</span></td>`;
    tb.appendChild(tr);
  });
  const cascComps = D.mepf.rows.map((_, i) => ({
    getVal: () => D.mepf.rows[i].amt,
    setVal: v  => { D.mepf.rows[i].amt = v; }
  }));
  const tot = document.createElement('tr'); tot.className = 'total-row';
  tot.innerHTML = `<td></td><td>TOTAL</td>`
    + edCascCell(() => C.mepfTotal, cascComps, { big: true })
    + `<td class="num derived">${(C.mepfTotal / 1e7).toFixed(2)} Cr</td><td></td>`;
  tb.appendChild(tot);
}

// ── ELEVATORS ────────────────────────────────────────────────────────────────
function renderElevators() {
  let tb = clearTbody('tbl-elev-body'); if (!tb) return;
  D.elevators.main.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="ctr">${r.sno}</td>`
      + edCell(() => D.elevators.main[i].desc, v => { D.elevators.main[i].desc = v; }, { isStr: true })
      + edCell(() => D.elevators.main[i].tot,  v => { D.elevators.main[i].tot = v; },  { dec: 0 })
      + edCell(() => D.elevators.main[i].cA,   v => { D.elevators.main[i].cA = v; },   { dec: 0 })
      + edCell(() => D.elevators.main[i].cB,   v => { D.elevators.main[i].cB = v; },   { dec: 0 })
      + edCell(() => D.elevators.main[i].amtCr, v => { D.elevators.main[i].amtCr = v; }, { dec: 2 });
    tb.appendChild(tr);
  });
  const totTot   = D.elevators.main.reduce((a, r) => a + (+r.tot  || 0), 0);
  const totCa    = D.elevators.main.reduce((a, r) => a + (+r.cA   || 0), 0);
  const totCb    = D.elevators.main.reduce((a, r) => a + (+r.cB   || 0), 0);
  const totAmtCr = D.elevators.main.reduce((a, r) => a + (+r.amtCr || 0), 0);
  const tot = document.createElement('tr'); tot.className = 'total-row';
  tot.innerHTML = `<td></td><td>TOTAL</td><td class="num">${totTot}</td><td class="num">${totCa}</td><td class="num">${totCb}</td><td class="num">${totAmtCr.toFixed(2)} Cr</td>`;
  tb.appendChild(tot);

  tb = clearTbody('tbl-elev-oos'); if (!tb) return;
  D.elevators.oos.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="ctr">${r.sno}</td>`
      + edCell(() => D.elevators.oos[i].label, v => { D.elevators.oos[i].label = v; }, { isStr: true })
      + edCell(() => D.elevators.oos[i].amt,   v => { D.elevators.oos[i].amt = v; },   { big: true });
    tb.appendChild(tr);
  });
  const exclTr = document.createElement('tr'); exclTr.className = 'sub-header';
  exclTr.innerHTML = `<td></td><td style="text-align:right">TOTAL EXCL. GST (editable)</td>`
    + edCell(() => D.elevators.exclGst, v => { D.elevators.exclGst = v; }, { big: true });
  tb.appendChild(exclTr);
  const gstRateTr = document.createElement('tr'); gstRateTr.className = 'sub-header';
  gstRateTr.innerHTML = `<td></td><td style="text-align:right">GST Rate (%)</td>`
    + edCell(() => D.elevators.gstRate * 100, v => { D.elevators.gstRate = v / 100; }, { dec: 1 });
  tb.appendChild(gstRateTr);
  const inclTr = document.createElement('tr'); inclTr.className = 'total-row';
  inclTr.innerHTML = `<td></td><td style="text-align:right"><strong>TOTAL INCL. GST (computed)</strong></td><td class="num derived"><strong>${fmtInr(C.elevInclGst)}</strong></td>`;
  tb.appendChild(inclTr);
}

// ── SIGNAGES ─────────────────────────────────────────────────────────────────
function renderSignages() {
  const tb = clearTbody('tbl-sign-body'); if (!tb) return;
  D.signages.rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="ctr">${r.sno}</td>`
      + edCell(() => D.signages.rows[i].label, v => { D.signages.rows[i].label = v; }, { isStr: true })
      + edCell(() => D.signages.rows[i].amt,   v => { D.signages.rows[i].amt = v; },   { big: true })
      + `<td class="num derived">${(r.amt / 1e7).toFixed(2)} Cr</td>`;
    tb.appendChild(tr);
  });
  const gstRateTr = document.createElement('tr'); gstRateTr.className = 'sub-header';
  gstRateTr.innerHTML = `<td></td><td style="text-align:right">GST Rate (%)</td>`
    + edCell(() => D.signages.gstRate * 100, v => { D.signages.gstRate = v / 100; }, { dec: 1 })
    + `<td></td>`;
  tb.appendChild(gstRateTr);
  const signExclComps = D.signages.rows.map((_, i) => ({
    getVal: () => D.signages.rows[i].amt,
    setVal: v  => { D.signages.rows[i].amt = v; }
  }));
  const tExcl = document.createElement('tr'); tExcl.className = 'total-row';
  tExcl.innerHTML = `<td></td><td>TOTAL (EXCL. GST)</td>`
    + edCascCell(() => C.signExcl, signExclComps, { big: true })
    + `<td class="num derived">${(C.signExcl / 1e7).toFixed(2)} Cr</td>`;
  tb.appendChild(tExcl);
  const tIncl = document.createElement('tr'); tIncl.className = 'total-row';
  tIncl.innerHTML = `<td></td><td>TOTAL (INCL. GST)</td><td class="num derived">${fmtInr(C.signIncl)}</td><td class="num derived">${(C.signIncl / 1e7).toFixed(2)} Cr</td>`;
  tb.appendChild(tIncl);
}

// ── CONSULTANT ───────────────────────────────────────────────────────────────
function renderConsultant() {
  let tb = clearTbody('tbl-con-body'); if (!tb) return;
  D.consultant.main.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="ctr">${r.sno}</td>`
      + edCell(() => D.consultant.main[i].label, v => { D.consultant.main[i].label = v; }, { isStr: true })
      + edCell(() => D.consultant.main[i].amt,   v => { D.consultant.main[i].amt = v; },   { big: true })
      + `<td class="num derived">${(r.amt / 1e7).toFixed(2)} Cr</td>`;
    tb.appendChild(tr);
  });
  const mainComps = D.consultant.main.map((_, i) => ({
    getVal: () => D.consultant.main[i].amt,
    setVal: v  => { D.consultant.main[i].amt = v; }
  }));
  const tMainExcl = document.createElement('tr'); tMainExcl.className = 'total-row';
  tMainExcl.innerHTML = `<td></td><td>TOTAL (EXCL. GST)</td>`
    + edCascCell(() => C.conMainExcl, mainComps, { big: true })
    + `<td class="num derived">${(C.conMainExcl / 1e7).toFixed(2)} Cr</td>`;
  tb.appendChild(tMainExcl);
  const tMainIncl = document.createElement('tr'); tMainIncl.className = 'total-row';
  tMainIncl.innerHTML = `<td></td><td>TOTAL (INCL. GST)</td><td class="num derived">${fmtInr(C.conMainIncl)}</td><td class="num derived">${(C.conMainIncl / 1e7).toFixed(2)} Cr</td>`;
  tb.appendChild(tMainIncl);

  tb = clearTbody('tbl-con2-body'); if (!tb) return;
  D.consultant.struct.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = edCell(() => D.consultant.struct[i].label, v => { D.consultant.struct[i].label = v; }, { isStr: true })
      + edCell(() => D.consultant.struct[i].amt,   v => { D.consultant.struct[i].amt = v; },   { big: true })
      + `<td class="num derived">${(r.amt / 1e7).toFixed(2)} Cr</td>`;
    tb.appendChild(tr);
  });
  const gstRateTr = document.createElement('tr'); gstRateTr.className = 'sub-header';
  gstRateTr.innerHTML = `<td style="text-align:right">GST Rate (%)</td>`
    + edCell(() => D.consultant.gstRate * 100, v => { D.consultant.gstRate = v / 100; }, { dec: 1 })
    + `<td></td>`;
  tb.appendChild(gstRateTr);
  const structComps = D.consultant.struct.map((_, i) => ({
    getVal: () => D.consultant.struct[i].amt,
    setVal: v  => { D.consultant.struct[i].amt = v; }
  }));
  const tStructExcl = document.createElement('tr'); tStructExcl.className = 'total-row';
  tStructExcl.innerHTML = `<td>Total without GST</td>`
    + edCascCell(() => C.conStructExcl, structComps, { big: true })
    + `<td class="num derived">${(C.conStructExcl / 1e7).toFixed(2)} Cr</td>`;
  tb.appendChild(tStructExcl);
  const tStructIncl = document.createElement('tr'); tStructIncl.className = 'total-row';
  tStructIncl.innerHTML = `<td>Total with GST</td><td class="num derived">${fmtInr(C.conStructIncl)}</td><td class="num derived">${(C.conStructIncl / 1e7).toFixed(2)} Cr</td>`;
  tb.appendChild(tStructIncl);
}

// ── MEP COSTPLAN ─────────────────────────────────────────────────────────────
function buildMEP() {
  const tb = clearTbody('tbl-mep-body'); if (!tb) return;
  D.mepCostplan.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (r.level === 'H')      tr.className = 'mep-section';
    else if (r.level === 'S') tr.className = 'mep-sub';
    else if (r.level === 'D') tr.className = 'pink-row';
    tr.innerHTML = `<td class="ctr">${escHtml(r.code || '')}</td>`
      + edCell(() => D.mepCostplan[i].label,      v => { D.mepCostplan[i].label = v;      }, { isStr: true })
      + edCell(() => D.mepCostplan[i].init,       v => { D.mepCostplan[i].init = v;       }, { big: true })
      + edCell(() => D.mepCostplan[i].r2,         v => { D.mepCostplan[i].r2 = v;         }, { big: true })
      + edCell(() => D.mepCostplan[i].r3,         v => { D.mepCostplan[i].r3 = v;         }, { big: true })
      + edCell(() => D.mepCostplan[i].r4,         v => { D.mepCostplan[i].r4 = v;         }, { big: true })
      + edCell(() => D.mepCostplan[i].r5,         v => { D.mepCostplan[i].r5 = v;         }, { big: true })
      + edCell(() => D.mepCostplan[i].internal,   v => { D.mepCostplan[i].internal = v;   }, { big: true })
      + edCell(() => D.mepCostplan[i].consultant, v => { D.mepCostplan[i].consultant = v; }, { big: true })
      + edCell(() => D.mepCostplan[i].rmk,        v => { D.mepCostplan[i].rmk = v;        }, { isStr: true });
    tb.appendChild(tr);
  });
}
