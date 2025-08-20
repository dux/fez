// runtime scss
import Gobber from './vendor/gobber.js'

// morph dom from one state to another
import { Idiomorph } from './vendor/idiomorph.js'

import objectDump from './utils/dump.js'
import connect from './connect.js'
import compile from './compile.js'
import state from './lib/global-state.js'

// Fez('ui-slider')                             # first slider
// Fez('ui-slider', (n)=>alert(n))              # find all and execute
// Fez(this, 'ui-slider')                       # first parent ui-slider
// Fez('ui-slider', class { init() { ... }}) # create Fez dom node
const Fez = (name, klass) => {
  if(typeof name === 'number') {
    const fez = Fez.instances.get(name)
    if (fez) {
      return fez
    } else {
      Fez.error(`Instance with UID "${name}" not found.`)
    }
  }
  else if (name) {
    if (klass) {
      const isPureFn = typeof klass === 'function' && !/^\s*class/.test(klass.toString()) && !/\b(this|new)\b/.test(klass.toString())

      if (isPureFn) {
        const list = Array
          .from(document.querySelectorAll(`.fez.fez-${name}`))
          .filter( n => n.fez )

        list.forEach( el => klass(el.fez) )
        return list
      } else if (typeof klass != 'function') {
        return Fez.find(name, klass)
      } else {
        return connect(name, klass)
      }
    } else {
      const node = name.nodeName ? name.closest('.fez') : (
        document.querySelector( name.includes('#') ? name : `.fez.fez-${name}` )
      )
      if (node) {
        if (node.fez) {
          return node.fez
        } else {
          Fez.error(`node "${name}" has no Fez attached.`)
        }
      } else {
        Fez.error(`node "${name}" not found.`)
      }
    }
  } else {
    Fez.error('Fez() ?')
  }
}

Fez.classes = {}
Fez.instanceCount = 0
Fez.instances = new Map()

Fez.find = (onode, name) => {
  let node = onode

  if (typeof node == 'string') {
    node = document.body.querySelector(node)
  }

  if (typeof node.val == 'function') {
    node = node[0]
  }

  const klass = name ? `.fez.fez-${name}` : '.fez'

  const closestNode = node.closest(klass)
  if (closestNode && closestNode.fez) {
    return closestNode.fez
  } else {
    console.error('Fez node connector not found', onode, node)
  }
}

Fez.cssClass = (text) => {
  return Gobber.css(text)
}

Fez.globalCss = (cssClass, opts = {}) => {
  if (typeof cssClass === 'function') {
    cssClass = cssClass()
  }

  if (cssClass.includes(':')) {
    let text = cssClass
      .split("\n")
      .filter(line => !(/^\s*\/\//.test(line)))
      .join("\n")

    if (opts.wrap) {
      text = `:fez { ${text} }`
    }

    text = text.replace(/\:fez|\:host/, `.fez.fez-${opts.name}`)

    cssClass = Fez.cssClass(text)
  }

  document.body.parentElement.classList.add(cssClass)

  return cssClass
}

Fez.info = () => {
  console.log('Fez components:', Object.keys(Fez.classes || {}))
}

Fez.morphdom = (target, newNode, opts = {}) => {
  Array.from(target.attributes).forEach(attr => {
    newNode.setAttribute(attr.name, attr.value)
  })

  Idiomorph.morph(target, newNode, {
    morphStyle: 'outerHTML'
  })

  // remove whitespace on next node, if exists (you never want this)
  const nextSibling = target.nextSibling
  if (nextSibling?.nodeType === Node.TEXT_NODE && nextSibling.textContent.trim() === '') {
    nextSibling.remove();
  }
}

Fez.publish = (channel, ...args) => {
  Fez._subs ||= {}
  Fez._subs[channel] ||= []
  Fez._subs[channel].forEach((el) => {
    el[1].bind(el[0])(...args)
  })
}

Fez.error = (text, show) => {
  text = `Fez: ${text}`
  console.error(text)
  if (show) {
    return `<span style="border: 1px solid red; font-size: 14px; padding: 3px 7px; background: #fee; border-radius: 4px;">${text}</span>`
  }
}

Fez.log = (text) => {
  if (Fez.LOG === true) {
    text = String(text).substring(0, 180)
    console.log(`Fez: ${text}`)
  }
}

Fez.onError = (kind, message) => {
  // Ensure kind is always a string
  if (typeof kind !== 'string') {
    throw new Error('Fez.onError: kind must be a string');
  }

  console.error(`${kind}: ${message.toString()}`);
}

// work with tmp store
Fez.store = {
  store: new Map(),
  counter: 0,

  set(value) {
    const key = this.counter++;
    this.store.set(key, value);
    return key;
  },

  get(key) {
    return this.store.get(key);
  },

  delete(key) {
    const value = this.store.get(key);
    this.store.delete(key)
    return value;
  }
};

// Load utility functions
import addUtilities from './utility.js'
import cssMixin from './utils/css_mixin.js'
addUtilities(Fez)
cssMixin(Fez)

Fez.compile = compile
Fez.state = state
Fez.dump = objectDump

Fez.onReady(() => Fez.log('Fez.LOG === true, logging enabled.') )

export default Fez
