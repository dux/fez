// Utility functions that extend Fez
export default (Fez) => {
  // Script from URL
  //   Fez.head({ js: 'https://example.com/script.js' });
  // Script with attributes
  //   Fez.head({ js: 'https://example.com/script.js', type: 'module', async: true });
  // Script with callback
  //   Fez.head({ js: 'https://example.com/script.js' }, () => { console.log('loaded') });
  // Module loading with auto-import to window
  //   Fez.head({ js: 'https://example.com/module.js', module: 'MyModule' }); // imports and sets window.MyModule
  // CSS inclusion
  //   Fez.head({ css: 'https://example.com/styles.css' });
  // CSS with additional attributes and callback
  //   Fez.head({ css: 'https://example.com/styles.css', media: 'print' }, () => { console.log('CSS loaded') })
  // Inline script evaluation
  //   Fez.head({ script: 'console.log("Hello world")' })
  // Extract from nodes
  //   Fez.head(domNode)
  Fez.head = (config, callback) => {
    if (config.nodeName) {
      if (config.nodeName == 'SCRIPT') {
        Fez.head({script: config.innerText})
        config.remove()
      } else {
        config.querySelectorAll('script').forEach((n) => Fez.head(n) )
        config.querySelectorAll('template[fez], xmp[fez], script[fez]').forEach((n) => Fez.compile(n) )
      }

      return
    }

    if (typeof config !== 'object' || config === null) {
      throw new Error('head requires an object parameter');
    }

    let src, attributes = {}, elementType;

    if (config.script) {
      if (config.script.includes('import ')) {
        if (callback) {
          Fez.error('Fez.head callback is not supported when script with import is passed (module context).')
        }

        // Evaluate inline script in context in the module
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = config.script;
        document.head.appendChild(script);
        requestAnimationFrame(()=>script.remove())
      } else {
        try {
          new Function(config.script)();
          if (callback) callback();
        } catch (error) {
          Fez.error('Error executing script:', error);
          console.log(config.script);
        }
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

  Fez.darkenColor = (color, percent = 20) => {
    // Convert hex to RGB
    const num = parseInt(color.replace("#", ""), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) - amt
    const G = (num >> 8 & 0x00FF) - amt
    const B = (num & 0x0000FF) - amt
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
  }

  Fez.lightenColor = (color, percent = 20) => {
    // Convert hex to RGB
    const num = parseInt(color.replace("#", ""), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) + amt
    const G = (num >> 8 & 0x00FF) + amt
    const B = (num & 0x0000FF) + amt
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1)
  }

  Fez.htmlEscape = (text) => {
    if (typeof text == 'string') {
      text = text
        // .replaceAll('&', "&amp;")
        .replace(/font-family\s*:\s*(?:&[^;]+;|[^;])*?;/gi, '')
        .replaceAll("&", '&amp;')
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

  // create dom root and return it
  Fez.domRoot = (data, name = 'div') => {
    if (data instanceof Node) {
      return data
    } else {
      const root = document.createElement(name)
      root.innerHTML = data
      return root
    }
  }

  // add class by name to node and remove it from siblings
  Fez.activateNode = (node, klass = 'active') => {
    Array.from(node.parentElement.children).forEach(child => {
      child.classList.remove(klass)
    })
    node.classList.add(klass)
  }

  Fez.isTrue = (val) => {
    return ['1', 'true', 'on'].includes(String(val).toLowerCase())
  }

  // Resolve a function from a string or function reference
  Fez.getFunction = (pointer) => {
    if (!pointer) {
      return ()=>{}
    }
    else if (typeof pointer === 'function') {
      return pointer;
    }
    else if (typeof pointer === 'string') {
      // Check if it's a function expression (arrow function or function keyword)
      // Arrow function: (args) => or args =>
      const arrowFuncPattern = /^\s*\(?\s*\w+(\s*,\s*\w+)*\s*\)?\s*=>/;
      const functionPattern = /^\s*function\s*\(/;

      if (arrowFuncPattern.test(pointer) || functionPattern.test(pointer)) {
        return new Function('return ' + pointer)();
      } else if (pointer.includes('.') && !pointer.includes('(')) {
        // It's a property access like "this.focus" - return a function that calls it
        return new Function(`return function() { return ${pointer}(); }`);
      } else {
        // It's a function body
        return new Function(pointer);
      }
    }
  }

  // Execute a function when DOM is ready or immediately if already loaded
  Fez.onReady = (callback) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ()=>{
        callback()
      }, { once: true })
    } else {
      callback()
    }
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
  }

  // execute function until it returns true
  Fez.untilTrue = (func, pingRate) => {
    pingRate ||= 200

    if (!func()) {
      setTimeout(()=>{
        Fez.untilTrue(func, pingRate)
      } ,pingRate)
    }
  }

  // throttle function calls
  Fez.throttle = (func, delay = 200) => {
    let lastRun = 0;
    let timeout;

    return function(...args) {
      const now = Date.now();

      if (now - lastRun >= delay) {
        func.apply(this, args);
        lastRun = now;
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          func.apply(this, args);
          lastRun = Date.now();
        }, delay - (now - lastRun));
      }
    };
  }
}
