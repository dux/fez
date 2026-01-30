/**
 * Demo and Info content registry and accessor
 *
 * Stores demo/info HTML from component <demo> and <info> sections
 * and provides methods to retrieve them as DOM nodes.
 *
 * Usage:
 *   Fez.demo.get('ui-color')  // Get { info: DIVNode|null, demo: DIVNode|null }
 *   Fez.demo.all()            // Get all as { name: { info: DIVNode|null, demo: DIVNode|null } }
 *   Fez.demo.list             // Raw demo registry object
 *   Fez.demo.infoList         // Raw info registry object
 */

const demo = {
  /** Raw demo content registry by component name */
  list: {},

  /** Raw info content registry by component name */
  infoList: {},

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
