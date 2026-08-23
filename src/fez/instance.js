/**
 * FezBase - Base class for all Fez components
 *
 * Provides lifecycle hooks, reactive state, DOM utilities, and template rendering
 */

import parseNode from "./lib/n.js";
import createTemplate from "./lib/template.js";
import RenderSlots from "./lib/render-slots.js";
import { componentSubscribe, componentPublish } from "./lib/pubsub.js";
import {
  parseTransition,
  runTransition,
  measureFlip,
  playFlip,
  animateSize,
} from "./lib/transitions.js";

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
   * Handles :attr syntax for evaluated expressions and data-props JSON.
   * Every path runs through castProps() so PROPS schema coercion and defaults
   * apply on connect, keyed refresh and <fez-component> passthrough alike.
   */
  static getProps(node, newNode) {
    const tagName = node.tagName?.toLowerCase();

    // Direct props attachment
    if (node.props) {
      return this.castProps(node.props, tagName);
    }

    let attrs = {};

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
            `<${tagName}> Error evaluating ${key}="${val}": ${e.message}`,
          );
        }
      }
    }

    // Handle data-props JSON
    if (attrs["data-props"]) {
      let data = attrs["data-props"];
      if (typeof data == "object") {
        attrs = data;
      } else {
        if (data[0] != "{") {
          data = decodeURIComponent(data);
        }
        try {
          attrs = JSON.parse(data);
        } catch (e) {
          Fez.onError(
            "props",
            `<${tagName}> Invalid JSON in data-props: ${e.message}`,
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
            `<${tagName}> Invalid JSON in template: ${e.message}`,
          );
        }
      }
    }

    return this.castProps(attrs, tagName);
  }

  /**
   * Normalized PROPS schema for this class: shorthand `name: String` becomes
   * `{ type: String }`. Memoized per class (own property, so subclasses with
   * their own PROPS do not inherit a parent's cache).
   */
  static propsSchema() {
    if (Object.prototype.hasOwnProperty.call(this, "_propsSchema")) {
      return this._propsSchema;
    }
    const raw = this.PROPS;
    let schema = null;
    if (raw && typeof raw === "object") {
      schema = {};
      for (const [name, spec] of Object.entries(raw)) {
        schema[name] =
          spec && typeof spec === "object" && !Array.isArray(spec)
            ? spec
            : { type: spec };
      }
    }
    Object.defineProperty(this, "_propsSchema", {
      value: schema,
      writable: true,
      configurable: true,
    });
    return schema;
  }

  /**
   * True when a value already is what the PROPS entry declares, so coercion
   * (and the transform in castProp) has nothing left to do.
   */
  static matchesType(value, type) {
    if (value === null || value === undefined) return false;
    if (type === Array) return Array.isArray(value);
    if (type === Object) return typeof value === "object" && !Array.isArray(value);
    if (type === Number) return typeof value === "number";
    if (type === Boolean) return typeof value === "boolean";
    if (type === String) return typeof value === "string";
    if (type === Date) return value instanceof Date;
    if (type === Function) return typeof value === "function";
    return false;
  }

  /**
   * Cast a single prop through its PROPS entry. Unknown keys pass through
   * untouched. Errors are reported via Fez.onError("props", ...) and never
   * thrown - a bad attribute must not kill the page.
   */
  static castProp(name, value, tagName) {
    const spec = this.propsSchema()?.[name];
    if (!spec) return value;

    const fail = (msg) => {
      Fez.onError("props", `<${tagName || "fez"}> prop "${name}": ${msg}`);
      return undefined;
    };
    const show = (v) => (typeof v === "string" ? JSON.stringify(v) : String(v));

    let v = value;
    const type = spec.type;

    // A `default` function that declares a parameter doubles as a transform:
    // it gets the raw attribute value (undefined when the attribute is
    // missing) and its result is what gets type checked. Zero-arg functions
    // stay lazy defaults, applied at the end only when nothing came in.
    const transform =
      typeof spec.default === "function" &&
      type !== Function &&
      spec.default.length > 0
        ? spec.default
        : null;

    // A transform parses raw attribute text. A value that already arrived as
    // the declared type - `:tags="someArray"`, data-props JSON, a parent
    // passing a real object - is handed through untouched, so a string parser
    // never sees an Array. Strings still go through it (String transforms are
    // the point of `{ type: String, default: raw => raw.trim() }`).
    if (transform && !(typeof v !== "string" && FezBase.matchesType(v, type))) {
      try {
        v = transform(v === null ? undefined : v, name);
      } catch (e) {
        v = fail(`default(${show(value)}) failed: ${e.message}`);
      }
    }

    if (v === null || v === undefined) {
      v = undefined;
    } else if (type === String) {
      v = String(v);
    } else if (type === Number) {
      const n = typeof v === "number" ? v : Number(String(v).trim());
      v = Number.isNaN(n) || String(v).trim() === "" ? fail(`expected Number, got ${show(v)}`) : n;
    } else if (type === Boolean) {
      v = FezBase.toBoolean(v, name);
    } else if (type === Array || type === Object) {
      if (typeof v === "string") {
        const str = v.trim();
        try {
          v = str === "" ? undefined : JSON.parse(str);
        } catch (e) {
          v = fail(`invalid JSON ${show(v)}: ${e.message}`);
        }
      }
      if (v !== undefined) {
        const ok =
          type === Array
            ? Array.isArray(v)
            : typeof v === "object" && !Array.isArray(v);
        if (!ok) v = fail(`expected ${type.name}, got ${show(value)}`);
      }
    } else if (type === Function) {
      if (typeof v !== "function") {
        v = fail(`expected Function (pass it with :${name}="..."), got ${show(v)}`);
      }
    } else if (type === Date) {
      if (!(v instanceof Date)) {
        const str = String(v).trim();
        const d = new Date(/^-?\d+(\.\d+)?$/.test(str) ? Number(str) : str);
        v = Number.isNaN(d.getTime()) ? fail(`expected Date, got ${show(v)}`) : d;
      } else if (Number.isNaN(v.getTime())) {
        v = fail(`expected Date, got Invalid Date`);
      }
    } else if (typeof type === "function") {
      // custom caster
      try {
        v = type(v, name);
      } catch (e) {
        v = fail(e.message);
      }
    }

    if (v === undefined && spec.required) {
      fail(`is required`);
    }

    if (v !== undefined && Array.isArray(spec.enum) && !spec.enum.includes(v)) {
      v = fail(`expected one of ${spec.enum.map(show).join(", ")}, got ${show(v)}`);
    }

    // transform already had its say - calling it again would just repeat it
    if (v === undefined && spec.default !== undefined && !transform) {
      v = typeof spec.default === "function" && type !== Function
        ? spec.default()
        : spec.default;
    }

    // declared Boolean with no attribute and no default reads as false
    if (v === undefined && type === Boolean) {
      v = false;
    }

    return v;
  }

  /**
   * Cast a props object through the PROPS schema. Schema keys are walked
   * first so defaults and Boolean=false land even for absent attributes;
   * everything else is copied through as is. Returns a new object.
   */
  static castProps(props, tagName) {
    const schema = this.propsSchema();
    if (!schema) return props;

    const out = {};
    for (const name of Object.keys(schema)) {
      const v = this.castProp(name, props?.[name], tagName);
      if (v !== undefined) out[name] = v;
    }
    for (const [name, value] of Object.entries(props || {})) {
      if (!(name in schema)) out[name] = value;
    }
    return out;
  }

  /**
   * HTML-ish boolean parsing for attribute values. Presence ("") and the
   * attribute's own name (`disabled="disabled"`) are true; the usual
   * negative words are false; anything else falls back to Fez.isTrue.
   */
  static toBoolean(value, name) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const s = String(value).trim().toLowerCase();
    if (s === "" || s === name) return true;
    if (["false", "0", "off", "no", "null", "undefined"].includes(s)) return false;
    return Fez.isTrue ? Fez.isTrue(s) : ["1", "true", "on"].includes(s);
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

  /**
   * Props are reactive: writing this.props.x schedules a render, exactly like
   * this.state.x. A component that owns a list can render props.items straight
   * from the template instead of copying it into state first.
   *
   * Assigning the whole object (connect, parent re-render) re-wraps it. The raw
   * object stays on _propsRaw - the proxy hands out a fresh wrapper on every
   * object read, so proxied values never compare equal by identity and prop
   * change detection has to run against the raw object.
   */
  get props() {
    return this._props;
  }

  set props(value) {
    this._propsRaw = value || {};
    // shallow - nested values come back raw, so props keep the plain object
    // identity they had before they became reactive (including across
    // component boundaries). Writing a nested field does not re-render,
    // assign the container instead: this.props.user = { ...this.props.user }
    this._props = this.fezReactiveStore(this._propsRaw, (_t, _k, next, prev) => {
      if (next === prev) return;
      if (this._isRendering || this._isInitializing) return;
      // <slot unwrap /> dissolves the slot wrapper on first render and the
      // children can never be re-inserted, so those components render once -
      // the same reason this.state is disabled for them. The write lands,
      // it just does not schedule a render.
      if (this._fezStateDisabled) return;
      this.fezNextTick(this.fezRender, "fezRender");
    }, { shallow: true });
  }

  // Slots for passing live values (:attr props, loop handlers) through
  // rendered HTML, see lib/render-slots.js
  fezGlobals = new RenderSlots();

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

    // Drop parked :attr values and loop handlers
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

        // Hash-skip: identical template output means nothing to morph, unless
        // a :attr slot now holds a different object - the HTML only carries
        // the slot key, so children need the morph to receive new props.
        const newHash = Fez.fnv1(parsedHtml);
        if (newHash === this._fezHash && !this.fezGlobals.valuesChanged) {
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

    // fez-animate: where were the kept nodes before the morph moved them
    const flip = measureFlip(this._fezFlipNodes);

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
    playFlip(flip);
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

    // fez-animate="height|width|size" -> animate the box when content changes
    // fez-animate="flip, duration=300" -> FLIP when the differ moves the node
    // (list reorder); "flip, height" does both. Flip nodes are rebuilt every
    // render - the attribute is re-synced from the template - so removed items
    // drop out of the list on their own.
    this._fezFlipNodes = [];
    fetchAttr("fez-animate", (value, n) => {
      const spec = parseTransition(value);
      if (animateSize(n, spec)) return;
      for (const axis of ["height", "width", "size"]) {
        if (spec.params[axis] === true) {
          animateSize(n, { name: axis, params: spec.params });
        }
      }
      n._fezAnimate = spec;
      this._fezFlipNodes.push(n);
    });

    // fez-transition="fade" -> shorthand for fez-in + fez-out with the same
    // spec. Runs before the explicit handlers so their attributes are still on
    // the node: an explicit fez-in / fez-out wins for its direction.
    fetchAttr("fez-transition", (value, n) => {
      const spec = parseTransition(value);
      if (!n.hasAttribute("fez-out")) n._fezOut = spec;
      if (n.hasAttribute("fez-in") || n._fezIn) return;
      n._fezIn = true;
      runTransition(n, spec, "in");
    });

    // fez-in="fade, duration=200" -> intro once, when the node first appears.
    // The morph re-syncs the attribute from the template on every render, so
    // a kept node sees it again - the flag stops a second intro.
    fetchAttr("fez-in", (value, n) => {
      if (n._fezIn) return;
      n._fezIn = true;
      runTransition(n, parseTransition(value), "in");
    });

    // fez-out="fade" -> remembered on the node; the morph's removeNode hook
    // plays it before detaching (see lib/fez-morph.js)
    fetchAttr("fez-out", (value, n) => {
      n._fezOut = parseTransition(value);
    });

    // fez-bind="state.inputNode" -> two-way binding
    fetchAttr("fez-bind", (text, n) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes(n.nodeName)) {
        const value = new Function(`return this.${text}`).bind(this)();
        const isCb = n.type.toLowerCase() == "checkbox";
        // "input" covers typing, paste, autofill and slider drags alike;
        // select and checkbox have no meaningful intermediate state
        const eventName =
          ["SELECT"].includes(n.nodeName) || isCb ? "onchange" : "oninput";
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
      Fez.globalCss(this.css, { name: this.fezName, wrap: true });
    }

    if (this.class.css) {
      Fez.globalCss(this.class.css, { name: this.fezName });
    }

    if (this.class.cssGlobal) {
      Fez.globalCss(this.class.cssGlobal);
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
    } else if (!this.state) {
      // _stateRaw is the object behind the store - writes that must not fire
      // onStateChange or schedule a render (prop seeding) go straight to it
      this._stateRaw = {};
      this.state = this.fezReactiveStore(this._stateRaw);
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
   * Seed this.state from PROPS entries flagged with `state`.
   * `state: true` uses the prop name, `state: 'other_key'` renames it.
   * Runs once before init(), so a component that owns a list can declare it
   * as a prop and mutate this.state from there - no copy line in init().
   */
  fezSeedStateProps() {
    const schema = this.class?.propsSchema?.();
    if (!schema) return;
    // <slot unwrap /> components have no usable state
    if (this._fezStateDisabled) return;

    for (const [name, spec] of Object.entries(schema)) {
      if (!spec.state) continue;
      // _propsRaw, not this.props - a value read through the props proxy
      // would land in state still wrapped in the props store
      let value = this._propsRaw?.[name];
      if (value === undefined) continue;
      // Seed with a copy: state owns the value from here, and an in place
      // this.state.list.push() must not write through to props (or to the
      // object the parent passed in with :prop="...").
      if (Array.isArray(value)) {
        value = [...value];
      } else if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
        value = { ...value };
      }
      // straight into the raw object: seeding happens before init(), so
      // onStateChange must not fire on setup the component has not done yet
      const target = this._stateRaw || this.state;
      target[typeof spec.state === "string" ? spec.state : name] = value;
    }
  }

  /**
   * Create a reactive store that triggers re-renders on changes
   */
  fezReactiveStore(obj, handler, options = {}) {
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

    // Only plain objects and arrays are wrapped. Everything with internal
    // slots (Date, Map, Set, RegExp, Promise, class instances, DOM nodes)
    // breaks when its methods run with a Proxy as `this` - a Date prop would
    // throw on .getFullYear() the moment it was read through the store.
    function shouldProxy(obj) {
      if (typeof obj !== "object" || obj === null) return false;
      if (obj.nodeType) return false;
      if (Array.isArray(obj)) return true;
      const proto = Object.getPrototypeOf(obj);
      return proto === Object.prototype || proto === null;
    }

    // `shallow` wraps only the object itself and hands nested values back raw
    // (this.props). Deep wrapping (this.state) makes nested writes reactive,
    // at the price of identity: a fresh wrapper per read is what lets
    // fezRender spot an in place mutation behind an unchanged render hash
    // (fezGlobals.valuesChanged, see lib/render-slots.js), but it also means
    // no value read out of the store ever compares equal to anything.
    // Props are values the parent owns and hands over whole, and they cross
    // component boundaries, so they keep plain identity instead.
    function createReactive(obj, handler) {
      if (!shouldProxy(obj)) {
        return obj;
      }

      return new Proxy(obj, {
        set(target, property, value, receiver) {
          const currentValue = Reflect.get(target, property, receiver);

          if (currentValue !== value) {
            const result = Reflect.set(target, property, value, receiver);
            handler(target, property, value, currentValue);
            return result;
          }

          return true;
        },
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (!options.shallow && shouldProxy(value)) {
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
    // root is cleared on destroy; a late timer/await calling find() gets null, not a TypeError
    return typeof selector == "string"
      ? (this.root ? this.root.querySelector(selector) : null)
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
