import createTemplate from './lib/template.js'
import FezBase from './instance.js'

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
    if (klassObj.GLOBAL) { newKlass.fezGlobal = klassObj.GLOBAL }  // Global instance reference
    if (klassObj.CSS) { newKlass.css = klassObj.CSS }              // Component styles
    if (klassObj.HTML) { 
      newKlass.html = closeCustomTags(klassObj.HTML)               // Component template
    }
    if (klassObj.NAME) { newKlass.nodeName = klassObj.NAME }       // Custom DOM node name

    // Auto-mount global components to body
    if (klassObj.GLOBAL) {
      const mountGlobalComponent = () => document.body.appendChild(document.createElement(name))

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountGlobalComponent);
      } else {
        mountGlobalComponent()
      }
    }

    klass = newKlass

    Fez.log(`${name} compiled`)
  } else if (klass.html) {
    // If klass already has html property, process it
    klass.html = closeCustomTags(klass.html)
  }

  // Process component template
  if (klass.html) {
    // Replace <slot /> with reactive slot containers
    klass.html = klass.html.replace(/<slot\s*\/>|<slot\s*>\s*<\/slot>/g, () => {
      const slotTag = klass.SLOT || 'div'
      return `<${slotTag} class="fez-slot" fez-keep="default-slot"></${slotTag}>`
    })

    // Compile template function
    klass.fezHtmlFunc = createTemplate(klass.html)
  }

  // Register component styles globally (available to all components)
  if (klass.css) {
    klass.css = Fez.globalCss(klass.css, {name: name})
  }

  Fez.classes[name] = klass

  connectCustomElement(name, klass)
}

/**
 * Registers the custom element with the browser
 * Sets up batched rendering for optimal performance
 */
function connectCustomElement(name, klass) {
  const Fez = globalThis.window?.Fez || globalThis.Fez;
  
  if (!customElements.get(name)) {
    customElements.define(name, class extends HTMLElement {
      connectedCallback() {
        // Batch all renders using microtasks for consistent timing and DOM completeness
        if (!Fez._pendingConnections) {
          Fez._pendingConnections = []
          Fez._batchScheduled = false
        }

        Fez._pendingConnections.push({ name, node: this })

        if (!Fez._batchScheduled) {
          Fez._batchScheduled = true
          Promise.resolve().then(() => {
            const connections = Fez._pendingConnections.slice()
            Fez._pendingConnections = []
            Fez._batchScheduled = false

            // Sort by DOM order to ensure parent nodes are processed before children
            connections.sort((a, b) => {
              if (a.node.contains(b.node)) return -1
              if (b.node.contains(a.node)) return 1
              return 0
            })

            connections.forEach(({ name, node }) => {
              if (node.isConnected && node.parentNode) {
                connectNode(name, node)
              }
            })
          })
        }
      }
    })
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

    if (klass.fezGlobal && klass.fezGlobal != true) {
      window[klass.fezGlobal] = fez
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
