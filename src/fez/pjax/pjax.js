// Pjax - PushState + AJAX page navigation, ported from dux-pjax.
//
// Renders a server HTML response into the current page's pjax container
// (`<pjax>` tag or `.pjax` class, with an id) instead of a hard navigation.
// Swaps go through Fez.nodeMorph, so fez components inside the container are
// preserved and refreshed instead of destroyed.
//
// The class is created per call so tests get fresh static state. The browser
// singleton is created by boot.js and exposed as window.Pjax.

import Fez from '../root.js';
import createOnClick from './onclick.js';

export default function createPjax() {
  class Pjax {
    static config = {
      is_silent:
        typeof location === 'undefined'
          ? true
          : !location.port || parseInt(location.port) < 1000,
      no_scroll_selector: ['.no-scroll'],
      paths_to_skip: [],
      no_pjax_class: ['no-pjax', 'direct'],
      no_ajax_class: ['ajax-skip', 'skip-ajax', 'no-ajax', 'top'],
      ajax_selector: '.ajax',
      timeout: 10000,
      history_max: 20,
    };

    static historyData = {};

    // --- public class methods ---

    // Bind all document/window level handlers. Called by boot.js once the page
    // is known to have a pjax container; call it manually if the container is
    // injected after DOMContentLoaded.
    static start() {
      if (Pjax._booted) return;
      Pjax._booted = true;

      setTimeout(() => Pjax.sendGlobalEvent(), 0);

      Pjax.onDocumentClick();

      window.addEventListener('popstate', () => {
        window.requestAnimationFrame(() => {
          const path = Pjax.path();
          const entry = Pjax.historyData[path];
          if (entry) {
            Pjax.console(`from history: ${path}`);
            const rroot = document.createElement('div');
            rroot.innerHTML = entry.html;
            Pjax.setPageBody(rroot, path);
            if (entry.scrollY) window.scrollTo(0, entry.scrollY);
          } else {
            Pjax.load(path, { history: false });
          }
        });
      });

      document.body.addEventListener('submit', (e) => {
        const form = e.target;
        const is_pjax = form.getAttribute('data-pjax');
        if (is_pjax) {
          e.preventDefault();
          const pjax_target = is_pjax === 'true' ? null : is_pjax;
          Pjax.load(form.getAttribute('action'), { form, target: pjax_target });
        }
      });
    }

    static onDocumentClick() {
      if (!Pjax._clickBound) {
        Pjax._clickBound = true;
        window.addEventListener('click', Pjax.PjaxOnClick.main);
      }
    }

    static load(href, opts) {
      return Pjax.fetch(Pjax.getOpts(href, opts));
    }

    static refresh(func, opts) {
      if (typeof func === 'string' && func[0] === '#') {
        opts ||= {};
        opts.target = func;
        func = Pjax.path();
        opts.history = false;
      }

      opts = Pjax.getOpts(func, opts);
      opts.scroll ||= false;
      opts.force = true;
      return Pjax.fetch(opts);
    }

    static reload(opts) {
      opts = Pjax.getOpts(opts);
      opts.cache = false;
      opts.force = true;
      return Pjax.fetch(opts);
    }

    static refreshed() {
      if (!Pjax.pastHref) return false;
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
        document.getElementsByTagName('pjax')[0] ||
        document.getElementsByClassName('pjax')[0];
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
      if (Pjax.DEV || !Pjax.config.is_silent) console.log(msg);
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
    }

    static push(href) {
      return Pjax.pushState(href);
    }

    static replace(href) {
      window.history.replaceState({}, document.title, href);
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

    static getOpts(path, opts) {
      opts = Pjax._resolveArgs(path, opts);
      if (opts.ajax) Pjax._resolveAjax(opts);
      if (opts.target) Pjax._resolveTarget(opts);
      Pjax._resolvePath(opts);
      return opts;
    }

    static _resolveArgs(path, opts) {
      opts ||= {};
      if (typeof opts === 'string') opts = { target: opts };

      if (typeof path === 'object' && path !== null) {
        if (path.nodeName) opts.ajax = path;
        else opts = path;
      } else if (typeof path === 'function') {
        opts.done = path;
      } else {
        opts.path = path;
      }

      if (opts.href) {
        opts.path = opts.href;
        delete opts.href;
      }

      opts.path ||= Pjax.path();

      if (opts.form) {
        const params = new URLSearchParams(new FormData(opts.form)).toString();
        if (params) {
          opts.path += opts.path.includes('?') ? '&' : '?';
          opts.path += params;
        }
      }

      return opts;
    }

    static _resolveAjax(opts) {
      opts.node = opts.ajax;
      if (typeof opts.node === 'string') opts.node = document.querySelector(opts.node);

      if (!opts.node) {
        delete opts.ajax;
        return;
      }

      let skip = false;
      for (const el of Pjax.config.no_ajax_class) {
        if (opts.node.closest(`.${el}`)) skip = true;
      }

      if (!skip) {
        const ajax_node = opts.node.closest(Pjax.config.ajax_selector);
        if (ajax_node) {
          opts.ajax_node = ajax_node;
          opts.scroll ||= false;
        }
      }

      delete opts.ajax;
    }

    static _resolveTarget(opts) {
      if (typeof opts.target === 'string') opts.target = document.querySelector(opts.target);
      opts.node = opts.target;
      opts.scroll ||= false;
    }

    static _resolvePath(opts) {
      if (opts.path[0] === '?') {
        if (opts.ajax_node) {
          const ajax_path =
            opts.ajax_node.getAttribute('data-path') || opts.ajax_node.getAttribute('path');
          if (ajax_path) opts.path = ajax_path.split('?')[0] + opts.path;
        }

        if (opts.path[0] === '?') opts.path = location.pathname + opts.path;
      }

      if (opts.replacePath && opts.replacePath[0] === '?') {
        opts.replacePath = location.pathname + opts.replacePath;
      }
    }

    // --- scroll management ---

    static shouldSkipScroll(node) {
      if (!node || !node.closest) return;
      for (const el of Pjax.config.no_scroll_selector) {
        if (node.closest(el)) return true;
      }
      return false;
    }

    static scrollLock() {
      const now = Date.now();
      if (Pjax._scrollLockTime && now - Pjax._scrollLockTime < 1000) return;
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

    // --- page rendering ---

    static setPageBody(node, href) {
      const title = node.querySelector('title')?.innerHTML;
      document.title = title || 'no page title (pjax)';
      Pjax.scrollLock();
      const pjaxNode = Pjax.node();
      if (!pjaxNode) return false;
      const new_body = Pjax.findById(node, pjaxNode.id);
      if (new_body) {
        const finish = () => {
          Pjax.runHeadScripts(node, new_body);
          Pjax.morphInto(pjaxNode, Pjax.parseScripts(new_body));
          Pjax.after(href);
        };

        if (Pjax.useViewTransition && document.startViewTransition) {
          document.startViewTransition(finish);
        } else {
          finish();
        }
        return true;
      }
      return false;
    }

    static morphInto(target, html) {
      // Strings go through a DocumentFragment, never nodeMorph's string path:
      // its "single root with matching tag" unwrap would swallow a legitimate
      // single-root child (e.g. a lone <div class="flex"> wrapper inside a
      // <div class="pjax"> container) and flatten the layout.
      if (typeof html === 'string') {
        const range = document.createRange();
        range.selectNodeContents(target);
        Fez.nodeMorph(target, range.createContextualFragment(html));
      } else {
        Fez.nodeMorph(target, html);
      }
    }

    static parseScripts(node) {
      if (typeof node === 'string') {
        const div = document.createElement('div');
        div.innerHTML = node;
        node = div;
      }

      for (const script_tag of Array.from(node.getElementsByTagName('script'))) {
        if (!script_tag) continue;
        if (script_tag.getAttribute('src')) continue;
        const type = script_tag.getAttribute('type') || 'javascript';
        if (!type.includes('javascript')) continue;

        if (!script_tag.id) {
          Pjax.script_cnt ||= 0;
          script_tag.id = `app-sc-${++Pjax.script_cnt}`;
        }

        // Scripts run AFTER history has been committed, but BEFORE the new HTML
        // is morphed into the live document.
        // Rationale: inline scripts in a response typically set globals/state that
        // the rendered markup will then consume on `pjax:render`, and may need
        // the new `location.pathname + location.search`. Running them against a
        // still-detached DOM also avoids a flash where new nodes appear before
        // their setup ran.
        // Side effect: a script cannot `document.querySelector` siblings in the
        // same response (they aren't in `document` yet) - do per-DOM wiring in a
        // `pjax:render` listener, or tag the script `pjax-delay` to defer it to
        // the next animation frame (after the morph completes).
        const func = new Function(script_tag.textContent);
        script_tag.text = 1;
        if (script_tag.hasAttribute('pjax-delay')) requestAnimationFrame(func);
        else func();
      }

      return node.innerHTML;
    }

    // Inline <head> scripts of a full-page response are otherwise discarded on a
    // swap (innerHTML never runs them; only the pjax region is morphed in). Run
    // those outside the pjax region so head bootstrap - e.g. window.app data and
    // flash emitted by the server - refreshes on every navigation. src= bundles
    // and the pjax region's own scripts (handled by parseScripts) are skipped.
    static runHeadScripts(root, pjaxBody) {
      for (const script_tag of Array.from(root.getElementsByTagName('script'))) {
        if (pjaxBody && pjaxBody.contains(script_tag)) continue;
        if (script_tag.getAttribute('src')) continue;
        const type = script_tag.getAttribute('type') || 'javascript';
        if (!type.includes('javascript')) continue;
        const func = new Function(script_tag.textContent);
        if (script_tag.hasAttribute('pjax-delay')) requestAnimationFrame(func);
        else func();
      }
    }

    static findById(root, id) {
      if (!root || !id) return;
      if (root.getElementById) {
        return root.getElementById(id);
      }
      for (const node of root.querySelectorAll('[id]')) {
        if (node.id === id) return node;
      }
      return null;
    }

    // --- querystring helper ---

    static qs(key, value, opts = {}) {
      const parts = location.search
        .replace(/^\?/, '')
        .split('&')
        .map((el) => el.split('=', 2));

      if (typeof value === 'undefined') {
        parts.forEach((el) => {
          if (el[0] === key) value = decodeURIComponent(el[1]);
        });
        return value;
      }

      const qs = {};
      parts.forEach((el) => {
        if (el[0]) qs[el[0]] = el[1];
      });

      if (value === null || value === false) {
        delete qs[key];
      } else {
        qs[key] = encodeURIComponent(value);
      }

      const remaining = Object.keys(qs);
      let href;
      if (remaining.length) {
        const data = remaining.map((k) => `${k}=${qs[k]}`).join('&');
        href = location.pathname + '?' + data;
      } else {
        href = location.pathname;
      }

      if (opts.push) return Pjax.push(href);
      if (opts.href) return href;
      return Pjax.load(href);
    }

    // --- history management ---

    static _addHistoryEntry(href, html) {
      if (html == null) {
        html = href;
        href = Pjax.path();
      }
      const keys = Object.keys(Pjax.historyData);
      const max = Pjax.config.history_max || 20;
      if (keys.length >= max) delete Pjax.historyData[keys[0]];
      Pjax.historyData[href] = { html, scrollY: 0 };
    }

    // --- internal ---

    static fetch(opts) {
      const pjax = new Pjax(opts);
      return pjax.load();
    }

    // --- instance methods ---

    constructor(opts) {
      this.opts = opts;
      this.href = opts.href || opts.path;
    }

    redirect() {
      this.href ||= location.href;
      if (this.href.slice(0, 4) === 'http' && !this.href.includes(location.host)) {
        window.open(this.href);
      } else {
        location.href = this.href;
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

      this.opts.redirects = (this.opts.redirects || 0) + 1;
      if (this.opts.redirects > 5) return this.redirect();

      this.href = path;
      this.opts.replace = true; // don't trap the intermediate URL in history
      Pjax.lastHref = this.href;
      this.sendRequest();
      return false;
    }

    swapMode() {
      if (this.opts.target) return 'target';
      if (this.opts.ajax_node) return 'ajax';
      return 'full';
    }

    emitDone(extra = {}) {
      const duration = this.opts.req_start_time ? Date.now() - this.opts.req_start_time : 0;
      const detail = Object.assign(
        {
          from: this.fromHref || Pjax.pastHref || null,
          to: this.eventToHref(),
          status: null,
          error: null,
          duration,
          mode: this.swapMode(),
          opts: this.opts,
        },
        extra,
      );
      Pjax._dispatchRender(detail);
    }

    historyHref() {
      return this.opts.replacePath || this.href;
    }

    eventToHref() {
      if (this.opts.history === false || (this.opts.ajax_node && !this.opts.target)) {
        return this.href;
      }
      return this.historyHref();
    }

    load() {
      if (!this.href) return false;

      const now = Date.now();
      if (!this.opts.force) {
        if (Pjax.lastHref === this.href && now - (Pjax._lastLoadTime || 0) < 2000) return false;
      }
      Pjax._lastLoadTime = now;

      this.fromHref = Pjax.path();

      // save scroll position of current page before navigating
      const currentEntry = Pjax.historyData[this.fromHref];
      if (currentEntry) currentEntry.scrollY = window.scrollY;

      Pjax.pastHref = Pjax.lastHref;
      Pjax.lastHref = this.href;

      const e = window.event;
      if (e && !e.key && (e.which === 2 || e.metaKey)) {
        return window.open(this.href);
      }

      if (Pjax.before(this.href, this.opts) === false) return;
      if (location.hash && location.pathname === this.href) return;

      if (this.href.startsWith('#')) {
        if (this.href === '#') return;
        const node = document.querySelector(`a[name=${this.href.replace('#', '')}]`);
        if (node) {
          node.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return false;
        }
      }

      if (/^http/.test(this.href) || /#/.test(this.href)) return this.redirect();

      for (const el of Pjax.config.paths_to_skip) {
        switch (typeof el) {
          case 'object':
            if (el.test(this.href)) return this.redirect();
            break;
          case 'function':
            if (el(this.href)) return this.redirect();
            break;
          default:
            if (this.href.startsWith(el)) return this.redirect();
        }
      }

      if (Pjax.request) Pjax.request.abort();
      this.sendRequest();
      return false;
    }

    sendRequest() {
      this.opts.req_start_time = Date.now();
      this.opts.path = this.href;

      Pjax.emit('start', {
        from: this.fromHref || Pjax.pastHref || null,
        to: this.href,
        mode: this.swapMode(),
        opts: this.opts,
      });

      const headers = { 'x-requested-with': 'XMLHttpRequest' };
      if (this.opts.cache === false) headers['cache-control'] = 'no-cache';

      Pjax.request = this.req = new XMLHttpRequest();
      this.req.timeout = Pjax.config.timeout || 10000;

      this.req.onerror = (e) => {
        if (Pjax.request === this.req) Pjax.request = null;
        Pjax.error('Net error: Server response not received (Pjax)');
        console.error(e);
        this.emitDone({ status: 0, error: 'network' });
      };

      this.req.onabort = () => {
        if (Pjax.request === this.req) Pjax.request = null;
        this.emitDone({ status: 0, error: 'abort' });
      };

      this.req.ontimeout = () => {
        Pjax.request = null;
        Pjax.error(`Request timeout: ${this.href}`);
        this.emitDone({ status: 0, error: 'timeout' });
        this.redirect();
      };

      this.req.open('GET', this.href);
      for (const [k, v] of Object.entries(headers)) this.req.setRequestHeader(k, v);
      this.req.onload = () => this.handleResponse();
      this.req.send();
    }

    handleResponse() {
      Pjax.request = null;
      this.response = this.req.responseText;

      const time_diff = Date.now() - this.opts.req_start_time;
      let log_data = `Pjax.load ${this.href}`;
      if (this.opts.history === false) log_data += ' (back trigger)';
      Pjax.console(
        `${log_data} (app ${this.req.getResponseHeader('x-lux-speed') || 'n/a'}, real ${time_diff}ms, status ${this.req.status})`,
      );

      if (this.req.status !== 200) {
        const redirect_to = this.req.getResponseHeader('Location');
        if (redirect_to) return this.followRedirect(redirect_to);
        this.emitDone({ status: this.req.status, error: 'status' });
        return this.redirect();
      }

      const rul = this.req.responseURL;
      if (rul) {
        const parsed = new URL(rul);
        this.href = parsed.pathname + parsed.search;
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
        this.emitDone({ status: this.req.status, error: 'apply' });
        return this.redirect();
      }

      if (typeof this.opts.done === 'function') this.opts.done();
      this.emitDone({ status: this.req.status });

      if (!(this.opts.scroll === false || Pjax.shouldSkipScroll(this.opts.node))) {
        window.requestAnimationFrame(() => {
          window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        });
      } else {
        Pjax.scrollLock();
      }
    }

    applyLoadedData() {
      this.pjaxNode = Pjax.node();
      if (!this.pjaxNode) return;
      if (!this.pjaxNode.id) return Pjax.error('No ID attribute on pjax node');

      this.rroot = document.createElement('div');
      this.rroot.innerHTML = this.response;

      if (this.opts.target && this.applyTarget()) return true;
      if (this.opts.ajax_node) return this.applyAjax();
      return this.applyFullSwap();
    }

    applyTarget() {
      const id = this.opts.target.getAttribute('id');
      if (!id) {
        Pjax.error('ID attribute not found on Pjax target');
        return false;
      }

      const rtarget = Pjax.findById(this.rroot, id);
      if (!rtarget) return false;

      Pjax.scrollLock();
      Pjax.morphInto(this.opts.target, Pjax.parseScripts(rtarget.innerHTML));
      return true;
    }

    applyAjax() {
      const ajax_node = this.opts.ajax_node;
      ajax_node.setAttribute('data-path', this.href);
      ajax_node.removeAttribute('path');
      const ajax_id = ajax_node.getAttribute('id') || Pjax.error('Pjax .ajax node has no ID');
      const ajax_data = Pjax.findById(this.rroot, ajax_id)?.innerHTML || this.response;
      Pjax.morphInto(ajax_node, Pjax.parseScripts(ajax_data));
      return true;
    }

    applyFullSwap() {
      Pjax._addHistoryEntry(this.historyHref(), this.response);
      return Pjax.setPageBody(this.rroot, this.href);
    }

    historyAddCurrent(href) {
      if (this.opts.history === false || (this.opts.ajax_node && !this.opts.target)) return;
      if (this.history_added) return;
      this.history_added = true;

      if (this.opts.replace || Pjax._lastHrefCheck === href) {
        window.history.replaceState({}, document.title, href);
        Pjax._lastHrefCheck = href;
      } else {
        window.history.pushState({}, document.title, href);
        Pjax._lastHrefCheck = href;
      }
    }
  }

  Pjax.PjaxOnClick = createOnClick(Pjax);

  return Pjax;
}
