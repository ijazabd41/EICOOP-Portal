/**
 * App Error Logger — Odoo 19 Integration
 * Pushes web application errors to the Odoo App Error Logger module.
 *
 * Include BEFORE api.js so it is available when the API module loads:
 *   <script src="js/error-logger.js?v=1.0"></script>
 *   <script src="js/api.js?v=8.8"></script>
 *
 * Configuration:
 *   Set ERROR_LOG_API_KEY below (from Odoo → Settings → Technical → API Keys).
 *   The base URL defaults to the same proxy used by the rest of the app.
 */

const ErrorLogger = (() => {
  // ── CONFIGURATION ────────────────────────────────────────────────
  // Route through the CORS proxy (same as the rest of the app).
  // The proxy allowlist already covers /api/ which matches /api/v1/error-log/*.
  const PROXY_PORT = '3001';
  const BASE_URL = (() => {
    if (typeof location === 'undefined') return '/proxy';
    if (location.protocol === 'file:') return `http://localhost:8000/proxy.php`;
    if (['3000', '5500', '8000', '8080'].includes(location.port) || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return `/proxy.php`;
    }
    if (location.port === PROXY_PORT) return '/proxy';
    return '/proxy.php';
  })();

  const _origin = (typeof location !== 'undefined' && location.origin !== 'null') ? location.origin : 'http://localhost';
  const PUSH_ENDPOINT = new URL(`${BASE_URL}/api/v1/error-log/push`, _origin).toString();
  const PING_ENDPOINT = new URL(`${BASE_URL}/api/v1/error-log/ping`, _origin).toString();

  // ── DEDUPLICATION / RATE LIMITING ────────────────────────────────
  // Prevent flooding: max 1 push per unique error_title within this window.
  const DEDUP_WINDOW_MS = 5000; // 5 seconds
  const MAX_QUEUE_SIZE  = 20;   // max queued errors before dropping
  const _seen = new Map();      // error_title → timestamp
  let _queueCount = 0;

  function _isDuplicate(title) {
    const now = Date.now();
    const last = _seen.get(title);
    if (last && (now - last) < DEDUP_WINDOW_MS) return true;
    _seen.set(title, now);
    // Housekeep: remove old entries
    if (_seen.size > 100) {
      for (const [k, ts] of _seen) {
        if (now - ts > DEDUP_WINDOW_MS * 2) _seen.delete(k);
      }
    }
    return false;
  }

  // ── CONTEXT HELPERS ──────────────────────────────────────────────
  function _sessionId() {
    try {
      const id = localStorage.getItem('cd_session_id');
      if (id) return id;
      const sess = JSON.parse(localStorage.getItem('cd_session') || 'null');
      return sess?.session_id || '';
    } catch (_) { return ''; }
  }
  function _userName() {
    try { return localStorage.getItem('cd_user_name') || ''; } catch (_) { return ''; }
  }
  function _userEmail() {
    try {
      const sess = JSON.parse(localStorage.getItem('cd_session') || 'null');
      return sess?.username || '';
    } catch (_) { return ''; }
  }
  function _userId() {
    try { return localStorage.getItem('cd_user_id') || ''; } catch (_) { return ''; }
  }
  function _appVersion() {
    try { return (typeof API !== 'undefined' && API.build) ? `web-${API.build}` : 'web-unknown'; } catch (_) { return 'web-unknown'; }
  }
  function _screenName() {
    try { return location.pathname.split('/').pop() || location.pathname || '/'; } catch (_) { return '/'; }
  }
  function _deviceInfo() {
    try { return navigator.userAgent || ''; } catch (_) { return ''; }
  }
  function _osVersion() {
    try {
      const ua = navigator.userAgent || '';
      const m = ua.match(/\(([^)]+)\)/);
      return m ? m[1] : '';
    } catch (_) { return ''; }
  }

  // ── CORE PUSH ────────────────────────────────────────────────────
  /**
   * Push an error log to the Odoo App Error Logger.
   * Fire-and-forget — never throws, never blocks.
   *
   * @param {Object} params — see API reference for fields
   * @param {string} params.error_title   — (required) short name/title
   * @param {string} params.error_detail  — (required) full message / stack trace
   * @param {string} [params.source]      — 'web' (default)
   * @param {string} [params.priority]    — '0'=Normal, '1'=Important, '2'=Very Urgent, '3'=Critical
   * @param {string} [params.screen_name]
   * @param {string} [params.user_name]
   * @param {string} [params.user_email]
   * @param {string} [params.error_code]
   * @param {string} [params.extra_data]  — JSON string
   * @returns {Promise<Object|null>} response or null on failure
   */
  async function pushErrorLog(params) {
    if (!params?.error_title || !params?.error_detail) return null;
    
    const sid = _sessionId();
    if (!sid) {
      console.warn('[ErrorLogger] No session ID available. Error not pushed:', params.error_title);
      return null;
    }

    if (_isDuplicate(params.error_title)) return null;
    if (_queueCount >= MAX_QUEUE_SIZE) return null;

    _queueCount++;
    try {
      const body = {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          error_title:      params.error_title,
          error_detail:     String(params.error_detail || '').substring(0, 4000),
          source:           params.source       || 'web',
          user_name:        params.user_name    || _userName(),
          user_email:       params.user_email   || _userEmail(),
          user_id_external: params.user_id_external || _userId(),
          app_version:      params.app_version  || _appVersion(),
          screen_name:      params.screen_name  || _screenName(),
          device_info:      params.device_info  || _deviceInfo(),
          os_version:       params.os_version   || _osVersion(),
          error_date:       params.error_date   || new Date().toISOString(),
          priority:         params.priority     || '1',
          error_code:       params.error_code   || '',
          extra_data:       params.extra_data   || '',
        }
      };

      const res = await fetch(PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Token': sid,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        console.warn('[ErrorLogger] Push failed:', res.status, res.statusText);
        return null;
      }

      const data = await res.json();
      if (data?.result?.status === 'success' || data?.status === 'success') {
        console.debug('[ErrorLogger] ✓ Logged:', data?.result?.reference || data?.reference || params.error_title);
      }
      return data;
    } catch (e) {
      // Logger errors must NEVER break the app
      console.warn('[ErrorLogger] Push exception:', e.message);
      return null;
    } finally {
      _queueCount--;
    }
  }

  // ── CAPTURE HELPERS ──────────────────────────────────────────────

  /**
   * Capture an API error from the app's API layer.
   * Called from api.js → notifyError().
   */
  function captureApiError(method, path, status, error) {
    const title = `API Error: ${method || 'CALL'} ${(path || '/unknown').substring(0, 80)}`;
    const detail = [
      `Endpoint: ${method || '?'} ${path || '?'}`,
      `Status: ${status || 'N/A'}`,
      `Message: ${error?.message || String(error || 'Unknown')}`,
      `Stack: ${error?.stack || 'N/A'}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');

    pushErrorLog({
      error_title: title,
      error_detail: detail,
      error_code: status ? `HTTP_${status}` : 'API_ERROR',
      priority: status >= 500 ? '2' : '1',
      extra_data: JSON.stringify({
        method, path, status,
        message: error?.message || String(error),
      }),
    });
  }

  /**
   * Capture an uncaught window error.
   * Attached via window.addEventListener('error', ...).
   */
  function captureWindowError(event) {
    if (!event) return;
    const title = String(event.message || 'Uncaught Error').substring(0, 120);
    const detail = [
      `Message: ${event.message || 'Unknown'}`,
      `File: ${event.filename || 'N/A'}`,
      `Line: ${event.lineno || '?'} Col: ${event.colno || '?'}`,
      `Stack: ${event.error?.stack || 'N/A'}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');

    pushErrorLog({
      error_title: title,
      error_detail: detail,
      error_code: 'UNCAUGHT_ERROR',
      priority: '2',
    });
  }

  /**
   * Capture an unhandled promise rejection.
   * Attached via window.addEventListener('unhandledrejection', ...).
   */
  function captureUnhandledRejection(event) {
    if (!event) return;
    const reason = event.reason;
    const title = String(reason?.message || reason || 'Unhandled Promise Rejection').substring(0, 120);
    const detail = [
      `Reason: ${reason?.message || String(reason || 'Unknown')}`,
      `Stack: ${reason?.stack || 'N/A'}`,
      `Time: ${new Date().toISOString()}`,
    ].join('\n');

    pushErrorLog({
      error_title: title,
      error_detail: detail,
      error_code: 'UNHANDLED_REJECTION',
      priority: '2',
    });
  }

  /**
   * Capture a custom error manually from anywhere in the app.
   *
   * @param {string} title   — short description
   * @param {string} detail  — full message / context
   * @param {string} [priority] — '0'=Normal, '1'=Important, '2'=Very Urgent, '3'=Critical
   */
  function captureCustom(title, detail, priority) {
    pushErrorLog({
      error_title: String(title || 'Custom Error').substring(0, 120),
      error_detail: String(detail || ''),
      error_code: 'CUSTOM',
      priority: priority || '1',
    });
  }

  // ── INIT ─────────────────────────────────────────────────────────
  /**
   * Initialize global error handlers.
   * Call once from app.js DOMContentLoaded.
   */
  let _initialized = false;
  function init() {
    if (_initialized) return;
    _initialized = true;

    // Global uncaught error handler
    window.addEventListener('error', captureWindowError);

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', captureUnhandledRejection);

    console.debug('[ErrorLogger] Initialized — global handlers attached');
  }

  /**
   * Health check — call /api/v1/error-log/ping to verify the module is reachable.
   * @returns {Promise<Object|null>}
   */
  async function ping() {
    try {
      const res = await fetch(PING_ENDPOINT, {
        headers: { 'Content-Type': 'application/json' },
      });
      return await res.json();
    } catch (e) {
      console.warn('[ErrorLogger] Ping failed:', e.message);
      return null;
    }
  }

  // ── PUBLIC API ───────────────────────────────────────────────────
  return {
    init,
    ping,
    pushErrorLog,
    captureApiError,
    captureWindowError,
    captureUnhandledRejection,
    captureCustom,
  };
})();
