/**
 * Coop Discounts — client API cache, request deduplication, prefetch.
 * Loaded before api.js; used by API.httpRequest for safe GET caching only.
 */
window.CDApiCache = (function () {
  const VERSION = 2;
  const STORAGE_PREFIX = 'cd_apic_' + VERSION + '_';
  const MEM_MAX = 220;
  const PERSIST_MIN_TTL = 5 * 60 * 1000;

  const mem = new Map();
  const inFlight = new Map();
  let hits = 0;
  let misses = 0;

  function sessionScope(sessionId) {
    return sessionId ? 'u:' + sessionId : 'anon';
  }

  function stableParams(p) {
    if (!p || typeof p !== 'object') return '';
    return Object.keys(p).sort().map(function (k) {
      const v = p[k];
      if (v === undefined || v === null || v === '') return '';
      return k + '=' + String(v);
    }).filter(Boolean).join('&');
  }

  function key(method, path, p, sessionId) {
    return method + ':' + path + '?' + stableParams(p) + ':' + sessionScope(sessionId);
  }

  /** TTL in ms; 0 = never cache this path. */
  function ttl(path) {
    const p = path || '';
    if (/\/web\/session\//.test(p)) return 0;
    if (/\/create_order|\/create_invoice|\/mark_done|apply_loyalty|new_registration|new_address|\/update/.test(p)) return 0;
    if (/\/api\/order|order-line|payment-provider|get_or_create_transaction|order_transaction/.test(p)) return 0;
    if (/\/api\/invoice/.test(p)) return 0;
    if (/\/api\/loyalty/.test(p)) return 0;
    if (/\/api\/contacts/.test(p)) return 0;
    if (/\/api\/rider/.test(p)) return 0;
    if (/\/api\/user\//.test(p)) return 0;
    if (/\/deal-day-slider/.test(p)) return 10 * 60 * 1000;
    if (/\/bcd-website-category/.test(p)) return 15 * 60 * 1000;
    if (/\/bcp-product-template/.test(p)) return 3 * 60 * 1000;
    if (/\/api\/country/.test(p)) return 60 * 60 * 1000;
    if (/\/config-settings/.test(p)) return 5 * 60 * 1000;
    if (/\/delivery|carrier/.test(p)) return 5 * 60 * 1000;
    if (/\/api\/product/.test(p)) return 5 * 60 * 1000;
    return 0;
  }

  function storageKey(k) {
    var h = 0;
    for (var i = 0; i < k.length; i++) h = ((h << 5) - h + k.charCodeAt(i)) | 0;
    return STORAGE_PREFIX + (h >>> 0).toString(36);
  }

  function clone(data) {
    try {
      return JSON.parse(JSON.stringify(data));
    } catch (_) {
      return data;
    }
  }

  function get(k, maxTtl) {
    var now = Date.now();
    var row = mem.get(k);
    if (row && row.exp > now) {
      hits++;
      return clone(row.data);
    }
    if (row) mem.delete(k);

    try {
      var raw = sessionStorage.getItem(storageKey(k));
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.exp > now) {
          mem.set(k, parsed);
          hits++;
          return clone(parsed.data);
        }
        sessionStorage.removeItem(storageKey(k));
      }
    } catch (_) {}

    misses++;
    return undefined;
  }

  function set(k, data, ttlMs) {
    var row = { data: data, exp: Date.now() + ttlMs };
    if (mem.size >= MEM_MAX) {
      var first = mem.keys().next().value;
      if (first !== undefined) mem.delete(first);
    }
    mem.set(k, row);

    if (ttlMs >= PERSIST_MIN_TTL) {
      try {
        sessionStorage.setItem(storageKey(k), JSON.stringify(row));
      } catch (_) {
        try {
          var keys = [];
          for (var i = 0; i < sessionStorage.length; i++) {
            var sk = sessionStorage.key(i);
            if (sk && sk.indexOf(STORAGE_PREFIX) === 0) keys.push(sk);
          }
          keys.slice(0, Math.ceil(keys.length / 3)).forEach(function (sk) {
            sessionStorage.removeItem(sk);
          });
          sessionStorage.setItem(storageKey(k), JSON.stringify(row));
        } catch (_2) {}
      }
    }
  }

  function invalidateMutation(path) {
    var p = path || '';
    var prefixes = [];
    if (/\/api\/order|order-line|apply_loyalty|create_invoice|payment/.test(p)) {
      prefixes.push('/api/order', '/api/order-line', '/api/invoice', '/api/loyalty');
    }
    if (/\/contacts/.test(p)) prefixes.push('/api/contacts');
    if (!prefixes.length) return;

    mem.forEach(function (_, k) {
      if (prefixes.some(function (pre) { return k.indexOf(pre) !== -1; })) mem.delete(k);
    });
    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var sk = sessionStorage.key(i);
        if (!sk || sk.indexOf(STORAGE_PREFIX) !== 0) continue;
        var blob = sessionStorage.getItem(sk) || '';
        if (prefixes.some(function (pre) { return blob.indexOf(pre) !== -1; })) {
          sessionStorage.removeItem(sk);
        }
      }
    } catch (_) {}
  }

  function clearAll() {
    mem.clear();
    inFlight.clear();
    try {
      for (var i = sessionStorage.length - 1; i >= 0; i--) {
        var sk = sessionStorage.key(i);
        if (sk && sk.indexOf(STORAGE_PREFIX) === 0) sessionStorage.removeItem(sk);
      }
    } catch (_) {}
  }

  function stats() {
    return { hits: hits, misses: misses, memoryEntries: mem.size, inFlight: inFlight.size };
  }

  return {
    key: key,
    ttl: ttl,
    get: get,
    set: set,
    inFlight: inFlight,
    invalidateMutation: invalidateMutation,
    clearAll: clearAll,
    stats: stats
  };
})();
