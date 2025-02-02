// runtime scss
import Gobber from '../vendor/gobber'

// morph dom from one state to another
import { Idiomorph } from '../vendor/idiomorph'

import connect from './connect'
import compile from './compile'

const Fez = (name, klass) => {
  if (!name) {
    return FezBase
  }

  if (typeof klass != 'function') {
    return Fez.find(name, klass)
  }

  return connect(name, klass)
}

Fez._classCache = {}

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
    text = text.replace(/\:fez|\:host/, `.fez.fez-${opts.name}`)

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

Fez.info = () => {
  console.log(JSON.stringify(Fez.fastBindInfo, null, 2))
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

Fez.htmlEscape = (text) => {
  if (typeof text == 'string') {
    return text
      .replaceAll('&', "&amp;")
      .replaceAll("'", '&apos;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
  } else {
    return text
  }
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

Fez.tag = (tag, opts = {}, html = '') => {
  const json = encodeURIComponent(JSON.stringify(opts))
  return `<${tag} data-props="${json}">${html}</${tag}>`
};

Fez.head = (text) => {
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = text

  Array.from(tempDiv.childNodes).forEach(node => {
    if (node.tagName === 'SCRIPT') {
      const newScript = document.createElement('script')

      Array.from(node.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value)
      })

      if (node.textContent) {
        newScript.textContent = node.textContent
      }

      document.head.appendChild(newScript)
    } else {
      document.head.appendChild(node)
    }
  })
}

// execute function untill it returns true
Fez.untilTrue = (func, pingRate) => {
  if (!func()) {
    setTimeout(
      func,
      pingRate || 200
    )
  }
}

Fez.compile = compile

export default Fez
