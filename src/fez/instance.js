/**
 * FezBase - Base class for all Fez components
 *
 * Provides lifecycle hooks, reactive state, DOM utilities, and template rendering
 */

import parseNode from "./lib/n.js";
import createTemplate from "./lib/template.js";
import { componentSubscribe, componentPublish } from "./lib/pubsub.js";

/**
 * Event names that default to `window` in `this.on('event', handler)`.
 * Anything not in this set defaults to `document`. Exposed as `Fez.WINDOW_EVENTS`
 * for userland customization.
 */
export const WINDOW_EVENTS = new Set([
  "resize", "scroll",
  "load", "beforeunload", "unload", "pagehide", "pageshow",
  "hashchange", "popstate",
  "online", "offline",
  "message", "storage",
  "orientationchange", "error",
]);

export default class FezBase {
  // ===========================================================================
  // STATIC METHODS
  // ===========================================================================

  static nodeName = "div";

  /**
   * Extract props from a DOM node's attributes
   * Handles :attr syntax for evaluated expressions and data-props JSON
   */
  static getProps(node, newNode) {
    let attrs = {};

    // Direct props attachment
    if (node.props) {
      return node.props;
    }

    // Collect attributes
    for (const attr of node.attributes) {
      attrs[attr.name] = attr.value;
    }

    // Evaluate :attr expressions
    for (const [key, val] of Object.entries(attrs)) {
      if ([":"].includes(key[0])) {
        delete attrs[key];
        try {
          const newVal = new Function(`return (${val})`).bind(newNode)();
          attrs[key.replace(/^:/, "")] = newVal;
        } catch (e) {
          Fez.onError(
            "attr",
            `<${node.tagName.toLowerCase()}> Error evaluating ${key}="${val}": ${e.message}`,
          );
        }
      }
    }

    // Handle data-props JSON
    if (attrs["data-props"]) {
      let data = attrs["data-props"];
      if (typeof data == "object") {
        return data;
      } else {
        if (data[0] != "{") {
          data = decodeURIComponent(data);
        }
        try {
          attrs = JSON.parse(data);
        } catch (e) {
          Fez.onError(
            "props",
            `<${node.tagName.toLowerCase()}> Invalid JSON in data-props: ${e.message}`,
          );
        }
      }
    }
    // Handle JSON template
    else if (attrs["data-json-template"]) {
      const data = newNode.previousSibling?.textContent;
      if (data) {
        try {
          attrs = JSON.parse(data);
          newNode.previousSibling.remove();
        } catch (e) {
          Fez.onError(
            "props",
            `<${node.tagName.toLowerCase()}> Invalid JSON in template: ${e.message}`,
          );
        }
      }
    }

    return attrs;
  }

  /**
   * Get form data from closest/child form
   */
  static formData(node) {
    const formNode = node.closest("form") || node.querySelector("form");
    if (!formNode) {
      Fez.consoleLog("No form found for formData()");
      return {};
    }
    const formData = new FormData(formNode);
    const formObject = {};
    formData.forEach((value, key) => {
      formObject[key] = value;
    });
    return formObject;
  }

  // ===========================================================================
  // CONSTRUCTOR & CORE
  // ===========================================================================

  constructor() {}

  n = parseNode;
  fezBlocks = {};
  local = {};

  // Store for passing values to child components (e.g., loop vars)
  fezGlobals = {
    _data: new Map(),
    _counter: 0,
    _handlerCounter: 0,
    _handlerKeys: new Set(),
    _nextHandlerKeys: null,
    set(value) {
      const key = this._counter++;
      this._data.set(key, value);
      return key;
    },
    setHandler(value) {
      const key = `h${this._handlerCounter++}`;
      this._data.set(key, value);
      this._nextHandlerKeys?.add(key);
      return `'${key}'`;
    },
    get(key) {
      return this._data.get(key);
    },
    delete(key) {
      const value = this._data.get(key);
      this._data.delete(key);
      return value;
    },
    beginRender() {
      this._handlerCounter = 0;
      this._nextHandlerKeys = new Set();
    },
    commitRender() {
      if (!this._nextHandlerKeys) return;
      for (const key of this._handlerKeys) {
        if (!this._nextHandlerKeys.has(key)) this._data.delete(key);
      }
      this._handlerKeys = this._nextHandlerKeys;
      this._nextHandlerKeys = null;
    },
    clear() {
      this._data.clear();
      this._handlerKeys.clear();
      this._nextHandlerKeys = null;
    },
  };

  /**
   * Report error with component name always included
   * @param {string} kind - Error category
   * @param {string} message - Error message
   * @param {Object} [context] - Additional context
   * @returns {string} Formatted error message
   */
  fezError(kind, message, context) {
    const name = this.fezName || this.root?.tagName?.toLowerCase() || "unknown";
    const enhancedContext = context ? { ...context, componentName: name } : { componentName: name };
    return Fez.onError(kind, `<${name}> ${message}`, enhancedContext);
  }

  /**
   * String selector for use in HTML nodes
   */
  get fezHtmlRoot() {
    return `Fez(${this.UID}).`;
  }

  /**
   * Check if node is attached to DOM
   */
  get isConnected() {
    return !!this.root?.isConnected;
  }

  /**
   * Get single node property
   */
  prop(name) {
    let v = this.oldRoot[name] || this.props[name];
    if (typeof v == "function") {
      v = v.bind(this.root);
    }
    return v;
  }

  // ===========================================================================
  // LIFECYCLE HOOKS
  // ===========================================================================

  connect() {}
  onMount() {}
  beforeRender() {}
  afterRender() {}
  onDestroy() {}
  onStateChange() {}
  onGlobalStateChange() {}
  onPropsChange() {}
  onRefresh() {}

  /**
   * Centralized destroy logic - called by MutationObserver when element is removed
   */
  fezOnDestroy() {
    // Guard against double-cleanup
    if (this._destroyed) return;
    this._destroyed = true;

    // Execute cleanup callbacks (intervals, observers, event listeners)
    if (this._onDestroyCallbacks) {
      this._onDestroyCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (e) {
          this.fezError("destroy", "Error in cleanup callback", e);
        }
      });
      this._onDestroyCallbacks = [];
    }

    // Call user's onDestroy hook
    this.onDestroy();
    this.onDestroy = () => {};
    this.local = {};

    // Clean up fezGlobals (orphaned entries from conditional children that never mounted)
    this.fezGlobals.clear();

    // Clean up root references
    if (this.root) {
      this.root.fez = undefined;
    }
    this.root = undefined;
  }

  /**
   * Add a cleanup callback for destroy
   */
  addOnDestroy(callback) {
    this._onDestroyCallbacks = this._onDestroyCallbacks || [];
    this._onDestroyCallbacks.push(callback);
  }

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  /**
   * Parse HTML and replace fez. references
   */
  fezParseHtml(text) {
    const base = this.fezHtmlRoot.replaceAll('"', "&quot;");
    text = text
      .replace(/([!'"\s;(])fez\.(\w)/g, `$1${base}$2`)
      .replace(/>\s+</g, "><");
    return text.trim();
  }

  /**
   * Schedule work on next animation frame (debounced by name)
   */
  fezNextTick(func, name) {
    if (name) {
      this._nextTicks ||= {};
      this._nextTicks[name] ||= window.requestAnimationFrame(() => {
        func.bind(this)();
        this._nextTicks[name] = null;
      }, name);
    } else {
      window.requestAnimationFrame(func.bind(this));
    }
  }

  /**
   * Force a re-render on next frame
   */
  fezRefresh() {
    this.fezNextTick(() => this.fezRender(), "refresh");
  }

  /**
   * Alias for fezRefresh - can be overwritten
   */
  refresh() {
    this.fezRefresh();
  }

  /**
   * Render the component template to DOM
   * Uses component-aware DOM differ with hash-based skip
   */
  fezRender(template) {
    // Check instance-level template first, then class-level
    template ||= this.fezHtmlFunc || this?.class?.fezHtmlFunc;

    if (!template || !this.root) return;

    // Prevent re-render loops from state changes in beforeRender/afterRender
    this._isRendering = true;

    this.beforeRender();

    const nodeName =
      typeof this.class.nodeName == "function"
        ? this.class.nodeName(this.root)
        : this.class.nodeName;
    const newNode = document.createElement(nodeName || "div");

    this.fezGlobals.beginRender();

    let renderedTpl;
    if (Array.isArray(template)) {
      if (template[0] instanceof Node) {
        template.forEach((n) => newNode.appendChild(n));
      } else {
        renderedTpl = template.join("");
      }
    } else if (typeof template == "string") {
      const name = this.root?.tagName?.toLowerCase();
      renderedTpl = createTemplate(template, { name })(this);
    } else if (typeof template == "function") {
      renderedTpl = template(this);
    }

    if (renderedTpl) {
      if (
        renderedTpl instanceof DocumentFragment ||
        renderedTpl instanceof Node
      ) {
        newNode.appendChild(renderedTpl);
      } else {
        renderedTpl = renderedTpl.replace(/\s\w+="undefined"/g, "");
        const parsedHtml = this.fezParseHtml(renderedTpl);

        // Hash-skip: if template output is identical, skip the morph entirely
        const newHash = Fez.fnv1(parsedHtml);
        if (newHash === this._fezHash) {
          this.fezGlobals.commitRender();
          this._isRendering = false;
          return;
        }
        this._fezHash = newHash;

        newNode.innerHTML = parsedHtml;
        this.fezPromoteInternalKeys(newNode);
      }
    }

    this.fezKeepNode(newNode);

    // Save input values for fez-this/fez-bind bound elements before morph
    const savedInputValues = new Map();
    this.root.querySelectorAll("input, textarea, select").forEach((el) => {
      if (el._fezThisName) {
        savedInputValues.set(el._fezThisName, {
          value: el.value,
          checked: el.checked,
        });
      }
    });

    Fez.morphdom(this.root, newNode);

    // Restore input values after morph
    if (savedInputValues.size) {
      this.root.querySelectorAll("input, textarea, select").forEach((el) => {
        const saved = el._fezThisName && savedInputValues.get(el._fezThisName);
        if (saved) {
          el.value = saved.value;
          if (saved.checked !== undefined) el.checked = saved.checked;
        }
      });
    }

    this.fezRenderPostProcess();
    this.fezGlobals.commitRender();
    this.afterRender();

    this._isRendering = false;
  }

  /**
   * Post-render processing for fez-* attributes
   */
  fezRenderPostProcess() {
    const fetchAttr = (name, func) => {
      this.root.querySelectorAll(`*[${name}]`).forEach((n) => {
        let value = n.getAttribute(name);
        n.removeAttribute(name);
        if (value) {
          func.bind(this)(value, n);
        }
      });
    };

    // fez-this="button" -> this.button = node
    fetchAttr("fez-this", (value, n) => {
      new Function("n", `this.${value} = n`).bind(this)(n);
      // Mark element for value preservation on re-render
      n._fezThisName = value;
    });

    fetchAttr("fez-use", (value, n) => {
      if (value.includes("=>")) return Fez.getFunction(value)(n);
      if (value.includes(".")) return Fez.getFunction(value).bind(n)();
      const target = this[value];
      if (typeof target == "function") return target(n);
      this.fezError("fez-use", `"${value}" is not a function`);
    });

    // fez-class="dialog animate" -> add class after init for animation
    fetchAttr("fez-class", (value, n) => {
      let classes = value.split(/\s+/);
      let lastClass = classes.pop();
      classes.forEach((c) => n.classList.add(c));
      if (lastClass) {
        setTimeout(() => {
          n.classList.add(lastClass);
        }, 1);
      }
    });

    // fez-bind="state.inputNode" -> two-way binding
    fetchAttr("fez-bind", (text, n) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(n.nodeName)) {
        const value = new Function(`return this.${text}`).bind(this)();
        const isCb = n.type.toLowerCase() == "checkbox";
        const eventName =
          ["SELECT"].includes(n.nodeName) || isCb ? "onchange" : "onkeyup";
        n.setAttribute(
          eventName,
          `${this.fezHtmlRoot}${text} = this.${isCb ? "checked" : "value"}`,
        );
        this.val(n, value);
        // Mark element for value preservation on re-render
        n._fezThisName = text;
      } else {
        this.fezError(
          "fez-bind",
          `Can't bind "${text}" to ${n.nodeName} (needs INPUT, SELECT or TEXTAREA)`,
        );
      }
    });

    this.root.querySelectorAll("*[checked], *[disabled], *[selected]").forEach((n) => {
      for (const attr of ["checked", "disabled", "selected"]) {
        if (!n.hasAttribute(attr)) continue;
        let value = n.getAttribute(attr);
        if (["false", "null", "undefined"].includes(value)) {
          n.removeAttribute(attr);
          n[attr] = false;
        } else {
          n.setAttribute(attr, attr);
        }
      }
    });
  }

  /**
   * Move compiler-generated key markers off the DOM attribute surface.
   */
  fezPromoteInternalKeys(node) {
    node.querySelectorAll?.("[fez-key]").forEach((el) => {
      el._fezKey = el.getAttribute("fez-key");
      el.removeAttribute("fez-key");
    });
  }

  /**
   * Handle slot initialization on first render.
   * Moves captured children from _fezSlotNodes into the .fez-slot container.
   * fez-keep matching is handled natively by the differ (morph.js).
   */
  fezKeepNode(newNode) {
    if (this._fezSlotInitialized) return;
    if (!this._fezSlotNodes) return;

    const newSlot = newNode.querySelector(".fez-slot");
    if (newSlot) {
      this._fezSlotInitialized = true;
      this._fezSlotNodes.forEach((child) => {
        newSlot.appendChild(child);
      });

      if (newSlot.hasAttribute("unwrap")) {
        const parent = newSlot.parentNode;
        while (newSlot.firstChild) {
          parent.insertBefore(newSlot.firstChild, newSlot);
        }
        newSlot.remove();
      }
    }
  }

  // ===========================================================================
  // REACTIVE STATE
  // ===========================================================================

  /**
   * Register component: setup CSS, state, and bind methods
   */
  fezRegister() {
    if (this.css) {
      this.css = Fez.globalCss(this.css, { name: this.fezName, wrap: true });
    }

    if (this.class.css) {
      this.class.css = Fez.globalCss(this.class.css, { name: this.fezName });
    }

    if (this.class.fezSlotUnwrap) {
      this._fezStateDisabled = true;
      this.state = new Proxy({}, {
        set: (t, k, v) => {
          console.error(`Fez: <${this.fezName}> uses <slot unwrap />, this.state is disabled`);
          return true;
        },
        get: (t, k) => undefined,
      });
    } else {
      this.state ||= this.fezReactiveStore();
    }
    this.globalState = Fez.state.createProxy(this);
    this.fezRegisterBindMethods();
  }

  /**
   * Bind all instance methods to this, walking the prototype chain
   * so inherited FezBase methods (refresh, fezRefresh, ...) bind too
   */
  fezRegisterBindMethods() {
    const methods = new Set();
    let proto = Object.getPrototypeOf(this);
    while (proto && proto !== Object.prototype) {
      for (const name of Object.getOwnPropertyNames(proto)) {
        if (name === "constructor" || methods.has(name)) continue;
        if (typeof this[name] === "function") methods.add(name);
      }
      proto = Object.getPrototypeOf(proto);
    }
    methods.forEach((name) => (this[name] = this[name].bind(this)));
  }

  /**
   * Create a reactive store that triggers re-renders on changes
   */
  fezReactiveStore(obj, handler) {
    obj ||= {};

    handler ||= (o, k, v, oldValue) => {
      if (v != oldValue) {
        this.onStateChange(k, v, oldValue);
        // Don't schedule re-render during init/mount or if already rendering
        if (!this._isRendering && !this._isInitializing) {
          this.fezNextTick(this.fezRender, "fezRender");
        }
      }
    };

    handler.bind(this);

    function shouldProxy(obj) {
      return (
        typeof obj === "object" &&
        obj !== null &&
        !(obj instanceof Promise) &&
        !obj.nodeType
      );
    }

    function createReactive(obj, handler) {
      if (!shouldProxy(obj)) {
        return obj;
      }

      return new Proxy(obj, {
        set(target, property, value, receiver) {
          const currentValue = Reflect.get(target, property, receiver);

          if (currentValue !== value) {
            if (shouldProxy(value)) {
              value = createReactive(value, handler);
            }

            const result = Reflect.set(target, property, value, receiver);
            handler(target, property, value, currentValue);
            return result;
          }

          return true;
        },
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (shouldProxy(value)) {
            return createReactive(value, handler);
          }
          return value;
        },
      });
    }

    return createReactive(obj, handler);
  }

  // ===========================================================================
  // DOM HELPERS
  // ===========================================================================

  /**
   * Find element by selector
   */
  find(selector) {
    return typeof selector == "string"
      ? this.root.querySelector(selector)
      : selector;
  }

  /**
   * Add one or more classes (space-separated) to root or given node
   */
  addClass(names, node) {
    (node || this.root).classList.add(...names.split(/\s+/).filter(Boolean));
  }

  /**
   * Toggle a class on root or given node, with optional force boolean
   */
  toggleClass(name, force, node) {
    (node || this.root).classList.toggle(name, force);
  }

  /**
   * Get or set node value (input/textarea/select or innerHTML)
   */
  val(selector, data) {
    const node = this.find(selector);

    if (node) {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(node.nodeName)) {
        if (typeof data != "undefined") {
          if (node.type == "checkbox") {
            node.checked = !!data;
          } else {
            node.value = data;
          }
        } else {
          return node.value;
        }
      } else {
        if (typeof data != "undefined") {
          node.innerHTML = data;
        } else {
          return node.innerHTML;
        }
      }
    }
  }

  /**
   * Instance form data helper
   */
  formData(node) {
    return this.class.formData(node || this.root);
  }

  /**
   * Get or set root attribute
   */
  attr(name, value) {
    if (typeof value === "undefined") {
      return this.root.getAttribute(name);
    } else {
      this.root.setAttribute(name, value);
      return value;
    }
  }

  childNodes(func) {
    let children = this._fezChildNodes || Array.from(this.root.children);
    if (func) {
      children = children.map(func);
    }
    return children;
  }

  childObjects() {
    return this.childNodes().map((node) => {
      const obj = { html: node.innerHTML, ROOT: node, NODE_NAME: node.nodeName.toLowerCase() };
      for (const attr of node.attributes) {
        obj[attr.name] = attr.value;
      }
      return obj;
    });
  }

  /**
   * Set CSS properties on root
   */
  setStyle(key, value) {
    if (key && typeof key == "object") {
      Object.entries(key).forEach(([prop, val]) => {
        this.root.style.setProperty(prop, val);
      });
    } else {
      this.root.style.setProperty(key, value);
    }
  }

  /**
   * Copy props as attributes to root
   */
  copy() {
    for (const name of Array.from(arguments)) {
      let value = this.props[name];

      if (value !== undefined) {
        if (name == "class") {
          const klass = this.root.getAttribute(name, value);
          if (klass) {
            value = [klass, value].join(" ");
          }
        }

        if (typeof value == "string") {
          this.root.setAttribute(name, value);
        } else {
          this.root[name] = value;
        }
      }
    }
  }

  /**
   * Get or set root ID
   */
  rootId() {
    this.root.id ||= `fez_${this.UID}`;
    return this.root.id;
  }

  /**
   * Dissolve component into parent
   */
  dissolve(inNode) {
    if (inNode) {
      inNode.classList.add("fez");
      inNode.classList.add(`fez-${this.fezName}`);
      inNode.fez = this;
      if (this.attr("id")) inNode.setAttribute("id", this.attr("id"));

      this.root.innerHTML = "";
      this.root.appendChild(inNode);
    }

    const node = this.root;
    const nodes = this.childNodes();
    const parent = this.root.parentNode;

    nodes.reverse().forEach((el) => parent.insertBefore(el, node.nextSibling));

    this.root.remove();
    this.root = undefined;

    if (inNode) {
      this.root = inNode;
    }

    return nodes;
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  /**
   * Gate for the `on<event>!="..."` strict-handler sugar, which the template
   * compiler expands to `fez.fezBang(event) && (body)`. Runs the body only when
   * the element itself is the event target (no child captured the event) and
   * swallows it with stopPropagation + preventDefault.
   */
  fezBang(e) {
    if (e.target !== e.currentTarget) return false;
    e.stopPropagation();
    e.preventDefault();
    return true;
  }

  /**
   * Add an event listener on any EventTarget with auto-cleanup.
   * Handler is bound to the component and only fires while it is connected.
   *
   *   this.on('resize', () => this.recompute())                  // window (event in WINDOW_EVENTS)
   *   this.on('pjax:render', () => this.refresh())               // document (default for unknown events)
   *   this.on(window, 'keydown', e => ...)                       // explicit target
   *   this.on(this.find('.x'), 'click', e => ..., { throttle: 100 })
   *
   * Returns a disposer for early unregister.
   */
  on(target, eventName, handler, opts) {
    if (typeof target === "string") {
      [target, eventName, handler, opts] = [
        WINDOW_EVENTS.has(target) ? window : document,
        target,
        eventName,
        handler,
      ];
    }
    const call = handler.bind(this);
    const guarded = (e) => {
      if (this.isConnected) call(e);
    };
    const fn = opts?.throttle ? Fez.throttle(guarded, opts.throttle) : guarded;
    target.addEventListener(eventName, fn, opts);
    const dispose = () => target.removeEventListener(eventName, fn, opts);
    this.addOnDestroy(dispose);
    return dispose;
  }

  /**
   * Window resize handler — calls fn once immediately, then on throttled resize.
   */
  onWindowResize(func, throttle = 200) {
    this.on("resize", func, { throttle });
    func.call(this);
  }

  /**
   * Window scroll handler — calls fn once immediately, then on throttled scroll.
   */
  onWindowScroll(func, throttle = 200) {
    this.on("scroll", func, { throttle });
    func.call(this);
  }

  /**
   * Element resize handler using ResizeObserver
   */
  onElementResize(el, func, delay = 200) {
    const throttledFunc = Fez.throttle(() => {
      if (this.isConnected) func.call(this, el.getBoundingClientRect(), el);
    }, delay);

    const observer = new ResizeObserver(throttledFunc);
    observer.observe(el);

    func.call(this, el.getBoundingClientRect(), el);

    this.addOnDestroy(() => {
      observer.disconnect();
    });
  }

  /**
   * Timeout with auto-cleanup
   */
  setTimeout(func, delay) {
    const timeoutID = setTimeout(() => {
      if (this.isConnected) func();
    }, delay);

    this.addOnDestroy(() => clearTimeout(timeoutID));

    return timeoutID;
  }

  /**
   * Interval with auto-cleanup
   */
  setInterval(func, tick, name) {
    if (typeof func == "number") {
      [tick, func] = [func, tick];
    }

    name ||= Fez.fnv1(String(func));

    this._setIntervalCache ||= {};
    clearInterval(this._setIntervalCache[name]);

    const intervalID = setInterval(() => {
      if (this.isConnected) func();
    }, tick);

    this._setIntervalCache[name] = intervalID;

    this.addOnDestroy(() => {
      clearInterval(intervalID);
      delete this._setIntervalCache[name];
    });

    return intervalID;
  }

  // ===========================================================================
  // PUB/SUB
  // ===========================================================================

  /**
   * Publish to parent components (bubbles up through DOM)
   * @param {string} channel - Event name
   * @param {...any} args - Arguments to pass
   * @returns {boolean} True if a parent handled the event
   */
  publish(channel, ...args) {
    return componentPublish(this, channel, ...args);
  }

  /**
   * Subscribe to a channel (auto-cleanup on destroy)
   * @param {string} channel - Event name
   * @param {Function} func - Handler function
   * @returns {Function} Unsubscribe function
   */
  subscribe(channel, func) {
    const unsubscribe = componentSubscribe(this, channel, func);
    this.addOnDestroy(unsubscribe);
    return unsubscribe;
  }

  // ===========================================================================
  // SLOTS
  // ===========================================================================

  /**
   * Copy child nodes natively to preserve bound events
   */
  fezSlot(source, target) {
    target ||= document.createElement("template");
    const isSlot = target.nodeName == "SLOT";

    while (source.firstChild) {
      if (isSlot) {
        target.parentNode.insertBefore(source.lastChild, target.nextSibling);
      } else {
        target.appendChild(source.firstChild);
      }
    }

    if (isSlot) {
      target.parentNode.removeChild(target);
    } else {
      source.innerHTML = "";
    }

    return target;
  }
}
