// Per-instance slots for passing live values through rendered HTML.
//
// A rendered template is a string, so a parent can't hand an object or a
// closure to a child directly. The value is parked here during render and the
// HTML carries only a small key; the other side resolves it through
// Fez(UID).fezGlobals. Keys are positional per render (reset in beginRender),
// so a template that renders the same text yields byte-identical HTML and the
// render hash-skip in fezRender keeps working.
//
// Two slot kinds:
//
// * values   - `:attr="expr"` props. Written by the parent during render, read
//              by the child in getProps() while the morph runs. Kept until the
//              parent's next render: children deferred to rAF during page load
//              (connect.js) may read them after the render has committed.
//              `valuesChanged` tells fezRender whether any slot holds a
//              different object than the previous render did - identical HTML
//              with changed props must still morph so children get
//              onPropsChange.
// * handlers - arrow handlers in loops that close over loop items. The DOM
//              calls them later, so a slot survives as long as the next render
//              claims the same key; stale keys are dropped in commitRender.

export default class RenderSlots {
  constructor() {
    this.values = new Map();
    this.handlers = new Map();
    this.renderValues = [];
    this.prevValues = [];
    this.handlerCount = 0;
    this.liveHandlers = null;
  }

  beginRender() {
    this.prevValues = this.renderValues;
    this.renderValues = [];
    this.values.clear();
    this.handlerCount = 0;
    this.liveHandlers = new Set();
  }

  commitRender() {
    if (!this.liveHandlers) return;
    for (const key of this.handlers.keys()) {
      if (!this.liveHandlers.has(key)) this.handlers.delete(key);
    }
    this.liveHandlers = null;
  }

  // True when any value slot holds a different reference than it did in the
  // previous render (or the count changed).
  get valuesChanged() {
    const prev = this.prevValues;
    const next = this.renderValues;
    if (prev.length !== next.length) return true;
    for (let i = 0; i < next.length; i++) {
      if (prev[i] !== next[i]) return true;
    }
    return false;
  }

  // --- values ---------------------------------------------------------------

  set(value) {
    const key = this.renderValues.length;
    this.renderValues.push(value);
    this.values.set(key, value);
    return key;
  }

  value(key) {
    return this.values.get(key);
  }

  // --- handlers -------------------------------------------------------------

  setHandler(fn) {
    const key = this.handlerCount++;
    this.handlers.set(key, fn);
    this.liveHandlers?.add(key);
    return key;
  }

  handler(key) {
    return this.handlers.get(key);
  }

  // --- lifecycle ------------------------------------------------------------

  clear() {
    this.values.clear();
    this.handlers.clear();
    this.renderValues = [];
    this.prevValues = [];
    this.liveHandlers = null;
  }
}
