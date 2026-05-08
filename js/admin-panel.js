// ── ADMIN PANEL ───────────────────────────────────────────────────────────────
// Full admin interface: Users · Access Requests · Activity Log · Analytics
// Only accessible when window._amRole === 'admin'

let _apTab         = 'users';
let _apUsersUnsub  = null;
let _apReqsUnsub   = null;
let _apActLastDoc  = null;
const _AP_PAGE     = 100;

// ── Panel lifecycle ───────────────────────────────────────────────────────────

function apOpen() {
  if (window._amRole !== 'admin') return;
  let el = document.getElementById('am-admin-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'am-admin-panel';
    el.innerHTML = _apShell();
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
  apSwitchTab('users');
}

function apClose() {
  const el = document.getElementById('am-admin-panel');
  if (el) el.style.display = 'none';
  if (_apUsersUnsub) { _apUsersUnsub(); _apUsersUnsub = null; }
  if (_apReqsUnsub)  { _apReqsUnsub();  _apReqsUnsub  = null; }
}

function apSwitchTab(tab) {
  _apTab = tab;
  document.querySelectorAll('#am-admin-panel .ap-tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('#am-admin-panel .ap-content').forEach(c =>
    c.style.display = c.id === `apc-${tab}` ? 'flex' : 'none');
  if (tab === 'users')     _apLoadUsers();
  if (tab === 'requests')  _apLoadRequests();
  if (tab === 'activity')  _apInitActivity();
  if (tab === 'analytics') _apLoadAnalytics();
}

function _apShell() {
  return `
  <div class="ap-panel">
    <div class="ap-header">
      <div class="ap-logo">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="opacity:.8"><path d="M17 11c.34 0 .67.03 1 .08V6.27L10 3 3 6.27V11c0 4.52 2.98 8.69 7 9.93 1.47-.43 2.79-1.3 3.9-2.43A7 7 0 0 1 17 11zm-7 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/><circle cx="17" cy="18" r="5" fill="#22c55e"/><path d="M16 20.5l-2-2 1.5-1.5.5.5 2.5-2.5 1.5 1.5-4 4z" fill="#fff"/></svg>
        Admin Panel
      </div>
      <div class="ap-tabs">
        <button class="ap-tab-btn active" data-tab="users"     onclick="apSwitchTab('users')">Users</button>
        <button class="ap-tab-btn"        data-tab="requests"  onclick="apSwitchTab('requests')">
          Requests&nbsp;<span id="ap-req-count" class="ap-count-badge" style="display:none">0</span>
        </button>
        <button class="ap-tab-btn"        data-tab="activity"  onclick="apSwitchTab('activity')">Activity Log</button>
        <button class="ap-tab-btn"        data-tab="analytics" onclick="apSwitchTab('analytics')">Analytics</button>
      </div>
      <button class="ap-close-btn" onclick="apClose()" title="Close admin panel">✕</button>
    </div>
    <div class="ap-body">
      <div id="apc-users"     class="ap-content" style="display:flex;flex-direction:column;gap:14px"></div>
      <div id="apc-requests"  class="ap-content" style="display:none;flex-direction:column;gap:10px"></div>
      <div id="apc-activity"  class="ap-content" style="display:none;flex-direction:column;gap:10px"></div>
      <div id="apc-analytics" class="ap-content" style="display:none;flex-direction:column;gap:16px"></div>
    </div>
  </div>`;
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function _apLoadUsers() {
  const el = document.getElementById('apc-users');
  if (!el || !_db) return;
  el.innerHTML = '<div class="ap-spinner-row">Loading…</div>';
  if (_apUsersUnsub) _apUsersUnsub();
  _apUsersUnsub = _db.collection('users').orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _apRenderUsers(el, users);
    }, e => { el.innerHTML = `<div class="ap-err-msg">Error: ${escHtml(e.message)}</div>`; });
}

function _apRenderUsers(el, users) {
  el.innerHTML = `
  <div class="ap-toolbar">
    <input type="email" id="ap-new-email" class="ap-inp" placeholder="new.user@example.com" style="flex:1;min-width:200px">
    <select id="ap-new-role" class="ap-sel">
      <option value="viewer">Viewer</option>
      <option value="editor">Editor</option>
      <option value="admin">Admin</option>
    </select>
    <button class="ap-btn-primary" onclick="apAddUser()">+ Add User</button>
    <button class="ap-btn-sec" onclick="apBulkImport()">⬆ Bulk Import</button>
    <input type="search" class="ap-inp" placeholder="Search…" oninput="_apFilterUsers(this.value)" style="margin-left:auto;max-width:200px">
  </div>
  <div class="ap-tbl-wrap">
    <table class="ap-tbl">
      <thead><tr>
        <th style="min-width:180px">User</th>
        <th>Email</th>
        <th style="width:110px">Role</th>
        <th style="width:80px">Status</th>
        <th style="width:150px">Created</th>
        <th style="width:150px">Last Seen</th>
        <th style="width:100px">Actions</th>
      </tr></thead>
      <tbody id="ap-user-tbody">
        ${users.length ? users.map(_apUserRow).join('') : '<tr><td colspan="7" class="ap-empty">No users yet.</td></tr>'}
      </tbody>
    </table>
  </div>`;
}

function _apUserRow(u) {
  const inits = (u.name || u.email || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const avatar = u.photoURL
    ? `<img src="${u.photoURL}" class="ap-avatar" referrerpolicy="no-referrer">`
    : `<div class="ap-avatar-ph">${inits}</div>`;
  const sinceDate = u.createdAt?.toDate?.();
  const sinceStr  = sinceDate ? sinceDate.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'2-digit' }) : '—';
  const seenDate  = u.lastSeen?.toDate?.();
  const seenStr   = seenDate  ? seenDate.toLocaleString('en-IN',  { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : 'Never';
  const isPreset  = _AM_ADMINS.includes((u.email || '').toLowerCase());

  const roleCell = isPreset
    ? `<span class="ap-role-fixed">${u.role}</span>`
    : `<select class="ap-role-sel" onchange="apChangeRole('${u.id}',this.value)">
        ${['viewer','editor','admin'].map(r => `<option value="${r}"${u.role===r?' selected':''}>${r}</option>`).join('')}
      </select>`;

  const actions = isPreset
    ? `<span class="ap-muted" style="font-size:11px">preset</span>`
    : (u.status === 'suspended'
        ? `<button class="ap-act-btn ap-act-ok"  onclick="apActivateUser('${u.id}')" title="Activate">✓</button>`
        : `<button class="ap-act-btn ap-act-warn" onclick="apSuspendUser('${u.id}')"  title="Suspend">⊘</button>`)
      + `<button class="ap-act-btn ap-act-del" onclick="apDeleteUser('${u.id}','${escHtml(u.email||'')}')" title="Delete">✕</button>`;

  return `<tr data-email="${escHtml((u.email||'').toLowerCase())}">
    <td><div class="ap-user-cell">${avatar}<span>${escHtml(u.name||u.email||'')}</span></div></td>
    <td style="font-size:12px">${escHtml(u.email||'')}</td>
    <td>${roleCell}</td>
    <td><span class="ap-status ap-s-${u.status||'active'}">${u.status||'active'}</span></td>
    <td class="ap-muted" style="font-size:11px">${escHtml(u.createdBy||'system')} · ${sinceStr}</td>
    <td class="ap-muted" style="font-size:11px">${seenStr}</td>
    <td class="ap-actions">${actions}</td>
  </tr>`;
}

function _apFilterUsers(q) {
  const tbody = document.getElementById('ap-user-tbody');
  if (!tbody) return;
  tbody.querySelectorAll('tr[data-email]').forEach(r => {
    const match = !q || r.dataset.email.includes(q.toLowerCase()) || r.textContent.toLowerCase().includes(q.toLowerCase());
    r.style.display = match ? '' : 'none';
  });
}

async function apAddUser() {
  const email = (document.getElementById('ap-new-email')?.value || '').trim().toLowerCase();
  const role  = document.getElementById('ap-new-role')?.value || 'viewer';
  if (!email || !email.includes('@')) { alert('Enter a valid email address.'); return; }
  const snap = await _db.collection('users').where('email','==',email).limit(1).get();
  if (!snap.empty) { alert(`${email} already exists.`); return; }
  await _db.collection('users').add({
    email, name: email, photoURL: null, uid: null, role,
    status: 'active', createdBy: window._amUser?.email || 'admin',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastSeen: null
  });
  document.getElementById('ap-new-email').value = '';
  atLog('admin_add_user', `Added ${email} as ${role}`);
  if (typeof kbToast === 'function') kbToast(`✓ Added ${email} as ${role}`);
}

async function apChangeRole(docId, role) {
  const snap = await _db.collection('users').doc(docId).get();
  const prev = snap.data()?.role;
  const email = snap.data()?.email;
  await _db.collection('users').doc(docId).update({ role });
  atLog('admin_change_role', `${email}: ${prev} → ${role}`);
  if (typeof kbToast === 'function') kbToast(`✓ ${email} is now ${role}`);
}

async function apSuspendUser(docId) {
  if (!confirm('Suspend this user? They will be blocked from accessing the dashboard.')) return;
  const snap = await _db.collection('users').doc(docId).get();
  await _db.collection('users').doc(docId).update({ status: 'suspended' });
  atLog('admin_suspend_user', `Suspended ${snap.data()?.email}`);
}

async function apActivateUser(docId) {
  const snap = await _db.collection('users').doc(docId).get();
  await _db.collection('users').doc(docId).update({ status: 'active' });
  atLog('admin_activate_user', `Activated ${snap.data()?.email}`);
}

async function apDeleteUser(docId, email) {
  if (!confirm(`Permanently delete user ${email}?\n\nThis cannot be undone.`)) return;
  await _db.collection('users').doc(docId).delete();
  atLog('admin_delete_user', `Deleted ${email}`);
  if (typeof kbToast === 'function') kbToast(`✓ Deleted ${email}`);
}

// ── Bulk import ───────────────────────────────────────────────────────────────

function apBulkImport() {
  let modal = document.getElementById('ap-bulk-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'ap-bulk-modal';
    modal.className = 'ap-modal-wrap';
    modal.innerHTML = `
    <div class="ap-modal">
      <div class="ap-modal-hdr">
        <span>Bulk Import Users</span>
        <button onclick="document.getElementById('ap-bulk-modal').style.display='none'">✕</button>
      </div>
      <div class="ap-modal-body">
        <p class="ap-card-note" style="margin:0 0 8px">Paste a list of email addresses (one per line), or upload a file. Use AI to extract emails from any text.</p>
        <textarea id="ap-bulk-txt" class="ap-textarea" rows="7" placeholder="email@example.com&#10;another@example.com&#10;…"></textarea>
        <div class="ap-modal-row" style="margin-top:8px">
          <input type="file" id="ap-bulk-file" accept=".csv,.txt,.xlsx,.xls" style="display:none" onchange="apBulkFile(this)">
          <button class="ap-btn-sec" onclick="document.getElementById('ap-bulk-file').click()">📁 Upload File</button>
          <button class="ap-btn-sec" onclick="apBulkAI()">✨ Parse with AI</button>
          <select id="ap-bulk-role" class="ap-sel">
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
          </select>
          <button class="ap-btn-primary" onclick="apBulkSave()">Import</button>
        </div>
        <div id="ap-bulk-preview" class="ap-muted" style="font-size:12px;margin-top:6px"></div>
      </div>
    </div>`;
    document.body.appendChild(modal);
  }
  document.getElementById('ap-bulk-txt').value = '';
  document.getElementById('ap-bulk-preview').textContent = '';
  modal.style.display = 'flex';
}

function apBulkFile(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const emails = (String(e.target.result).match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || []);
    document.getElementById('ap-bulk-txt').value = emails.join('\n');
    document.getElementById('ap-bulk-preview').textContent = `Found ${emails.length} email(s)`;
  };
  reader.readAsText(file);
}

async function apBulkAI() {
  const txt = (document.getElementById('ap-bulk-txt')?.value || '').trim();
  if (!txt) return;
  const key = typeof getApiKey === 'function' ? getApiKey() : '';
  if (!key) { alert('Set your Anthropic API key first (top-right AI Key button).'); return; }
  const prev = document.getElementById('ap-bulk-preview');
  if (prev) prev.textContent = 'Parsing with AI…';
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': key, 'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', max_tokens: 512,
        messages: [{ role: 'user', content: `Extract all email addresses from the text below. Return them one per line, nothing else.\n\n${txt}` }]
      })
    });
    const data  = await resp.json();
    const lines = (data.content?.[0]?.text || '').trim();
    document.getElementById('ap-bulk-txt').value = lines;
    const count = lines.split('\n').filter(l => l.includes('@')).length;
    if (prev) prev.textContent = `Found ${count} email(s)`;
  } catch (e) {
    if (prev) prev.textContent = `AI error: ${e.message}`;
  }
}

async function apBulkSave() {
  const role   = document.getElementById('ap-bulk-role')?.value || 'viewer';
  const emails = (document.getElementById('ap-bulk-txt')?.value || '')
    .split('\n').map(l => l.trim().toLowerCase()).filter(l => l.includes('@'));
  if (!emails.length) { alert('No valid emails found.'); return; }
  const prev = document.getElementById('ap-bulk-preview');
  if (prev) prev.textContent = `Importing ${emails.length}…`;
  let added = 0, skipped = 0;
  for (const email of emails) {
    const snap = await _db.collection('users').where('email','==',email).limit(1).get();
    if (!snap.empty) { skipped++; continue; }
    await _db.collection('users').add({
      email, name: email, photoURL: null, uid: null, role,
      status: 'active', createdBy: window._amUser?.email || 'admin',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastSeen: null
    });
    added++;
  }
  atLog('admin_bulk_import', `Bulk imported ${added} as ${role} (${skipped} skipped)`);
  document.getElementById('ap-bulk-modal').style.display = 'none';
  if (typeof kbToast === 'function') kbToast(`✓ Imported ${added} users (${skipped} already existed)`);
}

// ── Access Requests tab ───────────────────────────────────────────────────────

function _apLoadRequests() {
  const el = document.getElementById('apc-requests');
  if (!el || !_db) return;
  el.innerHTML = '<div class="ap-spinner-row">Loading…</div>';
  if (_apReqsUnsub) _apReqsUnsub();
  _apReqsUnsub = _db.collection('access_requests').orderBy('requestedAt', 'desc')
    .onSnapshot(snap => {
      const all      = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const pending  = all.filter(r => r.status === 'pending');
      const reviewed = all.filter(r => r.status !== 'pending');
      const badge    = document.getElementById('ap-req-count');
      if (badge) { badge.textContent = pending.length; badge.style.display = pending.length ? 'inline' : 'none'; }
      _apRenderRequests(el, pending, reviewed);
    }, e => { el.innerHTML = `<div class="ap-err-msg">${escHtml(e.message)}</div>`; });
}

function _apRenderRequests(el, pending, reviewed) {
  el.innerHTML = `
  <div class="ap-sect-head">Pending (${pending.length})</div>
  ${pending.length ? pending.map(r => _apReqRow(r, true)).join('') : '<div class="ap-empty">No pending requests.</div>'}
  ${reviewed.length ? `<div class="ap-sect-head" style="margin-top:12px">Reviewed (${reviewed.length})</div>
  ${reviewed.map(r => _apReqRow(r, false)).join('')}` : ''}`;
}

function _apReqRow(r, isPending) {
  const when = r.requestedAt?.toDate?.()?.toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) || '—';
  const photo = r.photoURL
    ? `<img src="${r.photoURL}" class="ap-avatar" referrerpolicy="no-referrer">`
    : `<div class="ap-avatar-ph">${(r.email||'?')[0].toUpperCase()}</div>`;
  const actions = isPending
    ? `<button class="ap-btn-sm ap-btn-sm-green"    onclick="apApproveReq('${r.id}','viewer')">✓ Viewer</button>
       <button class="ap-btn-sm ap-btn-sm-primary"  onclick="apApproveReq('${r.id}','editor')">✓ Editor</button>
       <button class="ap-btn-sm ap-btn-sm-danger"   onclick="apDenyReq('${r.id}')">✕ Deny</button>`
    : `<span class="ap-status ap-s-${r.status}">${r.status}</span>
       ${r.reviewedBy ? `<span class="ap-muted" style="font-size:11px">by ${escHtml(r.reviewedBy)}</span>` : ''}`;
  return `<div class="ap-req-row">
    <div class="ap-req-info">
      ${photo}
      <div>
        <div style="font-weight:600;font-size:13px">${escHtml(r.name||r.email)}</div>
        <div class="ap-muted" style="font-size:11px">${escHtml(r.email||'')} · ${when} · ${escHtml(r.ip||'')} · ${escHtml(r.location||'')}</div>
        ${r.message ? `<div class="ap-req-note">"${escHtml(r.message)}"</div>` : ''}
      </div>
    </div>
    <div class="ap-req-actions">${actions}</div>
  </div>`;
}

async function apApproveReq(reqId, role) {
  const snap = await _db.collection('access_requests').doc(reqId).get();
  const req  = snap.data(); if (!req) return;
  await _db.collection('access_requests').doc(reqId).update({
    status: 'approved', reviewedBy: window._amUser.email,
    reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  const existing = await _db.collection('users').where('email','==',req.email).limit(1).get();
  if (existing.empty) {
    await _db.collection('users').add({
      email: req.email, name: req.name || req.email, photoURL: req.photoURL || null,
      uid: req.uid || null, role, status: 'active',
      createdBy: window._amUser.email, createdAt: firebase.firestore.FieldValue.serverTimestamp(), lastSeen: null
    });
  }
  atLog('admin_approve_request', `Approved ${req.email} as ${role}`);
  if (typeof kbToast === 'function') kbToast(`✓ Approved ${req.email} as ${role}`);
}

async function apDenyReq(reqId) {
  if (!confirm('Deny this access request?')) return;
  const snap = await _db.collection('access_requests').doc(reqId).get();
  await _db.collection('access_requests').doc(reqId).update({
    status: 'denied', reviewedBy: window._amUser.email,
    reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  atLog('admin_deny_request', `Denied ${snap.data()?.email}`);
}

// ── Activity Log tab ──────────────────────────────────────────────────────────

let _apActFilters = { email: '', action: '' };

function _apInitActivity() {
  _apActLastDoc = null;
  const el = document.getElementById('apc-activity');
  if (!el) return;
  el.innerHTML = `
  <div class="ap-toolbar" style="flex-wrap:wrap;gap:8px">
    <input type="search" class="ap-inp" placeholder="Filter by email…"
           oninput="_apActFilters.email=this.value;_apActRefresh()" style="flex:1;min-width:160px;max-width:260px">
    <select class="ap-sel" onchange="_apActFilters.action=this.value;_apActRefresh()">
      <option value="">All actions</option>
      ${['login','logout','tab_switch','edit','save_view','load_view','reset',
         'admin_add_user','admin_change_role','admin_suspend_user','admin_activate_user',
         'admin_approve_request','admin_deny_request','admin_bulk_import','admin_delete_user']
        .map(a => `<option value="${a}">${a}</option>`).join('')}
    </select>
    <button class="ap-btn-sec" onclick="_apActFilters={email:'',action:''};document.querySelectorAll('#apc-activity .ap-inp,#apc-activity .ap-sel').forEach(e=>e.value='');_apActRefresh()">Clear</button>
  </div>
  <div class="ap-tbl-wrap" style="flex:1;min-height:0;overflow-y:auto">
    <table class="ap-tbl">
      <thead><tr>
        <th style="width:145px">Time</th>
        <th style="width:180px">User</th>
        <th style="width:70px">Role</th>
        <th style="width:130px">Action</th>
        <th>Details</th>
        <th style="width:80px">Tab</th>
        <th style="width:100px">IP</th>
        <th style="width:120px">Location</th>
      </tr></thead>
      <tbody id="ap-act-tbody"><tr><td colspan="8" class="ap-empty">Loading…</td></tr></tbody>
    </table>
  </div>
  <div id="ap-act-more-row" style="text-align:center;padding:8px;display:none">
    <button class="ap-btn-sec" onclick="_apActFetch(true)">Load more</button>
  </div>`;
  _apActRefresh();
}

async function _apActRefresh() {
  _apActLastDoc = null;
  const tbody = document.getElementById('ap-act-tbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="ap-empty">Loading…</td></tr>';
  await _apActFetch(false);
}

async function _apActFetch(append) {
  if (!_db) return;
  let q = _db.collection('activity_log').orderBy('ts', 'desc').limit(_AP_PAGE);
  if (_apActLastDoc && append) q = q.startAfter(_apActLastDoc);
  const snap = await q.get().catch(() => null);
  if (!snap) return;

  const rows = snap.docs
    .map(d => ({ ...d.data() }))
    .filter(r => {
      if (_apActFilters.email  && !(r.email ||'').toLowerCase().includes(_apActFilters.email.toLowerCase())) return false;
      if (_apActFilters.action && r.action !== _apActFilters.action) return false;
      return true;
    });

  if (snap.docs.length === _AP_PAGE) _apActLastDoc = snap.docs[snap.docs.length - 1];
  else _apActLastDoc = null;

  const tbody = document.getElementById('ap-act-tbody');
  const more  = document.getElementById('ap-act-more-row');
  if (!tbody) return;

  const html = rows.map(r => {
    const ts = r.ts?.toDate?.()?.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' }) || '—';
    const aCls = r.action?.startsWith('admin_') ? 'ap-act-admin' : r.action === 'login' ? 'ap-act-login' : r.action === 'edit' ? 'ap-act-edit' : '';
    return `<tr>
      <td class="ap-muted" style="font-size:11px;white-space:nowrap">${ts}</td>
      <td style="font-size:12px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.email||'')}">${escHtml(r.email||'')}</td>
      <td><span class="ap-role-chip ap-role-${r.role||''}">${r.role||''}</span></td>
      <td><span class="ap-act-chip ${aCls}">${r.action||''}</span></td>
      <td style="font-size:12px;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escHtml(r.details||'')}">${escHtml(r.details||'')}</td>
      <td class="ap-muted" style="font-size:11px">${r.tabId||'—'}</td>
      <td class="ap-muted" style="font-size:11px">${r.ip||'—'}</td>
      <td class="ap-muted" style="font-size:11px;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.location||'—'}</td>
    </tr>`;
  });

  if (append) tbody.innerHTML += html.join('');
  else tbody.innerHTML = rows.length ? html.join('') : '<tr><td colspan="8" class="ap-empty">No activity found.</td></tr>';

  if (more) more.style.display = _apActLastDoc ? 'block' : 'none';
}

// ── Analytics tab ─────────────────────────────────────────────────────────────

async function _apLoadAnalytics() {
  const el = document.getElementById('apc-analytics');
  if (!el || !_db) return;
  el.innerHTML = '<div class="ap-spinner-row">Loading analytics…</div>';

  const [usersSnap, sessSnap, actSnap, pendSnap] = await Promise.all([
    _db.collection('users').get(),
    _db.collection('sessions').orderBy('startedAt','desc').limit(200).get(),
    _db.collection('activity_log').orderBy('ts','desc').limit(500).get(),
    _db.collection('access_requests').where('status','==','pending').get()
  ]).catch(() => [null,null,null,null]);

  const users    = (usersSnap?.docs || []).map(d => d.data());
  const sessions = (sessSnap?.docs  || []).map(d => d.data());
  const acts     = (actSnap?.docs   || []).map(d => d.data());
  const pending  = pendSnap?.size || 0;

  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayActs  = acts.filter(a => a.ts?.toDate?.() >= todayStart);
  const editsToday = todayActs.filter(a => a.action === 'edit').length;
  const todayUsers = new Set(todayActs.map(a => a.email)).size;

  const byRole = { viewer: 0, editor: 0, admin: 0 };
  users.forEach(u => { if (u.role) byRole[u.role] = (byRole[u.role] || 0) + 1; });

  const tabCounts = {};
  acts.filter(a => a.tabId && a.action === 'tab_switch').forEach(a => {
    tabCounts[a.tabId] = (tabCounts[a.tabId] || 0) + 1;
  });
  const topTabs = Object.entries(tabCounts).sort((a,b) => b[1]-a[1]).slice(0, 6);
  const maxTab  = topTabs[0]?.[1] || 1;

  el.innerHTML = `
  <div class="ap-stat-row">
    <div class="ap-stat"><div class="ap-stat-num">${users.length}</div><div class="ap-stat-lbl">Total Users</div></div>
    <div class="ap-stat"><div class="ap-stat-num">${todayUsers}</div><div class="ap-stat-lbl">Active Today</div></div>
    <div class="ap-stat"><div class="ap-stat-num">${editsToday}</div><div class="ap-stat-lbl">Edits Today</div></div>
    <div class="ap-stat"><div class="ap-stat-num">${pending}</div><div class="ap-stat-lbl">Pending Requests</div></div>
    <div class="ap-stat"><div class="ap-stat-num">${sessions.length}</div><div class="ap-stat-lbl">Total Sessions</div></div>
  </div>
  <div class="ap-analytics-cols">
    <div class="ap-analytics-box">
      <div class="ap-box-title">Users by Role</div>
      ${Object.entries(byRole).map(([r,c]) => `
        <div class="ap-bar-row">
          <span class="ap-role-chip ap-role-${r}" style="min-width:52px;text-align:center">${r}</span>
          <div class="ap-bar-bg"><div class="ap-bar-fill" style="width:${users.length ? Math.round(c/users.length*100) : 0}%"></div></div>
          <span class="ap-muted">${c}</span>
        </div>`).join('')}
    </div>
    <div class="ap-analytics-box">
      <div class="ap-box-title">Most Visited Tabs</div>
      ${topTabs.length === 0 ? '<div class="ap-empty">No data yet.</div>' : topTabs.map(([tab,cnt]) => `
        <div class="ap-bar-row">
          <span style="min-width:90px;font-size:12px;font-weight:600;color:#1a1a2e">${tab}</span>
          <div class="ap-bar-bg"><div class="ap-bar-fill ap-bar-blue" style="width:${Math.round(cnt/maxTab*100)}%"></div></div>
          <span class="ap-muted">${cnt}</span>
        </div>`).join('')}
    </div>
    <div class="ap-analytics-box">
      <div class="ap-box-title">Recent Sessions</div>
      ${sessions.slice(0, 8).map(s => {
        const when = s.startedAt?.toDate?.()?.toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) || '—';
        const dura = s.endedAt?.toDate && s.startedAt?.toDate
          ? Math.round((s.endedAt.toDate() - s.startedAt.toDate()) / 60000) + 'm'
          : '● live';
        return `<div class="ap-session-row">
          <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(s.email||'')}</span>
          <span class="ap-muted" style="font-size:11px;white-space:nowrap">${when}</span>
          <span class="ap-muted" style="font-size:11px;min-width:40px;text-align:right">${dura}</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
