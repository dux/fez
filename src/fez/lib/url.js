// Fez.url - parse and build any URL, part by part.
//
//   https://host:8443/foo/bar/baz:789?baz=123#/some/hpath?baz=455
//   proto  host  port path    pqs     qs      hpath       hqs
//
// The fragment is one of three forms: a route (`#/some/hpath?baz=455`, any
// fragment with a '/' before its '?'), params only (`#tab=x&y=1`, read and
// written through hqs) or a plain anchor (`#section`).
//
// Fez.url(href) returns a builder (no href = the current page). A method with a
// name reads (`qs('page')`), with a value writes and returns the builder, so
// writes chain. `null`, `false` and '' remove a key. Fez.url.<method>(...) is
// Fez.url().<method>(...) on the current page, read at call time.
//
// Untouched parts keep their original encoding, so Fez.url(x).toString() === x.

const MARK = Symbol.for('fez.url');
const SHORTCUTS = [
  'proto',
  'host',
  'port',
  'path',
  'pqs',
  'qs',
  'hpath',
  'hqs',
  'anchor',
  'href',
  'push',
  'replace',
];

const hasLocation = () => typeof location !== 'undefined';
const currentHref = () => (hasLocation() ? location.href : 'http://localhost/');

const blank = (value) => value == null || value === false || value === '';

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

// encodeURIComponent, leaving the characters a query carries as is
const encodeQuery = (value) =>
  encodeURIComponent(String(value)).replace(/%(3A|2F|2C|40|5B|5D|24|21|27|28|29|2A|3B)/gi, (m) =>
    decodeURIComponent(m),
  );

// codecs per key/value list: a query reads '+' as a space, a path segment does
// not, and a '/' is encoded where it would end a segment or turn a fragment
// param list into a route
const encodeNoSlash = (v) => encodeQuery(v).replace(/\//g, '%2F');
const CODECS = {
  _qs: { decode: (v) => safeDecode(v.replace(/\+/g, ' ')), encode: encodeQuery },
  _hqs: { decode: (v) => safeDecode(v.replace(/\+/g, ' ')), encode: encodeNoSlash },
  _pqs: { decode: safeDecode, encode: encodeNoSlash },
};

// a path or hash path as typed: unsafe characters encoded, existing %xx kept
const encodePath = (value) =>
  String(value).replace(/[^A-Za-z0-9\-._~!$&'()*+,;=:@/%]/g, (c) => encodeURIComponent(c));

// raw 'a=1&b&c=' -> [['a', '1'], ['b', null], ['c', '']], still encoded; null
// marks a key written without '=', so it renders back the same way
const parsePairs = (raw) =>
  raw
    ? raw
        .split('&')
        .filter(Boolean)
        .map((pair) => {
          const at = pair.indexOf('=');
          return at === -1 ? [pair, null] : [pair.slice(0, at), pair.slice(at + 1)];
        })
    : [];

const joinPairs = (pairs, sep, glue) =>
  pairs.map(([k, v]) => (v === null ? k : `${k}${glue}${v}`)).join(sep);

// '/foo/bar/baz:789' -> { path: '/foo/bar', pairs: [['baz', '789']] }; the Lux
// router reads trailing /key:value segments as params
const splitPath = (pathname) => {
  const parts = pathname.split('/');
  const pairs = [];
  let seg;
  while (parts.length > 1 && (seg = parts[parts.length - 1]).includes(':') && seg[0] !== ':') {
    parts.pop();
    const at = seg.indexOf(':');
    pairs.unshift([seg.slice(0, at), seg.slice(at + 1)]);
  }
  return { path: parts.join('/') || '/', pairs };
};

class FezUrl {
  constructor(href) {
    const url = new URL(href == null ? currentHref() : String(href), currentHref());
    const { path, pairs } = splitPath(url.pathname);

    this._proto = url.protocol.slice(0, -1);
    this._host = url.hostname;
    this._port = url.port;
    this._path = path;
    this._pqs = pairs;
    this._qs = parsePairs(url.search.slice(1));
    this._hpath = '';
    this._hqs = [];
    this._anchor = '';
    this._parseFragment(url.hash.slice(1));
  }

  get [MARK]() {
    return true;
  }

  _parseFragment(raw) {
    const mark = raw.indexOf('?');
    const head = mark === -1 ? raw : raw.slice(0, mark);
    const query = mark === -1 ? '' : raw.slice(mark + 1);

    if (head.includes('/')) {
      this._hpath = head;
      this._hqs = parsePairs(query);
    } else if (head === '') {
      this._hqs = parsePairs(query);
    } else if (mark === -1 && head.includes('=')) {
      this._hqs = parsePairs(head);
    } else {
      this._anchor = raw;
    }
  }

  // one key/value list: read a key, read all as an object, write a key, write
  // an object, or clear the list with null
  _pairs(list, key, value, arity) {
    const { decode, encode } = CODECS[list];

    if (arity === 0) {
      const out = {};
      for (const [k, v] of this[list]) {
        const name = decode(k);
        if (!(name in out)) {
          out[name] = v === null ? '' : decode(v);
        }
      }
      return out;
    }

    if (key === null) {
      this[list] = [];
      return this;
    }

    if (typeof key === 'object') {
      for (const [k, v] of Object.entries(key)) {
        this._pairs(list, k, v, 2);
      }
      return this;
    }

    const name = String(key);
    const index = this[list].findIndex(([k]) => decode(k) === name);

    if (arity === 1) {
      if (index === -1) {
        return undefined;
      }
      const raw = this[list][index][1];
      return raw === null ? '' : decode(raw);
    }

    const rest = this[list].filter(([k]) => decode(k) !== name);
    if (!blank(value)) {
      rest.splice(index === -1 ? rest.length : index, 0, [encode(name), encode(value)]);
    }
    this[list] = rest;
    return this;
  }

  proto(value) {
    if (arguments.length === 0) {
      return this._proto;
    }
    this._proto = String(value).replace(/:\/*$/, '');
    return this;
  }

  host(value) {
    if (arguments.length === 0) {
      return this._host;
    }
    this._host = String(value);
    return this;
  }

  // '' for the protocol's default port
  port(value) {
    if (arguments.length === 0) {
      return this._port;
    }
    this._port = blank(value) ? '' : String(value);
    return this;
  }

  // the path without its /key:value params; trailing ones in a written path
  // are merged into pqs
  path(value) {
    if (arguments.length === 0) {
      return this._path;
    }
    const { path, pairs } = splitPath(
      encodePath(blank(value) ? '/' : value).replace(/^(?!\/)/, '/'),
    );
    this._path = path;
    for (const [k, v] of pairs) {
      this._pairs('_pqs', safeDecode(k), safeDecode(v), 2);
    }
    return this;
  }

  // /key:value path params; writing one drops the same key from the query
  pqs(key, value) {
    if (key && typeof key === 'object') {
      for (const [k, v] of Object.entries(key)) {
        this.pqs(k, v);
      }
      return this;
    }
    const result = this._pairs('_pqs', key, value, arguments.length);
    if (arguments.length === 2 && key !== null) {
      this._pairs('_qs', key, null, 2);
    }
    return result;
  }

  qs(key, value) {
    return this._pairs('_qs', key, value, arguments.length);
  }

  // the fragment route ('/some/hpath'), '' when the fragment is not a route.
  // A path without a '/' becomes '/path', so it parses back as a route.
  hpath(value) {
    if (arguments.length === 0) {
      return this._hpath;
    }
    this._hpath = blank(value) ? '' : encodePath(String(value).includes('/') ? value : `/${value}`);
    this._anchor = '';
    return this;
  }

  // the fragment query, on a route (#/path?a=1) or alone (#a=1)
  hqs(key, value) {
    const result = this._pairs('_hqs', key, value, arguments.length);
    if (result === this) {
      this._anchor = '';
    }
    return result;
  }

  // a plain #anchor; writing one drops the hash route and its query
  anchor(value) {
    if (arguments.length === 0) {
      return this._anchor;
    }
    this._anchor = blank(value) ? '' : String(value).replace(/^#/, '');
    this._hpath = '';
    this._hqs = [];
    return this;
  }

  _origin() {
    return `${this._proto}://${this._host}${this._port ? `:${this._port}` : ''}`;
  }

  _relative() {
    const path = this._pqs.length
      ? `${this._path.replace(/\/$/, '')}/${joinPairs(this._pqs, '/', ':')}`
      : this._path;
    const qs = this._qs.length ? `?${joinPairs(this._qs, '&', '=')}` : '';
    const hqs = joinPairs(this._hqs, '&', '=');
    let fragment = '';
    if (this._hpath) {
      fragment = `#${this._hpath}${hqs ? `?${hqs}` : ''}`;
    } else if (hqs) {
      fragment = `#${hqs}`;
    } else if (this._anchor) {
      fragment = `#${this._anchor}`;
    }
    return path + qs + fragment;
  }

  // always absolute
  href() {
    return this._origin() + this._relative();
  }

  // relative on the page's own origin, absolute elsewhere
  toString() {
    const same = !hasLocation() || this._origin() === location.origin;
    return same ? this._relative() : this.href();
  }

  // Write to history without fetching. Goes through the page's primary
  // Fez.pjax (window.Fez), so its Back/Forward bookkeeping stays right even
  // when this copy of fez was inlined into a second bundle.
  push() {
    const pjax = window.Fez?.pjax;
    pjax ? pjax.push(this.toString()) : window.history.pushState({}, '', this.toString());
  }

  replace() {
    const pjax = window.Fez?.pjax;
    pjax ? pjax.replace(this.toString()) : window.history.replaceState({}, '', this.toString());
  }
}

// Fez.load accepts a builder; checked by mark, not instanceof, because every
// inlined fez copy has its own class
export const isFezUrl = (value) => !!value?.[MARK];

export default function attachUrl(Fez) {
  const url = (href) => new FezUrl(href);
  for (const name of SHORTCUTS) {
    url[name] = (...args) => new FezUrl()[name](...args);
  }
  Fez.url = url;
}
