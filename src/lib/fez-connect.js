// templating
import createTemplate from '../vendor/template'

export default function(name, klass) {
  // to allow anonymous class and then re-attach (does not work)
  // Fez('ui-todo', class { ... # instead Fez('ui-todo', class extends FezBase {
  if (!klass.__objects) {
    const klassObj = new klass()
    const newKlass = class extends FezBase {}

    const props = Object.getOwnPropertyNames(klassObj)
      .concat(Object.getOwnPropertyNames(klass.prototype))
      .filter(el => !['constructor', 'prototype'].includes(el))

    props.forEach(prop => newKlass.prototype[prop] = klassObj[prop])

    if (klassObj.CSS) { newKlass.css = klassObj.CSS }
    if (klassObj.HTML) { newKlass.html = klassObj.HTML }
    if (klassObj.NAME) { newKlass.nodeName = klassObj.NAME }
    if (klassObj.FAST) { newKlass.fastBind = klassObj.FAST }

    klass = newKlass
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

  Fez._classCache[name] = klass

  if (!customElements.get(name)) {
    customElements.define(name, class extends HTMLElement {
      connectedCallback() {
        // when we render nested fez components, and under Svelte, sometimes node innerHTML is empty, but it should not be
        // in that case, we need to wait for another tick to get content
        // this solution looks like it is not efficient, because it slow renders fez components that do not have and are not intended to have body, but by testing this looks like it is not effecting render performance
        // if you want to force fast render, add static fastBind = true or check
        // console.log(this)
        if (this.firstChild || this.getAttribute('data-props') || forceFastRender(this, klass)) {
          Fez.info(`fast bind: ${name}`)
          connectDom(name, this, Fez._classCache[name])
        } else {
          Fez.info(`slow bind: ${name}`)
          window.requestAnimationFrame(()=>{
            if (this.parentNode) {
              connectDom(name, this, Fez._classCache[name])
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

function connectDom(name, node, klass) {
  const parentNode = node.parentNode

  if (parentNode) {
    const nodeName = typeof klass.nodeName == 'function' ? klass.nodeName(node) : klass.nodeName
    const newNode = document.createElement(nodeName || 'div')

    newNode.classList.add('fez')
    newNode.classList.add(`fez-${name}`)

    parentNode.replaceChild(newNode, node);

    const object = new klass()
    object.oldRoot = node
    object.fezName = name
    object.root = newNode
    object.props = klass.getProps(node, newNode) // TODO: simplify by move up
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

    object.fezRegister()
    object.connect(object.props)
    klass.__objects.push(object)

    const oldRoot = object.root.cloneNode(true)

    if (object.class.fezHtmlFunc) {
      object.render()
    }

    const slot = object.root.querySelector('.fez-slot')
    if (slot) {
      object.slot(oldRoot, slot)
    }

    if (object.onSubmit) {
      const form = object.root.nodeName == 'FORM' ? object.root : object.find('form')
      form.onsubmit = (e) => {
        e.preventDefault()
        object.onSubmit(object.formData())
      }
    }

    object.afterConnect()
    object.onMount()

    // parse code in props
    // size="{{ document.getElementById('icon-range').value }}"
    for (let [key, value] of Object.entries(object.props)) {
      if (/^\{\{/.test(value) && /\}\}$/.test(value)) {
        value = value.replace(/^\{\{/, 'return (').replace(/\}\}$/, ')')
        value = (new Function(value)).bind(object.root)()
        object.props[key] = value
      }
    }

    // if onPropsChange method defined, add observer and trigger call on all attributes once component is loaded
    if (object.onPropsChange) {
      observer.observe(newNode, {attributes:true})
      for (const [key, value] of Object.entries(object.props)) {
        object.onPropsChange(key, value)
      }
    }
  }
}

function forceFastRender(n, klass) {
  return typeof klass.fastBind === 'function' ? klass.fastBind(n) : klass.fastBind
}

const observer = new MutationObserver((mutationsList, _) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'attributes') {
      const fez = mutation.target.fez
      const name = mutation.attributeName
      const value = mutation.target.getAttribute(name)
      fez.props[name] = value
      fez.onPropsChange(name, value)
      // console.log(`The [${name}] attribute was modified to [${value}].`);
    }
  }
});

