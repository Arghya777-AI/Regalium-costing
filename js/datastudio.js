// ── DATA STUDIO ─────────────────────────────────────────────────────────────────
// Slide-in panel covering every editable field in D.
// Depends on: utils.js, data.js (D), compute.js (recompute), main.js (renderAll)

function openDS() {
  generateDS();
  document.getElementById('ds-panel').classList.add('open');
  document.getElementById('ds-overlay').classList.add('open');
}

function closeDS() {
  document.getElementById('ds-panel').classList.remove('open');
  document.getElementById('ds-overlay').classList.remove('open');
}

function filterDS(q) {
  q = q.toLowerCase();
  document.querySelectorAll('.ds-field').forEach(f => {
    f.classList.toggle('ds-hidden', q.length > 0 && !f.textContent.toLowerCase().includes(q));
  });
}

function refreshDS() {
  document.querySelectorAll('[data-ds-path]').forEach(input => {
    try {
      const val = getPath(input.dataset.dsPath);
      if (input.type === 'number') input.value = (val == null) ? '' : +(parseFloat(val || 0).toFixed(6));
      else input.value = (val == null) ? '' : val;
    } catch (e) {}
  });
}

// ── Path helpers ──────────────────────────────────────────────────────────────
function getPath(path) {
  return path.split('.').reduce((o, k) => o[k], D);
}
function setPath(path, val) {
  const keys = path.split('.');
  let obj = D;
  for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
  obj[keys[keys.length - 1]] = val;
}

// ── HTML builders ─────────────────────────────────────────────────────────────
function dsInput(path, isStr = false, label = '') {
  let val;
  try { val = getPath(path); } catch (e) { return ''; }
  const attrs = `data-ds-path="${path}" type="${isStr ? 'text' : 'number'}" step="any" value="${isStr ? escHtml(val || '') : +(parseFloat(val || 0).toFixed(6))}"`;
  return `<div class="ds-field">
    <span class="ds-f-label">${escHtml(label)}<span class="ds-f-path">${path}</span></span>
    <input ${attrs}>
  </div>`;
}

function dsSec(title, content) {
  return `<div class="ds-sec">
    <div class="ds-sec-hdr" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')">
      ${escHtml(title)}<span class="ds-arrow">▶</span>
    </div>
    <div class="ds-sec-body">${content}</div>
  </div>`;
}

function dsRowHdr(text) {
  return `<div class="ds-field" style="background:#f0f0f0;font-weight:700;font-size:10px;padding:6px 16px;border-bottom:1px solid #ddd">${escHtml(text)}</div>`;
}

// ── Main generator ─────────────────────────────────────────────────────────────
function generateDS() {
  const body = document.getElementById('ds-body');
  if (!body) return;
  let html = '';

  // Project Info
  html += dsSec('Project Info',
    dsInput('project.name',     true,  'Project Name') +
    dsInput('project.subtitle', true,  'Subtitle') +
    dsInput('project.asAtDate', true,  'As At Date')
  );

  // OS Rows
  let osHtml = '';
  D.os.rows.forEach((r, i) => {
    osHtml += dsRowHdr(`Row ${r.sno}: ${r.label}`);
    osHtml += dsInput(`os.rows.${i}.label`,     true,  'Label');
    osHtml += dsInput(`os.rows.${i}.init`,       false, 'Initial (Cr)');
    if (r.curDirect != null) osHtml += dsInput(`os.rows.${i}.curDirect`, false, 'Current Direct (Cr)');
    if (r.expFixed  != null) osHtml += dsInput(`os.rows.${i}.expFixed`,  false, 'Expected Fixed (Cr)');
  });
  osHtml += dsInput('os.contingencyInit', false, 'Contingency Init (Cr)');
  osHtml += dsInput('os.labourInit',      false, 'Labour Cess Init (Cr)');
  html += dsSec('OS Rows (1–13 + Contingency/Labour)', osHtml);

  // Façade
  let facHtml = '';
  D.facade.rows.forEach((r, i) => {
    facHtml += dsRowHdr(`${r.sno}: ${r.desc}`);
    facHtml += dsInput(`facade.rows.${i}.type`, true,  'Type');
    facHtml += dsInput(`facade.rows.${i}.desc`, true,  'Description');
    facHtml += dsInput(`facade.rows.${i}.qty`,  false, 'Qty (SQM)');
    facHtml += dsInput(`facade.rows.${i}.rate`, false, 'Rate (₹/SQM)');
  });
  facHtml += dsInput('facade.remaining', false, 'Remaining Balance (₹)');
  html += dsSec('Façade Rows', facHtml);

  // Parking
  let pHtml = '';
  D.parking.rows.forEach((r, i) => {
    pHtml += dsInput(`parking.rows.${i}.label`, true,  `${r.sno} label`);
    pHtml += dsInput(`parking.rows.${i}.unit`,  true,  `${r.sno} unit`);
    pHtml += dsInput(`parking.rows.${i}.qty`,   false, `${r.sno} qty`);
    pHtml += dsInput(`parking.rows.${i}.rate`,  false, `${r.sno} rate (₹)`);
  });
  pHtml += dsInput('parking.gstRate', false, 'GST Rate (decimal, e.g. 0.18)');
  html += dsSec('Parking', pHtml);

  // Landscape
  let lHtml = '';
  D.landscape.groups.forEach((g, i) => {
    lHtml += dsInput(`landscape.groups.${i}.label`, true,  `Group ${g.key} label`);
    lHtml += dsInput(`landscape.groups.${i}.amt`,   false, `Group ${g.key} amount (₹)`);
  });
  lHtml += dsInput('landscape.otherItems', false, 'Other Items Balance (₹)');
  D.landscape.details.forEach((r, i) => {
    lHtml += dsInput(`landscape.details.${i}.label`, true,  `${r.sno} label`);
    lHtml += dsInput(`landscape.details.${i}.qty`,   false, `${r.sno} qty`);
    lHtml += dsInput(`landscape.details.${i}.rate`,  false, `${r.sno} rate (₹)`);
  });
  html += dsSec('Landscape', lHtml);

  // Finishes
  let finHtml = '';
  D.finishes.rows.forEach((r, i) => {
    finHtml += dsInput(`finishes.rows.${i}.label`, true,  `Row ${r.sno} label`);
    finHtml += dsInput(`finishes.rows.${i}.amt`,   false, `Row ${r.sno} amount (₹)`);
  });
  html += dsSec('Finishes', finHtml);

  // Lighting
  let liHtml = '';
  D.lighting.rows.forEach((r, i) => {
    liHtml += dsInput(`lighting.rows.${i}.label`,   true,  `Row ${r.sno} label`);
    liHtml += dsInput(`lighting.rows.${i}.exclGst`, false, `Row ${r.sno} excl. GST (₹)`);
    liHtml += dsInput(`lighting.rows.${i}.inclGst`, false, `Row ${r.sno} incl. GST (₹)`);
  });
  html += dsSec('Lighting', liHtml);

  // MEPF
  let mHtml = '';
  D.mepf.rows.forEach((r, i) => {
    mHtml += dsInput(`mepf.rows.${i}.label`, true,  `Row ${r.sno} label`);
    mHtml += dsInput(`mepf.rows.${i}.amt`,   false, `Row ${r.sno} amount (₹)`);
  });
  html += dsSec('MEPF', mHtml);

  // Elevators
  let eHtml = dsInput('elevators.exclGst', false, 'Total Excl. GST (₹)') +
              dsInput('elevators.gstRate', false, 'GST Rate (e.g. 0.18)');
  D.elevators.main.forEach((r, i) => {
    eHtml += dsInput(`elevators.main.${i}.desc`,  true,  `Elev ${r.sno} description`);
    eHtml += dsInput(`elevators.main.${i}.amtCr`, false, `Elev ${r.sno} amount (Cr)`);
  });
  D.elevators.oos.forEach((r, i) => {
    eHtml += dsInput(`elevators.oos.${i}.label`, true,  `OOS ${r.sno} label`);
    eHtml += dsInput(`elevators.oos.${i}.amt`,   false, `OOS ${r.sno} amount (₹)`);
  });
  html += dsSec('Elevators', eHtml);

  // Signages
  let sHtml = '';
  D.signages.rows.forEach((r, i) => {
    sHtml += dsInput(`signages.rows.${i}.label`, true,  `Row ${r.sno} label`);
    sHtml += dsInput(`signages.rows.${i}.amt`,   false, `Row ${r.sno} amount (₹)`);
  });
  sHtml += dsInput('signages.gstRate', false, 'GST Rate (e.g. 0.18)');
  html += dsSec('Signages', sHtml);

  // Consultant
  let cHtml = '';
  D.consultant.main.forEach((r, i) => {
    cHtml += dsInput(`consultant.main.${i}.label`, true,  `Row ${r.sno} label`);
    cHtml += dsInput(`consultant.main.${i}.amt`,   false, `Row ${r.sno} amount (₹)`);
  });
  D.consultant.struct.forEach((r, i) => {
    cHtml += dsInput(`consultant.struct.${i}.label`, true,  `Struct ${i + 1} label`);
    cHtml += dsInput(`consultant.struct.${i}.amt`,   false, `Struct ${i + 1} amount (₹)`);
  });
  cHtml += dsInput('consultant.gstRate', false, 'GST Rate (e.g. 0.18)');
  html += dsSec('Consultant', cHtml);

  // Summary 3 Extras
  html += dsSec('Summary 3 Extras',
    dsInput('summary3.artWorks', false, 'Art Works (Cr)') +
    dsInput('summary3.notes',    true,  'Notes')
  );

  body.innerHTML = html;

  // Attach change listeners
  body.querySelectorAll('[data-ds-path]').forEach(input => {
    input.addEventListener('change', () => {
      const path = input.dataset.dsPath;
      const val  = input.type === 'text' ? input.value : parseFloat(input.value);
      if (input.type !== 'text' && isNaN(val)) return;
      setPath(path, val);
      recompute();
      renderAll();
    });
  });
}
