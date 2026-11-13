import { htmlAttr, styleProp } from './attrs.js';
import evaluate from './evaluate.js';
import { request, param } from './request.js';

// Append <head> block HTML to document.head. Scripts are recreated so they run.
function appendHeadHtml(html) {
  const container = document.createElement('div');
  container.innerHTML = html;
  for (const node of Array.from(container.children)) {
    if (node.tagName !== 'SCRIPT') {
      document.head.appendChild(node);
      continue;
    }
    const script = document.createElement('script');
    for (const attr of node.attributes) {
      script.setAttribute(attr.name, attr.value);
    }
    script.type ||= 'text/javascript';
    if (node.src) {
      document.head.appendChild(script);
    } else if (script.type.includes('javascript') || script.type === 'module') {
      // inline code of the component's own <head> block: allowed by the page nonce
      const nonce = globalThis.Fez?.nonce();
      if (nonce) {
        script.nonce = nonce;
      }
      script.textContent = node.textContent;
      document.head.appendChild(script);
    }
  }
}

// Utility functions that extend Fez
export default (Fez) => {
  // Nonce of the page's Content-Security-Policy ('' without one), for the
  // scripts fez inserts. Browsers hide the nonce attribute once the page is
  // loaded, the nonce property keeps it: src/fez.js reads it from the script
  // that loaded fez, else any nonced script on the page.
  Fez.nonce = () => {
    if (Fez._nonce === undefined && typeof document !== 'undefined') {
      Fez._nonce = document.querySelector('script[nonce]')?.nonce || undefined;
    }
    return Fez._nonce || '';
  };

  // Run inline JS without eval: a <script> carrying the page nonce, so a
  // Content-Security-Policy without 'unsafe-inline' / 'unsafe-eval' allows it.
  // The code runs in a function scope, like the new Function it replaces:
  // top-level declarations stay local and `return` works.
  Fez.runScript = (code) => {
    const script = document.createElement('script');
    if (Fez.nonce()) {
      script.nonce = Fez.nonce();
    }
    script.textContent = `(function () {\n${code}\n})();`;
    document.head.appendChild(script);
    script.remove();
  };

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
  // Fez component loading
  //   Fez.head({ fez: 'path/to/component.fez' })
  // Extract from nodes
  //   Fez.head(domNode)
  Fez.head = (config, callback) => {
    // a component's <head> block: its HTML, appended to document.head
    if (typeof config === 'string') {
      appendHeadHtml(config);
      return;
    }

    if (config.nodeName) {
      if (config.nodeName === 'SCRIPT') {
        Fez.head({ script: config.innerText });
        config.remove();
      } else {
        config.querySelectorAll('script').forEach((n) => Fez.head(n));
        config
          .querySelectorAll('template[fez], xmp[fez], script[fez]')
          .forEach((n) => Fez.compile(n));
      }

      return;
    }

    if (typeof config !== 'object' || config === null) {
      throw new Error('head requires an object parameter');
    }

    let src, elementType;
    const attributes = {};

    // Load Fez component(s) from URL
    // Supports:
    //   - Single component: { fez: 'path/to/component.fez' }
    //   - Component list:   { fez: 'path/to/components.txt' }
    //     txt file contains one component path per line (relative to txt location or absolute if starts with /)
    if (config.fez) {
      const fezPath = config.fez;

      // If it's a txt file, load it as a component list
      if (fezPath.endsWith('.txt')) {
        Fez.fetch(fezPath)
          .then((content) => {
            // Get base path from txt file location
            const basePath = fezPath.substring(0, fezPath.lastIndexOf('/') + 1);

            // Parse lines, filter empty lines and comments
            const lines = content
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line && !line.startsWith('#'));

            // Load each component; one failure must not stop the others nor
            // leave the callback waiting forever.
            const loads = lines.map((line) => {
              const path = line.endsWith('.fez') ? line : line + '.fez';
              const componentPath = path.startsWith('/') ? path : basePath + path;

              const name = Fez.nameFromPath(componentPath);
              return Fez.fetch(componentPath)
                .then((componentContent) => Fez.compile(name, componentContent))
                .catch((error) =>
                  Fez.onError('compile', `Load error for "${componentPath}": ${error.message}`),
                );
            });

            Promise.all(loads).then(() => {
              if (callback) {
                callback();
              }
            });
          })
          .catch((error) => {
            Fez.onError('compile', `Load error for "${fezPath}": ${error.message}`);
            if (callback) {
              callback(error);
            }
          });
        return;
      }

      // Single .fez component
      const name = Fez.nameFromPath(fezPath);
      Fez.fetch(fezPath)
        .then((content) => {
          Fez.compile(name, content);
          if (callback) {
            callback();
          }
        })
        .catch((error) => {
          Fez.onError('compile', `Load error for "${fezPath}": ${error.message}`);
          if (callback) {
            callback(error);
          }
        });
      return;
    }

    if (config.script) {
      if (config.script.includes('import ')) {
        // Inline module scripts never fire load/error, so evaluate the source
        // through a blob URL and let the dynamic import resolve after the
        // module's import graph has run.
        const blobUrl = URL.createObjectURL(new Blob([config.script], { type: 'text/javascript' }));
        import(/* webpackIgnore: true */ blobUrl)
          .then(() => {
            URL.revokeObjectURL(blobUrl);
            if (callback) {
              callback(null);
            }
          })
          .catch((error) => {
            URL.revokeObjectURL(blobUrl);
            if (callback) {
              callback(error);
            }
          });
      } else {
        Fez.runScript(config.script);
        if (callback) {
          callback();
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

    // Import the module's default/namespace onto window[config.module]. Runs on
    // a fresh load and on a cache hit (the tag may already be loaded, but the
    // window binding would otherwise never be set).
    const assignModule = () => {
      if (config.module && elementType === 'script') {
        import(src)
          .then((module) => {
            window[config.module] = module.default || module[config.module] || module;
          })
          .catch((error) => {
            console.error(`Error importing module ${config.module}:`, error);
          });
      }
    };

    // Match by attribute value instead of interpolating src into a selector -
    // a URL containing a quote would otherwise throw inside querySelector.
    const attrName = elementType === 'link' ? 'href' : 'src';
    const existingNode = Array.from(document.querySelectorAll(elementType)).find(
      (n) => n.getAttribute(attrName) === src || n[attrName] === src,
    );
    if (existingNode) {
      assignModule();
      if (callback) {
        callback();
      }
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
        assignModule();
        if (callback) {
          callback();
        }
      };
    }

    document.head.appendChild(element);

    return element;
  };

  Fez.request = request;
  Fez.param = param;

  // Throwing, cached sugar over Fez.request (see lib/request.js):
  //   Fez.fetch(url)                          GET, cached 5 minutes, resolves the parsed body
  //   Fez.fetch(url, data)                    GET with query params (?foo=bar&baz=qux)
  //   Fez.fetch(url, data?, callback)         callback form; errors go to Fez.onError
  //   Fez.fetch('POST', url, data, callback?) POST, never cached
  // An error status, network failure or timeout rejects (or reports through Fez.onError).
  Fez.fetch = function (...args) {
    const method = typeof args[0] === 'string' && /^[A-Z]+$/.test(args[0]) ? args.shift() : 'GET';
    const url = args.shift();
    const data = typeof args[0] === 'object' ? args.shift() : undefined;
    const callback = typeof args[0] === 'function' ? args[0] : null;

    Fez.consoleLog(`fetch ${method} ${url}`);
    const result = Fez.request({ method, url, data, cache: method === 'GET' ? 300 : 0 }).then((res) => {
      if (!res.ok) {
        const why = res.error || `${res.status} ${res.statusText}`.trim();
        throw new Error(`${why} for ${method} ${url}`);
      }
      return res.data;
    });

    if (callback) {
      result.then(callback).catch((error) => Fez.onError('fetch', error));
      return;
    }
    return result;
  };

  Fez.darkenColor = (color, percent = 20) => {
    // Convert hex to RGB
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  };

  Fez.lightenColor = (color, percent = 20) => {
    // Convert hex to RGB
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  };

  /**
   * Escapes HTML special characters of any value as text; null and
   * undefined render nothing
   */
  Fez.htmlEscape = (text) => {
    if (text == null) {
      return '';
    }
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll("'", '&apos;')
      .replaceAll('"', '&quot;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  };

  // `name={expr}` in a template: the whole attribute, or '' to drop it
  Fez.htmlAttr = (name, value) => htmlAttr(name, value, Fez.htmlEscape);
  Fez.styleProp = styleProp;

  // Escape a value for a quoted JS string inside handler code, so a quote in
  // the data cannot end the string: onclick="fez.rm('{id}')"
  Fez.jsEscape = (value) => {
    if (value == null) {
      return '';
    }
    return JSON.stringify(String(value)).slice(1, -1).replace(/['`$]/g, '\\$&');
  };

  // create dom root and return it
  Fez.domRoot = (data, name = 'div') => {
    if (data instanceof Node) {
      return data;
    } else {
      const root = document.createElement(name);
      root.innerHTML = data;
      return root;
    }
  };

  // add class by name to node and remove it from siblings
  Fez.activateNode = (node, klass = 'active') => {
    if (!node || !node.parentElement) {
      return;
    }
    Array.from(node.parentElement.children).forEach((child) => {
      child.classList.remove(klass);
    });
    node.classList.add(klass);
  };

  Fez.isTrue = (val) => {
    return ['1', 'true', 'on'].includes(String(val).toLowerCase());
  };

  // public utility - do not remove
  Fez.uid = (() => {
    let seq = 111;
    return () => 'fez_uid_' + (++seq).toString(32);
  })();

  // get global function pointer, used to pass functions to nested or inline elements
  // <some-node :callback="${Fez.pointer(opts.callback)}" ...>
  // Pointers are automatically cleaned up after first use (one-time use by default)
  // Use Fez.pointer(func, { persist: true }) to keep the pointer
  Fez.POINTER_SEQ = 0;
  Fez.POINTER = {};
  Fez.POINTER_CREATED = {};
  Fez.pointer = (func, opts = {}) => {
    if (typeof func === 'function') {
      const uid = ++Fez.POINTER_SEQ;

      if (opts.persist) {
        Fez.POINTER[uid] = func;
      } else {
        Fez.POINTER_CREATED[uid] = Date.now();
        Fez.POINTER[uid] = (...args) => {
          const result = func(...args);
          delete Fez.POINTER[uid];
          delete Fez.POINTER_CREATED[uid];
          return result;
        };
      }

      return `Fez.POINTER[${uid}]`;
    }
  };

  // Sweep stale one-time pointers older than 5 minutes
  Fez.sweepPointers = () => {
    const cutoff = Date.now() - 5 * 60 * 1000;
    for (const uid of Object.keys(Fez.POINTER_CREATED)) {
      if (Fez.POINTER_CREATED[uid] < cutoff) {
        delete Fez.POINTER[uid];
        delete Fez.POINTER_CREATED[uid];
      }
    }
  };
  if (typeof document !== 'undefined') {
    setInterval(Fez.sweepPointers, 60 * 1000);
  }

  // Resolve a function from a string or function reference
  Fez.getFunction = (pointer) => {
    if (!pointer) {
      return () => {};
    } else if (typeof pointer === 'function') {
      return pointer;
    } else if (typeof pointer === 'string') {
      // Check if it's a function expression (arrow function or function keyword)
      // Arrow function: (args) => or args =>
      const arrowFuncPattern = /^\s*(?:async\s*)?(?:\([^)]*\)|\w+)\s*=>/;
      const functionPattern = /^\s*function\s*\(/;

      if (arrowFuncPattern.test(pointer) || functionPattern.test(pointer)) {
        return evaluate('Fez.getFunction(string)', 'return ' + pointer)();
      } else if (pointer.includes('.') && !pointer.includes('(')) {
        // It's a property access like "this.focus" - return a function that calls it
        return evaluate('Fez.getFunction(string)', `return function() { return ${pointer}(); }`);
      } else {
        // It's a function body
        return evaluate('Fez.getFunction(string)', pointer);
      }
    }
    // Truthy but not a function or string (object/array): nothing callable
    return () => {};
  };

  // Execute a function when DOM is ready, or immediately if already loaded or
  // if there is no DOM at all (Node/SSR import)
  Fez.onReady = (callback) => {
    if (typeof document === 'undefined') {
      callback();
    } else if (document.readyState === 'loading') {
      document.addEventListener(
        'DOMContentLoaded',
        () => {
          callback();
        },
        { once: true },
      );
    } else {
      callback();
    }
  };

  // get unique id from string (32-bit FNV-1; Math.imul keeps the multiply in
  // 32-bit range so the hash does not lose precision as a float)
  Fez.fnv1 = (str) => {
    let hash = 2166136261;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(36);
  };

  // Component name from a URL/path: drop query/hash, directory and the final
  // extension. `my.component.fez` -> `my.component` (split('.')[0] would give
  // `my`).
  Fez.nameFromPath = (url) => {
    const clean = String(url).split(/[?#]/)[0];
    const base = clean.split('/').pop() || '';
    return base.replace(/\.[^.]*$/, '');
  };

  // execute function until it returns true
  Fez.untilTrue = (func, pingRate) => {
    pingRate ||= 200;

    if (!func()) {
      setTimeout(() => {
        Fez.untilTrue(func, pingRate);
      }, pingRate);
    }
  };

  // Default throttle delay in ms
  const DEFAULT_THROTTLE_DELAY = 200;

  // throttle function calls
  Fez.throttle = (func, delay = DEFAULT_THROTTLE_DELAY) => {
    let lastRun = 0;
    let timeout;

    return function (...args) {
      const now = Date.now();

      if (now - lastRun >= delay) {
        func.apply(this, args);
        lastRun = now;
      } else {
        clearTimeout(timeout);
        timeout = setTimeout(
          () => {
            func.apply(this, args);
            lastRun = Date.now();
          },
          delay - (now - lastRun),
        );
      }
    };
  };

  // Enhanced truthiness check for template conditionals (#if, #unless)
  // Empty arrays and empty objects are falsy, everything else uses standard JS truthiness
  Fez.isTruthy = (v) => {
    if (Array.isArray(v)) {
      return v.length > 0;
    }
    if (v && typeof v === 'object') {
      return Object.keys(v).length > 0;
    }
    return !!v;
  };

  // Convert any collection to pairs for loop destructuring
  // Array: ['a', 'b'] → [['a', 0], ['b', 1]] (value, index)
  // Object: {x: 1} → [['x', 1]] (key, value)
  Fez.toPairs = (c) => {
    if (Array.isArray(c)) {
      return c.map((v, i) => [v, i]);
    }
    if (c && typeof c === 'object') {
      return Object.entries(c);
    }
    return [];
  };

  // public utility - do not remove
  Fez.tag = (tag, opts = {}, html = '') => {
    const json = encodeURIComponent(JSON.stringify(opts));
    return `<${tag} data-props="${json}">${html}</${tag}>`;
  };

  // public utility - do not remove
  Fez.typeof = (data) => {
    if (data === null || data === undefined) {
      return 'u';
    }
    if (Array.isArray(data)) {
      return 'a';
    }
    const t = typeof data;
    if (t === 'function') {
      return 'f';
    }
    if (t === 'string') {
      return 's';
    }
    if (t === 'number') {
      return Number.isInteger(data) ? 'i' : 'n';
    }
    if (t === 'object') {
      return 'o';
    }
    return t[0];
  };
};
