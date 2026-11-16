(() => {
  const DEFAULT_API_BASE_URL = 'http://13.48.153.251:8081';
  const metaValue = document.querySelector('meta[name="ecorotate-api-base-url"]')?.content?.trim();

  // Handle file:// protocol — location.hostname is empty string
  let hostname = '';
  try { hostname = location.hostname || ''; } catch(_) { hostname = ''; }
  const isFileProtocol = (location.protocol === 'file:');

  const isReplitOrLocalHost = ['localhost', '127.0.0.1'].includes(hostname)
    || hostname.endsWith('.replit.dev')
    || hostname.endsWith('.replit.app');

  // When opened from file://, default to the remote backend so the app still works
  const configuredApiBaseUrl = metaValue && !metaValue.startsWith('%')
    ? metaValue
    : (isFileProtocol ? DEFAULT_API_BASE_URL : (isReplitOrLocalHost ? '' : DEFAULT_API_BASE_URL));
  const API_BASE_URL = configuredApiBaseUrl
    .replace(/\/+$/, '');

  function normalizeKeys(value) {
    if (Array.isArray(value)) return value.map(normalizeKeys);
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
      normalizeKeys(item)
    ]));
  }

  function toWireFormat(value) {
    if (Array.isArray(value)) return value.map(toWireFormat);
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
      toWireFormat(item)
    ]));
  }

  function responseMessage(body, fallback) {
    if (body && typeof body === 'object') {
      const detail = body.message || body.error || body.detail || body.title;
      if (detail) return String(detail);
    }
    if (typeof body === 'string' && body.trim()) return body.trim();
    return fallback;
  }

  async function request(path, options = {}) {
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs || 20000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const { timeoutMs: _timeoutMs, ...fetchOptions } = options;
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

    try {
      const response = await fetch(url, { ...fetchOptions, signal: controller.signal });
      const raw = await response.text();
      let body = null;
      if (raw) {
        try {
          body = JSON.parse(raw);
        } catch {
          body = raw;
        }
      }

      if (!response.ok) {
        const detail = responseMessage(body, response.statusText || 'Request failed');
        throw new Error(`${method} ${path} failed (${response.status}): ${detail}`);
      }
      return normalizeKeys(body);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`${method} ${path} timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
      }
      if (error instanceof TypeError) {
        throw new Error(`Could not reach the backend at ${API_BASE_URL}. Check that it is online and allows requests from this site (CORS).`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function ensureNotice() {
    let notice = document.getElementById('ecorotate-diagnostic-notice');
    if (notice) return notice;

    notice = document.createElement('section');
    notice.id = 'ecorotate-diagnostic-notice';
    notice.setAttribute('role', 'status');
    Object.assign(notice.style, {
      position: 'fixed',
      top: '78px',
      right: '16px',
      zIndex: '99999',
      width: 'min(440px, calc(100vw - 32px))',
      display: 'none',
      padding: '14px 16px',
      border: '1px solid #f0c36d',
      borderRadius: '14px',
      background: '#fff8e8',
      color: '#432f08',
      boxShadow: '0 12px 32px rgba(0,0,0,.24)',
      font: '14px/1.45 system-ui, sans-serif'
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      marginBottom: '5px'
    });
    const title = document.createElement('strong');
    title.id = 'ecorotate-diagnostic-title';
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = 'Dismiss';
    close.setAttribute('aria-label', 'Dismiss diagnostic message');
    Object.assign(close.style, {
      border: '0',
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: '700',
      padding: '2px 4px'
    });
    close.addEventListener('click', () => { notice.style.display = 'none'; });
    header.append(title, close);

    const message = document.createElement('p');
    message.id = 'ecorotate-diagnostic-message';
    message.style.margin = '0';
    notice.append(header, message);
    document.body.append(notice);
    return notice;
  }

  let noticeTimer;
  function showNotice(titleText, messageText, { error = false, persistent = error } = {}) {
    const notice = ensureNotice();
    notice.style.display = 'block';
    notice.style.borderColor = error ? '#e7a7a7' : '#91d6a8';
    notice.style.background = error ? '#fff0f0' : '#edfff1';
    notice.style.color = error ? '#601b1b' : '#123e20';
    notice.setAttribute('role', error ? 'alert' : 'status');
    document.getElementById('ecorotate-diagnostic-title').textContent = titleText;
    document.getElementById('ecorotate-diagnostic-message').textContent = String(messageText).slice(0, 700);
    clearTimeout(noticeTimer);
    if (!persistent) {
      noticeTimer = setTimeout(() => { notice.style.display = 'none'; }, 5000);
    }
  }

  function reportError(error, context = 'Application error') {
    const message = error instanceof Error ? error.message : String(error || 'Unknown error');
    console.error(context, error);
    showNotice(context, message, { error: true });
  }

  async function checkBackendHealth() {
    try {
      const health = await request('/health', { timeoutMs: 8000 });
      if (!health || health.status !== 'UP') {
        throw new Error(`Unexpected health response: ${JSON.stringify(health)}`);
      }
      const route = API_BASE_URL || 'the Replit preview proxy';
      showNotice('Backend connected', `Health check passed via ${route}.`, { persistent: false });
      return { ok: true, health };
    } catch (error) {
      reportError(error, 'Backend connection failed');
      return { ok: false, error };
    }
  }

  window.EcoRotateDiagnostics = {
    apiBaseUrl: API_BASE_URL,
    request,
    toWireFormat,
    showNotice,
    reportError,
    checkBackendHealth
  };

  window.addEventListener('error', event => {
    reportError(event.error || event.message || 'Unknown browser error', 'Page error');
  });
  window.addEventListener('unhandledrejection', event => {
    reportError(event.reason || 'Unhandled async error', 'Page error');
  });
})();
