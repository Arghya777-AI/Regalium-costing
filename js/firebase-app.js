// ── FIREBASE BACKEND ──────────────────────────────────────────────────────────
// Real-time sync, saved views, admin writes.
// Project: regalium-costing  (Firebase project ID)
//
// SETUP — fill in apiKey and appId from:
//   Firebase Console → Project Settings → Your Apps → Web App → SDK config
// ──────────────────────────────────────────────────────────────────────────────

const _FB_CFG = {
  apiKey:            "AIzaSyCPOywXvc0Lb_jIL3KtEzMxuBPlvzrSZ4U",
  authDomain:        "regalium-costing.firebaseapp.com",
  projectId:         "regalium-costing",
  storageBucket:     "regalium-costing.firebasestorage.app",
  messagingSenderId: "134403060464",
  appId:             "1:134403060464:web:f60d3015e376c134a08835",
  measurementId:     "G-7SV7NNGFB4"
};

// ── Init ──────────────────────────────────────────────────────────────────────
let _fbApp = null, _db = null, _fbAuth = null;
let _fbUser = null;          // currently signed-in user (set by auth-manager)
let _fbIsAdmin = false;      // set to true by auth-manager for editor/admin roles
let _fbReceiving = false;    // true while applying a snapshot — suppresses re-save
let _fbSaveTimer = null;
let _fbSnapshotUnsub = null;
let _fbViewsUnsub = null;
let _fbViews = [];           // cached view list
let _fbOverlayDone = false;  // true after loading overlay has been dismissed

function fbInit() {
  // Fallback: dismiss overlay after 7s regardless of Firebase status
  setTimeout(_fbDismissOverlay, 7000);
  try {
    _fbApp  = firebase.initializeApp(_FB_CFG);
    _db     = firebase.firestore();
    _fbAuth = firebase.auth();

    // Enable Firestore offline persistence
    _db.enablePersistence({ synchronizeTabs: true }).catch(() => {});

    _fbEnsureBase();   // write hardcoded base to dashboard/base once, never overwrite
    fbStartSync();
    fbWatchViews();
    fbRenderStatus('connecting');
    if (typeof amInit === 'function') amInit();
  } catch (e) {
    console.error('Firebase init failed:', e);
    fbRenderStatus('error');
    _fbDismissOverlay();
  }
}

// Write the hardcoded _D_BASE to Firestore once on first deploy.
// dashboard/base is NEVER overwritten after creation — it is the ground truth for Reset.
async function _fbEnsureBase() {
  try {
    const snap = await _db.doc('dashboard/base').get();
    if (!snap.exists) {
      await _db.doc('dashboard/base').set({
        D:         JSON.parse(JSON.stringify(_D_BASE)),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  } catch (e) {
    console.warn('_fbEnsureBase:', e);
  }
}

// ── Real-time state sync ──────────────────────────────────────────────────────

function fbStartSync() {
  if (_fbSnapshotUnsub) _fbSnapshotUnsub();
  _fbSnapshotUnsub = _db.doc('dashboard/state').onSnapshot(
    snap => {
      if (!snap.exists) { fbRenderStatus('online'); _fbDismissOverlay(); return; }
      _fbReceiving = true;
      // Preserve active tab so Firebase sync never causes a blank/glitched tab
      const _activeBtn   = document.querySelector('.tab-btn.active');
      const _activeTabId = _activeBtn?.dataset?.tabId ||
        (_activeBtn?.getAttribute('onclick') || '').match(/showTab\(['"]([^'"]+)['"]/)?.[1];
      try {
        const data = snap.data();
        if (data.D)      _fbApplyD(data.D);
        if (data.FSTORE) _fbApplyFSTORE(data.FSTORE);
        if (data.TUI)    _fbApplyTUI(data.TUI);
        // Always enforce branding — overrides whatever Firestore has stored
        D.project.name     = 'Regalium';
        D.project.subtitle = 'CONSTRUCTION COST DASHBOARD';
        recompute();
        renderAll();
        // Restore the previously-active tab after re-render
        if (_activeTabId) {
          const targetBtn = document.querySelector(
            `.tab-btn[data-tab-id="${_activeTabId}"], .tab-btn[onclick*="'${_activeTabId}'"]`
          );
          if (targetBtn && targetBtn.style.display !== 'none') {
            showTab(_activeTabId.replace(/^tui_/, 'tui_'), targetBtn);
          }
        }
        const who = data.updatedBy ? ` · ${data.updatedBy}` : '';
        fbRenderStatus('online', who);
      } finally {
        _fbReceiving = false;
        _fbDismissOverlay();
      }
    },
    err => {
      console.error('fbSync:', err);
      fbRenderStatus('error');
      _fbDismissOverlay();
      _fbSnapshotUnsub = null;
      // Attempt to re-establish listener after 8 seconds
      setTimeout(() => { if (!_fbSnapshotUnsub && _db) { fbRenderStatus('connecting'); fbStartSync(); } }, 8000);
    }
  );
}

function _fbDismissOverlay() {
  if (_fbOverlayDone) return;
  _fbOverlayDone = true;
  const el = document.getElementById('fb-loading-overlay');
  if (!el) return;
  el.classList.add('fb-overlay-hide');
  setTimeout(() => { el.style.display = 'none'; }, 380);
}

// ── Save (debounced, admin-only) ──────────────────────────────────────────────

function fbScheduleSave() {
  if (!_fbIsAdmin || _fbReceiving || !_db) return;
  clearTimeout(_fbSaveTimer);
  fbRenderStatus('pending');
  _fbSaveTimer = setTimeout(fbSave, 1800);
}

async function fbSave() {
  if (!_fbIsAdmin || !_db) return;
  fbRenderStatus('saving');
  const _delays = [1500, 4000, 12000];
  for (let _attempt = 0; _attempt <= _delays.length; _attempt++) {
    try {
      await _db.doc('dashboard/state').set({
        D:         JSON.parse(JSON.stringify(D)),
        FSTORE:    JSON.parse(JSON.stringify(FSTORE)),
        TUI:       _tuiToJSON(),
        updatedBy: _fbUser?.email || _fbUser?.displayName || 'admin',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      fbRenderStatus('saved');
      if (typeof atLog === 'function') atLog('edit', 'Dashboard data saved');
      return;
    } catch (e) {
      if (_attempt === _delays.length) {
        console.error('fbSave failed after retries:', e);
        fbRenderStatus('error');
        return;
      }
      const wait = _delays[_attempt];
      console.warn(`fbSave retry ${_attempt + 1}/${_delays.length} in ${wait}ms:`, e.message);
      fbRenderStatus('pending');
      await new Promise(r => setTimeout(r, wait));
      fbRenderStatus('saving');
    }
  }
}

// Force-save immediately (used by Save View)
function fbFlushSave() {
  clearTimeout(_fbSaveTimer);
  return fbSave();
}

// ── Saved Views ───────────────────────────────────────────────────────────────

function fbWatchViews() {
  if (_fbViewsUnsub) _fbViewsUnsub();
  if (!_db) return;
  _fbViewsUnsub = _db.collection('views')
    .orderBy('savedAt', 'desc')
    .onSnapshot(snap => {
      _fbViews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      fbRenderViewsList();
    }, err => console.warn('fbWatchViews:', err));
}

async function fbSaveView(name) {
  if (!_db) return;
  if (!name) name = `View ${new Date().toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}`;
  try {
    await _db.collection('views').add({
      name,
      D:         JSON.parse(JSON.stringify(D)),
      FSTORE:    JSON.parse(JSON.stringify(FSTORE)),
      TUI:       _tuiToJSON(),
      savedBy:   _fbUser?.email || _fbUser?.displayName || 'admin',
      savedAt:   firebase.firestore.FieldValue.serverTimestamp()
    });
    if (typeof kbToast === 'function') kbToast(`✓ View "${name}" saved`);
    if (typeof atLog   === 'function') atLog('save_view', `Saved view: ${name}`);
  } catch (e) {
    console.error('fbSaveView:', e);
    if (typeof kbToast === 'function') kbToast('⚠ Could not save view');
  }
}

async function fbLoadView(viewId) {
  const v = _fbViews.find(x => x.id === viewId);
  if (!v) return;
  _fbReceiving = true;
  try {
    if (v.D)      _fbApplyD(v.D);
    if (v.FSTORE) _fbApplyFSTORE(v.FSTORE);
    if (v.TUI)    _fbApplyTUI(v.TUI);
    recompute();
    renderAll();
    if (typeof kbToast === 'function') kbToast(`✓ Loaded "${v.name}"`);
    if (typeof atLog   === 'function') atLog('load_view', `Loaded view: ${v.name}`);
    fbRenderViewsList();
  } finally {
    _fbReceiving = false;
  }
}

async function fbDeleteView(viewId) {
  if (!_db || !_fbIsAdmin) return;
  if (!confirm('Delete this view?')) return;
  try { await _db.collection('views').doc(viewId).delete(); }
  catch (e) { console.error('fbDeleteView:', e); }
}

// ── Apply remote data to local state ─────────────────────────────────────────

function _fbApplyD(remote) {
  // Deep-merge remote D into local D — preserves any keys that don't exist remotely.
  // project.name and project.subtitle are branding constants — never overwrite from Firestore.
  function deepMerge(target, source, parentKey) {
    Object.keys(source).forEach(k => {
      if (parentKey === 'project' && (k === 'name' || k === 'subtitle')) return;
      if (Array.isArray(source[k])) {
        target[k] = JSON.parse(JSON.stringify(source[k]));
      } else if (source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])) {
        if (!target[k] || typeof target[k] !== 'object') target[k] = {};
        deepMerge(target[k], source[k], k);
      } else {
        target[k] = source[k];
      }
    });
  }
  deepMerge(D, remote, null);
}

function _fbApplyFSTORE(remote) {
  Object.keys(FSTORE).forEach(k => delete FSTORE[k]);
  Object.assign(FSTORE, remote);
}

function _fbApplyTUI(remote) {
  if (remote.hiddenRows) {
    TUI.hiddenRows = {};
    Object.entries(remote.hiddenRows).forEach(([k, v]) => { TUI.hiddenRows[k] = new Set(v); });
  }
  if (remote.hiddenCols) {
    TUI.hiddenCols = {};
    Object.entries(remote.hiddenCols).forEach(([k, v]) => { TUI.hiddenCols[k] = new Set(v); });
  }
  if (remote.hiddenTabs) {
    TUI.hiddenTabs.clear();
    remote.hiddenTabs.forEach(t => TUI.hiddenTabs.add(t));
  }
  if (remote.extraCols) Object.assign(TUI.extraCols, remote.extraCols);
  if (remote.customTabs) { TUI.customTabs.length = 0; TUI.customTabs.push(...remote.customTabs); }
  if (remote.hiddenElements) {
    TUI.hiddenElements = JSON.parse(JSON.stringify(remote.hiddenElements));
  }
}

function _tuiToJSON() {
  return {
    hiddenRows:     Object.fromEntries(Object.entries(TUI.hiddenRows).map(([k,v]) => [k, [...v]])),
    hiddenCols:     Object.fromEntries(Object.entries(TUI.hiddenCols).map(([k,v]) => [k, [...v]])),
    hiddenTabs:     [...TUI.hiddenTabs],
    extraCols:      JSON.parse(JSON.stringify(TUI.extraCols      || {})),
    customTabs:     JSON.parse(JSON.stringify(TUI.customTabs     || [])),
    hiddenElements: JSON.parse(JSON.stringify(TUI.hiddenElements || {}))
  };
}

// ── Status indicator ──────────────────────────────────────────────────────────

const _FB_STATUS = {
  connecting: { dot: '◌', color: '#94a3b8', text: 'Connecting…' },
  online:     { dot: '●', color: '#22c55e', text: 'Live'         },
  pending:    { dot: '◌', color: '#f59e0b', text: 'Unsaved'      },
  saving:     { dot: '◌', color: '#f59e0b', text: 'Saving…'      },
  saved:      { dot: '●', color: '#22c55e', text: 'Saved'        },
  error:      { dot: '●', color: '#ef4444', text: 'Offline'      }
};

function fbRenderStatus(state, extra = '') {
  const el = document.getElementById('fb-status-dot');
  const tx = document.getElementById('fb-status-txt');
  const s  = _FB_STATUS[state] || _FB_STATUS.online;
  if (el) { el.textContent = s.dot; el.style.color = s.color; }
  if (tx) tx.textContent = s.text + extra;
}

// ── Views panel UI ────────────────────────────────────────────────────────────

function fbToggleViewsPanel() {
  const p = document.getElementById('fb-views-panel');
  if (!p) return;
  const open = p.style.display !== 'none';
  p.style.display = open ? 'none' : 'block';
  if (!open) { document.getElementById('fb-view-name-input')?.focus(); }
}

function fbRenderViewsList() {
  const el = document.getElementById('fb-views-list');
  if (!el) return;
  if (!_fbViews.length) {
    el.innerHTML = '<div class="fb-no-views">No saved views yet.</div>';
    return;
  }
  el.innerHTML = _fbViews.map(v => {
    const when = v.savedAt?.toDate ? v.savedAt.toDate().toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '';
    const by   = v.savedBy ? `<span class="fb-view-by">${escHtml(v.savedBy)}</span>` : '';
    return `
      <div class="fb-view-row">
        <div class="fb-view-info" onclick="fbLoadView('${v.id}')">
          <span class="fb-view-name">${escHtml(v.name)}</span>
          <span class="fb-view-meta">${when}${by}</span>
        </div>
        <button class="fb-view-load" onclick="fbLoadView('${v.id}')" title="Load view">↩</button>
        ${_fbIsAdmin ? `<button class="fb-view-del" onclick="fbDeleteView('${v.id}')" title="Delete view">✕</button>` : ''}
      </div>`;
  }).join('');
}

function fbHandleSaveView() {
  const input = document.getElementById('fb-view-name-input');
  const name  = input ? input.value.trim() : '';
  fbSaveView(name || undefined);
  if (input) input.value = '';
  document.getElementById('fb-views-panel').style.display = 'none';
}

// ── Reset to Base Case ────────────────────────────────────────────────────────

async function fbResetToBase() {
  if (!confirm('Reset ALL data to the original base case?\n\nThis will overwrite every change for all users.')) return;

  // Read the frozen base from Firestore (written once on first deploy)
  let baseD = JSON.parse(JSON.stringify(_D_BASE)); // fallback if Firestore unavailable
  try {
    if (_db) {
      const snap = await _db.doc('dashboard/base').get();
      if (snap.exists && snap.data().D) baseD = snap.data().D;
    }
  } catch (e) {
    console.warn('fbResetToBase read:', e);
  }

  // Apply base D
  Object.keys(D).forEach(k => delete D[k]);
  Object.assign(D, JSON.parse(JSON.stringify(baseD)));

  // Clear formula store
  Object.keys(FSTORE).forEach(k => delete FSTORE[k]);

  // Reset TUI to empty state
  TUI.hiddenRows = {};
  TUI.hiddenCols = {};
  TUI.hiddenTabs.clear();
  TUI.extraCols  = {};
  TUI.customTabs.length = 0;

  recompute();
  renderAll();   // triggers fbScheduleSave → pushes base case to Firestore for all users
  if (typeof kbToast === 'function') kbToast('✓ Reset to base case');
  if (typeof atLog   === 'function') atLog('reset', 'Reset dashboard to base case');
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Close views panel on outside click
  document.addEventListener('mousedown', e => {
    const wrap = document.getElementById('fb-views-wrap');
    if (wrap && !wrap.contains(e.target)) {
      const p = document.getElementById('fb-views-panel');
      if (p) p.style.display = 'none';
    }
  });

  // Init after a short delay so all other scripts have fully loaded
  setTimeout(fbInit, 200);
});
