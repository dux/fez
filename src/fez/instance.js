// HTML node builder
import parseNode from './lib/n.js'
import createTemplate from './lib/template.js'

export default class FezBase {
  // get node attributes as object
  static getProps(node, newNode) {
    let attrs = {}

    // we can directly attach props to DOM node instance
    if (node.props) {
      return node.props
    }

    // LOG(node.nodeName, node.attributes)
    for (const attr of node.attributes) {
      attrs[attr.name] = attr.value
    }

    for (const [key, val] of Object.entries(attrs)) {
      if ([':'].includes(key[0])) {
        // LOG([key, val])
        delete attrs[key]
        try {
          const newVal = new Function(`return (${val})`).bind(newNode)()
          attrs[key.replace(/[\:_]/, '')] = newVal

        } catch (e) {
          console.error(`Fez: Error evaluating attribute ${key}="${val}" for ${node.tagName}: ${e.message}`)
        }
      }
    }

    if (attrs['data-props']) {
      let data = attrs['data-props']

      if (typeof data == 'object') {
        return data
      }
      else {
        if (data[0] != '{') {
          data = decodeURIComponent(data)
        }
        try {
          attrs = JSON.parse(data)
        } catch (e) {
          console.error(`Fez: Invalid JSON in data-props for ${node.tagName}: ${e.message}`)
        }
      }
    }

    // pass props as json template
    // <script type="text/template">{...}</script>
    // <foo-bar data-json-template="true"></foo-bar>
    else if (attrs['data-json-template']) {
      const data = newNode.previousSibling?.textContent
      if (data) {
        try {
          attrs = JSON.parse(data)
          newNode.previousSibling.remove()
        } catch (e) {
          console.error(`Fez: Invalid JSON in template for ${node.tagName}: ${e.message}`)
        }
      }
    }

    return attrs
  }

  static formData(node) {
    const formNode = node.closest('form') || node.querySelector('form')
    if (!formNode) {
      Fez.log('No form found for formData()')
      return {}
    }
    const formData = new FormData(formNode)
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
    return `Fez(${this.UID}).`
    // return this.props.id ? `Fez.find("#${this.props.id}").` : `Fez.find(this, "${this.fezName}").`
  }

  // checks if node is attached and clears all if not
  get isConnected() {
    if (this.root?.isConnected) {
      return true
    } else {
      this.fezRemoveSelf()
      return false
    }
  }

  // clear all node references
  fezRemoveSelf() {
    this._setIntervalCache ||= {}
    Object.keys(this._setIntervalCache).forEach((key)=> {
      clearInterval(this._setIntervalCache[key])
    })

    if (this._eventHandlers) {
      Object.entries(this._eventHandlers).forEach(([eventName, handler]) => {
        window.removeEventListener(eventName, handler);
      });
      this._eventHandlers = {};
    }

    if (this._timeouts) {
      Object.values(this._timeouts).forEach(timeoutId => {
        clearTimeout(timeoutId);
      });
      this._timeouts = {};
    }

    this.onDestroy()
    this.onDestroy = () => {}

    if (this.root) {
      this.root.fez = undefined
    }

    this.root = undefined
  }

  // get single node property
  prop(name) {
    let v = this.oldRoot[name] || this.props[name]
    if (typeof v == 'function') {
      // if this.prop('onclick'), we want "this" to point to this.root (dom node)
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

        if (name == 'style' || !this.root[name]) {
          if (typeof value == 'string') {
            this.root.setAttribute(name, value)
          }
          else {
            this.root[name] = value
          }
        }
      }
    }
  }

  // Generic function to handle window events with automatic cleanup
  // eventName: 'resize', 'scroll', etc.
  // func: callback function to execute
  // delay: throttle delay in ms (default: 100ms)
  on(eventName, func, delay = 200) {
    this._eventHandlers = this._eventHandlers || {};
    this._timeouts = this._timeouts || {};

    if (this._eventHandlers[eventName]) {
      window.removeEventListener(eventName, this._eventHandlers[eventName]);
    }

    if (this._timeouts[eventName]) {
      clearTimeout(this._timeouts[eventName]);
    }

    let lastRun = 0;

    const doExecute = () => {
      if (!this.isConnected) {
        if (this._eventHandlers[eventName]) {
          window.removeEventListener(eventName, this._eventHandlers[eventName]);
          delete this._eventHandlers[eventName];
        }
        if (this._timeouts[eventName]) {
          clearTimeout(this._timeouts[eventName]);
          delete this._timeouts[eventName];
        }
        return false;
      }
      func.call(this);
      return true;
    };

    const handleEvent = () => {
      const now = Date.now();

      if (now - lastRun >= delay) {
        if (doExecute()) {
          lastRun = now;
        } else {
          return;
        }
      }

      // Clear previous timeout and set new one to ensure final event
      if (this._timeouts[eventName]) {
        clearTimeout(this._timeouts[eventName]);
      }

      this._timeouts[eventName] = setTimeout(() => {
        if (now > lastRun && doExecute()) {
          lastRun = Date.now();
        }
        delete this._timeouts[eventName];
      }, delay);
    };

    this._eventHandlers[eventName] = handleEvent;
    window.addEventListener(eventName, handleEvent);
  }

  // Helper function for resize events
  onResize(func, delay) {
    this.on('resize', func, delay);
    func();
  }

  // Helper function for scroll events
  onScroll(func, delay) {
    this.on('scroll', func, delay);
    func();
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

  setStyle(key, value) {
    this.root.style.setProperty(key, value);
  }

  connect() {}
  onMount() {}
  beforeRender() {}
  afterRender() {}
  onDestroy() {}
  onStateChange() {}
  onGlobalStateChange() {}
  publish = Fez.publish
  fezBlocks = {}

  parseHtml(text) {
    const base = this.fezHtmlRoot.replaceAll('"', '&quot;')

    text = text
      .replace(/([!'"\s;])fez\.(\w)/g, `$1${base}$2`)
      .replace(/>\s+</g, '><')

    return text.trim()
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
  render(template) {
    template ||= this?.class?.fezHtmlFunc

    if (!template || !this.root) return

    this.beforeRender()

    const newNode = document.createElement(this.class.nodeName || 'div')

    let renderedTpl
    if (Array.isArray(template)) {
      // array nodes this.n(...), look tabs example
      if (template[0] instanceof Node) {
        template.forEach( n => newNode.appendChild(n) )
      } else{
        renderedTpl = template.join('')
      }
    }
    else if (typeof template == 'string') {
      renderedTpl = createTemplate(template)(this)
    }
    else if (typeof template == 'function') {
      renderedTpl = template(this)
    }

    if (renderedTpl) {
      renderedTpl = renderedTpl.replace(/\s\w+="undefined"/g, '')
      newNode.innerHTML = this.parseHtml(renderedTpl)
    }

    newNode.querySelectorAll('[fez-keep]').forEach(newEl => {
      const key = newEl.getAttribute('fez-keep')
      const oldEl = this.root.querySelector(`[fez-keep="${key}"]`)

      if (oldEl) {
        // Keep the old element in place of the new one
        newEl.parentNode.replaceChild(oldEl, newEl)
      } else if (key === 'default-slot') {
        // First render - populate the slot with current root children
        Array.from(this.root.childNodes).forEach(child => newEl.appendChild(child))
      }
    })

    Fez.morphdom(this.root, newNode)

    this.renderFezPostProcess()

    this.afterRender()
  }

  renderFezPostProcess() {
    const fetchAttr = (name, func) => {
      this.root.querySelectorAll(`*[${name}]`).forEach((n)=>{
        let value = n.getAttribute(name)
        n.removeAttribute(name)
        if (value) {
          func.bind(this)(value, n)
        }
      })
    }

    // <button fez-this="button" -> this.button = node
    fetchAttr('fez-this', (value, n) => {
      (new Function('n', `this.${value} = n`)).bind(this)(n)
    })

    // <button fez-use="animate" -> this.animate(node]
    fetchAttr('fez-use', (value, n) => {
      const target = this[value]
      if (typeof target == 'function') {
        target(n)
      } else {
        console.error(`Fez error: "${value}" is not a function in ${this.fezName}`)
      }
    })

    // <button fez-class="dialog animate" -> add class "animate" after node init to trigger animation
    fetchAttr('fez-class', (value, n) => {
      let classes = value.split(/\s+/)
      let lastClass = classes.pop()
      classes.forEach((c)=> n.classList.add(c) )
      if (lastClass) {
        setTimeout(()=>{
          n.classList.add(lastClass)
        }, 300)
      }
    })

    // <input fez-bind="state.inputNode" -> this.state.inputNode will be the value of input
    fetchAttr('fez-bind', (text, n) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(n.nodeName)) {
        const value = (new Function(`return this.${text}`)).bind(this)()
        const isCb = n.type.toLowerCase() == 'checkbox'
        const eventName = ['SELECT'].includes(n.nodeName) || isCb ? 'onchange' : 'onkeyup'
        n.setAttribute(eventName, `${this.fezHtmlRoot}${text} = this.${isCb ? 'checked' : 'value'}`)
        this.val(n, value)
      } else {
        console.error(`Cant fez-bind="${text}" to ${n.nodeName} (needs INPUT, SELECT or TEXTAREA. Want to use fez-this?).`)
      }
    })

    this.root.querySelectorAll(`*[disabled]`).forEach((n)=>{
      let value = n.getAttribute('disabled')
      if (['false'].includes(value)) {
        n.removeAttribute('disabled')
      } else {
        n.setAttribute('disabled', 'true')
      }
    })
  }

  // refresh single node only
  refresh(selector) {
    alert('NEEDS FIX and remove htmlTemplate')
    if (selector) {
      const n = document.createElement('div')
      n.innerHTML = this.class.htmlTemplate
      const tpl = n.querySelector(selector).innerHTML
      this.render(selector, tpl)
    } else {
      this.render()
    }
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
      if (this.isConnected) {
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
    let children = Array.from(this.root.children)

    if (func) {
      // Create temporary container to avoid ancestor-parent errors
      const tmpContainer = document.createElement('div')
      tmpContainer.style.display = 'none'
      document.body.appendChild(tmpContainer)
      children.forEach(child => tmpContainer.appendChild(child))

      children = Array.from(tmpContainer.children).map(func)
      document.body.removeChild(tmpContainer)
    }

    return children
  }

  subscribe(channel, func) {
    Fez._subs ||= {}
    Fez._subs[channel] ||= []
    Fez._subs[channel] = Fez._subs[channel].filter((el) => el[0].isConnected)
    Fez._subs[channel].push([this, func])
  }

  // get and set root node ID
  rootId() {
    this.root.id ||= `fez_${this.UID}`
    return this.root.id
  }

  fezRegister() {
    if (this.css) {
      this.css = Fez.globalCss(this.css, {name: this.fezName, wrap: true})
    }

    if (this.class.css) {
      this.class.css = Fez.globalCss(this.class.css, {name: this.fezName})
    }

    this.state ||= this.reactiveStore()
    this.globalState = Fez.state.createProxy(this)
    this.fezRegisterBindMethods()
  }

  // bind all instance method to this, to avoid calling with .bind(this)
  fezRegisterBindMethods() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor' && typeof this[method] === 'function')

    methods.forEach(method => this[method] = this[method].bind(this))
  }

  fezHide() {
    const node = this.root
    const nodes = this.childNodes()
    const parent = this.root.parentNode

    nodes.reverse().forEach(el => parent.insertBefore(el, node.nextSibling))

    this.root.remove()
    this.root = parent
    return nodes
  }

  reactiveStore(obj, handler) {
    obj ||= {}

    handler ||= (o, k, v, oldValue) => {
      this.onStateChange(k, v, oldValue)
      this.nextTick(this.render, 'render')
    }

    handler.bind(this)

    // licence ? -> generated by ChatGPT 2024
    function createReactive(obj, handler) {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      return new Proxy(obj, {
        set(target, property, value, receiver) {
          // Get the current value of the property
          const currentValue = Reflect.get(target, property, receiver);

          // Only proceed if the new value is different from the current value
          if (currentValue !== value) {
            if (typeof value === 'object' && value !== null) {
              value = createReactive(value, handler); // Recursively make nested objects reactive
            }

            // Set the new value
            const result = Reflect.set(target, property, value, receiver);

            // Call the handler only if the value has changed
            handler(target, property, value, currentValue);

            return result;
          }

          // If the value hasn't changed, return true (indicating success) without calling the handler
          return true;
        },
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (typeof value === 'object' && value !== null) {
            return createReactive(value, handler); // Recursively make nested objects reactive
          }
          return value;
        }
      });
    }

    return createReactive(obj, handler);
  }
}
