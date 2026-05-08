// ── CHARTS ─────────────────────────────────────────────────────────────────────
// Depends on: compute.js (C), data.js (D)
// Destroys and recreates all Chart.js instances on each renderAll() call.

const chartInstances = {};

function buildCharts() {
  ['chartBar', 'chartPie', 'chartVar', 'chartLight', 'chartSign'].forEach(id => {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
  });

  const labels   = C.osRowsFull.map(r => r.label.length > 18 ? r.label.substring(0, 18) + '…' : r.label);
  const initVals = C.osRowsFull.map(r => r.init || 0);
  const curVals  = C.osRowsFull.map(r => r.cur  || 0);
  const expVals  = C.osRowsFull.map(r => r.exp  || 0);

  // Bar — Budget vs Current vs Expected
  chartInstances['chartBar'] = new Chart(document.getElementById('chartBar'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Initial',   data: initVals, backgroundColor: 'rgba(13,110,253,0.5)', borderColor: 'rgba(13,110,253,0.8)', borderWidth: 1 },
      { label: 'Current',   data: curVals,  backgroundColor: 'rgba(255,192,0,0.7)',  borderColor: '#d4a017',              borderWidth: 1 },
      { label: 'Expected',  data: expVals,  backgroundColor: 'rgba(40,167,69,0.4)',  borderColor: 'rgba(40,167,69,0.7)',  borderWidth: 1 },
    ]},
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } },
      scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { callback: v => v + 'Cr', font: { size: 9 } } } }
    }
  });

  // Doughnut — Expected distribution
  const pieData = C.osRowsFull.filter(r => (r.exp || 0) > 0);
  chartInstances['chartPie'] = new Chart(document.getElementById('chartPie'), {
    type: 'doughnut',
    data: {
      labels: pieData.map(r => r.label.length > 16 ? r.label.substring(0, 16) + '…' : r.label),
      datasets: [{ data: pieData.map(r => r.exp),
        backgroundColor: ['#0d6efd','#ffc000','#28a745','#dc3545','#fd7e14','#6610f2','#0dcaf0','#6c757d','#198754','#d63384','#20c997','#6f42c1','#0d6efd99','#ffc00099','#28a74599']
      }]
    },
    options: { responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'right', labels: { font: { size: 9 }, boxWidth: 10 } } }
    }
  });

  // Horizontal bar — Variance (Initial − Current)
  const varVals = C.osRowsFull.map(r => (r.init || 0) - (r.cur || 0));
  chartInstances['chartVar'] = new Chart(document.getElementById('chartVar'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Variance (Initial−Current)', data: varVals,
      backgroundColor: varVals.map(v => v >= 0 ? 'rgba(40,167,69,0.7)' : 'rgba(220,53,69,0.7)'), borderWidth: 1
    }]},
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: { x: { ticks: { callback: v => (v > 0 ? '+' : '') + v.toFixed(1) + 'Cr', font: { size: 9 } } }, y: { ticks: { font: { size: 8 } } } }
    }
  });

  // Pie — Lighting breakdown
  chartInstances['chartLight'] = new Chart(document.getElementById('chartLight'), {
    type: 'pie',
    data: {
      labels: D.lighting.rows.map(r => r.label),
      datasets: [{ data: D.lighting.rows.map(r => r.inclGst), backgroundColor: ['#ffc000', '#0d6efd', '#28a745'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } }
  });

  // Pie — Signage breakdown
  chartInstances['chartSign'] = new Chart(document.getElementById('chartSign'), {
    type: 'pie',
    data: {
      labels: D.signages.rows.map(r => r.label),
      datasets: [{ data: D.signages.rows.map(r => r.amt), backgroundColor: ['#ffc000', '#0d6efd', '#28a745', '#dc3545', '#fd7e14'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } }
  });
}
