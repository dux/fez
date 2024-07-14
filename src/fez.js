// templating
import renderStache from './lib/stache'

// morph dom from one state to another
import { Idiomorph } from './lib/idiomorph'

// runtime scss
import Gobber from './lib/gobber'

// HTML node builder
import parseNode from './lib/n'

class FezBase {
  static __objects = []

  static find(node, name) {
    return Fez.find(node, name)
  }

  // get unique id from string
  static fnv1(str) {
    var FNV_OFFSET_BASIS, FNV_PRIME, hash, i, j, ref;
    FNV_OFFSET_BASIS = 2166136261;
    FNV_PRIME = 16777619;
    hash = FNV_OFFSET_BASIS;
    for (i = j = 0, ref = str.length - 1; (0 <= ref ? j <= ref : j >= ref); i = 0 <= ref ? ++j : --j) {
      hash ^= str.charCodeAt(i);
      hash *= FNV_PRIME;
    }
    return hash.toString(36).replaceAll('-', '');
  }

  // get node attributes as object
  static getProps(node) {
    const attrs = {}
    for (const attr of node.attributes) {
      attrs[attr.name] = attr.value
    }
    return attrs
  }

  static formData(node) {
    const formData = new FormData(node.closest('form'))
    const formObject = {}
    formData.forEach((value, key) => {
      formObject[key] = value
    });
    return formObject
  }

  static fastBind() {
    // return true to bind without requestAnimationFrame
    // you can do this if you are sure you are not expecting innerHTML data
    return false
  }

  // instance methods

  constructor() {
    this.__int = {}
  }

  n = parseNode

  // string selector for use in HTML nodes
  get fezHtmlRoot() {
    return `Fez.find(this, "${this.fezName}").`
  }

  // checks if node is attached and clears all if not
  get isAttached() {
    if (this.root?.parentNode) {
      return true
    } else {
      Object.keys(this.__int).forEach((key)=> {
        clearInterval(this.__int[key])
      })
      this.root.fez = null
      this.root = null
      return false
    }
  }

  // get single node property
  prop(name) {
    let v = this.oldRoot[name] || this.props[name]
    if (typeof v == 'function') {
      // if @prop('onclick'), we want "this" to point to this.root (dom node)
      v = v.bind(this.root)
    }
    return v
  }

  // copy attributes to root node
  copy() {
    for (const name of Array.from(arguments)) {
      let value = this.props[name]

      if (value !== undefined) {
        if (name == 'class') {
          const klass = this.root.getAttribute(name, value)

          if (klass) {
            value = [klass, value].join(' ')
          }
        }

        if (typeof value == 'string') {
          this.root.setAttribute(name, value)
        } else {
          this.root[name] = value
        }
      }
    }
  }

  // copy child nodes, natively to preserve bound events
  // if node name is SLOT insert adjacent and remove SLOT, else as a child nodes
  slot(source, target) {
    target ||= document.createElement('template')
    const isSlot = target.nodeName == 'SLOT'

    while (source.firstChild) {
      if (isSlot) {
        target.parentNode.insertBefore(source.lastChild, target.nextSibling);
      } else {
        target.appendChild(source.firstChild)
      }
    }

    if (isSlot) {
      target.parentNode.removeChild(target)
    } else {
      source.innerHTML = ''
    }

    return target
  }

  style() { console.error('call Fez static style') }

  connect() {
    console.error('Fez is missing "connect" method.', this.root)
  }

  parseHtml(text, context) {
    if (typeof text == 'object') {
      text = text[0]
    }

    text = text.replaceAll('$$.', this.fezHtmlRoot.replaceAll('"', '&quot;'))

    if (text.includes('{{')) {
      try {
        const func = renderStache(text, this)
        text = func()// .replace(/\n\s*\n/g, "\n")
      } catch(error) {
        console.error(`Fez stache template error in "${this.fezName}"`, error)
      }
    }

    return text
  }

  // inject htmlString as innerHTML and replace $$. with local pointer
  // $$. will point to current fez instance
  // <slot></slot> will be replaced with current root
  // this.html('...loading')
  // this.html('.images', '...loading')
  html(target, body) {
    if (!target) {
      target = this.class.html
    }

    if (typeof body == 'undefined') {
      body = target
      target = this.root
    }

    if (typeof target == 'string') {
      target = this.find(target)
    }

    const newNode = document.createElement('div')

    if (typeof body === 'function') {
      // this.class.html will be converted to function, and all sequential calls will use function call
      // this feature is not available on this.html(...)
      body = body()
    }

    if (Array.isArray(body)) {
      if (body[0] instanceof Node) {
        body.forEach((n)=>{
          newNode.appendChild(n)
        })
      } else {
        body = body.join('')
      }
    } else if (typeof body === 'string') {
      newNode.innerHTML = this.parseHtml(body)
    } else {
      newNode.appendChild(body)
    }

    const slot = newNode.querySelector('slot')
    if (slot) {
      this.slot(target, slot)
    }

    // old way, just replace
    // target.innerHTML = ''
    // this.slot(newNode, target)

    Fez.morphdom(target, newNode)

    const fetchAttr = (name, func) => {
      target.querySelectorAll(`*[${name}]`).forEach((n)=>{
        let value = n.getAttribute(name)
        n.removeAttribute(name)
        if (value) {
          func.bind(this)(value, n)
        }
      })
    }

    fetchAttr('fez-this', (value, n) => {
      this[value] = n
    })

    fetchAttr('fez-use', (value, n) => {
      const target = this[value]
      if (typeof target == 'function') {
        target(n)
      } else {
        console.error(`Fez error: "${value}" is not a function in ${this.fezName}`)
      }
    })

    fetchAttr('fez-class', (value) => {
      let classes = value.split(/\s+/)
      let lastClass = classes.pop()
      classes.forEach((c)=> n.classList.add(c) )
      if (lastClass) {
        setTimeout(()=>{
          n.classList.add(lastClass)
        }, 1000)
      }
    })
  }

  // run only if node is attached, clear otherwise
  setInterval(func, tick, name) {
    if (typeof func == 'number') {
      [tick, func] = [func, tick]
    }

    name ||= this.class.fnv1(String(func))

    clearInterval(this.__int[name])

    this.__int[name] = setInterval(() => {
      if (this.isAttached) {
        func()
      }
    }, tick)

    return this.__int[name]
  }

  // add css class for scss styled text
  css(text, isGlobal) {
    const className = Fez.css(text)

    if (isGlobal) {
      this.root.classList.add(className)
    }

    return className
  }

  find(selector) {
    return this.root.querySelector(selector)
  }

  val(selector, data) {
    const node = this.find('.time')

    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.nodeName)) {
      node.value = data
    } else {
      node.innerHTML = new Date()
    }
  }

  formData(node) {
    return this.class.formData(node || this.root)
  }

  // get or set attribute
  attr(name, value) {
    if (typeof value === 'undefined') {
      return this.root.getAttribute(name)
    } else {
      this.root.setAttribute(name, value)
      return value
    }
  }

  // get root node child nodes as array
  childNodes(func) {
    const list = Array.from(this.root.querySelectorAll(":scope > *"))

    if (func) {
      list.forEach(func)
    } else {
      return list
    }
  }

  subscribe(channel, func) {
    Fez._subs ||= {}
    Fez._subs[channel] ||= []
    Fez._subs[channel] = Fez._subs[channel].filter((el) => el[0].isAttached)
    Fez._subs[channel].push([this, func])
  }

  fezRegister() {
    if (this.class.css) {
      if (typeof this.class.css == 'function') {
        this.class.css = this.class.css(this)
      }

      if (this.class.css.includes(':')) {
        this.class.css = Fez.css(this.class.css)
      }
      this.root.classList.add(this.class.css)
    }

    this.fezRegisterBindMethods()
  }

  // bind all instance method to this, to avoid calling with .bind(this)
  fezRegisterBindMethods() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor' && typeof this[method] === 'function')

    methods.forEach(method => this[method] = this[method].bind(this))
  }

  reactiveStore(obj, handler) {
    handler ||= (o, k, v) => {
      window.requestAnimationFrame(()=>{
        Fez.info('reactive render')
        this.html()
      },0)
    }

    handler.bind(this)

    // licence ? -> generated by ChatGPT 2024
    function createReactive(obj, handler) {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      return new Proxy(obj, {
        set(target, property, value, receiver) {
          if (typeof value === 'object' && value !== null) {
            value = createReactive(value, handler)
          }
          const result = Reflect.set(target, property, value, receiver)
          handler(target, property, value)
          return result
        },
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver)
          if (typeof value === 'object' && value !== null) {
            return createReactive(value, handler)
          }
          return value
        }
      });
    }

    return createReactive(obj, handler);
  }

}

// clear all unnatached nodes
setInterval(() => {
  FezBase.__objects = FezBase.__objects.filter(
    (el) => el.isAttached
  )
}, 10_000)

//

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

const Fez = (name, klass) => {
  function connect() {
    const parentNode = this.parentNode
    if (parentNode) {
      const nodeName = typeof klass.nodeName == 'function' ? klass.nodeName(this) : klass.nodeName
      const newNode = document.createElement(nodeName || 'div')

      newNode.classList.add('fez')
      newNode.classList.add(`fez-${name}`)

      parentNode.replaceChild(newNode, this);

      const object =  new klass()
      object.oldRoot = this
      object.fezName = name
      object.root = newNode
      object.props = klass.getProps(this)
      object.class = klass

      // copy child nodes, natively to preserve bound events
      object.slot(this, newNode)

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

      if (klass.html) {
        if (typeof klass.html == 'function') {
          klass.html = klass.html(this)
        }
        klass.html = renderStache(klass.html, object)
        object.html()
      }

      if (object.onPropsChange) {
        observer.observe(newNode, {attributes:true})
      }
    }
  }

  function forceFastRender(n) {
    return typeof klass.fastBind === 'function' ? klass.fastBind(n) : klass.fastBind
  }

  if (!name) {
    return FezBase
  }

  if (typeof klass != 'function') {
    return Fez.find(name, klass)
  }

  customElements.define(name, class extends HTMLElement {
    connectedCallback() {
      // when we render nested fez components, and under Svelte, sometimes node innerHTML is empty, but it should not be
      // in that case, we need to wait for another tick to get content
      // this solution looks like it is not efficient, because it slow renders fez components that do not have and are not intended to have body, but by testing this looks like it is not effecting render performance
      // if you want to force fast render, add static fastBind = true or check
      if (this.firstChild || forceFastRender(this)) {
        Fez.info(`fast bind: ${name}`)
        connect.bind(this)()
      } else {
        Fez.info(`slow bind: ${name}`)
        window.requestAnimationFrame(()=>{
          connect.bind(this)()
        })
      }
    }
  })
}

Fez.find = (node, name) => {
  if (typeof node == 'string') {
    node = document.body.querySelector(node)
  }

  if (typeof node.val == 'function') {
    node = node[0]
  }

  const klass = name ? `.fez-${name}` : '.fez'

  return node.closest(klass).fez
}

Fez.globalCss = (text) => {
  const cssClass = Fez.css(text)
  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add(cssClass)
  })
  return cssClass
}

Fez.css = (text) => {
  return Gobber.css(text)
}

Fez.info = (text) => {
  if (window.DEBUG) {
    console.log(`Fez: ${text}`)
  }
}

Fez.morphdom = (target, newNode, opts = {}) => {
  if (opts.childrenOnly === undefined) {
    opts.childrenOnly = true
  }

  // Morphdom(target, newNode, opts)
  Idiomorph.morph(target, newNode, { morphStyle: 'innerHTML'})
}

Fez.htmlEscape = (text) => {
  return text
    .replaceAll("'", '&apos;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

Fez.publish = (channel, ...args) => {
  Fez._subs[channel] ||= []
  Fez._subs[channel].forEach((el) => {
    el[1].bind(el[0])(...args)
  })
}

window.Fez = Fez
window.FezBase = FezBase
