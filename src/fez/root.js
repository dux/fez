// runtime scss
import Gobber from './vendor/gobber.js'

// morph dom from one state to another
import { Idiomorph } from './vendor/idiomorph.js'

import objectDump from './utils/dump.js'
import highlightAll from './utils/highlight_all.js'
import connect from './connect.js'
import compile from './compile.js'
import state from './lib/global-state.js'

/**
 * Fez - Main framework function for component registration and lookup
 *
 * @example
 * // Register a component
 * Fez('ui-slider', class { init() { ... } })
 *
 * // Find first instance by name
 * Fez('ui-slider')
 *
 * // Find by UID
 * Fez(123)
 *
 * // Find all instances and execute callback
 * Fez('ui-slider', (instance) => console.log(instance))
 *
 * // Find from DOM node
 * Fez(domNode)
 *
 * @param {string|number|Node} name - Component name, UID, or DOM node
 * @param {Class|Function} [klass] - Component class or callback function
 * @returns {FezBase|Array|void} Component instance, array of instances, or void
 */
const Fez = (name, klass) => {
  if(typeof name === 'number') {
    const fez = Fez.instances.get(name)
    if (fez) {
      return fez
    } else {
      Fez.consoleError(`Instance with UID "${name}" not found.`)
    }
  }
  else if (name) {
    if (klass) {
      const isPureFn = typeof klass === 'function' && !/^\s*class/.test(klass.toString()) && !/\b(this|new)\b/.test(klass.toString())

      if (isPureFn) {
        const list = Array
          .from(document.querySelectorAll(`.fez.fez-${name}`))
          .filter( n => n.fez )

        list.forEach( el => klass(el.fez) )
        return list
      } else if (typeof klass != 'function') {
        return Fez.find(name, klass)
      } else {
        return connect(name, klass)
      }
    } else {
      const node = name.nodeName ? name.closest('.fez') : (
        document.querySelector( name.includes('#') ? name : `.fez.fez-${name}` )
      )
      if (node) {
        if (node.fez) {
          return node.fez
        } else {
          Fez.consoleError(`node "${name}" has no Fez attached.`)
        }
      } else {
        Fez.consoleError(`node "${name}" not found.`)
      }
    }
  } else {
    Fez.consoleError('Fez() ?')
  }
}

/** Registered component classes by name */
Fez.classes = {}

/** Counter for generating unique instance IDs */
Fez.instanceCount = 0

/** Map of all active component instances by UID */
Fez.instances = new Map()

/**
 * Find a Fez component instance from a DOM node
 * @param {Node|string} onode - DOM node or selector string
 * @param {string} [name] - Optional component name to filter by
 * @returns {FezBase|undefined} The component instance or undefined
 */
Fez.find = (onode, name) => {
  let node = onode

  if (typeof node == 'string') {
    node = document.body.querySelector(node)
  }

  if (typeof node.val == 'function') {
    node = node[0]
  }

  const klass = name ? `.fez.fez-${name}` : '.fez'

  const closestNode = node.closest(klass)
  if (closestNode && closestNode.fez) {
    return closestNode.fez
  } else {
    Fez.onError('find', 'Node connector not found', { original: onode, resolved: node })
  }
}

/**
 * Generate a unique CSS class name from CSS text using Goober
 * @param {string} text - CSS rules to process
 * @returns {string} Generated unique class name
 */
Fez.cssClass = (text) => {
  return Gobber.css(text)
}

/**
 * Register global CSS styles for a component
 * @param {string|Function} cssClass - CSS text or function returning CSS
 * @param {Object} [opts] - Options
 * @param {string} [opts.name] - Component name for scoping
 * @param {boolean} [opts.wrap] - Wrap CSS in :fez selector
 * @returns {string} Generated class name
 */
Fez.globalCss = (cssClass, opts = {}) => {
  if (typeof cssClass === 'function') {
    cssClass = cssClass()
  }

  if (cssClass.includes(':')) {
    let text = cssClass
      .split("\n")
      .filter(line => !(/^\s*\/\//.test(line)))
      .join("\n")

    if (opts.wrap) {
      text = `:fez { ${text} }`
    }

    text = text.replace(/\:fez|\:host/, `.fez.fez-${opts.name}`)

    cssClass = Fez.cssClass(text)
  }

  Fez.onReady(() => {
    document.body.parentElement.classList.add(cssClass)
  })

  return cssClass
}

Fez.info = () => {
  console.log('Fez components:', Object.keys(Fez.classes || {}))
}

/**
 * Morph one DOM node into another using Idiomorph
 * Preserves event handlers and minimizes DOM mutations
 * @param {Element} target - Target element to morph
 * @param {Element} newNode - New element state to morph into
 * @param {Object} [opts] - Idiomorph options
 */
Fez.morphdom = (target, newNode, opts = {}) => {
  Array.from(target.attributes).forEach(attr => {
    newNode.setAttribute(attr.name, attr.value)
  })

  Idiomorph.morph(target, newNode, {
    morphStyle: 'outerHTML'
  })

  // remove whitespace on next node, if exists (you never want this)
  const nextSibling = target.nextSibling
  if (nextSibling?.nodeType === Node.TEXT_NODE && nextSibling.textContent.trim() === '') {
    nextSibling.remove();
  }
}

Fez._globalSubs ||= new Map()

/**
 * Publish an event to all subscribers on a channel
 * @param {string} channel - Event channel name
 * @param {...any} args - Arguments to pass to subscribers
 */
Fez.publish = (channel, ...args) => {
  Fez._subs ||= {}
  Fez._subs[channel] ||= []
  Fez._subs[channel].forEach((el) => {
    el[1].bind(el[0])(...args)
  })

  // Trigger global subscriptions
  const subs = Fez._globalSubs.get(channel)
  if (subs) {
    subs.forEach((sub) => {
      if (sub.node && sub.node.isConnected) {
        sub.callback.call(sub.node, ...args)
      } else {
        // Remove disconnected or null nodes from subscriptions
        subs.delete(sub)
      }
    })
  }
}

/**
 * Subscribe to events on a channel
 * @param {Node|string} node - DOM node, selector, or event name (if using simplified syntax)
 * @param {string|Function} eventName - Event name or callback (if node is event name)
 * @param {Function} [callback] - Event handler callback
 * @returns {Function} Unsubscribe function
 */
Fez.subscribe = (node, eventName, callback) => {
  // If second arg is function, shift arguments
  if (typeof eventName === 'function') {
    callback = eventName
    eventName = node
    node = document.body
  }

  // Handle string selectors
  if (typeof node === 'string') {
    node = document.querySelector(node)
  }

  if (!Fez._globalSubs.has(eventName)) {
    Fez._globalSubs.set(eventName, new Set())
  }

  const subs = Fez._globalSubs.get(eventName)

  // Remove existing subscription for same node and callback
  subs.forEach(sub => {
    if (sub.node === node && sub.callback === callback) {
      subs.delete(sub)
    }
  })

  const subscription = { node, callback }
  subs.add(subscription)

  // Return unsubscribe function
  return () => {
    subs.delete(subscription)
  }
}

Fez.consoleError = (text, show) => {
  text = `Fez: ${text}`
  console.error(text)
  if (show) {
    return `<span style="border: 1px solid red; font-size: 14px; padding: 3px 7px; background: #fee; border-radius: 4px;">${text}</span>`
  }
}

Fez.consoleLog = (text) => {
  if (Fez.LOG === true) {
    text = String(text).substring(0, 180)
    console.log(`Fez: ${text}`)
  }
}

// Error handler - can be overridden by user for custom error handling
// Usage: Fez.onError = (kind, message, context) => { ... }
Fez.onError = (kind, message, context) => {
  const errorMsg = `Fez ${kind}: ${message?.toString?.() || message}`
  console.error(errorMsg, context || '')
  return errorMsg
}

// work with tmp store
Fez.store = {
  store: new Map(),
  counter: 0,

  set(value) {
    const key = this.counter++;
    this.store.set(key, value);
    return key;
  },

  get(key) {
    return this.store.get(key);
  },

  delete(key) {
    const value = this.store.get(key);
    this.store.delete(key)
    return value;
  }
};

// Load utility functions
import addUtilities from './utility.js'
import cssMixin from './utils/css_mixin.js'
addUtilities(Fez)
cssMixin(Fez)

Fez.compile = compile
Fez.state = state
Fez.log = objectDump
Fez.highlightAll = highlightAll

Fez.onReady(() => {
  Fez.consoleLog('Fez.LOG === true, logging enabled.')
})

export default Fez
