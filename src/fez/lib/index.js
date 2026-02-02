/**
 * Unified Component Index
 *
 * Single source of truth for all component data:
 *   Fez.index['ui-btn'].class   - Component class
 *   Fez.index['ui-btn'].meta    - Metadata from META = {...}
 *   Fez.index['ui-btn'].demo    - Demo HTML string
 *   Fez.index['ui-btn'].info    - Info HTML string
 *   Fez.index['ui-btn'].source  - Raw .fez source
 *
 * Helper methods:
 *   Fez.index.get('ui-btn')     - Get entry with DOM nodes for demo/info
 *   Fez.index.apply('ui-btn', el) - Render demo into element
 *   Fez.index.names()           - Get all registered component names
 *   Fez.index.withDemo()        - Get names of components with demos
 *   Fez.index.all()             - Get all components as object
 */

function createDomNode(html) {
  const node = document.createElement("div");
  node.innerHTML = html;
  return node;
}

const index = {
  // Component entries stored directly: index['ui-btn'] = { class, meta, ... }

  /**
   * Get or create entry for component
   * @param {string} name - Component name
   * @returns {{ class: Function|null, meta: Object|null, demo: string|null, info: string|null, source: string|null }}
   */
  ensure(name) {
    if (
      !this[name] ||
      typeof this[name] !== "object" ||
      !("class" in this[name])
    ) {
      this[name] = {
        class: null,
        meta: null,
        demo: null,
        info: null,
        source: null,
      };
    }
    return this[name];
  },

  /**
   * Get component data with DOM nodes for demo/info
   * @param {string} name - Component name
   * @returns {{ class: Function|null, meta: Object|null, demo: HTMLDivElement|null, info: HTMLDivElement|null, source: string|null }}
   */
  get(name) {
    const entry = this[name];
    if (!entry || typeof entry !== "object" || !("class" in entry)) {
      return { class: null, meta: null, demo: null, info: null, source: null };
    }

    return {
      class: entry.class,
      meta: entry.meta,
      source: entry.source,
      demo: entry.demo ? createDomNode(entry.demo) : null,
      info: entry.info ? createDomNode(entry.info) : null,
    };
  },

  /**
   * Apply demo to element and execute scripts
   * Scripts are executed first to define data/variables, then DOM is injected
   * @param {string} name - Component name
   * @param {HTMLElement} target - Target element to render into
   * @returns {boolean} - True if demo was found and applied
   */
  apply(name, target) {
    const entry = this[name];
    if (!entry?.demo || !target) return false;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = entry.demo;

    // Execute top-level scripts first (before DOM parsing triggers components)
    tempDiv.querySelectorAll(":scope > script").forEach((script) => {
      const content = script.textContent;
      if (content.trim()) {
        try {
          new Function(content)();
        } catch (e) {
          console.error(`Fez.index.apply("${name}") script error:`, e.message);
        }
      }
      script.remove();
    });

    target.innerHTML = tempDiv.innerHTML;
    return true;
  },

  /**
   * Get all registered component names
   * @returns {string[]}
   */
  names() {
    return Object.keys(this).filter(
      (k) =>
        typeof this[k] === "object" && this[k] !== null && "class" in this[k],
    );
  },

  /**
   * Get names of components that have demos
   * @returns {string[]}
   */
  withDemo() {
    return this.names().filter((name) => this[name].demo);
  },

  /**
   * Get all components as object with DOM nodes
   * @returns {Object} Object with component names as keys
   */
  all() {
    const result = {};
    for (const name of this.names()) {
      result[name] = this.get(name);
    }
    return result;
  },

  /**
   * Print registered components to console
   */
  info() {
    console.log("Fez components:", this.names());
  },
};

export default index;
