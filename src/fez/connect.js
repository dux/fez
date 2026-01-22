import createTemplate from './lib/template.js'
import FezBase from './instance.js'

const SELF_CLOSING_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'
])

/**
 * Global mutation observer for reactive attribute changes
 * Watches for attribute changes and triggers component updates
 */
const observer = new MutationObserver((mutationsList, _) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'attributes') {
      const fez = mutation.target.fez
      const name = mutation.attributeName
      const value = mutation.target.getAttribute(name)

      if (fez) {
        fez.props[name] = value
        fez.onPropsChange(name, value)
        // console.log(`The [${name}] attribute was modified to [${value}].`);
      }
    }
  }
});

/**
 * Registers a new custom element with Fez framework
 * @param {string} name - Custom element name (must contain a dash)
 * @param {Class|Object} klass - Component class or configuration object
 * @example
 * Fez('my-component', class {
 *   HTML = '<div>Hello World</div>'
 *   CSS = '.my-component { color: blue; }'
 * })
 */
export default function connect(name, klass) {
  const Fez = globalThis.window?.Fez || globalThis.Fez;
  // Validate custom element name format (must contain a dash)
  if (!name.includes('-')) {
    console.error(`Fez: Invalid custom element name "${name}". Custom element names must contain a dash (e.g., 'my-element', 'ui-button').`)
    return
  }

  // Transform plain class to FezBase subclass if needed
  klass = ensureFezBase(Fez, name, klass)

  // Process component template
  if (klass.html) {
    let slotTag = klass.SLOT || 'div'

    klass.html = klass.html
      // Replace <slot> or <slot > (with optional space/attributes) with fez-slot div
      // Use component name in fez-keep to make it unique for nested components
      .replace(/<slot(\s[^>]*)?>/, `<${slotTag} class="fez-slot fez-slot-${name}" fez-keep="slot-${name}"$1>`)
      .replace('</slot>', `</${slotTag}>`)

    // Compile template function
    klass.fezHtmlFunc = createTemplate(klass.html, { name })
  }

  // Register component styles globally (available to all components)
  if (klass.css) {
    klass.css = Fez.globalCss(klass.css, {name: name})
  }

  Fez.classes[name] = klass

  if (!customElements.get(name)) {
    customElements.define(name, class extends HTMLElement {
      connectedCallback() {
        // Fez.onReady(()=>{connectNode(name, this)})
        // connectNode(name, this)
        if (useFastRender(this, klass)) {
          connectNode(name, this)
        } else {
          requestAnimationFrame(()=>{
            connectNode(name, this)
          })
        }
      }
    })
  }
}

/**
 * Transforms a plain class into a FezBase subclass
 * Copies all properties/methods and maps uppercase config props (HTML, CSS, etc.)
 */
function ensureFezBase(Fez, name, klass) {
  // Already a FezBase subclass
  if (klass.prototype instanceof FezBase) {
    if (klass.html) {
      klass.html = closeCustomTags(klass.html)
    }
    return klass
  }

  const instance = new klass()
  const newKlass = class extends FezBase {}

  // Copy all properties and methods from original class
  const propNames = [
    ...Object.getOwnPropertyNames(instance),
    ...Object.getOwnPropertyNames(klass.prototype)
  ].filter(p => p !== 'constructor' && p !== 'prototype')

  for (const prop of propNames) {
    newKlass.prototype[prop] = instance[prop]
  }

  // Map uppercase config properties to their internal names
  const configMap = { FAST: 'FAST', GLOBAL: 'GLOBAL', CSS: 'css', NAME: 'nodeName' }
  for (const [from, to] of Object.entries(configMap)) {
    if (instance[from]) newKlass[to] = instance[from]
  }

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
 * Determines if component should render synchronously (fast) or async
 * Fast render is used when:
 * - Component has FAST class property set
 * - Node has fez-fast attribute
 * - Node has child content or siblings (to preserve DOM order)
 */
function useFastRender(node, klass) {
  const fezFastAttr = node.getAttribute('fez-fast')

  // Explicit false attribute takes precedence
  if (fezFastAttr === 'false') {
    return false
  }

  // Check class-level FAST setting (can be function or boolean)
  const klassFast = typeof klass.FAST === 'function' ? klass.FAST(node) : klass.FAST

  // Fast render if any condition is true
  return !!(fezFastAttr || klassFast || node.childNodes[0] || node.nextSibling)
}

/**
 * Converts self-closing custom tags to full open/close format
 * Required for proper HTML parsing of custom elements
 */
function closeCustomTags(html) {
  return html.replace(/<([a-z-]+)\b([^>]*)\/>/g, (match, tagName, attributes) => {
    return SELF_CLOSING_TAGS.has(tagName) ? match : `<${tagName}${attributes}></${tagName}>`
  })
}

/**
 * Initializes a Fez component instance from a DOM node
 * Replaces the custom element with the component's rendered content
 */
function connectNode(name, node) {
  if (!node.isConnected) return

  // Skip if already processed
  if (node.classList?.contains('fez')) return

  const klass = Fez.classes[name]
  const nodeName = typeof klass.nodeName == 'function' ? klass.nodeName(node) : klass.nodeName
  const newNode = document.createElement(nodeName || 'div')

  newNode.classList.add('fez')
  newNode.classList.add(`fez-${name}`)

  if (!node.parentNode) {
    console.warn(`Fez: ${name} node has no parent, skipping`)
    return
  }

  node.parentNode.replaceChild(newNode, node)

  const fez = new klass()

  fez.UID = ++Fez.instanceCount
  Fez.instances.set(fez.UID, fez)

  fez.oldRoot = node
  fez.fezName = name
  fez.root = newNode
  fez.props = klass.getProps(node, newNode)
  fez.class = klass

  // Move child nodes to preserve DOM event listeners
  fez.fezSlot(node, newNode)

  newNode.fez = fez

  if (klass.GLOBAL && klass.GLOBAL != true) {
    window[klass.GLOBAL] ||= fez
  }

  if (window.$) {
    fez.$root = $(newNode)
  }

  if (fez.props.id) {
    newNode.setAttribute('id', fez.props.id)
  }

  // Component lifecycle initialization
  fez.fezRegister()

  // Call initialization method (init, created, or connect)
  const initMethod = fez.onInit || fez.init || fez.created || fez.connect
  initMethod(fez.props)

  // Initial render
  fez.fezRender()

  // Trigger mount lifecycle hook
  fez.onMount(fez.props)

  if (fez.onSubmit) {
    const form = fez.root.nodeName == 'FORM' ? fez.root : fez.find('form')
    if (form) {
      form.onsubmit = (e) => {
        e.preventDefault()
        fez.onSubmit(fez.formData())
      }
    }
  }

  // Set up reactive attribute watching
  if (fez.onPropsChange) {
    observer.observe(newNode, {attributes:true})

    // Trigger initial prop change callbacks
    for (const [key, value] of Object.entries(fez.props)) {
      fez.onPropsChange(key, value)
    }
  }
}
