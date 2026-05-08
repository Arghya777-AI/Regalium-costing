// ── AUTH MANAGER ──────────────────────────────────────────────────────────────
// Firebase Auth + role-based access control.
// Roles: viewer (read-only) | editor (edit + save) | admin (full + admin panel)
// Pre-seeded admins always have admin role regardless of DB state.

const _AM_ADMINS = [
  'arghya.ghosh@machanigroup.com',
  'ashik.raheem@machanigroup.com'
];

window._amUser       = null;   // Firebase Auth user
window._amRole       = null;   // 'viewer' | 'editor' | 'admin'
window._amCurrentTab = null;   // last tab visited (used by atLog)
window._amIP         = 'unknown';
window._amLocation   = 'unknown';

let _amSessionId = null;

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function amInit() {
  _amFetchGeo();
  _fbAuth.onAuthStateChanged(_amHandleAuthChange);
}

async function _amFetchGeo() {
  try {
    const r = await fetch('https://ipapi.co/json/');
    if (r.ok) {
      const d = await r.json();
      window._amIP       = d.ip   || 'unknown';
      window._amLocation = d.city ? `${d.city}, ${d.country_name}` : 'unknown';
    }
  } catch (e) {}
}

async function _amHandleAuthChange(user) {
  if (!user) {
    window._amUser = null;
    window._amRole = null;
    _amShowLogin();
    return;
  }
  window._amUser = user;
  try {
    await _amResolveRole(user);
  } catch (e) {
    console.error('amResolveRole:', e);
    _amSetContent(`
      <div class="am-status-icon" style="color:#ef4444">⚠</div>
      <div class="am-status-head">Connection error</div>
      <div class="am-card-note">${escHtml(e.message)}</div>
      <button class="am-link-btn" onclick="amSignOut()">Sign out</button>`);
  }
}

async function _amResolveRole(user) {
  const email = (user.email || '').toLowerCase();

  if (_AM_ADMINS.includes(email)) {
    await _amUpsertUser(user, 'admin');
    _amGrant('admin');
    return;
  }

  const uSnap = await _db.collection('users')
    .where('email', '==', user.email).limit(1).get();

  if (!uSnap.empty) {
    const d    = uSnap.docs[0];
    const data = d.data();
    if (data.status === 'suspended') { _amShowSuspended(); return; }
    d.ref.update({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }).catch(() => {});
    _amGrant(data.role || 'viewer');
    return;
  }

  // Not in users — check for existing access request
  const rSnap = await _db.collection('access_requests')
    .where('email', '==', user.email).limit(1).get();

  if (!rSnap.empty) {
    const req = rSnap.docs[0].data();
    if (req.status === 'approved') {
      await _amUpsertUser(user, 'viewer');
      _amGrant('viewer');
    } else if (req.status === 'denied') {
      _amShowDenied();
    } else {
      _amShowPending();
    }
    return;
  }

  _amShowRequestAccess(user);
}

async function _amUpsertUser(user, role) {
  try {
    const snap = await _db.collection('users')
      .where('email', '==', user.email).limit(1).get();
    if (snap.empty) {
      await _db.collection('users').add({
        email:     user.email,
        name:      user.displayName || user.email,
        photoURL:  user.photoURL    || null,
        uid:       user.uid,
        role,
        status:    'active',
        createdBy: 'system',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        lastSeen:  firebase.firestore.FieldValue.serverTimestamp()
      });
    } else {
      snap.docs[0].ref.update({
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(() => {});
    }
  } catch (e) { console.warn('_amUpsertUser:', e); }
}

// ── Grant / enforce access ────────────────────────────────────────────────────

function _amGrant(role) {
  window._amRole = role;
  _fbIsAdmin     = (role === 'admin' || role === 'editor');
  _fbUser        = window._amUser;

  _amHideOverlay();
  document.body.dataset.role = role;

  // Re-run table ops so admin-only controls (hidden-tabs btn, hide buttons) appear
  if (typeof applyTableOps === 'function') applyTableOps();

  const adminBtn = document.getElementById('am-admin-btn');
  if (adminBtn) adminBtn.style.display = role === 'admin' ? 'flex' : 'none';

  _amRenderChip();
  _amStartSession();

  if (typeof atLog === 'function') atLog('login', `Signed in as ${window._amUser.email}`);
}

// ── Sign in / out ─────────────────────────────────────────────────────────────

function amSignInGoogle() {
  const p = new firebase.auth.GoogleAuthProvider();
  _fbAuth.signInWithPopup(p).catch(e => _amShowErr(e.message));
}

function amSignInEmail() {
  const email = (document.getElementById('am-email')?.value || '').trim();
  const pass  = document.getElementById('am-pass')?.value || '';
  if (!email) return;
  _fbAuth.signInWithEmailAndPassword(email, pass)
    .catch(e => _amShowErr(e.message));
}

function amSignOut() {
  if (!confirm(`Sign out as ${window._amUser?.email}?`)) return;
  if (typeof atLog === 'function') atLog('logout', 'Signed out');
  _amEndSession();
  _fbAuth.signOut();
}

async function amSubmitRequest() {
  const msg = (document.getElementById('am-req-note')?.value || '').trim();
  if (!window._amUser || !_db) return;
  const btn = document.querySelector('.am-primary-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }
  await _db.collection('access_requests').add({
    uid:         window._amUser.uid,
    email:       window._amUser.email,
    name:        window._amUser.displayName || window._amUser.email,
    photoURL:    window._amUser.photoURL    || null,
    message:     msg,
    ip:          window._amIP,
    location:    window._amLocation,
    requestedAt: firebase.firestore.FieldValue.serverTimestamp(),
    status:      'pending'
  }).catch(e => console.error('amSubmitRequest:', e));
  _amShowPending();
}

// ── Session tracking ──────────────────────────────────────────────────────────

async function _amStartSession() {
  if (!_db || !window._amUser) return;
  const ref = await _db.collection('sessions').add({
    uid:       window._amUser.uid,
    email:     window._amUser.email,
    role:      window._amRole,
    startedAt: firebase.firestore.FieldValue.serverTimestamp(),
    ip:        window._amIP,
    location:  window._amLocation,
    userAgent: navigator.userAgent
  }).catch(() => null);
  if (ref) {
    _amSessionId = ref.id;
    window.addEventListener('beforeunload', _amEndSession);
  }
}

function _amEndSession() {
  if (!_amSessionId || !_db) return;
  _db.collection('sessions').doc(_amSessionId)
    .update({ endedAt: firebase.firestore.FieldValue.serverTimestamp() })
    .catch(() => {});
}

// ── User chip (top bar) ───────────────────────────────────────────────────────

function _amRenderChip() {
  const chip = document.getElementById('am-user-chip');
  if (!chip || !window._amUser) return;
  const name  = window._amUser.displayName || window._amUser.email || 'User';
  const inits = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const photo = window._amUser.photoURL;
  chip.innerHTML = `
    ${photo
      ? `<img src="${photo}" class="am-chip-photo" alt="" referrerpolicy="no-referrer">`
      : `<div class="am-chip-initials">${inits}</div>`}
    <span class="am-chip-name">${name.split(' ')[0]}</span>
    <span class="am-chip-badge am-badge-${window._amRole}">${window._amRole}</span>`;
  chip.style.display = 'flex';
  chip.title = `${name} · ${window._amRole} — click to sign out`;
  chip.onclick = amSignOut;
}

// ── Login overlay helpers ─────────────────────────────────────────────────────

function _amGetOverlay() {
  let el = document.getElementById('am-login-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'am-login-overlay';
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
  return el;
}

function _amHideOverlay() {
  const el = document.getElementById('am-login-overlay');
  if (el) el.style.display = 'none';
}

function _amSetContent(html) {
  const el = _amGetOverlay();
  el.innerHTML = `<div class="am-card am-card-center">${html}</div>`;
}

function _amShowErr(msg) {
  const err = document.getElementById('am-err');
  if (err) { err.textContent = msg; err.style.display = 'block'; }
}

// ── Login screens ─────────────────────────────────────────────────────────────

function _amShowLogin() {
  const el = _amGetOverlay();
  el.innerHTML = `
  <div class="am-card">
    <div class="am-card-logo">
      <div class="am-logo-icon">R</div>
      <div>
        <div class="am-card-title">Regalium</div>
        <div class="am-card-sub">Construction Cost Dashboard</div>
      </div>
    </div>
    <button class="am-google-btn" onclick="amSignInGoogle()">
      ${_amGoogleSVG()} Sign in with Google
    </button>
    <div class="am-or-sep"><span>or sign in with email</span></div>
    <input  type="email"    id="am-email" class="am-inp" placeholder="Email address" autocomplete="email">
    <input  type="password" id="am-pass"  class="am-inp" placeholder="Password"
            onkeydown="if(event.key==='Enter')amSignInEmail()">
    <button class="am-primary-btn" onclick="amSignInEmail()">Sign In</button>
    <div id="am-err" class="am-err-msg" style="display:none"></div>
    <div class="am-card-note">Access is restricted to authorised users only.</div>
  </div>`;
}

function _amShowRequestAccess(user) {
  const photo = user.photoURL
    ? `<img src="${user.photoURL}" class="am-req-photo" alt="" referrerpolicy="no-referrer">`
    : `<div class="am-req-initials">${(user.email || '?')[0].toUpperCase()}</div>`;
  const el = _amGetOverlay();
  el.innerHTML = `
  <div class="am-card">
    <div class="am-card-logo">
      <div class="am-logo-icon">R</div>
      <div><div class="am-card-title">Regalium</div><div class="am-card-sub">Construction Cost Dashboard</div></div>
    </div>
    <div class="am-req-user">
      ${photo}
      <div>
        <div class="am-req-name">${escHtml(user.displayName || '')}</div>
        <div class="am-req-email">${escHtml(user.email || '')}</div>
      </div>
    </div>
    <div class="am-card-note" style="margin:0 0 4px">
      You don't have access to this dashboard yet. Submit a request and an admin will review it.
    </div>
    <textarea id="am-req-note" class="am-textarea" rows="3" placeholder="Optional note for the admin…"></textarea>
    <button class="am-primary-btn" onclick="amSubmitRequest()">Request Access</button>
    <button class="am-link-btn" onclick="amSignOut()">Sign out</button>
  </div>`;
}

function _amShowPending() {
  _amSetContent(`
    <div class="am-status-icon">⏳</div>
    <div class="am-status-head">Request Pending</div>
    <div class="am-card-note">An admin will review your request shortly. Check back later.</div>
    <button class="am-link-btn" onclick="amSignOut()">Sign out</button>`);
}

function _amShowDenied() {
  _amSetContent(`
    <div class="am-status-icon" style="color:#ef4444">✕</div>
    <div class="am-status-head">Access Denied</div>
    <div class="am-card-note">Your access request was not approved. Contact an admin for assistance.</div>
    <button class="am-link-btn" onclick="amSignOut()">Sign out</button>`);
}

function _amShowSuspended() {
  _amSetContent(`
    <div class="am-status-icon" style="color:#f59e0b">🔒</div>
    <div class="am-status-head">Account Suspended</div>
    <div class="am-card-note">Your account has been suspended. Contact an administrator.</div>
    <button class="am-link-btn" onclick="amSignOut()">Sign out</button>`);
}

function _amGoogleSVG() {
  return `<svg width="18" height="18" viewBox="0 0 18 18" style="flex-shrink:0">
    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.015 17.64 11.707 17.64 9.2z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A9.005 9.005 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>`;
}
