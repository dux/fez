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
  // Fez component loading
  //   Fez.head({ fez: 'path/to/component.fez' })
  // Extract from nodes
  //   Fez.head(domNode)
  Fez.head = (config, callback) => {
    if (config.nodeName) {
      if (config.nodeName == "SCRIPT") {
        Fez.head({ script: config.innerText });
        config.remove();
      } else {
        config.querySelectorAll("script").forEach((n) => Fez.head(n));
        config
          .querySelectorAll("template[fez], xmp[fez], script[fez]")
          .forEach((n) => Fez.compile(n));
      }

      return;
    }

    if (typeof config !== "object" || config === null) {
      throw new Error("head requires an object parameter");
    }

    let src,
      attributes = {},
      elementType;

    // Load Fez component(s) from URL
    // Supports:
    //   - Single component: { fez: 'path/to/component.fez' }
    //   - Component list:   { fez: 'path/to/components.txt' }
    //     txt file contains one component path per line (relative to txt location or absolute if starts with /)
    if (config.fez) {
      const fezPath = config.fez;

      // If it's a txt file, load it as a component list
      if (fezPath.endsWith(".txt")) {
        Fez.fetch(fezPath).then((content) => {
          // Get base path from txt file location
          const basePath = fezPath.substring(0, fezPath.lastIndexOf("/") + 1);

          // Parse lines, filter empty lines and comments
          const lines = content
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => line && !line.startsWith("#"));

          // Load each component
          let loaded = 0;
          const total = lines.length;

          lines.forEach((line) => {
            // Determine full path
            // - If starts with /, it's absolute from root
            // - Otherwise, relative to txt file location
            let componentPath;
            if (line.startsWith("/")) {
              componentPath = line;
            } else {
              // Add .fez extension if not present
              const path = line.endsWith(".fez") ? line : line + ".fez";
              componentPath = basePath + path;
            }

            // Extract component name from path
            const name = componentPath.split("/").pop().split(".")[0];

            Fez.fetch(componentPath).then((componentContent) => {
              Fez.compile(name, componentContent);
              loaded++;
              if (loaded === total && callback) callback();
            });
          });
        });
        return;
      }

      // Single .fez component
      Fez.fetch(fezPath).then((content) => {
        const name = fezPath.split("/").pop().split(".")[0];
        Fez.compile(name, content);
        if (callback) callback();
      });
      return;
    }

    if (config.script) {
      if (config.script.includes("import ")) {
        if (callback) {
          Fez.consoleError(
            "Fez.head callback is not supported when script with import is passed (module context).",
          );
        }

        // Evaluate inline script in context in the module
        const script = document.createElement("script");
        script.type = "module";
        script.textContent = config.script;
        document.head.appendChild(script);
        requestAnimationFrame(() => script.remove());
      } else {
        try {
          new Function(config.script)();
          if (callback) callback();
        } catch (error) {
          Fez.consoleError("Error executing script:", error);
          console.log(config.script);
        }
      }
      return;
    } else if (config.js) {
      src = config.js;
      elementType = "script";
      // Copy all properties except 'js' as attributes
      for (const [key, value] of Object.entries(config)) {
        if (key !== "js" && key !== "module") {
          attributes[key] = value;
        }
      }
      // Handle module loading
      if (config.module) {
        attributes.type = "module";
      }
    } else if (config.css) {
      src = config.css;
      elementType = "link";
      attributes.rel = "stylesheet";
      // Copy all properties except 'css' as attributes
      for (const [key, value] of Object.entries(config)) {
        if (key !== "css") {
          attributes[key] = value;
        }
      }
    } else {
      throw new Error('head requires either "script", "js" or "css" property');
    }

    const existingNode = document.querySelector(
      `${elementType}[src="${src}"], ${elementType}[href="${src}"]`,
    );
    if (existingNode) {
      if (callback) callback();
      return existingNode;
    }

    const element = document.createElement(elementType);

    if (elementType === "link") {
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
        if (config.module && elementType === "script") {
          import(src)
            .then((module) => {
              window[config.module] =
                module.default || module[config.module] || module;
            })
            .catch((error) => {
              console.error(`Error importing module ${config.module}:`, error);
            });
        }
        if (callback) callback();
      };
    }

    document.head.appendChild(element);

    return element;
  };

  // Cache configuration
  const FETCH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const FETCH_CACHE_MAX_SIZE = 100;

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
  Fez.fetch = function (...args) {
    // Initialize cache if not exists
    Fez._fetchCache ||= new Map();

    let method = "GET";
    let url;
    let callback;

    // Check if first arg is HTTP method (uppercase letters)
    if (typeof args[0] === "string" && /^[A-Z]+$/.test(args[0])) {
      method = args.shift();
    }

    // URL is required
    url = args.shift();

    // Check for data/options object
    let opts = {};
    let data = null;
    if (typeof args[0] === "object") {
      data = args.shift();
    }

    // Check for callback function
    if (typeof args[0] === "function") {
      callback = args.shift();
    }

    // Handle data based on method
    if (data) {
      if (method === "GET") {
        // For GET, append data as query parameters
        const params = new URLSearchParams(data);
        url += (url.includes("?") ? "&" : "?") + params.toString();
      } else if (method === "POST") {
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

    // Check cache first (with TTL validation)
    const cached = Fez._fetchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < FETCH_CACHE_TTL) {
      Fez.consoleLog(`fetch cache hit: ${method} ${url}`);
      if (callback) {
        callback(cached.data);
        return;
      }
      return Promise.resolve(cached.data);
    }

    // Log live fetch
    Fez.consoleLog(`fetch live: ${method} ${url}`);

    // Helper to process and cache response
    const processResponse = (response) => {
      if (response.headers.get("content-type")?.includes("application/json")) {
        return response.json();
      }
      return response.text();
    };

    // Helper to store in cache with size limit
    const storeInCache = (key, data) => {
      // Enforce max cache size by removing oldest entries
      if (Fez._fetchCache.size >= FETCH_CACHE_MAX_SIZE) {
        const oldestKey = Fez._fetchCache.keys().next().value;
        Fez._fetchCache.delete(oldestKey);
      }
      Fez._fetchCache.set(key, { data, timestamp: Date.now() });
    };

    // If callback provided, execute and handle
    if (callback) {
      fetch(url, opts)
        .then(processResponse)
        .then((data) => {
          storeInCache(cacheKey, data);
          callback(data);
        })
        .catch((error) => Fez.onError("fetch", error));
      return;
    }

    // Return promise with automatic JSON parsing
    return fetch(url, opts)
      .then(processResponse)
      .then((data) => {
        storeInCache(cacheKey, data);
        return data;
      });
  };

  // Clear fetch cache (useful for testing or manual cache invalidation)
  Fez.clearFetchCache = () => {
    Fez._fetchCache?.clear();
  };

  Fez.darkenColor = (color, percent = 20) => {
    // Convert hex to RGB
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) - amt;
    const G = ((num >> 8) & 0x00ff) - amt;
    const B = (num & 0x0000ff) - amt;
    return (
      "#" +
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
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      "#" +
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
   * Escapes HTML special characters in a string
   * Also strips font-family styles (common source of XSS via CSS)
   */
  Fez.htmlEscape = (text) => {
    if (typeof text === "string") {
      return text
        .replace(/font-family\s*:\s*(?:&[^;]+;|[^;])*?;/gi, "") // Strip font-family (CSS safety)
        .replaceAll("&", "&amp;")
        .replaceAll("'", "&apos;")
        .replaceAll('"', "&quot;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }
    return text === undefined ? "" : text;
  };

  // create dom root and return it
  Fez.domRoot = (data, name = "div") => {
    if (data instanceof Node) {
      return data;
    } else {
      const root = document.createElement(name);
      root.innerHTML = data;
      return root;
    }
  };

  // add class by name to node and remove it from siblings
  Fez.activateNode = (node, klass = "active") => {
    if (!node || !node.parentElement) return;
    Array.from(node.parentElement.children).forEach((child) => {
      child.classList.remove(klass);
    });
    node.classList.add(klass);
  };

  Fez.isTrue = (val) => {
    return ["1", "true", "on"].includes(String(val).toLowerCase());
  };

  // get document unique ID
  Fez.UID = 111;
  Fez.uid = () => {
    return "fez_uid_" + (++Fez.UID).toString(32);
  };

  // get global function pointer, used to pass functions to nested or inline elements
  // <some-node :callback="${Fez.pointer(opts.callback)}" ...>
  // Pointers are automatically cleaned up after first use (one-time use by default)
  // Use Fez.pointer(func, { persist: true }) to keep the pointer
  Fez.POINTER_SEQ = 0;
  Fez.POINTER = {};
  Fez.pointer = (func, opts = {}) => {
    if (typeof func == "function") {
      const uid = ++Fez.POINTER_SEQ;

      if (opts.persist) {
        // Persistent pointer - stays until manually removed
        Fez.POINTER[uid] = func;
      } else {
        // One-time use pointer - auto-cleanup after first call
        Fez.POINTER[uid] = (...args) => {
          const result = func(...args);
          delete Fez.POINTER[uid];
          return result;
        };
      }

      return `Fez.POINTER[${uid}]`;
    }
  };

  // Manually clear all pointers (useful for testing or cleanup)
  Fez.clearPointers = () => {
    Fez.POINTER = {};
  };

  // Resolve a function from a string or function reference
  Fez.getFunction = (pointer) => {
    if (!pointer) {
      return () => {};
    } else if (typeof pointer === "function") {
      return pointer;
    } else if (typeof pointer === "string") {
      // Check if it's a function expression (arrow function or function keyword)
      // Arrow function: (args) => or args =>
      const arrowFuncPattern = /^\s*\(?\s*\w+(\s*,\s*\w+)*\s*\)?\s*=>/;
      const functionPattern = /^\s*function\s*\(/;

      if (arrowFuncPattern.test(pointer) || functionPattern.test(pointer)) {
        return new Function("return " + pointer)();
      } else if (pointer.includes(".") && !pointer.includes("(")) {
        // It's a property access like "this.focus" - return a function that calls it
        return new Function(`return function() { return ${pointer}(); }`);
      } else {
        // It's a function body
        return new Function(pointer);
      }
    }
  };

  // Execute a function when DOM is ready or immediately if already loaded
  Fez.onReady = (callback) => {
    if (document.readyState === "loading") {
      document.addEventListener(
        "DOMContentLoaded",
        () => {
          callback();
        },
        { once: true },
      );
    } else {
      callback();
    }
  };

  // get unique id from string
  Fez.fnv1 = (str) => {
    var FNV_OFFSET_BASIS, FNV_PRIME, hash, i, j, ref;
    FNV_OFFSET_BASIS = 2166136261;
    FNV_PRIME = 16777619;
    hash = FNV_OFFSET_BASIS;
    for (
      i = j = 0, ref = str.length - 1;
      0 <= ref ? j <= ref : j >= ref;
      i = 0 <= ref ? ++j : --j
    ) {
      hash ^= str.charCodeAt(i);
      hash *= FNV_PRIME;
    }
    return hash.toString(36).replaceAll("-", "");
  };

  Fez.tag = (tag, opts = {}, html = "") => {
    const json = encodeURIComponent(JSON.stringify(opts));
    return `<${tag} data-props="${json}">${html}</${tag}>`;
    // const json = JSON.stringify(opts, null, 2)
    // const data = `<script type="text/template">${json}</script><${tag} data-json-template="true">${html}</${tag}>`
    // return data
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

  // Convert any collection to pairs for loop destructuring
  // Array: ['a', 'b'] → [['a', 0], ['b', 1]] (value, index)
  // Object: {x: 1} → [['x', 1]] (key, value)
  Fez.toPairs = (c) => {
    if (Array.isArray(c)) return c.map((v, i) => [v, i]);
    if (c && typeof c === "object") return Object.entries(c);
    return [];
  };

  // Returns short type identifier for data:
  //   'o' - object, 'f' - function, 's' - string, 'a' - array, 'i' - integer, 'n' - float/number, 'u' - undefined/null
  Fez.typeof = (data) => {
    if (data === null || data === undefined) return "u";
    if (Array.isArray(data)) return "a";
    const t = typeof data;
    if (t === "function") return "f";
    if (t === "string") return "s";
    if (t === "number") return Number.isInteger(data) ? "i" : "n";
    if (t === "object") return "o";
    return t[0];
  };
};
