// runtime scss
import Gobber from '../vendor/gobber'

// morph dom from one state to another
import { Idiomorph } from '../vendor/idiomorph'

import connect from './fez-connect'

const Fez = (name, klass) => {
  if (!name) {
    return FezBase
  }

  if (typeof klass != 'function') {
    return Fez.find(name, klass)
  }

  return connect(name, klass)
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
    text = text.replaceAll(':fez', `.fez.fez-${opts.name}`)

    if (opts.wrap) {
      text = `.fez.fez-${opts.name} { ${text} }`
    }

    cssClass = Fez.cssClass(text)
  }

  if (document.body) {
    document.body.classList.add(cssClass)
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.classList.add(cssClass)
    })
  }

  return cssClass
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
  Fez._subs ||= {}
  Fez._subs[channel] ||= []
  Fez._subs[channel].forEach((el) => {
    el[1].bind(el[0])(...args)
  })
}

  // get unique id from string
Fez.fnv1 = (str) => {
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

export default Fez
