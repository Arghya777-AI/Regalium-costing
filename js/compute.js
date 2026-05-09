// ── FORMULA ENGINE ─────────────────────────────────────────────────────────────
// Derives all C values from D. Called before every render.
// Load order: data.js → compute.js

function recompute() {

  // ── FACADE ──
  C.facadeRowAmts = D.facade.rows.map(r =>
    (r.amtOverride != null) ? r.amtOverride : r.qty * r.rate
  );
  C.facadeRowsSum = C.facadeRowAmts.reduce((a, v) => a + v, 0);
  C.facadeTotal   = C.facadeRowsSum + D.facade.remaining;

  // ── PARKING ──
  C.parkingRowAmts  = D.parking.rows.map(r => r.qty * r.rate);
  C.parkingSubtotal = C.parkingRowAmts.reduce((a, v) => a + v, 0);
  C.parkingGST      = C.parkingSubtotal * D.parking.gstRate;
  C.parkingTotal    = C.parkingSubtotal + C.parkingGST;

  // ── LANDSCAPE ──
  C.landscapeGroupsSum  = D.landscape.groups.reduce((a, g) => a + g.amt, 0);
  C.landscapeTotal      = C.landscapeGroupsSum + D.landscape.otherItems;
  C.landscapeDetailAmts = D.landscape.details.map(r => r.qty * r.rate); // display only

  // ── FINISHES ──
  C.finishesTotal = D.finishes.rows.reduce((a, r) => a + r.amt, 0);

  // ── LIGHTING ──
  C.lightingTotal = D.lighting.rows.reduce((a, r) => a + r.inclGst, 0);

  // ── MEPF ──
  C.mepfTotal = D.mepf.rows.reduce((a, r) => a + r.amt, 0);

  // ── ELEVATORS ──
  C.elevInclGst = D.elevators.exclGst * (1 + D.elevators.gstRate);

  // ── SIGNAGES ──
  C.signExcl = D.signages.rows.reduce((a, r) => a + r.amt, 0);
  C.signIncl = C.signExcl * (1 + D.signages.gstRate);

  // ── CONSULTANT ──
  C.conMainExcl   = D.consultant.main.reduce((a, r) => a + r.amt, 0);
  C.conMainIncl   = C.conMainExcl * (1 + D.consultant.gstRate);
  C.conStructExcl = D.consultant.struct.reduce((a, r) => a + r.amt, 0);
  C.conStructIncl = C.conStructExcl * (1 + D.consultant.gstRate);
  C.conTotal      = C.conMainIncl + C.conStructIncl;

  // ── OS ROWS — resolve cur values ──
  // Rows with curDirect set use that value; others derive from their sheet total.
  const derived = {
    2:  C.finishesTotal / 1e7,
    3:  C.lightingTotal / 1e7,
    4:  C.facadeTotal   / 1e7,
    5:  C.mepfTotal     / 1e7,
    6:  C.elevInclGst   / 1e7,
    7:  C.parkingTotal  / 1e7,
    9:  C.landscapeTotal / 1e7,
    10: C.signIncl      / 1e7,
    13: C.conTotal      / 1e7,
  };
  C.osRows = D.os.rows.map(r => {
    const cur = r.curDirect != null ? r.curDirect : (derived[r.sno] ?? 0);
    const exp = r.expFixed  != null ? r.expFixed  : cur;
    return { ...r, cur, exp };
  });

  // ── CONTINGENCY & LABOUR (depend on sum of rows 1–13 only) ──
  C.cur13          = C.osRows.filter(r => r.sno < 14).reduce((a, r) => a + (r.cur || 0), 0);
  C.contingencyCur = C.cur13 * 0.026;
  C.labourCur      = C.cur13 * 0.005;

  // Patch rows 14/15 with their percentage-derived cur values (initial pass had cur=0)
  C.osRows = C.osRows.map(r => {
    if (r.sno === 14) return { ...r, cur: C.contingencyCur, exp: r.expFixed ?? C.contingencyCur };
    if (r.sno === 15) return { ...r, cur: C.labourCur,      exp: r.expFixed ?? C.labourCur };
    return r;
  });
  C.osRowsFull = C.osRows;

  // ── GRAND TOTALS ──
  C.totalInit = C.osRowsFull.reduce((a, r) => a + (r.init || 0), 0);
  C.totalCur  = C.osRowsFull.reduce((a, r) => a + (r.cur  || 0), 0);
  C.totalExp  = C.osRowsFull.reduce((a, r) => a + (r.exp  || 0), 0);

  // ── SUMMARY 2 groupings ──
  const bySnos = snos => C.osRowsFull.filter(r => snos.includes(r.sno));
  C.s2g1 = bySnos([1, 4, 5, 6, 7, 13]);   C.s2sub1 = C.s2g1.reduce((a, r) => a + (r.exp || 0), 0);
  C.s2g2 = bySnos([2, 3, 8, 9, 10, 11, 12]); C.s2sub2 = C.s2g2.reduce((a, r) => a + (r.exp || 0), 0);
  C.s2g3 = bySnos([14, 15]);               C.s2sub3 = C.s2g3.reduce((a, r) => a + (r.exp || 0), 0);

  // ── SUMMARY 3 groupings ──
  C.s3g1 = bySnos([1, 4, 5, 6, 7, 13]);
  C.s3committed1 = C.s3g1.reduce((a, r) => a + (r.exp || 0), 0);
  C.s3g2 = bySnos([3, 8, 10, 11]);
  C.s3committed2 = C.s3committed1 + C.s3g2.reduce((a, r) => a + (r.exp || 0), 0);
  C.s3g3 = bySnos([2, 9, 12, 15]);
  C.s3total = C.s3committed2 + C.s3g3.reduce((a, r) => a + (r.exp || 0), 0) + D.summary3.artWorks;
}
