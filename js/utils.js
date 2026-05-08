// Formatting helpers
const fmt    = (v, dec = 1) => v == null ? '—' : (+v).toFixed(dec);
const fmtInr = v => v == null ? '—' : '₹' + Math.round(v).toLocaleString('en-IN');
const fmtCr  = v => v == null ? '—' : (v / 1e7).toFixed(2) + ' Cr';

function diffFmt(d) {
  if (d == null || Math.abs(d) < 0.0001) return '<span class="diff-zero">—</span>';
  return `<span class="${d > 0 ? 'diff-pos' : 'diff-neg'}">${d > 0 ? '+' : ''}${(+d).toFixed(1)}</span>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function clearTbody(id) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = '';
  return el;
}
