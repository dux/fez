// runtime scss
import Gobber from './vendor/gobber.js'

// morph dom from one state to another
import { Idiomorph } from './vendor/idiomorph.js'

import connect from './connect.js'
import compile from './compile.js'

// Fez('ui-slider')                             # first slider
// Fez('ui-slider', (n)=>alert(n))              # find all and execute
// Fez(this, 'ui-slider')                       # first parent ui-slider
// Fez('ui-slider', class { init() { ... }}) # create Fez dom node
const Fez = (name, klass) => {
  if(typeof name === 'number') {
    const fez = Fez.instances[name]
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
    return FezBase
  }
}

Fez.classes = {}
Fez.instanceCount = 0
Fez.instances = {}

Fez.id = () => {
  Fez._id_count ||= 0
  Fez._id_count += 1
  const rand = Math.random().toString(36).substring(2, 6)
  return `fez_${Fez._id_count}${rand}`
}

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

  if (document.body) {
    document.body.parentElement.classList.add(cssClass)
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      document.body.parentElement.classList.add(cssClass)
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
    text = text
      // .replaceAll('&', "&amp;")
      .replace(/font-family\s*:\s*(?:&[^;]+;|[^;])*?;/gi, '')
      .replaceAll("'", '&apos;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      // .replaceAll('@', '&#64;') // needed for template escaping

    return text
  } else {
    return text === undefined ? '' : text
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
  // const json = JSON.stringify(opts, null, 2)
  // const data = `<script type="text/template">${json}</script><${tag} data-json-template="true">${html}</${tag}>`
  // return data
};

Fez.error = (text, show) => {
  text = `Fez: ${text}`
  console.error(text)
  if (show) {
    return `<span style="border: 1px solid red; font-size: 14px; padding: 3px 7px; background: #fee; border-radius: 4px;">${text}</span>`
  }
}
Fez.log = (text) => {
  if (Fez.LOG === true) {
    console.log(`Fez: ${text}`)
  }
}
document.addEventListener('DOMContentLoaded', () => {
  Fez.log('Fez.LOG === true, logging enabled.')
})

// execute function until it returns true
Fez.untilTrue = (func, pingRate) => {
  pingRate ||= 200

  if (!func()) {
    setTimeout(()=>{
      Fez.untilTrue(func, pingRate)
    } ,pingRate)
  }
}

// Script from URL
//   head({ js: 'https://example.com/script.js' });
// Script with attributes
//   head({ js: 'https://example.com/script.js', type: 'module', async: true });
// Script with callback
//   head({ js: 'https://example.com/script.js' }, () => { console.log('loaded') });
// Module loading with auto-import to window
//   head({ js: 'https://example.com/module.js', module: 'MyModule' }); // imports and sets window.MyModule
// CSS inclusion
//   head({ css: 'https://example.com/styles.css' });
// CSS with additional attributes and callback
//   head({ css: 'https://example.com/styles.css', media: 'print' }, () => { console.log('CSS loaded') })
// Inline script evaluation
//   head({ script: 'console.log("Hello world")' })
Fez.head = (config, callback) => {
  if (typeof config !== 'object' || config === null) {
    throw new Error('head requires an object parameter');
  }

  let src, attributes = {}, elementType;

  if (config.script) {
    // Evaluate inline script using new Function
    try {
      new Function(config.script)();
      if (callback) callback();
    } catch (error) {
      console.error('Error executing script:', error);
    }
    return;
  } else if (config.js) {
    src = config.js;
    elementType = 'script';
    // Copy all properties except 'js' as attributes
    for (const [key, value] of Object.entries(config)) {
      if (key !== 'js' && key !== 'module') {
        attributes[key] = value;
      }
    }
    // Handle module loading
    if (config.module) {
      attributes.type = 'module';
    }
  } else if (config.css) {
    src = config.css;
    elementType = 'link';
    attributes.rel = 'stylesheet';
    // Copy all properties except 'css' as attributes
    for (const [key, value] of Object.entries(config)) {
      if (key !== 'css') {
        attributes[key] = value;
      }
    }
  } else {
    throw new Error('head requires either "script", "js" or "css" property');
  }

  const existingNode = document.querySelector(`${elementType}[src="${src}"], ${elementType}[href="${src}"]`);
  if (existingNode) {
    if (callback) callback();
    return existingNode;
  }

  const element = document.createElement(elementType);

  if (elementType === 'link') {
    element.href = src;
  } else {
    element.src = src;
  }

  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, value);
  }

  if (callback || config.module) {
    element.onload = () => {
      // If module name is provided, import it and assign to window
      if (config.module && elementType === 'script') {
        import(src).then(module => {
          window[config.module] = module.default || module[config.module] || module;
        }).catch(error => {
          console.error(`Error importing module ${config.module}:`, error);
        });
      }
      if (callback) callback();
    };
  }

  document.head.appendChild(element);

  return element;
}

// Fetch wrapper with automatic caching and data handling
// Usage:
//   Fez.fetch(url) - GET request (default)
//   Fez.fetch(url, callback) - GET with callback
//   Fez.fetch(url, data) - GET with query params (?foo=bar&baz=qux)
//   Fez.fetch(url, data, callback) - GET with query params and callback
//   Fez.fetch('POST', url, data) - POST with FormData body (multipart/form-data)
//   Fez.fetch('POST', url, data, callback) - POST with FormData and callback
// Data object is automatically converted:
//   - GET: appended as URL query parameters
//   - POST: sent as FormData (multipart/form-data) without custom headers
Fez.fetch = function(...args) {
  // Initialize cache if not exists
  Fez._fetchCache ||= {};

  let method = 'GET';
  let url;
  let callback;

  // Check if first arg is HTTP method (uppercase letters)
  if (typeof args[0] === 'string' && /^[A-Z]+$/.test(args[0])) {
    method = args.shift();
  }

  // URL is required
  url = args.shift();

  // Check for data/options object
  let opts = {};
  let data = null;
  if (typeof args[0] === 'object') {
    data = args.shift();
  }

  // Check for callback function
  if (typeof args[0] === 'function') {
    callback = args.shift();
  }

  // Handle data based on method
  if (data) {
    if (method === 'GET') {
      // For GET, append data as query parameters
      const params = new URLSearchParams(data);
      url += (url.includes('?') ? '&' : '?') + params.toString();
    } else if (method === 'POST') {
      // For POST, convert to FormData
      const formData = new FormData();
      for (const [key, value] of Object.entries(data)) {
        formData.append(key, value);
      }
      opts.body = formData;
    }
  }

  // Set method
  opts.method = method;

  // Create cache key from method, url, and stringified opts
  const cacheKey = `${method}:${url}:${JSON.stringify(opts)}`;

  // Check cache first
  if (Fez._fetchCache[cacheKey]) {
    const cachedData = Fez._fetchCache[cacheKey];
    Fez.log(`fetch cache hit: ${method} ${url}`);
    if (callback) {
      callback(cachedData);
      return;
    }
    return Promise.resolve(cachedData);
  }

  // Log live fetch
  Fez.log(`fetch live: ${method} ${url}`);

  // Helper to process and cache response
  const processResponse = (response) => {
    if (response.headers.get('content-type')?.includes('application/json')) {
      return response.json();
    }
    return response.text();
  };

  // If callback provided, execute and handle
  if (callback) {
    fetch(url, opts)
      .then(processResponse)
      .then(data => {
        Fez._fetchCache[cacheKey] = data;
        callback(data);
      })
      .catch(error => Fez.onError('fetch', error));
    return;
  }

  // Return promise with automatic JSON parsing
  return fetch(url, opts)
    .then(processResponse)
    .then(data => {
      Fez._fetchCache[cacheKey] = data;
      return data;
    });
}

Fez.onError = (kind, message) => {
  // Ensure kind is always a string
  if (typeof kind !== 'string') {
    throw new Error('Fez.onError: kind must be a string');
  }

  console.error(`${kind}: ${message.toString()}`);
}

// define custom style macro
// Fez.styleMacro('mobile', '@media (max-width:  768px)')
// :mobile { ... } -> @media (max-width:  768px) { ... }
Fez._styleMacros = {}
Fez.styleMacro = (name, content) => {
  Fez._styleMacros[name] = content
}

Fez.compile = compile

export default Fez
