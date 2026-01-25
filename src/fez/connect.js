/**
 * Fez Component Registration & Connection
 *
 * This file handles:
 * - Registering components with customElements
 * - Transforming plain classes to FezBase subclasses
 * - Instantiating components when they appear in DOM
 *
 * Flow:
 * 1. connect(name, class) - registers custom element
 * 2. connectedCallback() - when element appears in DOM
 * 3. connectNode() - creates instance, renders, calls lifecycle
 */

import createTemplate from './lib/template.js'
import FezBase from './instance.js'

// =============================================================================
// CONSTANTS
// =============================================================================

const SELF_CLOSING_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img',
  'input', 'link', 'meta', 'source', 'track', 'wbr'
])

// Attribute observer for reactive props
const attrObserver = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    if (mutation.type === 'attributes') {
      const fez = mutation.target.fez
      if (fez) {
        const name = mutation.attributeName
        const value = mutation.target.getAttribute(name)
        fez.props[name] = value
        fez.onPropsChange(name, value)
      }
    }
  }
})

// =============================================================================
// MAIN CONNECT FUNCTION
// =============================================================================

/**
 * Register a Fez component
 *
 * @param {string} name - Custom element name (must contain dash)
 * @param {Class} klass - Component class
 *
 * @example
 * Fez('ui-button', class {
 *   HTML = '<button><slot /></button>'
 *   CSS = 'button { color: blue; }'
 *   init() { console.log('created') }
 * })
 */
export default function connect(name, klass) {
  const Fez = globalThis.window?.Fez || globalThis.Fez

  // Validate name
  if (!name.includes('-')) {
    console.error(`Fez: Invalid name "${name}". Must contain a dash.`)
    return
  }

  // Transform to FezBase subclass
  klass = ensureFezBase(Fez, name, klass)

  // Process HTML template
  if (klass.html) {
    const slotTag = klass.SLOT || 'div'
    klass.html = klass.html
      .replace(/<slot(\s[^>]*)?>/, `<${slotTag} class="fez-slot fez-slot-${name}" fez-keep="slot-${name}"$1>`)
      .replace('</slot>', `</${slotTag}>`)

    klass.fezHtmlFunc = createTemplate(klass.html, { name })
  }

  // Register CSS
  if (klass.css) {
    klass.css = Fez.globalCss(klass.css, { name })
  }

  // Store class
  Fez.classes[name] = klass

  // Register custom element
  if (!customElements.get(name)) {
    customElements.define(name, class extends HTMLElement {
      connectedCallback() {
        if (shouldRenderFast(this, klass)) {
          connectNode(name, this)
        } else {
          requestAnimationFrame(() => connectNode(name, this))
        }
      }
    })
  }
}

// =============================================================================
// CLASS TRANSFORMATION
// =============================================================================

/**
 * Transform plain class to FezBase subclass
 * Maps uppercase config props (HTML, CSS, etc.)
 */
function ensureFezBase(Fez, name, klass) {
  // Already a FezBase subclass
  if (klass.prototype instanceof FezBase) {
    if (klass.html) klass.html = closeCustomTags(klass.html)
    return klass
  }

  // Create FezBase subclass
  const instance = new klass()
  const newKlass = class extends FezBase {}

  // Copy properties and methods
  const props = [
    ...Object.getOwnPropertyNames(instance),
    ...Object.getOwnPropertyNames(klass.prototype)
  ].filter(p => p !== 'constructor' && p !== 'prototype')

  for (const prop of props) {
    newKlass.prototype[prop] = instance[prop]
  }

  // Map config properties
  const configMap = { FAST: 'FAST', GLOBAL: 'GLOBAL', CSS: 'css', NAME: 'nodeName' }
  for (const [from, to] of Object.entries(configMap)) {
    if (instance[from]) newKlass[to] = instance[from]
  }

  // Handle HTML
  if (instance.HTML) {
    newKlass.html = closeCustomTags(instance.HTML)
  }

  // Auto-mount global components
  if (instance.GLOBAL) {
    Fez.onReady(() => document.body.appendChild(document.createElement(name)))
  }

  Fez.consoleLog(`${name} compiled`)
  return newKlass
}

/**
 * Convert self-closing custom tags to full format
 * <my-comp /> -> <my-comp></my-comp>
 */
function closeCustomTags(html) {
  return html.replace(/<([a-z-]+)\b([^>]*)\/>/g, (match, tag, attrs) => {
    return SELF_CLOSING_TAGS.has(tag) ? match : `<${tag}${attrs}></${tag}>`
  })
}

/**
 * Determine if component should render synchronously
 */
function shouldRenderFast(node, klass) {
  const attr = node.getAttribute('fez-fast')
  if (attr === 'false') return false

  const klassFast = typeof klass.FAST === 'function' ? klass.FAST(node) : klass.FAST
  return !!(attr || klassFast || node.childNodes[0] || node.nextSibling)
}

// =============================================================================
// NODE CONNECTION (Instantiation)
// =============================================================================

/**
 * Initialize component instance from DOM node
 */
function connectNode(name, node) {
  if (!node.isConnected) return
  if (node.classList?.contains('fez')) return

  const klass = Fez.classes[name]
  const nodeName = typeof klass.nodeName === 'function' ? klass.nodeName(node) : klass.nodeName
  const newNode = document.createElement(nodeName || 'div')

  newNode.classList.add('fez', `fez-${name}`)

  if (!node.parentNode) {
    console.warn(`Fez: ${name} has no parent, skipping`)
    return
  }

  // Replace custom element with component node
  node.parentNode.replaceChild(newNode, node)

  // Create instance
  const fez = new klass()
  fez.UID = ++Fez.instanceCount
  Fez.instances.set(fez.UID, fez)

  fez.oldRoot = node
  fez.fezName = name
  fez.root = newNode
  fez.props = klass.getProps(node, newNode)
  fez.class = klass

  // Move children (slot content)
  fez.fezSlot(node, newNode)

  newNode.fez = fez

  // Global component reference
  if (klass.GLOBAL && klass.GLOBAL !== true) {
    window[klass.GLOBAL] ||= fez
  }

  // jQuery compatibility
  if (window.$) fez.$root = $(newNode)

  // Copy ID
  if (fez.props.id) newNode.setAttribute('id', fez.props.id)

  // === LIFECYCLE ===

  // Setup reactive state
  fez.fezRegister()

  // Init (supports multiple naming conventions)
  const initMethod = fez.onInit || fez.init || fez.created || fez.connect
  initMethod.call(fez, fez.props)

  // Render
  fez.fezRender()

  // Mount
  fez.onMount(fez.props)

  // Form submit handling
  if (fez.onSubmit) {
    const form = fez.root.nodeName === 'FORM' ? fez.root : fez.find('form')
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault()
        fez.onSubmit(fez.formData())
      }
    }
  }

  // Watch for attribute changes
  if (fez.onPropsChange) {
    attrObserver.observe(newNode, { attributes: true })
    for (const [key, value] of Object.entries(fez.props)) {
      fez.onPropsChange(key, value)
    }
  }
}
