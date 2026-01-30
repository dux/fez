/**
 * FezBase - Base class for all Fez components
 *
 * Provides lifecycle hooks, reactive state, DOM utilities, and template rendering
 */

import parseNode from './lib/n.js'
import createTemplate from './lib/template.js'
import { componentSubscribe, componentPublish } from './lib/pubsub.js'

export default class FezBase {

  // ===========================================================================
  // STATIC METHODS
  // ===========================================================================

  static nodeName = 'div'

  /**
   * Extract props from a DOM node's attributes
   * Handles :attr syntax for evaluated expressions and data-props JSON
   */
  static getProps(node, newNode) {
    let attrs = {}

    // Direct props attachment
    if (node.props) {
      return node.props
    }

    // Collect attributes
    for (const attr of node.attributes) {
      attrs[attr.name] = attr.value
    }

    // Evaluate :attr expressions
    for (const [key, val] of Object.entries(attrs)) {
      if ([':'].includes(key[0])) {
        delete attrs[key]
        try {
          const newVal = new Function(`return (${val})`).bind(newNode)()
          attrs[key.replace(/[\:_]/, '')] = newVal
        } catch (e) {
          Fez.onError('attr', `<${node.tagName.toLowerCase()}> Error evaluating ${key}="${val}": ${e.message}`)
        }
      }
    }

    // Handle data-props JSON
    if (attrs['data-props']) {
      let data = attrs['data-props']
      if (typeof data == 'object') {
        return data
      } else {
        if (data[0] != '{') {
          data = decodeURIComponent(data)
        }
        try {
          attrs = JSON.parse(data)
        } catch (e) {
          Fez.onError('props', `<${node.tagName.toLowerCase()}> Invalid JSON in data-props: ${e.message}`)
        }
      }
    }
    // Handle JSON template
    else if (attrs['data-json-template']) {
      const data = newNode.previousSibling?.textContent
      if (data) {
        try {
          attrs = JSON.parse(data)
          newNode.previousSibling.remove()
        } catch (e) {
          Fez.onError('props', `<${node.tagName.toLowerCase()}> Invalid JSON in template: ${e.message}`)
        }
      }
    }

    return attrs
  }

  /**
   * Get form data from closest/child form
   */
  static formData(node) {
    const formNode = node.closest('form') || node.querySelector('form')
    if (!formNode) {
      Fez.consoleLog('No form found for formData()')
      return {}
    }
    const formData = new FormData(formNode)
    const formObject = {}
    formData.forEach((value, key) => {
      formObject[key] = value
    });
    return formObject
  }

  // ===========================================================================
  // CONSTRUCTOR & CORE
  // ===========================================================================

  constructor() {}

  n = parseNode
  fezBlocks = {}

  // Store for passing values to child components (e.g., loop vars)
  fezGlobals = {
    _data: new Map(),
    _counter: 0,
    set(value) {
      const key = this._counter++
      this._data.set(key, value)
      return key
    },
    delete(key) {
      const value = this._data.get(key)
      this._data.delete(key)
      return value
    }
  }

  /**
   * Report error with component name always included
   */
  fezError(kind, message, context) {
    const name = this.fezName || this.root?.tagName?.toLowerCase() || 'unknown'
    return Fez.onError(kind, `<${name}> ${message}`, context)
  }

  /**
   * String selector for use in HTML nodes
   */
  get fezHtmlRoot() {
    return `Fez(${this.UID}).`
  }

  /**
   * Check if node is attached to DOM
   */
  get isConnected() {
    return !!this.root?.isConnected
  }

  /**
   * Get single node property
   */
  prop(name) {
    let v = this.oldRoot[name] || this.props[name]
    if (typeof v == 'function') {
      v = v.bind(this.root)
    }
    return v
  }

  // ===========================================================================
  // LIFECYCLE HOOKS
  // ===========================================================================

  connect() {}
  onMount() {}
  beforeRender() {}
  afterRender() {}
  onDestroy() {}
  onStateChange() {}
  onGlobalStateChange() {}
  onPropsChange() {}

  /**
   * Centralized destroy logic - called by MutationObserver when element is removed
   */
  fezOnDestroy() {
    // Guard against double-cleanup
    if (this._destroyed) return
    this._destroyed = true

    // Execute cleanup callbacks (intervals, observers, event listeners)
    if (this._onDestroyCallbacks) {
      this._onDestroyCallbacks.forEach(callback => {
        try {
          callback()
        } catch (e) {
          this.fezError('destroy', 'Error in cleanup callback', e)
        }
      })
      this._onDestroyCallbacks = []
    }

    // Call user's onDestroy hook
    this.onDestroy()
    this.onDestroy = () => {}

    // Clean up root references
    if (this.root) {
      this.root.fez = undefined
    }
    this.root = undefined
  }

  /**
   * Add a cleanup callback for destroy
   */
  addOnDestroy(callback) {
    this._onDestroyCallbacks = this._onDestroyCallbacks || [];
    this._onDestroyCallbacks.push(callback);
  }

  // ===========================================================================
  // RENDERING
  // ===========================================================================

  /**
   * Parse HTML and replace fez. references
   */
  fezParseHtml(text) {
    const base = this.fezHtmlRoot.replaceAll('"', '&quot;')
    text = text
      .replace(/([!'"\s;])fez\.(\w)/g, `$1${base}$2`)
      .replace(/>\s+</g, '><')
    return text.trim()
  }

  /**
   * Schedule work on next animation frame (debounced by name)
   */
  fezNextTick(func, name) {
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

  /**
   * Force a re-render on next frame
   */
  fezRefresh() {
    this.fezNextTick(() => this.fezRender(), 'refresh')
  }

  /**
   * Alias for fezRefresh - can be overwritten
   */
  refresh() {
    this.fezRefresh()
  }

  /**
   * Render the component template to DOM
   * Uses Idiomorph for efficient DOM diffing
   */
  fezRender(template) {
    // Check instance-level template first, then class-level
    template ||= this.fezHtmlFunc || this?.class?.fezHtmlFunc

    if (!template || !this.root) return

    // Prevent re-render loops from state changes in beforeRender/afterRender
    this._isRendering = true

    this.beforeRender()

    const nodeName = typeof this.class.nodeName == 'function' ? this.class.nodeName(this.root) : this.class.nodeName
    const newNode = document.createElement(nodeName || 'div')

    let renderedTpl
    if (Array.isArray(template)) {
      if (template[0] instanceof Node) {
        template.forEach(n => newNode.appendChild(n))
      } else {
        renderedTpl = template.join('')
      }
    }
    else if (typeof template == 'string') {
      const name = this.root?.tagName?.toLowerCase()
      renderedTpl = createTemplate(template, { name })(this)
    }
    else if (typeof template == 'function') {
      renderedTpl = template(this)
    }

    if (renderedTpl) {
      if (renderedTpl instanceof DocumentFragment || renderedTpl instanceof Node) {
        newNode.appendChild(renderedTpl)
      } else {
        renderedTpl = renderedTpl.replace(/\s\w+="undefined"/g, '')
        newNode.innerHTML = this.fezParseHtml(renderedTpl)
      }
    }

    this.fezKeepNode(newNode)

    // Save input values for fez-this/fez-bind bound elements before morph
    const savedInputValues = new Map()
    this.root.querySelectorAll('input, textarea, select').forEach(el => {
      if (el._fezThisName) {
        savedInputValues.set(el._fezThisName, {
          value: el.value,
          checked: el.checked
        })
      }
    })

    Fez.morphdom(this.root, newNode)

    // Restore input values after morph - find element by _fezThisName property
    savedInputValues.forEach((saved, name) => {
      let el = null
      this.root.querySelectorAll('input, textarea, select').forEach(input => {
        if (input._fezThisName === name) el = input
      })
      if (el) {
        el.value = saved.value
        if (saved.checked !== undefined) el.checked = saved.checked
      }
    })

    this.fezRenderPostProcess()
    this.afterRender()

    this._isRendering = false
  }

  /**
   * Post-render processing for fez-* attributes
   */
  fezRenderPostProcess() {
    const fetchAttr = (name, func) => {
      this.root.querySelectorAll(`*[${name}]`).forEach((n) => {
        let value = n.getAttribute(name)
        n.removeAttribute(name)
        if (value) {
          func.bind(this)(value, n)
        }
      })
    }

    // fez-this="button" -> this.button = node
    fetchAttr('fez-this', (value, n) => {
      (new Function('n', `this.${value} = n`)).bind(this)(n)
      // Mark element for value preservation on re-render
      n._fezThisName = value
    })

    // fez-use="animate" -> this.animate(node)
    fetchAttr('fez-use', (value, n) => {
      if (value.includes('=>')) {
        Fez.getFunction(value)(n)
      }
      else {
        if (value.includes('.')) {
          Fez.getFunction(value).bind(n)()
        }
        else {
          const target = this[value]
          if (typeof target == 'function') {
            target(n)
          } else {
            this.fezError('fez-use', `"${value}" is not a function`)
          }
        }
      }
    })

    // fez-class="dialog animate" -> add class after init for animation
    fetchAttr('fez-class', (value, n) => {
      let classes = value.split(/\s+/)
      let lastClass = classes.pop()
      classes.forEach((c) => n.classList.add(c))
      if (lastClass) {
        setTimeout(() => {
          n.classList.add(lastClass)
        }, 1)
      }
    })

    // fez-bind="state.inputNode" -> two-way binding
    fetchAttr('fez-bind', (text, n) => {
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(n.nodeName)) {
        const value = (new Function(`return this.${text}`)).bind(this)()
        const isCb = n.type.toLowerCase() == 'checkbox'
        const eventName = ['SELECT'].includes(n.nodeName) || isCb ? 'onchange' : 'onkeyup'
        n.setAttribute(eventName, `${this.fezHtmlRoot}${text} = this.${isCb ? 'checked' : 'value'}`)
        this.val(n, value)
        // Mark element for value preservation on re-render
        n._fezThisName = text
      } else {
        this.fezError('fez-bind', `Can't bind "${text}" to ${n.nodeName} (needs INPUT, SELECT or TEXTAREA)`)
      }
    })

    // Normalize disabled attribute
    this.root.querySelectorAll(`*[disabled]`).forEach((n) => {
      let value = n.getAttribute('disabled')
      if (['false'].includes(value)) {
        n.removeAttribute('disabled')
      } else {
        n.setAttribute('disabled', 'true')
      }
    })
  }

  /**
   * Handle fez-keep attributes for preserved nodes
   */
  fezKeepNode(newNode) {
    newNode.querySelectorAll('[fez-keep]').forEach(newEl => {
      const key = newEl.getAttribute('fez-keep')
      const isSlot = key === 'default-slot' || key.startsWith('slot-')

      let oldEl
      if (isSlot) {
        // Find slot belonging to THIS component, not nested
        const candidates = this.root.querySelectorAll(`[fez-keep="${key}"]`)
        for (const el of candidates) {
          let parent = el.parentElement
          let isNested = false
          while (parent && parent !== this.root) {
            if (parent.classList.contains('fez')) {
              isNested = true
              break
            }
            parent = parent.parentElement
          }
          if (!isNested) {
            oldEl = el
            break
          }
        }
      } else {
        oldEl = this.root.querySelector(`[fez-keep="${key}"]`)
      }

      if (oldEl) {
        // Move the old element to replace the new placeholder
        // This preserves all children including nested fez components
        newEl.parentNode.replaceChild(oldEl, newEl)
      } else if (isSlot) {
        if (newEl.getAttribute('hide')) {
          this.state = null
          const parent = newEl.parentNode
          Array.from(this.root.childNodes).forEach(child => {
            parent.insertBefore(child, newEl)
          })
          newEl.remove()
        } else {
          const children = Array.from(this.root.childNodes)
          children.forEach(child => {
            newEl.appendChild(child)
          })
        }
      }
    })
  }



  // ===========================================================================
  // REACTIVE STATE
  // ===========================================================================

  /**
   * Register component: setup CSS, state, and bind methods
   */
  fezRegister() {
    if (this.css) {
      this.css = Fez.globalCss(this.css, { name: this.fezName, wrap: true })
    }

    if (this.class.css) {
      this.class.css = Fez.globalCss(this.class.css, { name: this.fezName })
    }

    this.state ||= this.fezReactiveStore()
    this.globalState = Fez.state.createProxy(this)
    this.fezRegisterBindMethods()
  }

  /**
   * Bind all instance methods to this
   */
  fezRegisterBindMethods() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor' && typeof this[method] === 'function')
    methods.forEach(method => this[method] = this[method].bind(this))
  }

  /**
   * Create a reactive store that triggers re-renders on changes
   */
  fezReactiveStore(obj, handler) {
    obj ||= {}

    handler ||= (o, k, v, oldValue) => {
      if (v != oldValue) {
        this.onStateChange(k, v, oldValue)
        // Don't schedule re-render during init/mount or if already rendering
        if (!this._isRendering && !this._isInitializing) {
          this.fezNextTick(this.fezRender, 'fezRender')
        }
      }
    }

    handler.bind(this)

    function createReactive(obj, handler) {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      return new Proxy(obj, {
        set(target, property, value, receiver) {
          const currentValue = Reflect.get(target, property, receiver);

          if (currentValue !== value) {
            if (typeof value === 'object' && value !== null) {
              value = createReactive(value, handler);
            }

            const result = Reflect.set(target, property, value, receiver);
            handler(target, property, value, currentValue);
            return result;
          }

          return true;
        },
        get(target, property, receiver) {
          const value = Reflect.get(target, property, receiver);
          if (typeof value === 'object' && value !== null) {
            return createReactive(value, handler);
          }
          return value;
        }
      });
    }

    return createReactive(obj, handler);
  }

  // ===========================================================================
  // DOM HELPERS
  // ===========================================================================

  /**
   * Find element by selector
   */
  find(selector) {
    return typeof selector == 'string' ? this.root.querySelector(selector) : selector
  }

  /**
   * Get or set node value (input/textarea/select or innerHTML)
   */
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

  /**
   * Instance form data helper
   */
  formData(node) {
    return this.class.formData(node || this.root)
  }

  /**
   * Get or set root attribute
   */
  attr(name, value) {
    if (typeof value === 'undefined') {
      return this.root.getAttribute(name)
    } else {
      this.root.setAttribute(name, value)
      return value
    }
  }

  /**
   * Get root children as array, optionally transform
   * Returns captured children if no slot in template
   * Pass true to convert children to objects with attrs as keys, innerHTML as .html, original node as .ROOT
   */
  childNodes(func) {
    let children = this._fezChildNodes || Array.from(this.root.children)
    if (func === true) {
      children = children.map(node => {
        const obj = { html: node.innerHTML, ROOT: node }
        for (const attr of node.attributes) {
          obj[attr.name] = attr.value
        }
        return obj
      })
    } else if (func) {
      children = children.map(func)
    }
    return children
  }

  /**
   * Set CSS properties on root
   */
  setStyle(key, value) {
    if (key && typeof key == 'object') {
      Object.entries(key).forEach(([prop, val]) => {
        this.root.style.setProperty(prop, val);
      });
    } else {
      this.root.style.setProperty(key, value);
    }
  }

  /**
   * Copy props as attributes to root
   */
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
        }
        else {
          this.root[name] = value
        }
      }
    }
  }

  /**
   * Get or set root ID
   */
  rootId() {
    this.root.id ||= `fez_${this.UID}`
    return this.root.id
  }

  /**
   * Dissolve component into parent
   */
  dissolve(inNode) {
    if (inNode) {
      inNode.classList.add('fez')
      inNode.classList.add(`fez-${this.fezName}`)
      inNode.fez = this
      if (this.attr('id')) inNode.setAttribute('id', this.attr('id'))

      this.root.innerHTML = ''
      this.root.appendChild(inNode)
    }

    const node = this.root
    const nodes = this.childNodes()
    const parent = this.root.parentNode

    nodes.reverse().forEach(el => parent.insertBefore(el, node.nextSibling))

    this.root.remove()
    this.root = undefined

    if (inNode) {
      this.root = inNode
    }

    return nodes
  }

  // ===========================================================================
  // EVENTS
  // ===========================================================================

  /**
   * Add window event listener with auto-cleanup
   */
  on(eventName, func, delay = 200) {
    this._eventHandlers = this._eventHandlers || {};

    if (this._eventHandlers[eventName]) {
      window.removeEventListener(eventName, this._eventHandlers[eventName]);
    }

    const throttledFunc = Fez.throttle(() => {
      if (this.isConnected) func.call(this);
    }, delay);

    this._eventHandlers[eventName] = throttledFunc;
    window.addEventListener(eventName, throttledFunc);

    this.addOnDestroy(() => {
      window.removeEventListener(eventName, throttledFunc);
      delete this._eventHandlers[eventName];
    });
  }

  /**
   * Window resize handler
   */
  onWindowResize(func, delay) {
    this.on('resize', func, delay);
    func();
  }

  /**
   * Window scroll handler
   */
  onWindowScroll(func, delay) {
    this.on('scroll', func, delay);
    func();
  }

  /**
   * Element resize handler using ResizeObserver
   */
  onElementResize(el, func, delay = 200) {
    const throttledFunc = Fez.throttle(() => {
      if (this.isConnected) func.call(this, el.getBoundingClientRect(), el);
    }, delay);

    const observer = new ResizeObserver(throttledFunc);
    observer.observe(el);

    func.call(this, el.getBoundingClientRect(), el);

    this.addOnDestroy(() => {
      observer.disconnect();
    });
  }

  /**
   * Timeout with auto-cleanup
   */
  setTimeout(func, delay) {
    const timeoutID = setTimeout(() => {
      if (this.isConnected) func()
    }, delay)

    this.addOnDestroy(() => clearTimeout(timeoutID))

    return timeoutID
  }

  /**
   * Interval with auto-cleanup
   */
  setInterval(func, tick, name) {
    if (typeof func == 'number') {
      [tick, func] = [func, tick]
    }

    name ||= Fez.fnv1(String(func))

    this._setIntervalCache ||= {}
    clearInterval(this._setIntervalCache[name])

    const intervalID = setInterval(() => {
      if (this.isConnected) func()
    }, tick)

    this._setIntervalCache[name] = intervalID

    this.addOnDestroy(() => {
      clearInterval(intervalID);
      delete this._setIntervalCache[name];
    });

    return intervalID
  }

  // ===========================================================================
  // PUB/SUB
  // ===========================================================================

  /**
   * Publish to parent components (bubbles up through DOM)
   * @param {string} channel - Event name
   * @param {...any} args - Arguments to pass
   * @returns {boolean} True if a parent handled the event
   */
  publish(channel, ...args) {
    return componentPublish(this, channel, ...args)
  }

  /**
   * Subscribe to a channel (auto-cleanup on destroy)
   * @param {string} channel - Event name
   * @param {Function} func - Handler function
   * @returns {Function} Unsubscribe function
   */
  subscribe(channel, func) {
    const unsubscribe = componentSubscribe(this, channel, func)
    this.addOnDestroy(unsubscribe)
    return unsubscribe
  }

  // ===========================================================================
  // SLOTS
  // ===========================================================================

  /**
   * Copy child nodes natively to preserve bound events
   */
  fezSlot(source, target) {
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
}
