// Fez.$ - a small jQuery-shaped DOM layer: the 20% of jQuery that covers 80% of
// page scripts. Fez never assigns window.$; an app opts in with `window.$ = Fez.$`.
//
//   Fez.$('.row').addClass('on').find('a').attr('href')
//   Fez.$('<li>x</li>').appendTo('ul')
//   Fez.$(document).on('click.menu', '.item', fn)
//   Fez.$.post('/api/save', { refs: [1, 2] }).done(data => ...).fail(res => ...)
//   Fez.$.fn.shake = function () { ... }     // app extensions
//
// Differences from jQuery, on purpose:
// - on() keeps ONE handler per node + event + key; the key is the .namespace,
//   else a hash of the handler source (and delegate selector). Registering
//   again replaces it, so a script re-run by a pjax swap does not stack handlers.
// - $.ajax / $.get / $.post run on Fez.req: no jqXHR, no global ajax events.
//   They return the request promise (with .abort() and .xhr) plus .done(data, res),
//   .fail(res) and .always(res); res is the Fez.req result.
// - no animations, effects queue, deferreds or $.Callbacks.

const HTML = /^\s*</;
const isStr = (v) => typeof v === 'string';
const isFn = (v) => typeof v === 'function';
const arr = (v) => Array.prototype.slice.call(v);
const uniq = (a) => [...new Set(a)];

// FNV-1a, base36: the default on() key
const hash = (str) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
};

const onReady = (fn) =>
  document.readyState !== 'loading' ? fn() : document.addEventListener('DOMContentLoaded', fn);

// show(): drop the inline display; if a stylesheet still hides the node, use the tag's natural display
const DISPLAY = {};
const reveal = (el) => {
  el.style.display = '';
  if (getComputedStyle(el).display === 'none') {
    const tag = el.tagName.toLowerCase();
    if (!DISPLAY[tag]) {
      const probe = document.createElement(tag);
      document.body.appendChild(probe);
      const d = getComputedStyle(probe).display;
      probe.remove();
      DISPLAY[tag] = d === 'none' ? 'block' : d;
    }
    el.style.display = DISPLAY[tag];
  }
};

const ONS = Symbol('fez.$.on'); // per-node [{ ev, key, h }]
// "keydown.nfc" -> ['keydown', 'nfc'], ".nfc" -> ['', 'nfc']
const evkey = (tok) => {
  const i = tok.indexOf('.');
  return i < 0 ? [tok, ''] : [tok.slice(0, i), tok.slice(i + 1)];
};

class Dollar extends Array {}

const frag = (c) => {
  if (c instanceof Dollar) {
    return [...c];
  }
  if (c.nodeType) {
    return [c];
  }
  if (isStr(c)) {
    if (!HTML.test(c)) {
      return [document.createTextNode(c)];
    }
    const t = document.createElement('template');
    t.innerHTML = c.trim();
    return arr(t.content.childNodes);
  }
  return arr(c);
};

const nodes = (sel, ctx) => {
  if (!sel) {
    return [];
  }
  if (sel instanceof Dollar) {
    return [...sel];
  }
  if (isFn(sel)) {
    onReady(sel);
    return [];
  }
  if (sel.nodeType || sel === window) {
    return [sel];
  }
  if (isStr(sel)) {
    return HTML.test(sel) ? frag(sel) : arr((ctx ? $(ctx)[0] : document).querySelectorAll(sel));
  }
  return typeof sel.length === 'number' ? arr(sel) : [sel];
};

const $ = (sel, ctx) => Dollar.from(nodes(sel, ctx));
const collect = (set, fn) => $(uniq([].concat(...[...set].map(fn)).filter(Boolean)));
const narrow = (set, sel) => (sel ? set.filter(sel) : set);
const insert = (place) =>
  function (c) {
    return this.each(function (i) {
      const list = frag(c).map((n) => (i ? n.cloneNode(true) : n));
      this[place](...list);
    });
  };

Object.assign(Dollar.prototype, {
  each(fn) {
    [...this].forEach((e, i) => fn.call(e, i, e));
    return this;
  },
  map(fn) {
    return $([...this].map((e, i) => fn.call(e, i, e)));
  },
  filter(f) {
    return $([...this].filter((e, i) => (isStr(f) ? e.matches(f) : f.call(e, i, e))));
  },
  get(i) {
    return i === undefined ? [...this] : this[i < 0 ? this.length + i : i];
  },
  eq(i) {
    return $(this.get(i));
  },
  first() {
    return this.eq(0);
  },
  last() {
    return this.eq(-1);
  },
  add(sel) {
    return $(uniq([...this, ...nodes(sel)]));
  },
  not(sel) {
    return $([...this].filter((e) => (isFn(sel) ? !sel(e) : !e.matches(sel))));
  },
  is(sel) {
    return [...this].some((e) => (isFn(sel) ? sel(e) : e.matches(sel)));
  },

  addClass(c) {
    return this.each(function () {
      this.classList.add(...c.split(/\s+/).filter(Boolean));
    });
  },
  removeClass(c) {
    return this.each(function () {
      this.classList.remove(...c.split(/\s+/).filter(Boolean));
    });
  },
  toggleClass(c, force) {
    return this.each(function () {
      c.split(/\s+/)
        .filter(Boolean)
        .forEach((n) => this.classList.toggle(n, force));
    });
  },
  hasClass(c) {
    return [...this].some((e) => e.classList.contains(c));
  },
  attr(n, v) {
    if (v === undefined && isStr(n)) {
      return this[0]?.getAttribute(n);
    }
    return this.each(function () {
      if (typeof n === 'object') {
        Object.entries(n).forEach(([k, x]) => this.setAttribute(k, x));
      } else {
        this.setAttribute(n, v);
      }
    });
  },
  removeAttr(n) {
    return this.each(function () {
      this.removeAttribute(n);
    });
  },
  prop(n, v) {
    return v === undefined
      ? this[0]?.[n]
      : this.each(function () {
          this[n] = v;
        });
  },
  data(n, v) {
    return v === undefined
      ? this[0]?.dataset[n]
      : this.each(function () {
          this.dataset[n] = v;
        });
  },
  css(n, v) {
    if (typeof n === 'object') {
      return this.each(function () {
        Object.assign(this.style, n);
      });
    }
    if (v === undefined) {
      return this[0] && getComputedStyle(this[0])[n];
    }
    return this.each(function () {
      this.style[n] = v;
    });
  },
  val(v) {
    return v === undefined
      ? this[0]?.value
      : this.each(function () {
          this.value = v;
        });
  },
  html(v) {
    return v === undefined
      ? this[0]?.innerHTML
      : this.each(function () {
          this.innerHTML = v;
        });
  },
  text(v) {
    return v === undefined
      ? this[0]?.textContent
      : this.each(function () {
          this.textContent = v;
        });
  },
  serialize() {
    return new URLSearchParams(new FormData(this[0])).toString();
  },

  width() {
    return this[0] ? this[0].getBoundingClientRect().width : 0;
  },
  height() {
    return this[0] ? this[0].getBoundingClientRect().height : 0;
  },
  offset() {
    const r = this[0].getBoundingClientRect();
    return { top: r.top + window.scrollY, left: r.left + window.scrollX };
  },
  scrollTop(v) {
    return v === undefined
      ? this[0]?.scrollTop
      : this.each(function () {
          this.scrollTop = v;
        });
  },

  show() {
    return this.each(function () {
      reveal(this);
    });
  },
  hide() {
    return this.each(function () {
      this.style.display = 'none';
    });
  },
  toggle(force) {
    return this.each(function () {
      const show = force === undefined ? getComputedStyle(this).display === 'none' : force;
      if (show) {
        reveal(this);
      } else {
        this.style.display = 'none';
      }
    });
  },

  append: insert('append'),
  prepend: insert('prepend'),
  before: insert('before'),
  after: insert('after'),
  replaceWith: insert('replaceWith'),
  appendTo(t) {
    $(t).append(this);
    return this;
  },
  prependTo(t) {
    $(t).prepend(this);
    return this;
  },
  clone() {
    return $([...this].map((e) => e.cloneNode(true)));
  },
  empty() {
    return this.each(function () {
      this.replaceChildren();
    });
  },
  remove() {
    return this.each(function () {
      this.remove();
    });
  },

  find(sel) {
    return collect(this, (e) => arr(e.querySelectorAll(sel)));
  },
  children(sel) {
    return narrow(
      collect(this, (e) => arr(e.children)),
      sel,
    );
  },
  closest(sel) {
    return collect(this, (e) => e.closest(sel));
  },
  parent(sel) {
    return narrow(
      collect(this, (e) => e.parentElement),
      sel,
    );
  },
  parents(sel) {
    const ups = (e) => {
      const out = [];
      for (let p = e.parentElement; p; p = p.parentElement) {
        out.push(p);
      }
      return out;
    };
    return narrow(collect(this, ups), sel);
  },
  next(sel) {
    return narrow(
      collect(this, (e) => e.nextElementSibling),
      sel,
    );
  },
  prev(sel) {
    return narrow(
      collect(this, (e) => e.previousElementSibling),
      sel,
    );
  },
  siblings(sel) {
    return narrow(
      collect(this, (e) => arr(e.parentNode.children).filter((c) => c !== e)),
      sel,
    );
  },

  on(type, sel, fn) {
    const dele = isStr(sel);
    const cb = dele ? fn : sel;
    const h = dele
      ? function (ev) {
          const t = ev.target.closest?.(sel);
          if (t && this.contains(t)) {
            cb.call(t, ev);
          }
        }
      : cb;
    if (dele) {
      cb.__fezDelegate = h;
    }
    return this.each(function () {
      const reg = (this[ONS] ||= []);
      type.split(/\s+/).forEach((tok) => {
        const [ev, ns] = evkey(tok);
        const key = ns || hash((dele ? sel + '\u0000' : '') + String(cb));
        const i = reg.findIndex((e) => e.ev === ev && e.key === key);
        if (i >= 0) {
          this.removeEventListener(ev, reg[i].h);
          reg.splice(i, 1);
        }
        reg.push({ ev, key, h });
        this.addEventListener(ev, h);
      });
    });
  },
  off(type, fn) {
    const target = fn && (fn.__fezDelegate || fn);
    return this.each(function () {
      const reg = this[ONS] || [];
      type.split(/\s+/).forEach((tok) => {
        const [ev, ns] = evkey(tok);
        if (target && ev) {
          this.removeEventListener(ev, target);
        }
        for (let i = reg.length - 1; i >= 0; i--) {
          const e = reg[i];
          if ((!ev || e.ev === ev) && (!ns || e.key === ns) && (!target || e.h === target)) {
            this.removeEventListener(e.ev, e.h);
            reg.splice(i, 1);
          }
        }
      });
    });
  },
  one(type, sel, fn) {
    const dele = isStr(sel);
    const cb = dele ? fn : sel;
    return this.each(function () {
      const node = this;
      const h = function (ev) {
        const t = dele ? ev.target.closest?.(sel) : node;
        if (dele && !(t && node.contains(t))) {
          return;
        }
        type.split(/\s+/).forEach((tok) => node.removeEventListener(evkey(tok)[0], h));
        cb.call(t, ev);
      };
      type.split(/\s+/).forEach((tok) => node.addEventListener(evkey(tok)[0], h));
    });
  },
  trigger(type, detail) {
    return this.each(function () {
      this.dispatchEvent(new CustomEvent(type, { bubbles: true, cancelable: true, detail }));
    });
  },
  ready(fn) {
    onReady(fn);
    return this;
  },
});

// x(fn) binds a handler; x() runs the native action (focus, click, ...) or dispatches the event
'click focus blur submit change input keydown keyup'.split(' ').forEach((ev) => {
  Dollar.prototype[ev] = function (fn) {
    if (fn !== undefined) {
      return this.on(ev, fn);
    }
    return this.each(function () {
      if (isFn(this[ev])) {
        this[ev]();
      } else {
        $(this).trigger(ev);
      }
    });
  };
});

$.fn = Dollar.prototype;
$.ready = onReady;

export default function attachDollar(Fez) {
  // .done(data, res) on success, .fail(res) on an error status or transport error,
  // .always(res); each also works when attached after the response arrived
  const chain = (req, success) => {
    req.done = (f) => (req.then((res) => res.ok && f(res.data, res)), req);
    req.fail = (f) => (req.then((res) => !res.ok && f(res)), req);
    req.always = (f) => (req.then(f), req);
    return success ? req.done(success) : req;
  };

  // $.ajax({ type, url, data, headers, success(data, res), error(res), complete(res), ...Fez.req options })
  $.ajax = (o) => {
    const { type, success, error, complete, contentType, ...rest } = o;
    const json = rest.json || contentType === 'json' || contentType === 'application/json';
    const req = chain(Fez.req({ ...rest, method: type || rest.method, json }), success);
    if (error) {
      req.fail(error);
    }
    if (complete) {
      req.always(complete);
    }
    return req;
  };

  const shorthand = (method) => (url, data, success) => {
    if (isFn(data)) {
      success = data;
      data = undefined;
    }
    return chain(Fez.req({ method, url, data }), success);
  };
  $.get = shorthand('GET');
  $.post = shorthand('POST');
  $.param = Fez.req.param;

  Fez.$ = $;
}

export { $ };
