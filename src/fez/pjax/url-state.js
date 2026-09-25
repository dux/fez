// History-only URL state helpers, attached to the Pjax class as statics:
// qs() / hash() for named params in the query string or a slashless fragment,
// hpath() / hqs() for a hash route. None of them fetch or scroll. Writes go
// through Pjax.push / Pjax.replace so the class keeps its popstate bookkeeping.
//
// A fragment whose path part contains a '/' is a route (`#/foo`, `#ns/foo`,
// `#/foo?bar=baz`); the route name is the last path segment and the query
// rides in the fragment. Fragments without a '/' are left to `hash()` and
// native anchors (`#foo`, `#a=b`).

export default function attachUrlState(Pjax) {
  // opts.href returns the URL without writing; it wins over opts.replace
  const write = (href, opts) => {
    if (opts.href) {
      return href;
    }
    return opts.replace ? Pjax.replace(href) : Pjax.push(href);
  };

  const urlParam = (part, key, value, opts) => {
    const url = new URL(location.href);
    const params = new URLSearchParams(url[part].slice(1));

    if (typeof value === 'undefined') {
      return params.get(key) ?? undefined;
    }

    if (value === null || value === false) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    url[part] = params.toString();
    return write(url.pathname + url.search + url.hash, opts);
  };

  const hashParts = () => {
    const raw = location.hash.replace(/^#/, '');
    const mark = raw.indexOf('?');
    const path = mark === -1 ? raw : raw.slice(0, mark);
    const query = mark === -1 ? '' : raw.slice(mark + 1);
    return { path, query, route: path.includes('/') };
  };

  const hashHref = (fragment) => {
    const url = new URL(location.href);
    url.hash = fragment;
    return url.pathname + url.search + url.hash;
  };

  Pjax.qs = (key, value, opts = {}) => urlParam('search', key, value, opts);

  Pjax.hash = (key, value, opts = {}) => urlParam('hash', key, value, opts);

  Pjax.hpath = (value, opts = {}) => {
    const parts = hashParts();
    if (typeof value === 'undefined') {
      return parts.route ? parts.path.split('/').filter(Boolean).pop() || '' : '';
    }

    const clean = String(value || '').replace(/^\/+|\/+$/g, '');
    let query = '';
    if (clean) {
      query =
        typeof opts.qs === 'undefined' ? parts.query : new URLSearchParams(opts.qs).toString();
    } else if (typeof opts.qs !== 'undefined') {
      query = new URLSearchParams(opts.qs).toString();
    }
    const fragment = clean ? `/${clean}${query ? `?${query}` : ''}` : query ? `?${query}` : '';
    return write(hashHref(fragment), opts);
  };

  Pjax.hqs = (key, value, opts = {}) => {
    const parts = hashParts();
    if (!parts.route) {
      return undefined;
    }

    const params = new URLSearchParams(parts.query);
    if (typeof value === 'undefined') {
      return params.get(key) ?? undefined;
    }

    if (value === null || value === false) {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const query = params.toString();
    return write(hashHref(parts.path + (query ? `?${query}` : '')), opts);
  };
}
