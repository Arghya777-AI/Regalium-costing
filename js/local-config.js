// Local API key — fill this in locally, never commit a real key here.
// Copy this file to local-config.js and paste your key below.
(function () {
  const KEY = ''; // paste your sk-ant-... key here for local dev only
  window._LOCAL_API_KEY = KEY;
  try { if (KEY) localStorage.setItem('anthropic_api_key', KEY); } catch (_) {}
})();
