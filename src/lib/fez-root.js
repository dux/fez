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
  Idiomorph.morph(target, newNode, { morphStyle: 'innerHTML' })

  // I tried to ignore custom DOM nodes, cant do it
  // Idiomorph.defaults.callbacks.beforeNodeMorphed = (oldNode, newNode) => {
  //   console.log('-', oldNode.outerHTML)
  //   const klass = oldNode.getAttribute ? oldNode.getAttribute('class') : null
  //   if (klass) {
  //     console.log(klass)
  //     return false
  //   }
  // }
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

Fez.tag = function(tag, opts = {}, html = '') {
  const json = encodeURIComponent(JSON.stringify(opts));
  return `<${tag} data-props="${json}">${html}</${tag}>`;
};

Fez.parseTemplate = function(html) {
  const result = { script: '', style: '', html: '' }
  const lines = html.split('\n')

  let currentBlock = []
  let currentType = ''

  for (const line of lines) {
    if (line.trim().startsWith('<script') && !result.script) {
      currentType = 'script';
    } else if (line.trim().startsWith('<style')) {
      currentType = 'style';
    } else if (line.trim().endsWith('</script>') && currentType === 'script' && !result.script) {
      result.script = currentBlock.join('\n');
      currentBlock = [];
      currentType = null;
    } else if (line.trim().endsWith('</style>') && currentType === 'style') {
      result.style = currentBlock.join('\n');
      currentBlock = [];
      currentType = null;
    } else if (currentType) {
      currentBlock.push(line);
    } else {
      result.html += line + '\n';
    }
  }

  result.html = result.html.trim();
  return result;
}

export default Fez
