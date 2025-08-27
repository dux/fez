import createTemplate from './lib/template.js'
import FezBase from './instance.js'

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
  }

  // Transform simple class definitions into Fez components
  if (!klass.fezHtmlRoot) {
    const klassObj = new klass()
    const newKlass = class extends FezBase {}

    // Copy all properties and methods from the original class
    const props = Object.getOwnPropertyNames(klassObj)
      .concat(Object.getOwnPropertyNames(klass.prototype))
      .filter(el => !['constructor', 'prototype'].includes(el))

    props.forEach(prop => newKlass.prototype[prop] = klassObj[prop])

    // Map component configuration properties
    if (klassObj.FAST) { newKlass.FAST = klassObj.FAST }           // Global instance reference
    if (klassObj.GLOBAL) { newKlass.GLOBAL = klassObj.GLOBAL }       // Global instance reference
    if (klassObj.CSS) { newKlass.css = klassObj.CSS }                // Component styles
    if (klassObj.HTML) {
      newKlass.html = closeCustomTags(klassObj.HTML)                 // Component template
    }
    if (klassObj.NAME) { newKlass.nodeName = klassObj.NAME }         // Custom DOM node name

    // Auto-mount global components to body
    if (klassObj.GLOBAL) {
      document.body.appendChild(document.createElement(name))
    }

    klass = newKlass

    Fez.log(`${name} compiled`)
  } else if (klass.html) {
    // If klass already has html property, process it
    klass.html = closeCustomTags(klass.html)
  }

  // Process component template
  if (klass.html) {
    let slotTag = klass.SLOT || 'div'

    klass.html = klass.html
      .replace('<slot', `<${slotTag} class="fez-slot" fez-keep="default-slot"`)
      .replace('</slot>', `</${slotTag}>`)

    // Compile template function
    klass.fezHtmlFunc = createTemplate(klass.html)
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

function useFastRender(node, klass) {
  const fezFast = node.getAttribute('fez-fast')
  var isFast = typeof klass.FAST === 'function' ? klass.FAST(node) : klass.FAST
  if (fezFast == 'false') {
    return false
  } else {
    return fezFast || isFast
  }
}

/**
 * Converts self-closing custom tags to full open/close format
 * Required for proper HTML parsing of custom elements
 */
function closeCustomTags(html) {
  const selfClosingTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'
  ])

  return html.replace(/<([a-z-]+)\b([^>]*)\/>/g, (match, tagName, attributes) => {
    return selfClosingTags.has(tagName) ? match : `<${tagName}${attributes}></${tagName}>`
  })
}

/**
 * Initializes a Fez component instance from a DOM node
 * Replaces the custom element with the component's rendered content
 */
function connectNode(name, node) {
  const klass = Fez.classes[name]
  const parentNode = node.parentNode

  if (node.isConnected) {
    const nodeName = typeof klass.nodeName == 'function' ? klass.nodeName(node) : klass.nodeName
    const newNode = document.createElement(nodeName || 'div')

    newNode.classList.add('fez')
    newNode.classList.add(`fez-${name}`)

    parentNode.replaceChild(newNode, node);

    const fez = new klass()

    fez.UID = ++Fez.instanceCount
    Fez.instances.set(fez.UID, fez)

    fez.oldRoot = node
    fez.fezName = name
    fez.root = newNode
    fez.props = klass.getProps(node, newNode)
    fez.class = klass

    // Move child nodes to preserve DOM event listeners
    fez.slot(node, newNode)

    newNode.fez = fez

    if (klass.GLOBAL && klass.GLOBAL != true) {
      window[klass.GLOBAL] = fez
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
    ;(fez.init || fez.created || fez.connect).bind(fez)(fez.props)

    // Initial render
    fez.render()
    fez.firstRender = true

    // Trigger mount lifecycle hook
    fez.onMount(fez.props)

    if (fez.onSubmit) {
      const form = fez.root.nodeName == 'FORM' ? fez.root : fez.find('form')
      form.onsubmit = (e) => {
        e.preventDefault()
        fez.onSubmit(fez.formData())
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
}
