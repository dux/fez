// HTML node builder
import parseNode from './n'

export default class FezBase {
  static __objects = []

  // get node attributes as object
  static getProps(node, newNode) {
    let attrs = {}
    for (const attr of node.attributes) {
      attrs[attr.name] = attr.value
    }

    if (attrs['data-props']) {
      attrs = JSON.parse(attrs['data-props'])
    }

    // pass props as json template
    // <script type="text/template">{...}</script>
    // <foo-bar data-json-template="true"></foo-bar>
    if (attrs['data-json-template']) {
      const data = newNode.previousSibling?.textContent
      if (data) {
        attrs = JSON.parse(data)
      }
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

  static nodeName = 'div'

  // instance methods

  constructor() {}

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
      this._setIntervalCache ||= {}
      Object.keys(this._setIntervalCache).forEach((key)=> {
        clearInterval(this._setIntervalCache[key])
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
    if (! this.class.html) {
      console.error('Fez is missing "connect" method.', this.root)
    }
  }

  afterConnect() {}
  beforeRender() {}
  afterRender() {}

  parseHtml(text, context) {
    if (typeof text == 'object') {
      text = text[0]
    }

    const base = this.fezHtmlRoot.replaceAll('"', '&quot;')
    text = text
      .replaceAll('$$.', base)
      .replace(/([^\w\.])fez\./g, `$1${base}`)

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

  // pass name to have only one tick of a kind
  nextTick(func, name) {
    if (name) {
      this._nextTicks ||= {}
      this._nextTicks[name] ||= window.requestAnimationFrame(() => {
        func.bind(this)()
        this._nextTicks[name] = null
      }, name)
    } else {
      window.requestAnimationFrame(func.bind(this))
    }
  }

  // inject htmlString as innerHTML and replace $$. with local pointer
  // $$. will point to current fez instance
  // <slot></slot> will be replaced with current root
  // this.render('...loading')
  // this.render('.images', '...loading')
  render(target, body) {
    if (target === true) {
      this.nextTick(this.render, 'render')
      return
    }

    if (!target) {
      target = this?._fez_html_func
      if (!target) {
        return
      }
    }

    this.beforeRender()

    if (typeof body == 'undefined') {
      body = target
      target = this.root
    }

    if (typeof target == 'string') {
      target = this.find(target)
    }

    const newNode = document.createElement('div')

    if (typeof body === 'function') {
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
    } else if (body) {
      newNode.appendChild(body)
    }

    // if slot is defined in static html, preserve current in runtime
    const slot = newNode.querySelector('slot')
    if (slot) {
      const currentSlot = this.find('.fez-slot')
      if (currentSlot) {
        this.slot(currentSlot, slot)
      } else {
        this.slot(target, slot)
      }
    }

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

    fetchAttr('fez-bind', (text, n) => {
      const value = (new Function(`return this.${text}`)).bind(this)()
      const isCb = n.type.toLowerCase() == 'checkbox'
      const eventName = ['SELECT'].includes(n.nodeName) || isCb ? 'onchange' : 'onkeyup'
      n.setAttribute(eventName, `${this.fezHtmlRoot}${text} = this.${isCb ? 'checked' : 'value'}`)
      this.val(n, value)
    })

    this.afterRender()
  }

  refresh() {
    this.render()
  }

  // run only if node is attached, clear otherwise
  setInterval(func, tick, name) {
    if (typeof func == 'number') {
      [tick, func] = [func, tick]
    }

    name ||= Fez.fnv1(String(func))

    this._setIntervalCache ||= {}
    clearInterval(this._setIntervalCache[name])

    this._setIntervalCache[name] = setInterval(() => {
      if (this.isAttached) {
        func()
      }
    }, tick)

    return this._setIntervalCache[name]
  }

  find(selector) {
    return typeof selector == 'string' ? this.root.querySelector(selector) : selector
  }

  // get or set node value
  val(selector, data) {
    const node = this.find(selector)

    if (node) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.nodeName)) {
        if (typeof data != 'undefined') {
          if (node.type == 'checkbox') {
            node.checked = !!data
          } else {
            node.value = data
          }
        } else {
          return node.value
        }
      } else {
        if (typeof data != 'undefined') {
          node.innerHTML = data
        } else {
          return node.innerHTML
        }
      }
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
    let list = Array.from(this.root.querySelectorAll(":scope > *"))

    if (func) {
      list = list.map(func)
    }
    return list
  }

  subscribe(channel, func) {
    Fez._subs ||= {}
    Fez._subs[channel] ||= []
    Fez._subs[channel] = Fez._subs[channel].filter((el) => el[0].isAttached)
    Fez._subs[channel].push([this, func])
  }

  fezRegister() {
    if (this.css) {
      this.css = Fez.globalCss(this.css, {name: this.fezName, wrap: true})
    }

    if (this.class.css) {
      this.class.css = Fez.globalCss(this.class.css, {name: this.fezName})
    }

    this.state = this.reactiveStore()

    this.fezRegisterBindMethods()
  }

  // bind all instance method to this, to avoid calling with .bind(this)
  fezRegisterBindMethods() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor' && typeof this[method] === 'function')

    methods.forEach(method => this[method] = this[method].bind(this))
  }

  reactiveStore(obj, handler) {
    obj ||= {}

    handler ||= (o, k, v) => {
      this.render(true)
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
