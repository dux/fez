/**
 * Fez - Main Framework Object
 *
 * This file contains:
 * - Main Fez function (component registration and lookup)
 * - Component registry
 * - CSS utilities
 * - Pub/Sub system
 * - DOM morphing
 * - Error handling
 * - Temporary store
 *
 * For component instance methods, see instance.js
 */

// =============================================================================
// IMPORTS
// =============================================================================

import Gobber from "./vendor/gobber.js";
import { fezMorph } from "./morph.js";
import objectDump from "./utils/dump.js";
import highlightAll from "./utils/highlight_all.js";
import connect from "./connect.js";
import compile from "./compile.js";
import state from "./lib/global-state.js";
import createTemplate from "./lib/template.js";
import { subscribe, publish } from "./lib/pubsub.js";
import fezLocalStorage from "./lib/localstorage.js";
import fezAwait from "./lib/await-helper.js";
import index from "./lib/index.js";

// =============================================================================
// MAIN FEZ FUNCTION
// =============================================================================

/**
 * Main Fez function - register or find components
 *
 * @example
 * Fez('ui-foo', class { ... })  // Register component
 * Fez('ui-foo')                  // Find first instance
 * Fez(123)                       // Find by UID
 * Fez(domNode)                   // Find from DOM node
 * Fez('ui-foo', fn)              // Find all & execute callback
 *
 * @param {string|number|Node} name - Component name, UID, or DOM node
 * @param {Class|Function} [klass] - Component class or callback
 * @returns {FezBase|Array|void}
 */
const Fez = (name, klass) => {
  // Find by UID
  if (typeof name === "number") {
    const fez = Fez.instances.get(name);
    if (fez) return fez;
    Fez.onError("lookup", `Instance with UID "${name}" not found. Component may have been destroyed or never created.`, { uid: name });
    return;
  }

  if (!name) {
    Fez.onError("lookup", "Fez() called without arguments. Expected component name, UID, or DOM node.");
    return;
  }

  // With second argument
  if (klass) {
    const isPureFn =
      typeof klass === "function" &&
      !/^\s*class/.test(klass.toString()) &&
      !/\b(this|new)\b/.test(klass.toString());

    // Fez('name', callback) - find all & execute
    if (isPureFn) {
      const list = Array.from(
        document.querySelectorAll(`.fez.fez-${name}`),
      ).filter((n) => n.fez);
      list.forEach((el) => klass(el.fez));
      return list;
    }

    // Fez('name', selector) - find with context
    if (typeof klass !== "function") {
      return Fez.find(name, klass);
    }

    // Fez('name', class) - register component
    return connect(name, klass);
  }

  // Find instance by name or node
  const node = name.nodeName
    ? name.closest(".fez")
    : document.querySelector(name.includes("#") ? name : `.fez.fez-${name}`);

  if (!node) {
    Fez.onError("lookup", `Component "${name}" not found in DOM. Ensure the component is defined and rendered.`, { componentName: name });
    return;
  }

  if (!node.fez) {
    Fez.onError("lookup", `DOM node "${name}" exists but has no Fez instance attached. Component may not be initialized yet.`, { node, tagName: name });
    return;
  }

  return node.fez;
};

// =============================================================================
// COMPONENT REGISTRY
// =============================================================================

/** Unified component index - Fez.index['name'] = { class, meta, demo, info, source } */
Fez.index = index;

/** Counter for unique instance IDs */
Fez.instanceCount = 0;

/** Active component instances by UID */
Fez.instances = new Map();

/**
 * Find a component instance from a DOM node
 * @param {Node|string} onode - DOM node or selector
 * @param {string} [name] - Optional component name filter
 * @returns {FezBase|undefined}
 */
Fez.find = (onode, name) => {
  let node =
    typeof onode === "string" ? document.body.querySelector(onode) : onode;

  // jQuery compatibility
  if (typeof node.val === "function") node = node[0];

  const selector = name ? `.fez.fez-${name}` : ".fez";
  const closestNode = node.closest(selector);

  if (closestNode?.fez) return closestNode.fez;

  Fez.onError("find", `Node connector not found. Selector: "${selector}", node: ${onode}`, {
    original: onode,
    resolved: node,
    selector,
  });
};

// =============================================================================
// CSS UTILITIES
// =============================================================================

/**
 * Generate unique CSS class from CSS text (via Goober)
 * @param {string} text - CSS rules
 * @returns {string} Generated class name
 */
Fez.cssClass = (text) => {
  // In test environments without proper DOM, goober may fail
  // Return a placeholder class name based on hash
  try {
    return Gobber.css(text);
  } catch {
    // Fallback: generate simple hash-based class name
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    return "fez-" + Math.abs(hash).toString(36);
  }
};

/**
 * Register global CSS styles
 * @param {string|Function} cssClass - CSS text or function
 * @param {Object} opts - { name, wrap }
 * @returns {string} Generated class name
 */
Fez.globalCss = (cssClass, opts = {}) => {
  if (typeof cssClass === "function") cssClass = cssClass();

  if (cssClass.includes(":")) {
    let text = cssClass
      .split("\n")
      .filter((line) => !/^\s*\/\//.test(line))
      .join("\n");

    if (opts.wrap) text = `:fez { ${text} }`;
    text = text.replace(/\:fez|\:host/, `.fez.fez-${opts.name}`);
    cssClass = Fez.cssClass(text);
  }

  Fez.onReady(() => document.body.parentElement.classList.add(cssClass));
  return cssClass;
};

// =============================================================================
// DOM MORPHING
// =============================================================================

/**
 * Morph DOM node to new state (via fez-morph)
 * Child fez components are automatically preserved (skipped from morphing)
 * Use fez-keep attribute for explicit element preservation
 * @param {Element} target - Element to morph
 * @param {Element} newNode - New state
 */
Fez.morphdom = (target, newNode) => {
  fezMorph(target, newNode, {
    // Preserve child fez components - skip morphing them entirely
    skipNode: (oldNode) => {
      if (
        oldNode.classList?.contains("fez") &&
        oldNode.fez &&
        !oldNode.fez._destroyed
      ) {
        if (Fez.LOG) {
          console.log(
            `Fez: preserved child component ${oldNode.fez.fezName} (UID ${oldNode.fez.UID})`,
          );
        }
        return true;
      }
      return false;
    },

    // Cleanup destroyed fez components
    beforeRemove: (node) => {
      if (node.classList?.contains("fez") && node.fez) {
        node.fez.fezOnDestroy();
      }
    },
  });
};

// =============================================================================
// PUB/SUB SYSTEM (see lib/pubsub.js)
// =============================================================================

Fez.subscribe = subscribe;
Fez.publish = publish;

// =============================================================================
// LOCAL STORAGE (see lib/localstorage.js)
// =============================================================================

Fez.localStorage = fezLocalStorage;

// =============================================================================
// ASYNC AWAIT HELPER (see lib/await-helper.js)
// =============================================================================

Fez.fezAwait = fezAwait;

// =============================================================================
// ERROR HANDLING & LOGGING
// =============================================================================

Fez.consoleError = (text, show) => {
  text = `Fez: ${text}`;
  console.error(text);
  if (show) {
    return `<span style="border: 1px solid red; font-size: 14px; padding: 3px 7px; background: #fee; border-radius: 4px;">${text}</span>`;
  }
};

Fez.consoleLog = (text) => {
  if (Fez.LOG) {
    console.log(`Fez: ${String(text).substring(0, 180)}`);
  }
};

/**
 * Enhanced error handler with component context
 * @param {string} kind - Error category (e.g., 'template', 'lifecycle', 'morph')
 * @param {string|Error} message - Error message or Error object
 * @param {Object} [context] - Additional context (component name, props, etc.)
 * @returns {string} Formatted error message
 */
Fez.onError = (kind, message, context) => {
  // Extract component name from context or message
  let componentName = context?.componentName || context?.name;

  // Try to extract component name from message if not in context
  if (!componentName && typeof message === "string") {
    const match = message.match(/<([^>]+)>/);
    if (match) componentName = match[1];
  }

  // Format the error message with component context
  const prefix = componentName ? ` [${componentName}]` : "";
  const errorMsg =
    typeof message === "string" ? message : message?.message || String(message);
  const fullMessage = `Fez ${kind}:${prefix} ${errorMsg}`;

  // Log with context if available
  if (context && Fez.LOG) {
    console.error(fullMessage, context);
  } else {
    console.error(fullMessage);
  }

  // Include stack trace for Error objects
  if (message instanceof Error && message.stack && Fez.LOG) {
    console.error(message.stack);
  }

  return fullMessage;
};

// =============================================================================
// LOAD UTILITIES & EXPORTS
// =============================================================================

import addUtilities from "./utility.js";
import cssMixin from "./utils/css_mixin.js";

addUtilities(Fez);
cssMixin(Fez);

Fez.compile = compile;
Fez.createTemplate = createTemplate;
Fez.state = state;
Fez.log = objectDump;
Fez.highlightAll = highlightAll;

Fez.onReady(() => Fez.consoleLog("Fez.LOG === true, logging enabled."));

export default Fez;
