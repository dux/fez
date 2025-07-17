// templating
import createTemplate from './lib/template'

// this function accepts custom tag name and class definition, creates and connects
// Fez(name, klass)
export default function(name, klass) {
  // Validate custom element name format (must contain a dash)
  if (!name.includes('-')) {
    console.error(`Fez: Invalid custom element name "${name}". Custom element names must contain a dash (e.g., 'my-element', 'ui-button').`)
  }

  // to allow anonymous class and then re-attach (does not work)
  // Fez('ui-todo', class { ... # instead Fez('ui-todo', class extends FezBase {
  if (!klass.__objects) {
    const klassObj = new klass()
    const newKlass = class extends FezBase {}

    const props = Object.getOwnPropertyNames(klassObj)
      .concat(Object.getOwnPropertyNames(klass.prototype))
      .filter(el => !['constructor', 'prototype'].includes(el))

    props.forEach(prop => newKlass.prototype[prop] = klassObj[prop])

    Fez.fastBindInfo ||= {fast: [], slow: []}

    if (klassObj.CSS) { newKlass.css = klassObj.CSS }
    if (klassObj.HTML) { newKlass.html = klassObj.HTML }
    if (klassObj.NAME) { newKlass.nodeName = klassObj.NAME }
    if (klassObj.FAST) {
      newKlass.fastBind = klassObj.FAST
      Fez.fastBindInfo.fast.push(typeof klassObj.FAST == 'function' ? `${name} (func)` : name)
    } else {
      Fez.fastBindInfo.slow.push(name)
    }

    klass = newKlass

    let info = `${name} compiled`
    if (klassObj.FAST) info += ' (fast bind)'
    Fez.log(info)
  }

  if (klass.html) {
    klass.html = closeCustomTags(klass.html)

    // wrap slot to enable reactive re-renders. It will use existing .fez-slot if found
    klass.html = klass.html.replace(/<slot\s*\/>|<slot\s*>\s*<\/slot>/g, () => {
      const name = klass.slotNodeName || 'div'
      return `<${name} class="fez-slot"></${name}>`
    })

    klass.fezHtmlFunc = createTemplate(klass.html)
  }

  // we have to register global css on component init, because some other component can depend on it (it is global)
  if (klass.css) {
    klass.css = Fez.globalCss(klass.css, {name: name})
  }

  Fez.classes[name] = klass

  if (!customElements.get(name)) {
    customElements.define(name, class extends HTMLElement {
      connectedCallback() {
        // if you want to force fast render (prevent page flickering), add static fastBind = true or FAST = true
        // we can not fast load auto for all because that creates hard to debug problems in nested custom nodes
        // problems with events and slots (I woke up at 2AM, now it is 5AM)
        // this is usually safe for first order components, as page header or any components that do not have innerHTML or use slots
        // Example: you can add FAST as a function - render fast nodes that have name attribute
        //   FAST(node) { return !!node.getAttribute('name') }
        // to inspect fast / slow components use Fez.info() in console
        if (useFastRender(this, klass)) {
          connectNode(name, this)
        } else {
          window.requestAnimationFrame(()=>{
            if (this.parentNode) {
              connectNode(name, this)
            }
          })
        }
      }
    })
  }
}

//

function closeCustomTags(html) {
  const selfClosingTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'
  ])

  return html.replace(/<([a-z-]+)\b([^>]*)\/>/g, (match, tagName, attributes) => {
    return selfClosingTags.has(tagName) ? match : `<${tagName}${attributes}></${tagName}>`
  })
}

function useFastRender(n, klass) {
  const fezFast = n.getAttribute('fez-fast')
  var isFast = typeof klass.fastBind === 'function' ? klass.fastBind(n) : klass.fastBind

  if (fezFast == 'false') {
    return false
  } else {
    return fezFast || isFast
  }
}

function connectNode(name, node) {
  const klass = Fez.classes[name]
  const parentNode = node.parentNode

  if (node.isConnected) {
    const nodeName = typeof klass.nodeName == 'function' ? klass.nodeName(node) : klass.nodeName
    const newNode = document.createElement(nodeName || 'div')

    newNode.classList.add('fez')
    newNode.classList.add(`fez-${name}`)

    parentNode.replaceChild(newNode, node);

    const object = new klass()
    object.oldRoot = node
    object.fezName = name
    object.root = newNode
    object.props = klass.getProps(node, newNode)
    object.class = klass

    // copy child nodes, natively to preserve bound events
    object.slot(node, newNode)

    newNode.fez = object

    if (window.$) {
      object.$root = $(newNode)
    }

    if (object.props.id) {
      newNode.setAttribute('id', object.props.id)
    }

    object.fezRegister();
    (object.init || object.created || object.connect).bind(object)(object.props);
    klass.__objects.push(object)

    const oldRoot = object.root.cloneNode(true)

    if (object.class.fezHtmlFunc) {
      object.render()
    }

    const slot = object.root.querySelector('.fez-slot')
    if (slot) {
      if (object.props.html) {
        slot.innerHTML = object.props.html
      } else {
        object.slot(oldRoot, slot)
      }
    }

    if (object.onSubmit) {
      const form = object.root.nodeName == 'FORM' ? object.root : object.find('form')
      form.onsubmit = (e) => {
        e.preventDefault()
        object.onSubmit(object.formData())
      }
    }

    object.onMount(object.props)

    // if onPropsChange method defined, add observer and trigger call on all attributes once component is loaded
    if (object.onPropsChange) {
      observer.observe(newNode, {attributes:true})
      for (const [key, value] of Object.entries(object.props)) {
        object.onPropsChange(key, value)
      }
    }
  }
}

//

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
