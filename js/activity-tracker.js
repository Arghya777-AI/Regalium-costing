// ── ACTIVITY TRACKER ─────────────────────────────────────────────────────────
// Writes user actions to Firestore activity_log collection.
// atLog is called by auth-manager, admin-panel, and firebase-app.

function atLog(action, details, tabId) {
  if (!_db || !window._amUser) return;
  _db.collection('activity_log').add({
    uid:       window._amUser.uid,
    email:     window._amUser.email,
    role:      window._amRole || 'unknown',
    action,
    details:   details || '',
    tabId:     tabId || window._amCurrentTab || null,
    ip:        window._amIP       || 'unknown',
    location:  window._amLocation || 'unknown',
    userAgent: navigator.userAgent,
    ts:        firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
}

// Wrap showTab to track tab navigation after all scripts load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const _orig = window.showTab;
    if (typeof _orig !== 'function') return;
    window.showTab = function(id, btn) {
      window._amCurrentTab = id;
      if (window._amUser) atLog('tab_switch', id, id);
      return _orig.call(this, id, btn);
    };
  }, 700);
});
