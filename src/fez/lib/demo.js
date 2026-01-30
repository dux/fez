/**
 * Demo and Info content registry and accessor
 *
 * Stores demo/info HTML from component <demo> and <info> sections
 * and provides methods to retrieve them as DOM nodes.
 *
 * Usage:
 *   Fez.demo.get('ui-color')       // Get { info: DIVNode|null, demo: DIVNode|null }
 *   Fez.demo.apply('ui-color', el) // Render demo into element and execute scripts
 *   Fez.demo.all()                 // Get all as { name: { info, demo } }
 *   Fez.demo.list                  // Raw demo registry object
 *   Fez.demo.infoList              // Raw info registry object
 */

const demo = {
  /** Raw demo content registry by component name */
  list: {},

  /** Raw info content registry by component name */
  infoList: {},

  /** Raw source code registry by component name */
  sourceList: {},

  /**
   * Get demo and info content for a single component as DOM nodes
   * @param {string} name - Component name (e.g., 'ui-color')
   * @returns {{ info: HTMLDivElement|null, demo: HTMLDivElement|null }}
   */
  get(name) {
    const demoHtml = this.list[name];
    const infoHtml = this.infoList[name];

    let demoNode = null;
    if (demoHtml) {
      demoNode = document.createElement("div");
      demoNode.innerHTML = demoHtml;
    }

    let infoNode = null;
    if (infoHtml) {
      infoNode = document.createElement("div");
      infoNode.innerHTML = infoHtml;
    }

    return { info: infoNode, demo: demoNode };
  },

  /**
   * Render demo content into a DOM element and execute scripts
   * Scripts are executed first to define data/variables, then DOM is injected
   * @param {string} name - Component name (e.g., 'ui-color')
   * @param {HTMLElement} target - Target element to render into
   * @returns {boolean} - True if demo was found and applied
   */
  apply(name, target) {
    const demoHtml = this.list[name];
    if (!demoHtml || !target) return false;

    // Extract and execute top-level scripts first (before any DOM parsing that could trigger components)
    // This ensures window.* variables are defined before components evaluate :attr expressions
    // Skip scripts inside <xmp>, <template>, or other fez component definitions
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = demoHtml;

    // Only execute direct child scripts (not inside xmp/template which are component definitions)
    tempDiv.querySelectorAll(":scope > script").forEach((script) => {
      const scriptContent = script.textContent;
      if (scriptContent.trim()) {
        try {
          new Function(scriptContent)();
        } catch (e) {
          console.error(`Fez.demo.apply("${name}") script error:`, e.message);
        }
      }
      script.remove();
    });

    // Inject remaining content into target
    target.innerHTML = tempDiv.innerHTML;
    return true;
  },

  /**
   * Execute script tags within a node (scripts in innerHTML don't auto-execute)
   * @param {HTMLElement} node
   */
  _executeScripts(node) {
    const scripts = node.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");
      // Copy attributes
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      // Copy content
      newScript.textContent = oldScript.textContent;
      // Replace old with new (this executes it)
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  },

  /**
   * Get all demos and infos as object
   * @returns {Object} Object with component names as keys and { info, demo } as values
   */
  all() {
    // Get all unique component names from both lists
    const names = new Set([
      ...Object.keys(this.list),
      ...Object.keys(this.infoList),
    ]);

    const result = {};
    for (const name of names) {
      result[name] = this.get(name);
    }
    return result;
  },
};

export default demo;
