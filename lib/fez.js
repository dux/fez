class FezBase {
  static __objects = []
  static __once = {}

  static find(node, name) {
    return node.closest(`.fez-${name}`)[0].fez
  }

  static preload() { }

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
  static getAttributes(node) {
    const attrs = {}
    for (const attr of node.attributes) {
      attrs[attr.name] = attr.value
    }
    return attrs
  }

  constructor() {
    this.__int = {}
  }

  get fezHtmlRoot() {
    return `FezBase.find(this, &quot;${this.fezName}&quot;).`
  }

  // checks if node is attached and clears all if not
  get isAttached() {
    if (this.root.parentNode) {
      return true
    } else {
      Object.keys(this.__int).forEach((key)=> {
        clearInterval(this.__int[key])
      })
      this.root.fez = null
      return false
    }
  }

  // copy attributes to root node
  attrCopy() {
    for (const name of Array.from(arguments)) {
      const value = this.attr[name]
      if (value) {
        this.root.setAttribute(name, value)
      }
    }
  }

  // copy child nodes, natively to preserve bound events
  slot(source, target) {
    target ||= document.createElement('template')

    while (source.firstChild) {
      target.appendChild(source.firstChild)
    }

    source.innerHTML = ''

    return target
  }

  fezRegister() {
    if (!FezBase.__once[this.fezName]) {
      FezBase.__once[this.fezName] = true
      this.once()
    }

    this.fezRegisterStyle()
    this.fezRegisterBindMethods()
  }

  // bind all instance method to this, to avoid calling with .bind(this)
  fezRegisterBindMethods() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor' && typeof this[method] === 'function')

    methods.forEach(method => this[method] = this[method].bind(this))
  }

  fezRegisterStyle() {
    const styleId = `fez-style-${this.fezName}`

    if (!document.getElementById(styleId)) {
      let style = this.class.style
      if (style) {
        style = typeof style == 'function' ? style() : style

        if (style.includes('</style>')) {
          style = style.replace('<style', `<style id="${styleId}"`)
        } else {
          style = `<style id="${styleId}">.fez-${this.fezName} { ${style} }</style>`
        }

        $(document.head).append(style.trim())
      }
    }
  }

  once() {}
  preload() { console.error('call Fez static preload') }
  style() { console.error('call Fez static style') }

  connect() {
    console.error('jQuery CDN is not connected', this.root)
  }

  html(text) {
    text = text.replaceAll('$$.', this.fezHtmlRoot)
    this.root.innerHTML = text
  }

  // run only if node is attached, clear otherwise
  setInterval(func, tick, name) {
    name ||= this.class.fnv1(String(func))

    clearInterval(this.__int[name])

    this.__int[name] = setInterval(() => {
      if (this.isAttached) {
        func()
      }
    }, tick)

    return this.__int[name]
  }

  static formData(node) {
    const formData = new FormData(node.closest('form'))
    const formObject = {}
    formData.forEach((value, key) => {
      formObject[key] = value
    });
    return formObject
  }

  formData(node) {
    return this.class.formData(node || this.root)
  }
}

// clear all unnatached nodes
setInterval(() => {
  FezBase.__objects = FezBase.__objects.filter(
    (el) => el.isAttached
  )
}, 10_000)

//

const Fez = (name, klass) => {
  if (!name) {
    return FezBase
  }

  if (typeof klass != 'function') {
    let node = document.querySelector(name)
    const className = klass ? `.fez-${klass}` : '.fez'
    node = node.closest(className) || console.error(`FEZ error: parent node ${className} not found`)
    return node.fez
  }

  klass.preload()

  customElements.define(name, class extends HTMLElement {
    connectedCallback() {
      $(()=>{ // needs to init on document ready, or there is no innerHTML in nodes
        const parentNode = this.parentNode;
        const nodeName = typeof klass.nodeName == 'function' ? klass.nodeName(this) : klass.nodeName
        const newNode = document.createElement(nodeName || 'div')

        newNode.setAttribute('data-fez', name);
        newNode.classList.add('fez')
        newNode.classList.add(`fez-${name}`)

        // this is needed, because there is bug in custom dom nodes, that innerHTML is empty on big nodes
        // replaceChild is much faster than requestAnimation frame, and there is no flickering
        // plus it is easier to style native elements
        parentNode.replaceChild(newNode, this);

        const object =  new klass()
        object.fezName = name
        object.root = newNode
        object.attrs = object.attr = klass.getAttributes(this)
        object.class = klass

        // copy child nodes, natively to preserve bound events
        object.slot(this, newNode)

        newNode.fez = object

        if (window.$) {
          object.$root = $(newNode)
        }

        if (object.attrs.id) {
          newNode.setAttribute('id', object.attrs.id)
        }

        object.fezRegister()
        object.connect(object.node, object.attrs)
        klass.__objects.push(object)
      })
    }

    disconnectedCallback() {
    }
  })
}

window.Fez = Fez
window.FezBase = FezBase

