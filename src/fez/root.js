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

import Gobber from './vendor/gobber.js'
import { Idiomorph } from './vendor/idiomorph.js'
import objectDump from './utils/dump.js'
import highlightAll from './utils/highlight_all.js'
import connect from './connect.js'
import compile from './compile.js'
import state from './lib/global-state.js'
import createTemplate from './lib/template.js'
import { subscribe, publish } from './lib/pubsub.js'
import fezLocalStorage from './lib/localstorage.js'

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
  if (typeof name === 'number') {
    const fez = Fez.instances.get(name)
    if (fez) return fez
    Fez.consoleError(`Instance with UID "${name}" not found.`)
    return
  }

  if (!name) {
    Fez.consoleError('Fez() ?')
    return
  }

  // With second argument
  if (klass) {
    const isPureFn = typeof klass === 'function' &&
      !/^\s*class/.test(klass.toString()) &&
      !/\b(this|new)\b/.test(klass.toString())

    // Fez('name', callback) - find all & execute
    if (isPureFn) {
      const list = Array
        .from(document.querySelectorAll(`.fez.fez-${name}`))
        .filter(n => n.fez)
      list.forEach(el => klass(el.fez))
      return list
    }

    // Fez('name', selector) - find with context
    if (typeof klass !== 'function') {
      return Fez.find(name, klass)
    }

    // Fez('name', class) - register component
    return connect(name, klass)
  }

  // Find instance by name or node
  const node = name.nodeName
    ? name.closest('.fez')
    : document.querySelector(name.includes('#') ? name : `.fez.fez-${name}`)

  if (!node) {
    Fez.consoleError(`node "${name}" not found.`)
    return
  }

  if (!node.fez) {
    Fez.consoleError(`node "${name}" has no Fez attached.`)
    return
  }

  return node.fez
}

// =============================================================================
// COMPONENT REGISTRY
// =============================================================================

/** Registered component classes by name */
Fez.classes = {}

/** Counter for unique instance IDs */
Fez.instanceCount = 0

/** Active component instances by UID */
Fez.instances = new Map()

/**
 * Find a component instance from a DOM node
 * @param {Node|string} onode - DOM node or selector
 * @param {string} [name] - Optional component name filter
 * @returns {FezBase|undefined}
 */
Fez.find = (onode, name) => {
  let node = typeof onode === 'string' ? document.body.querySelector(onode) : onode

  // jQuery compatibility
  if (typeof node.val === 'function') node = node[0]

  const selector = name ? `.fez.fez-${name}` : '.fez'
  const closestNode = node.closest(selector)

  if (closestNode?.fez) return closestNode.fez

  Fez.onError('find', 'Node connector not found', { original: onode, resolved: node })
}

/** Print registered components */
Fez.info = () => console.log('Fez components:', Object.keys(Fez.classes || {}))

// =============================================================================
// CSS UTILITIES
// =============================================================================

/**
 * Generate unique CSS class from CSS text (via Goober)
 * @param {string} text - CSS rules
 * @returns {string} Generated class name
 */
Fez.cssClass = (text) => Gobber.css(text)

/**
 * Register global CSS styles
 * @param {string|Function} cssClass - CSS text or function
 * @param {Object} opts - { name, wrap }
 * @returns {string} Generated class name
 */
Fez.globalCss = (cssClass, opts = {}) => {
  if (typeof cssClass === 'function') cssClass = cssClass()

  if (cssClass.includes(':')) {
    let text = cssClass
      .split("\n")
      .filter(line => !(/^\s*\/\//.test(line)))
      .join("\n")

    if (opts.wrap) text = `:fez { ${text} }`
    text = text.replace(/\:fez|\:host/, `.fez.fez-${opts.name}`)
    cssClass = Fez.cssClass(text)
  }

  Fez.onReady(() => document.body.parentElement.classList.add(cssClass))
  return cssClass
}

// =============================================================================
// DOM MORPHING
// =============================================================================

/**
 * Morph DOM node to new state (via Idiomorph)
 * @param {Element} target - Element to morph
 * @param {Element} newNode - New state
 */
Fez.morphdom = (target, newNode) => {
  // Preserve attributes
  Array.from(target.attributes).forEach(attr => {
    newNode.setAttribute(attr.name, attr.value)
  })

  Idiomorph.morph(target, newNode, { morphStyle: 'outerHTML' })

  // Clean up whitespace
  const next = target.nextSibling
  if (next?.nodeType === Node.TEXT_NODE && !next.textContent.trim()) {
    next.remove()
  }
}

// =============================================================================
// PUB/SUB SYSTEM (see lib/pubsub.js)
// =============================================================================

Fez.subscribe = subscribe
Fez.publish = publish

// =============================================================================
// TEMPORARY STORE
// =============================================================================

/** Store for passing values through DOM (e.g., loop vars to child components) */
Fez.store = {
  _data: new Map(),
  _counter: 0,

  set(value) {
    const key = this._counter++
    this._data.set(key, value)
    return key
  },

  get(key) {
    return this._data.get(key)
  },

  delete(key) {
    const value = this._data.get(key)
    this._data.delete(key)
    return value
  }
}

// =============================================================================
// LOCAL STORAGE (see lib/localstorage.js)
// =============================================================================

Fez.localStorage = fezLocalStorage

// =============================================================================
// ERROR HANDLING & LOGGING
// =============================================================================

Fez.consoleError = (text, show) => {
  text = `Fez: ${text}`
  console.error(text)
  if (show) {
    return `<span style="border: 1px solid red; font-size: 14px; padding: 3px 7px; background: #fee; border-radius: 4px;">${text}</span>`
  }
}

Fez.consoleLog = (text) => {
  if (Fez.LOG) {
    console.log(`Fez: ${String(text).substring(0, 180)}`)
  }
}

/** Error handler - can be overridden */
Fez.onError = (kind, message, context) => {
  const errorMsg = `Fez ${kind}: ${message?.toString?.() || message}`
  console.error(errorMsg, context || '')
  return errorMsg
}

// =============================================================================
// LOAD UTILITIES & EXPORTS
// =============================================================================

import addUtilities from './utility.js'
import cssMixin from './utils/css_mixin.js'

addUtilities(Fez)
cssMixin(Fez)

Fez.compile = compile
Fez.createTemplate = createTemplate
Fez.state = state
Fez.log = objectDump
Fez.highlightAll = highlightAll

Fez.onReady(() => Fez.consoleLog('Fez.LOG === true, logging enabled.'))

export default Fez
