class FezBaze {
  static __objects = []
  static __once = {}

  static nodeName = 'div'

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

  // static style() { }

  constructor() {
    this.__int = {}
  }

  get fezHtmlRoot() {
    return `FezBaze.find(this, &quot;${this.fezName}&quot;).`
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

  fezRegister() {
    if (!FezBaze.__once[this.fezName]) {
      FezBaze.__once[this.fezName] = true
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
    this.$root.html(text)
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
  FezBaze.__objects = FezBaze.__objects.filter(
    (el) => el.isAttached
  )
}, 10_000)

//

Fez = (name, klass) => {
  if (!name) {
    return FezBaze
  }

  if (typeof klass != 'function') {
    node = $(name)
    const className = klass ? `.fez-${klass}` : '.fez'

    if (node[0].fez) {
      return node[0].fez
    } else {
      node = node.parents(className)[0] || console.error(`FEZ error: parent node ${className} not found`)
      return node.fez
    }
  }

  klass.preload()

  customElements.define(name, class extends HTMLElement {
    connectedCallback() {
      $(()=>{ // needs to init on document ready, or there is no innerHTML in nodes
        const parentNode = this.parentNode;

        const newNode = document.createElement(klass.nodeName);

        // copy attributes
        const attrs = {}
        for (const attr of this.attributes) {
          attrs[attr.name] = attr.value
          newNode.setAttribute(attr.name, attr.value);
        }

        // copy child nodes, natively to preserve bound events
        while (this.firstChild) {
          newNode.appendChild(this.firstChild);
        }

        newNode.setAttribute('data-fez', name);
        newNode.classList.add('fez')
        newNode.classList.add(`fez-${name}`)

        // we need to clear html not to have duplicate
        this.innerHTML = ''

        // this is needed, because there is bug in custom dom nodes, that innerHTML is empty on big nodes
        // replaceChild is much faster than requestAnimation frame, and there is no flickering
        // plus it is easier to style native elements
        parentNode.replaceChild(newNode, this);

        const object =  new klass()
        object.fezName = name
        object.root = newNode
        object.attrs = attrs
        object.class = klass

        if (window.$) {
          object.$root = $(newNode)
        }

        newNode.fez = object
        object.fezRegister()
        object.connect(object.node, attrs)
        klass.__objects.push(object)
      })
    }

    disconnectedCallback() {
    }
  })
}

window.Fez = Fez
window.FezBaze = FezBaze

