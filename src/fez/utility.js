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
        setTimeout(()=>script.remove(), 100)
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
}
