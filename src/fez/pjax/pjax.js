// Pjax - PushState + AJAX page navigation, ported from dux-pjax.
//
// Renders a server HTML response into the current page's pjax container
// (`<pjax>` tag or `.pjax` class, with an id) instead of a hard navigation.
// Swaps go through Fez.nodeMorph, so fez components inside the container are
// preserved and refreshed instead of destroyed.
//
// The class is created per call so tests get fresh static state. The browser
// singleton is created by boot.js and exposed as Fez.pjax, with Fez.load,
// Fez.refresh and the URL state helpers delegating to it.

import Fez from '../root.js';
import createOnClick from './onclick.js';
import attachUrlState from './url-state.js';
import { runScripts, runHeadScripts } from './scripts.js';

export default function createPjax() {
  class Pjax {
    static config = {
      is_silent:
        typeof location === 'undefined' ? true : !location.port || parseInt(location.port) < 1000,
      no_scroll_selector: ['.no-scroll'],
      paths_to_skip: [],
      no_pjax_class: ['no-pjax', 'direct'],
      no_ajax_class: ['ajax-skip', 'skip-ajax', 'no-ajax', 'top'],
      ajax_selector: '.ajax',
      timeout: 10000,
      history_max: 20,
    };

    // full-swap responses by path, restored on Back/Forward without a fetch
    static historyData = {};

    // in-flight AbortController per swap key ('full', or the target / region id)
    static requests = new Map();

    static LOAD_OPTIONS = ['target', 'source', 'form', 'history', 'scroll'];

    // --- public class methods ---

    // Bind all document/window level handlers. Called by boot.js once the page
    // is known to have a pjax container; call it manually if the container is
    // injected after DOMContentLoaded.
    static start() {
      if (Pjax._booted) {
        return;
      }
      Pjax._booted = true;
      Pjax._historyPath = Pjax.path();

      setTimeout(() => Pjax.sendGlobalEvent(), 0);

      Pjax.onDocumentClick();

      window.addEventListener('popstate', () => {
        const path = Pjax.path();
        const previousPath = Pjax._historyPath;
        Pjax._historyPath = path;
        // Fragment-only history changes leave the current page mounted.
        if (path === previousPath) {
          return;
        }
        window.requestAnimationFrame(() => {
          const entry = Pjax.historyData[path];
          if (entry) {
            Pjax.console(`from history: ${path}`);
            const root = document.createElement('div');
            root.innerHTML = entry.html;
            Pjax.setPageBody(root, path);
            if (entry.scrollY) {
              window.scrollTo(0, entry.scrollY);
            }
          } else {
            Pjax.load(path, { history: false });
          }
        });
      });

      document.body.addEventListener('submit', (e) => {
        const form = e.target;
        const pjaxAttr = form.getAttribute('data-pjax');
        if (pjaxAttr) {
          e.preventDefault();
          const target = pjaxAttr === 'true' ? undefined : pjaxAttr;
          Pjax.load(form.getAttribute('action'), { form, target });
        }
      });
    }

    static onDocumentClick() {
      if (!Pjax._clickBound) {
        Pjax._clickBound = true;
        window.addEventListener('click', Pjax.PjaxOnClick.main);
      }
    }

    // load and refresh share one signature and differ only in defaults:
    // refresh sends no-cache, skips the same-URL debounce and keeps scroll.
    // Both return a Promise that never rejects - it resolves the pjax:render
    // detail, or null when nothing was requested.
    static load(what, opts) {
      return Pjax.fetch(what, opts, false);
    }

    static refresh(what, opts) {
      return Pjax.fetch(what, opts, true);
    }

    static refreshed() {
      if (!Pjax.pastHref) {
        return false;
      }
      return Pjax.pastHref === Pjax.lastHref;
    }

    static path() {
      return location.pathname + location.search;
    }

    static last() {
      return Pjax.lastHref || Pjax.path();
    }

    static node() {
      const el =
        document.getElementsByTagName('pjax')[0] || document.getElementsByClassName('pjax')[0];
      if (!el) {
        Pjax.error('.pjax or <pjax> not found');
        return;
      }
      if (el.nodeName === 'BODY') {
        Pjax.error('You cant bind PJAX to body');
        return;
      }
      return el;
    }

    static console(msg) {
      if (Pjax.DEV || !Pjax.config.is_silent) {
        console.log(msg);
      }
    }

    static before() {
      return true;
    }

    static after() {
      return true;
    }

    static confirm(message, _node) {
      return window.confirm(message);
    }

    static error(msg) {
      console.error(`Pjax error: ${msg}`);
    }

    static pushState(href) {
      window.history.pushState({}, document.title, href);
      Pjax._historyPath = Pjax.path();
    }

    static push(href) {
      return Pjax.pushState(href);
    }

    static replace(href) {
      window.history.replaceState({}, document.title, href);
      Pjax._historyPath = Pjax.path();
    }

    static sendGlobalEvent() {
      Pjax._dispatchRender({
        from: null,
        to: Pjax.path(),
        status: 200,
        error: null,
        duration: 0,
        mode: 'full',
        opts: {},
      });
    }

    static _dispatchRender(detail) {
      document.dispatchEvent(new CustomEvent('pjax:render', { bubbles: true, detail }));
    }

    static emit(name, detail) {
      const event = new CustomEvent(`pjax:${name}`, { bubbles: true, cancelable: true, detail });
      document.dispatchEvent(event);
      return !event.defaultPrevented;
    }

    // --- option normalization ---

    // Normalizes load/refresh arguments into { href, opts }, or null when the
    // call is invalid (reported through Pjax.error). `what` is a URL, or a
    // '#selector' / element that becomes the swap target for the current URL.
    // The caller's object is copied, never written to.
    static getOpts(what, input) {
      const opts = {};
      for (const [key, value] of Object.entries(input || {})) {
        if (!Pjax.LOAD_OPTIONS.includes(key)) {
          Pjax.error(`unknown load option: ${key}`);
        } else if (value != null) {
          opts[key] = value;
        }
      }

      let href = what || null;
      if (href?.nodeType === 1 || (typeof href === 'string' && href[0] === '#')) {
        if (opts.target) {
          Pjax.error('target given twice - pass a #selector/element or opts.target, not both');
          return null;
        }
        opts.target = href;
        href = null;
      } else if (href !== null && typeof href !== 'string') {
        Pjax.error('load expects a URL, a #selector or an element');
        return null;
      }

      if (opts.target) {
        const node = Pjax._findNode(opts.target);
        if (!node) {
          Pjax.error(`target not found: ${opts.target}`);
          return null;
        }
        // the swap copies the node with the same id out of the response
        if (!node.id) {
          Pjax.error('target has no id attribute');
          return null;
        }
        opts.target = node;
      }

      return { href, opts };
    }

    static _findNode(target) {
      if (typeof target !== 'string') {
        return target?.nodeType === 1 ? target : null;
      }
      try {
        return document.querySelector(target);
      } catch {
        return null;
      }
    }

    // The .ajax region a source element sits in, unless an ancestor opts out.
    static _sourceRegion(source) {
      if (!source?.closest) {
        return;
      }
      for (const cls of Pjax.config.no_ajax_class) {
        if (source.closest(`.${cls}`)) {
          return;
        }
      }
      return source.closest(Pjax.config.ajax_selector) || undefined;
    }

    static _regionPath(region) {
      return region?.getAttribute('data-path') || region?.getAttribute('path');
    }

    // No href means the current URL, fragment included (a hash route survives a
    // refresh) - or the region's own URL for a region refresh. A '?query' href
    // is resolved against the region path or pathname.
    static _resolveHref(href, region) {
      if (!href) {
        return Pjax._regionPath(region) || Pjax.path() + location.hash;
      }
      if (href[0] === '?') {
        const base = Pjax._regionPath(region);
        return (base ? base.split('?')[0] : location.pathname) + href;
      }
      return href;
    }

    static _abort(key) {
      for (const [k, controller] of Pjax.requests) {
        // a full swap replaces every region, so it cancels them all
        if (key === 'full' || k === key) {
          Pjax.requests.delete(k);
          controller.abort();
        }
      }
    }

    // --- scroll management ---

    static shouldSkipScroll(node) {
      if (!node || !node.closest) {
        return;
      }
      for (const el of Pjax.config.no_scroll_selector) {
        if (node.closest(el)) {
          return true;
        }
      }
      return false;
    }

    static scrollLock() {
      const now = Date.now();
      if (Pjax._scrollLockTime && now - Pjax._scrollLockTime < 1000) {
        return;
      }
      Pjax._scrollLockTime = now;

      const scrollPosition = window.scrollY;
      const body = document.body;
      body.style.height = window.getComputedStyle(body).height;
      window.scrollTo(0, scrollPosition);

      window.requestAnimationFrame(() => {
        body.style.height = '';
        window.scrollTo(0, scrollPosition);
      });
    }

    // The element a URL fragment points at, by id or by name like the browser.
    static _anchor(fragment) {
      if (!fragment) {
        return null;
      }
      let name = fragment;
      try {
        name = decodeURIComponent(fragment);
      } catch {
        // keep the raw fragment
      }
      return document.getElementById(name) || document.getElementsByName(name)[0] || null;
    }

    // --- page rendering ---

    static setPageBody(root, href) {
      const title = root.querySelector('title')?.innerHTML;
      document.title = title || 'no page title (pjax)';
      Pjax.scrollLock();
      const pjaxNode = Pjax.node();
      if (!pjaxNode) {
        return false;
      }
      const newBody = Pjax.findById(root, pjaxNode.id);
      if (!newBody) {
        return false;
      }

      const finish = () => {
        runHeadScripts(root, newBody, Pjax.error);
        Pjax.morphInto(pjaxNode, runScripts(newBody));
        Pjax.after(href);
      };

      if (Pjax.useViewTransition && document.startViewTransition) {
        document.startViewTransition(finish);
      } else {
        finish();
      }
      return true;
    }

    // `source` is an element whose children become the target's children, or
    // an HTML string. Both reach nodeMorph as a DocumentFragment, never through
    // its string path: that would unwrap a single root child whose tag matches
    // the target (e.g. a lone <div class="flex"> wrapper inside a
    // <div class="pjax"> container) and flatten the layout.
    static morphInto(target, source) {
      let fragment;
      if (typeof source === 'string') {
        const range = document.createRange();
        range.selectNodeContents(target);
        fragment = range.createContextualFragment(source);
      } else {
        fragment = document.createDocumentFragment();
        fragment.append(...source.childNodes);
      }
      Fez.nodeMorph(target, fragment);
    }

    static findById(root, id) {
      if (!root || !id) {
        return;
      }
      if (root.getElementById) {
        return root.getElementById(id);
      }
      for (const node of root.querySelectorAll('[id]')) {
        if (node.id === id) {
          return node;
        }
      }
      return null;
    }

    // --- history management ---

    static _addHistoryEntry(href, html) {
      if (html == null) {
        html = href;
        href = Pjax.path();
      }
      const keys = Object.keys(Pjax.historyData);
      const max = Pjax.config.history_max || 20;
      if (keys.length >= max) {
        delete Pjax.historyData[keys[0]];
      }
      Pjax.historyData[href] = { html, scrollY: 0 };
    }

    // --- internal ---

    static fetch(what, opts, fresh) {
      try {
        const args = Pjax.getOpts(what, opts);
        return args ? new Pjax(args.href, args.opts, fresh).run() : Promise.resolve(null);
      } catch (err) {
        Pjax.error(`load failed: ${err?.message || err}`);
        return Promise.resolve(null);
      }
    }

    // --- instance methods ---

    // `opts` is the normalized copy from getOpts; defaults are filled in here,
    // so pjax:start / pjax:render publish exactly what the request used.
    constructor(href, opts = {}, fresh = false) {
      this.opts = opts;
      this.fresh = fresh;
      this.explicitHref = !!href;
      this.target = opts.target;
      this.region = Pjax._sourceRegion(opts.source);
      this.href = Pjax._resolveHref(href, this.region);
      this.resolve = () => {};

      // the fragment never goes to the server; it is kept for history and scroll
      const mark = this.href.indexOf('#');
      if (mark !== -1) {
        this.fragment = this.href.slice(mark + 1);
        this.href = this.href.slice(0, mark) || Pjax.path();
      }

      if (opts.form) {
        if ((opts.form.getAttribute('method') || 'get').toLowerCase() === 'post') {
          // POST keeps the body out of the URL
          this.method = 'POST';
          this.body = new FormData(opts.form);
        } else {
          const params = new URLSearchParams(new FormData(opts.form)).toString();
          if (params) {
            this.href += (this.href.includes('?') ? '&' : '?') + params;
          }
        }
      }

      this.key = this.target ? this.target.id : this.region ? this.region.id || 'ajax' : 'full';

      const nodeSwap = !!(this.target || this.region);
      opts.scroll ??= !nodeSwap && !fresh;
      // the current URL fetched into a node, or a region swap, is not a navigation
      opts.history ??= (this.target ? !href : this.region) ? false : 'push';
    }

    // Resolves exactly once: the pjax:render detail, or null when no request
    // went out (debounced, cancelled, handed to a full navigation, failed hook).
    run() {
      return new Promise((resolve) => {
        this.resolve = (detail) => {
          if (!this.settled) {
            this.settled = true;
            resolve(detail);
          }
        };
        try {
          if (!this.load()) {
            this.resolve(null);
          }
        } catch (err) {
          Pjax.error(`load failed: ${err?.message || err}`);
          this.resolve(null);
        }
      });
    }

    historyHref() {
      return this.fragment ? `${this.href}#${this.fragment}` : this.href;
    }

    redirect() {
      const href = this.historyHref() || location.href;
      if (href.slice(0, 4) === 'http' && !href.includes(location.host)) {
        window.open(href);
      } else {
        location.href = href;
      }
      return false;
    }

    // A same-origin redirect (e.g. lux `redirect_to`) comes back as a non-200
    // with a `Location` header. Re-run it through pjax so we swap in place
    // instead of forcing a full document load. External hosts fall back to a
    // real browser navigation.
    followRedirect(url) {
      let path;
      if (url[0] === '/' && url[1] !== '/') {
        // same-origin absolute path, the common `redirect_to '/foo'` case
        path = url;
      } else {
        const parsed = new URL(url, location.href);
        if (parsed.origin !== location.origin) {
          location.href = url; // external host -> real navigation
          return false;
        }
        path = parsed.pathname + parsed.search;
      }

      this.redirects = (this.redirects || 0) + 1;
      if (this.redirects > 5) {
        return this.redirect();
      }

      this.href = path;
      // don't trap the intermediate URL in history
      if (this.opts.history) {
        this.opts.history = 'replace';
      }
      Pjax.lastHref = this.href;
      if (!this.sendRequest()) {
        this.resolve(null);
      }
      return false;
    }

    swapMode() {
      if (this.target) {
        return 'target';
      }
      if (this.region) {
        return 'ajax';
      }
      return 'full';
    }

    emitDone(extra = {}) {
      const detail = Object.assign(
        {
          from: this.fromHref || Pjax.pastHref || null,
          to: this.href,
          status: null,
          error: null,
          duration: this.startedAt ? Date.now() - this.startedAt : 0,
          mode: this.swapMode(),
          opts: this.opts,
        },
        extra,
      );
      Pjax._dispatchRender(detail);
      this.resolve(detail);
    }

    // Returns true when a request went out.
    load() {
      // '/page#section' while already on /page: the browser would only scroll
      if (
        this.explicitHref &&
        this.fragment &&
        !this.fresh &&
        this.key === 'full' &&
        this.href === Pjax.path()
      ) {
        this.historyAddCurrent(this.historyHref());
        Pjax._anchor(this.fragment)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return false;
      }

      const now = Date.now();
      const last = Pjax._lastLoad;
      if (
        !this.fresh &&
        last &&
        last.key === this.key &&
        last.href === this.href &&
        now - last.time < 2000
      ) {
        return false;
      }
      Pjax._lastLoad = { key: this.key, href: this.href, time: now };

      this.fromHref = Pjax.path();

      // save scroll position of current page before navigating
      const currentEntry = Pjax.historyData[this.fromHref];
      if (currentEntry) {
        currentEntry.scrollY = window.scrollY;
      }

      Pjax.pastHref = Pjax.lastHref;
      Pjax.lastHref = this.href;

      if (Pjax.before(this.href, this.opts) === false) {
        return false;
      }

      if (/^http/.test(this.href)) {
        return this.redirect();
      }

      for (const el of Pjax.config.paths_to_skip) {
        switch (typeof el) {
          case 'object':
            if (el.test(this.href)) {
              return this.redirect();
            }
            break;
          case 'function':
            if (el(this.href)) {
              return this.redirect();
            }
            break;
          default:
            if (this.href.startsWith(el)) {
              return this.redirect();
            }
        }
      }

      return this.sendRequest();
    }

    // Starts the request and returns true, or false when a pjax:start listener
    // cancelled it.
    sendRequest() {
      this.startedAt = Date.now();

      const go = Pjax.emit('start', {
        from: this.fromHref || Pjax.pastHref || null,
        to: this.href,
        mode: this.swapMode(),
        opts: this.opts,
      });
      if (!go) {
        return false;
      }

      Pjax._abort(this.key);
      const controller = new AbortController();
      Pjax.requests.set(this.key, controller);
      this.request(controller);
      return true;
    }

    // Never throws: every outcome ends in emitDone, redirect or resolve(null).
    async request(controller) {
      const timer = setTimeout(() => controller.abort('timeout'), Pjax.config.timeout || 10000);
      const headers = { 'x-requested-with': 'XMLHttpRequest' };
      if (this.fresh) {
        headers['cache-control'] = 'no-cache';
      }

      let res;
      let html;
      try {
        res = await fetch(this.href, {
          method: this.method || 'GET',
          headers,
          body: this.body,
          signal: controller.signal,
        });
        html = await res.text();
      } catch (err) {
        if (Pjax.requests.get(this.key) === controller) {
          Pjax.requests.delete(this.key);
        }
        if (!controller.signal.aborted) {
          Pjax.error('Net error: Server response not received (Pjax)');
          console.error(err);
          this.emitDone({ status: 0, error: 'network' });
        } else if (controller.signal.reason === 'timeout') {
          Pjax.error(`Request timeout: ${this.href}`);
          this.emitDone({ status: 0, error: 'timeout' });
          this.redirect();
        } else {
          this.emitDone({ status: 0, error: 'abort' });
        }
        return;
      } finally {
        clearTimeout(timer);
      }

      // A late response from a superseded request must not swap anything.
      if (Pjax.requests.get(this.key) !== controller) {
        this.resolve(null);
        return;
      }
      Pjax.requests.delete(this.key);

      try {
        this.handleResponse(res, html);
      } catch (err) {
        Pjax.error(`Response failed: ${err?.message || err}`);
        console.error(err);
        this.resolve(null);
      }
    }

    handleResponse(res, html) {
      this.response = html;

      const note = this.opts.history === false ? ' (no history)' : '';
      Pjax.console(
        `Pjax.load ${this.href}${note} (app ${res.headers.get('x-lux-speed') || 'n/a'}, real ${Date.now() - this.startedAt}ms, status ${res.status})`,
      );

      if (res.status !== 200) {
        const redirectTo = res.headers.get('Location');
        if (redirectTo) {
          return this.followRedirect(redirectTo);
        }
        this.emitDone({ status: res.status, error: 'status' });
        return this.redirect();
      }

      if (res.url) {
        const url = new URL(res.url);
        this.href = url.pathname + url.search;
      }

      this.historyAddCurrent(this.historyHref());

      let applied;
      try {
        applied = this.applyLoadedData();
      } catch (err) {
        Pjax.error(`Apply failed: ${err?.message || err}`);
        console.error(err);
        applied = false;
      }

      if (!applied) {
        this.emitDone({ status: res.status, error: 'apply' });
        return this.redirect();
      }

      this.emitDone({ status: res.status });
      this.scrollAfterSwap();
    }

    scrollAfterSwap() {
      if (!this.opts.scroll || Pjax.shouldSkipScroll(this.target || this.opts.source)) {
        Pjax.scrollLock();
        return;
      }
      const anchor = Pjax._anchor(this.fragment);
      window.requestAnimationFrame(() => {
        if (anchor) {
          anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        }
      });
    }

    applyLoadedData() {
      const pjaxNode = Pjax.node();
      if (!pjaxNode) {
        return;
      }
      if (!pjaxNode.id) {
        return Pjax.error('No ID attribute on pjax node');
      }

      this.responseRoot = document.createElement('div');
      this.responseRoot.innerHTML = this.response;

      if (this.target && this.applyTarget()) {
        return true;
      }
      if (this.region) {
        return this.applyAjax();
      }
      return this.applyFullSwap();
    }

    applyTarget() {
      const source = Pjax.findById(this.responseRoot, this.target.id);
      if (!source) {
        return false;
      }

      Pjax.scrollLock();
      Pjax.morphInto(this.target, runScripts(source));
      return true;
    }

    applyAjax() {
      const region = this.region;
      region.setAttribute('data-path', this.href);
      region.removeAttribute('path');
      if (!region.id) {
        Pjax.error('Pjax .ajax node has no ID');
        return false;
      }
      // a response without the region's id is the region content itself
      const source = Pjax.findById(this.responseRoot, region.id) || this.responseRoot;
      Pjax.morphInto(region, runScripts(source));
      return true;
    }

    applyFullSwap() {
      Pjax._addHistoryEntry(this.href, this.response);
      return Pjax.setPageBody(this.responseRoot, this.href);
    }

    historyAddCurrent(href) {
      if (this.opts.history === false || this.historyAdded) {
        return;
      }
      this.historyAdded = true;

      // re-fetching the URL already in the address bar never stacks an entry
      const current = location.pathname + location.search + location.hash;
      if (this.opts.history === 'replace' || href === current) {
        Pjax.replace(href);
      } else {
        Pjax.push(href);
      }
    }
  }

  attachUrlState(Pjax);
  Pjax.PjaxOnClick = createOnClick(Pjax);

  return Pjax;
}
