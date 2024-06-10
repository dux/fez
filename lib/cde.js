class BaseCde {
  static __objects = []
  static __once = {}

  static nodeName = 'div'

  static find(node, name) {
    return $(node).closest(`.cde-${name}`)[0].cde
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

  get cdeHtmlRoot() {
    return `BaseCde.find(this, &quot;${this.cdeName}&quot;).`
  }

  // checks if node is attached and clears all if not
  get isAttached() {
    if (this.root.parentNode) {
      return true
    } else {
      Object.keys(this.__int).forEach((key)=> {
        clearInterval(this.__int[key])
      })
      this.root.cde = null
      return false
    }
  }

  cdeRegister() {
    if (!BaseCde.__once[this.cdeName]) {
      BaseCde.__once[this.cdeName] = true
      this.once()
    }

    this.cdeRegisterStyle()
    this.cdeRegisterBindMethods()
  }

  // bind all instance method to this, to avoid calling with .bind(this)
  cdeRegisterBindMethods() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor' && typeof this[method] === 'function')

    methods.forEach(method => this[method] = this[method].bind(this))
  }

  cdeRegisterStyle() {
    const styleId = `cde-style-${this.cdeName}`

    if (!document.getElementById(styleId)) {
      let style = this.class.style
      if (style) {
        style = typeof style == 'function' ? style() : style

        if (style.includes('</style>')) {
          style = style.replace('<style', `<style id="${styleId}"`)
        } else {
          style = `<style id="${styleId}">.cde-${this.cdeName} { ${style} }</style>`
        }

        $(document.head).append(style.trim())
      }
    }
  }

  once() {}
  preload() { console.error('call $.cde static preload') }
  style() { console.error('call $.cde static style') }

  connect() {
    console.error('jQuery CDN is not connected', this.root)
  }

  html(text) {
    text = text.replaceAll('$$.', this.cdeHtmlRoot)
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
  BaseCde.__objects = BaseCde.__objects.filter(
    (el) => el.isAttached
  )
}, 10_000)

//

$.cde = (name, klass) => {
  if (!name) {
    return BaseCde
  }

  if (typeof klass != 'function') {
    node = $(name)
    const className = klass ? `.cde-${klass}` : '.cde'

    if (node[0].cde) {
      return node[0].cde
    } else {
      node = node.parents(className)[0] || console.error(`CDE error: parent node ${className} not found`)
      return node.cde
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

        newNode.setAttribute('data-cde', name);
        $(newNode).addClass(`cde cde-${name}`);

        // we need to clear html not to have duplicate
        this.innerHTML = ''

        // this is needed, because there is bug in custom dom nodes, that innerHTML is empty on big nodes
        // replaceChild is much faster than requestAnimation frame, and there is no flickering
        // plus it is easier to style native elements
        parentNode.replaceChild(newNode, this);

        const object =  new klass()
        object.cdeName = name
        object.root = newNode
        object.$root = $(newNode)
        object.attrs = attrs
        object.class = klass
        newNode.cde = object
        object.cdeRegister()
        object.connect(object.node, attrs)
        klass.__objects.push(object)
      })
    }

    disconnectedCallback() {
    }
  })
}

// $.cde('#some-node').sommeFunc(this.value)
$.fn.cde = function (e) {
  return this[0].cde
}

window.BaseCde = BaseCde

