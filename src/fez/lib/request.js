// Fez.req - the one remote-request primitive. Built on XMLHttpRequest because
// fetch still cannot report upload progress outside Chromium.
//
//   const req = Fez.req({ method: 'POST', url, data })
//   const req = Fez.req('/path', { data })     // url first, options second
//   req.then(res => res.ok ? use(res.data) : show(res.status))
//   req.abort()                                     // req.xhr is the live XMLHttpRequest
//
// The promise never rejects: an HTTP error status, a network failure, a timeout
// and an abort all resolve with `ok: false` (the last three also set `error`).
// Fez.req.param(obj) builds the same bracket-style query string.

const CACHE_MAX = 100;
const cache = new Map(); // key -> { res, expires }
const inflight = new Map(); // key -> request promise

const isBlob = (v) => typeof Blob !== 'undefined' && v instanceof Blob;
const isRaw = (v) =>
  typeof v === 'string' ||
  isBlob(v) ||
  v instanceof ArrayBuffer ||
  (typeof FormData !== 'undefined' && v instanceof FormData) ||
  (typeof URLSearchParams !== 'undefined' && v instanceof URLSearchParams);

// Rails/Rack bracket names: { a: [1, 2], u: { n: 'x' } } -> a[]=1, a[]=2, u[n]=x.
// An array of objects keeps indexes (items[0][name]) so rows stay together.
const pairs = (obj, scope, out = []) => {
  const isArr = Array.isArray(obj);
  for (const k in obj) {
    let v = obj[k];
    if (v instanceof Date) {
      v = v.toISOString();
    }
    const nested = v != null && typeof v === 'object' && !isBlob(v);
    const key = scope ? `${scope}[${isArr && !nested ? '' : k}]` : k;
    if (nested) {
      pairs(v, key, out);
    } else {
      out.push([key, v == null ? '' : v]);
    }
  }
  return out;
};

const param = (obj) =>
  pairs(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

const queryString = (data) => {
  if (typeof data === 'string') {
    return data.replace(/^\?/, '');
  }
  if (isRaw(data)) {
    return new URLSearchParams(data).toString();
  }
  return param(data);
};

// -> [body, content-type or undefined (let the browser pick)]
const encodeBody = (data, json) => {
  if (data == null) {
    return [null];
  }
  if (json) {
    return [JSON.stringify(data), 'application/json'];
  }
  if (isRaw(data)) {
    return [data];
  }
  const list = pairs(data);
  if (list.some(([, v]) => isBlob(v))) {
    const form = new FormData();
    list.forEach(([k, v]) => form.append(k, v));
    return [form];
  }
  return [param(data), 'application/x-www-form-urlencoded; charset=UTF-8'];
};

const sameOrigin = (url) => {
  if (typeof location === 'undefined') {
    return true;
  }
  try {
    return new URL(url, location.href).origin === location.origin;
  } catch {
    return false;
  }
};

const parseHeaders = (raw) => {
  const headers = new Headers();
  for (const line of (raw || '').trim().split(/[\r\n]+/)) {
    const i = line.indexOf(':');
    if (i > 0) {
      headers.append(line.slice(0, i).trim(), line.slice(i + 1).trim());
    }
  }
  return headers;
};

const progress = (fn) => (e) =>
  fn({
    loaded: e.loaded,
    total: e.lengthComputable ? e.total : 0,
    percent: e.lengthComputable && e.total ? Math.round((e.loaded / e.total) * 100) : null,
  });

const send = (o) => {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve) => {
    const method = (o.method || 'GET').toUpperCase();
    const bodyless = method === 'GET' || method === 'HEAD';
    let url = o.url;
    let body = null;
    let type;

    if (bodyless) {
      const qs = o.data == null ? '' : queryString(o.data);
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    } else {
      [body, type] = encodeBody(o.data, o.json);
    }

    xhr.open(method, url, true);

    // app-wide headers (CSRF token, ...) never leave the origin
    const headers = sameOrigin(url)
      ? { 'x-requested-with': 'XMLHttpRequest', ...request.headers }
      : {};
    if (type) {
      headers['content-type'] = type;
    }
    Object.assign(headers, o.headers);
    for (const k in headers) {
      if (headers[k] != null) {
        xhr.setRequestHeader(k, headers[k]);
      }
    }

    if (o.timeout) {
      xhr.timeout = o.timeout;
    }
    if (o.responseType) {
      xhr.responseType = o.responseType;
    }
    if (o.credentials) {
      xhr.withCredentials = true;
    }
    // an upload listener forces a CORS preflight, so attach it only on request
    if (o.onUpload) {
      xhr.upload.onprogress = progress(o.onUpload);
    }
    if (o.onProgress) {
      xhr.onprogress = progress(o.onProgress);
    }

    let done = false;
    const finish = (error) => {
      if (done) {
        return;
      }
      done = true;
      o.signal?.removeEventListener('abort', onSignal);

      const status = error ? 0 : xhr.status;
      const textual = !xhr.responseType || xhr.responseType === 'text';
      const text = textual ? xhr.responseText || '' : '';
      const res = {
        ok: !error && status >= 200 && status < 300,
        status,
        statusText: error ? '' : xhr.statusText || '',
        url: xhr.responseURL || '',
        headers: parseHeaders(error ? '' : xhr.getAllResponseHeaders()),
        text,
        data: textual ? text : xhr.response,
        xhr,
      };
      if (error) {
        res.error = error;
      } else if (textual && text && (res.headers.get('content-type') || '').includes('json')) {
        try {
          res.data = JSON.parse(text);
        } catch {
          // keep the raw text: a broken JSON body is still worth showing
        }
      }
      resolve(res);
    };
    const onSignal = () => xhr.abort();

    xhr.onload = () => finish();
    xhr.onerror = () => finish('network');
    xhr.ontimeout = () => finish('timeout');
    xhr.onabort = () => finish('abort');

    if (o.signal?.aborted) {
      return finish('abort');
    }
    o.signal?.addEventListener('abort', onSignal);

    xhr.send(body);
  });
  promise.abort = () => xhr.abort();
  promise.xhr = xhr;
  return promise;
};

// cache: seconds a successful GET is reused; concurrent identical cached GETs
// share one request (aborting it aborts it for every joined caller)
function request(url, opts) {
  const o = typeof url === 'string' ? { ...opts, url } : { ...url };
  const method = (o.method || 'GET').toUpperCase();
  if (!o.cache || method !== 'GET') {
    return send(o);
  }

  const key = `${o.url}\u0000${o.data == null ? '' : queryString(o.data)}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) {
    const promise = Promise.resolve(hit.res);
    promise.abort = () => {};
    promise.xhr = hit.res.xhr;
    return promise;
  }

  let req = inflight.get(key);
  if (!req) {
    req = send(o);
    inflight.set(key, req);
    req.then((res) => {
      inflight.delete(key);
      if (res.ok) {
        if (cache.size >= CACHE_MAX) {
          cache.delete(cache.keys().next().value);
        }
        cache.set(key, { res, expires: Date.now() + o.cache * 1000 });
      }
    });
  }
  return req;
}

// default headers for same-origin requests, e.g. Fez.req.headers['x-csrf-token'] = token
request.headers = {};

request.clearCache = () => {
  cache.clear();
  inflight.clear();
};

request.param = param;

// Cached GET of a text source (component files, includes): resolves the body,
// rejects on an error status, network failure or timeout. Internal, not API.
const loadText = (url) =>
  request(url, { cache: 300 }).then((res) => {
    if (!res.ok) {
      const why = res.error || `${res.status} ${res.statusText}`.trim();
      throw new Error(`${why} for GET ${url}`);
    }
    return res.data;
  });

export { request, loadText };
