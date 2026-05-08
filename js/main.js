// ── MAIN ──────────────────────────────────────────────────────────────────────
// Entry point. Depends on all other JS files.

function renderAll() {
  resetEH();
  recompute();
  renderKPIs();
  renderOverview();
  renderSummary2();
  renderSummary3();
  renderFacade();
  renderParking();
  renderLandscape();
  renderFinishes();
  renderLighting();
  renderMEPF();
  renderElevators();
  renderSignages();
  renderConsultant();
  buildMEP();
  buildCharts();
  refreshDS();
  setText('proj-name', 'Regalium');
  setText('proj-subtitle', 'CONSTRUCTION COST DASHBOARD');
  const meta = document.getElementById('proj-meta');
  if (meta) meta.textContent = `As at ${D.project.asAtDate}  |  All amounts in INR Crores unless noted`;
  applyTableOps();
  if (typeof fbScheduleSave === 'function') fbScheduleSave();
}

function renderKPIs() {
  setText('kpi-init', C.totalInit.toFixed(1));
  setText('kpi-cur',  C.totalCur.toFixed(1));
  setText('kpi-exp',  C.totalExp.toFixed(1));
  const v = C.totalInit - C.totalCur;
  setText('kpi-var', (v >= 0 ? '+' : '') + v.toFixed(1));

  setText('kpi-facade-cur', (C.facadeTotal / 1e7).toFixed(2));
  const fRow = C.osRowsFull.find(r => r.sno === 4);
  setText('kpi-facade-exp', fRow ? (fRow.exp || 0).toFixed(2) : '—');
  const fv = D.os.rows.find(r => r.sno === 4);
  const fvar = document.getElementById('kpi-facade-var');
  if (fvar && fRow) fvar.textContent = ((C.facadeTotal / 1e7) - (fv && fv.init || 66.5) > 0 ? '+' : '') + ((C.facadeTotal / 1e7) - (fv && fv.init || 66.5)).toFixed(2);

  setText('kpi-park-sub',   (C.parkingSubtotal / 1e7).toFixed(2));
  setText('kpi-park-gst',   (C.parkingGST / 1e7).toFixed(2));
  setText('kpi-park-total', (C.parkingTotal / 1e7).toFixed(2));
  setText('kpi-land-total', (C.landscapeTotal / 1e7).toFixed(2));
  setText('kpi-fin-total',  (C.finishesTotal / 1e7).toFixed(2));
  setText('kpi-light-total',(C.lightingTotal / 1e7).toFixed(2));
  setText('kpi-mepf-total', (C.mepfTotal / 1e7).toFixed(2));

  setText('kpi-elev-excl',    (D.elevators.exclGst / 1e7).toFixed(2));
  setText('kpi-elev-incl',    (C.elevInclGst / 1e7).toFixed(2));
  setText('kpi-elev-incl2',   (C.elevInclGst / 1e7).toFixed(2));
  setText('kpi-elev-gstrate', (D.elevators.gstRate * 100).toFixed(0));

  setText('kpi-sign-excl', (C.signExcl / 1e7).toFixed(2));
  setText('kpi-sign-incl', (C.signIncl / 1e7).toFixed(2));

  setText('kpi-con-main-excl',   (C.conMainExcl / 1e7).toFixed(2));
  setText('kpi-con-main-incl',   (C.conMainIncl / 1e7).toFixed(2));
  setText('kpi-con-struct-excl', (C.conStructExcl / 1e7).toFixed(2));
  setText('kpi-con-struct-incl', (C.conStructIncl / 1e7).toFixed(2));
  setText('kpi-con-total',       (C.conTotal / 1e7).toFixed(2));

  setText('kpi-s2-sub1',  C.s2sub1.toFixed(1));
  setText('kpi-s2-sub2',  C.s2sub2.toFixed(1));
  setText('kpi-s2-sub3',  C.s2sub3.toFixed(1));
  setText('kpi-s2-total', (C.s2sub1 + C.s2sub2 + C.s2sub3).toFixed(1));

  setText('kpi-s3-c1',    C.s3committed1.toFixed(1));
  setText('kpi-s3-c2',    C.s3committed2.toFixed(1));
  setText('kpi-s3-total', C.s3total.toFixed(1));
}

function showTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + id).classList.add('active');
  if (btn) btn.classList.add('active');
}

document.addEventListener('DOMContentLoaded', () => {
  recompute();
  renderAll();
  renderSmartSheet();
  initTableOps();
});
