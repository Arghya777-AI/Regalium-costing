// ── PWA ───────────────────────────────────────────────────────────────────────
// Service worker registration, update detection, mobile drawer.

let _pwaReg = null;

// ── Service worker ────────────────────────────────────────────────────────────

function pwaInit() {
  if (!('serviceWorker' in navigator)) return;

  // Capture existing controller before registration so we can distinguish
  // a true update (controller changed) from first install (no prior controller).
  const _prevCtrl = navigator.serviceWorker.controller;

  navigator.serviceWorker.register('/sw.js').then(reg => {
    _pwaReg = reg;

    // Poll for updates every 5 minutes while page is open
    setInterval(() => reg.update(), 5 * 60 * 1000);

    // New SW activates automatically (skipWaiting in sw.js install event).
    // controllerchange fires once the new SW takes over — reload to pick up
    // fresh assets. Skip on first install (_prevCtrl === null) to avoid a
    // pointless reload when there was never an old controller.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!_prevCtrl || window._pwaReloading) return;
      window._pwaReloading = true;
      sessionStorage.setItem('sw-updated', '1');
      location.reload();
    });

  }).catch(e => console.warn('SW registration failed:', e));
}

// Show a toast after an auto-reload caused by a SW update
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('sw-updated')) {
    sessionStorage.removeItem('sw-updated');
    setTimeout(() => {
      if (typeof kbToast === 'function') {
        kbToast('Dashboard updated to latest version');
      }
    }, 1500);
  }
});

function pwaApplyUpdate() {
  if (_pwaReg?.waiting) {
    _pwaReg.waiting.postMessage('SKIP_WAITING');
  } else {
    location.reload();
  }
}

// ── Mobile drawer ─────────────────────────────────────────────────────────────

function mobileMenuOpen() {
  let drawer = document.getElementById('mob-drawer');
  if (!drawer) {
    drawer = document.createElement('div');
    drawer.id = 'mob-drawer';
    drawer.innerHTML = `
      <div class="mob-drawer-backdrop" onclick="mobileMenuClose()"></div>
      <div class="mob-drawer-panel">
        <div class="mob-drawer-hdr">
          <div class="mob-drawer-logo">
            <div class="logo-icon" style="width:30px;height:30px;font-size:15px">R</div>
            <div>
              <div style="font-size:15px;font-weight:700">Regalium</div>
              <div style="font-size:10px;color:#adb5bd">CONSTRUCTION COST DASHBOARD</div>
            </div>
          </div>
          <button class="mob-drawer-close" onclick="mobileMenuClose()">✕</button>
        </div>

        <!-- User info -->
        <div id="mob-user-info" class="mob-user-info" style="display:none"></div>

        <!-- Nav items -->
        <div class="mob-drawer-nav">
          <button class="mob-nav-item" onclick="mobileMenuClose();fbToggleViewsPanel()">
            <span id="mob-status-icon">●</span> Live Status &amp; Views
          </button>
          <div id="mob-views-panel-wrap"></div>

          <div class="mob-nav-sep"></div>

          <button class="mob-nav-item mob-nav-warn" onclick="mobileMenuClose();fbResetToBase()">
            ↺ Reset to Base Case
          </button>
          <button class="mob-nav-item" onclick="mobileMenuClose();openDS()">
            ⚙ Data Studio
          </button>
          <button id="mob-admin-btn" class="mob-nav-item mob-nav-admin" onclick="mobileMenuClose();apOpen()" style="display:none">
            ⚙ Admin Panel
          </button>

          <div class="mob-nav-sep"></div>

          <button class="mob-nav-item mob-nav-signout" onclick="mobileMenuClose();amSignOut()">
            ↪ Sign Out
          </button>
        </div>

        <div class="mob-drawer-footer">by Arghya's Olama AGT · © Machani Group 2026</div>
      </div>`;
    document.body.appendChild(drawer);
  }

  // Sync user info
  _mobSyncUser();

  drawer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function mobileMenuClose() {
  const drawer = document.getElementById('mob-drawer');
  if (drawer) { drawer.classList.remove('open'); document.body.style.overflow = ''; }
}

function _mobSyncUser() {
  const el = document.getElementById('mob-user-info');
  if (!el || !window._amUser) return;
  const name  = window._amUser.displayName || window._amUser.email || 'User';
  const photo = window._amUser.photoURL;
  const inits = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  el.innerHTML = `
    ${photo ? `<img src="${photo}" class="mob-user-photo" referrerpolicy="no-referrer">` : `<div class="mob-user-initials">${inits}</div>`}
    <div>
      <div class="mob-user-name">${name}</div>
      <div class="mob-user-role">${window._amRole || ''}</div>
    </div>`;
  el.style.display = 'flex';

  // Sync admin btn
  const adminBtn = document.getElementById('mob-admin-btn');
  if (adminBtn) adminBtn.style.display = window._amRole === 'admin' ? '' : 'none';
}

// Keep mobile status icon in sync with Firebase status
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const orig = window.fbRenderStatus;
    if (typeof orig !== 'function') return;
    window.fbRenderStatus = function(state, extra) {
      orig.call(this, state, extra);
      // Sync mobile status dot colour
      const mobDot = document.getElementById('mob-status-icon');
      const colours = { online: '#22c55e', saved: '#22c55e', connecting: '#94a3b8', pending: '#f59e0b', saving: '#f59e0b', error: '#ef4444' };
      if (mobDot) mobDot.style.color = colours[state] || '#94a3b8';
    };
  }, 300);
});

// ── Init ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', pwaInit);
