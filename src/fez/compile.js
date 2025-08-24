const compileToClass = (html) => {
  const result = { script: '', style: '', html: '', head: '' }
  const lines = html.split('\n')

  let currentBlock = []
  let currentType = ''

  for (var line of lines) {
    line = line.trim()
    if (line.startsWith('<script') && !result.script && currentType != 'head') {
      currentType = 'script';
    } else if (line.startsWith('<head') && !result.script) { // you must use XMP tag if you want to define <head> tag, and it has to be first
      currentType = 'head';
    } else if (line.startsWith('<style')) {
      currentType = 'style';
    } else if (line.endsWith('</script>') && currentType === 'script' && !result.script) {
      result.script = currentBlock.join('\n');
      currentBlock = [];
      currentType = null;
    } else if (line.endsWith('</style>') && currentType === 'style') {
      result.style = currentBlock.join('\n');
      currentBlock = [];
      currentType = null;
    } else if ((line.endsWith('</head>') || line.endsWith('</header>')) && currentType === 'head') {
      result.head = currentBlock.join('\n');
      currentBlock = [];
      currentType = null;
    } else if (currentType) {
      // if (currentType == 'script' && line.startsWith('//')) {
      //   continue
      // }
      currentBlock.push(line);
    } else {
      result.html += line + '\n';
    }
  }

  if (result.head) {
    const container = Fez.domRoot(result.head)

    // Process all children of the container
    Array.from(container.children).forEach(node => {
      if (node.tagName === 'SCRIPT') {
        const script = document.createElement('script')
        // Copy all attributes
        Array.from(node.attributes).forEach(attr => {
          script.setAttribute(attr.name, attr.value)
        })
        script.type ||= 'text/javascript'

        if (node.src) {
          // External script - will load automatically
          document.head.appendChild(script)
        } else if (script.type.includes('javascript') || script.type == 'module') {
          // Inline script - set content and execute
          script.textContent = node.textContent
          document.head.appendChild(script)
        }
      } else {
        // For other elements (link, meta, etc.), just append them
        document.head.appendChild(node.cloneNode(true))
      }
    })
  }

  let klass = result.script

  if (!/class\s+\{/.test(klass)) {
    klass = `class {\n${klass}\n}`
  }

  if (String(result.style).includes(':')) {
    result.style = Fez.cssMixin(result.style)
    result.style = result.style.includes(':fez') || /(?:^|\s)body\s*\{/.test(result.style) ? result.style : `:fez {\n${result.style}\n}`
    klass = klass.replace(/\}\s*$/, `\n  CSS = \`${result.style}\`\n}`)
  }

  if (/\w/.test(String(result.html))) {
    // escape backticks in whole template block
    result.html = result.html.replaceAll('`', '&#x60;')
    result.html = result.html.replaceAll('$', '\\$')
    klass = klass.replace(/\}\s*$/, `\n  HTML = \`${result.html}\`\n}`)
  }

  return klass
}

// Handle single argument cases - compile all, compile node, or compile from URL
function compile_bulk(data) {
  if (data instanceof Node) {
    const node = data
    node.remove()

    const fezName = node.getAttribute('fez')

    // Check if fezName contains dot or slash (indicates URL)
    if (fezName && (fezName.includes('.') || fezName.includes('/'))) {
      compile_from_url(fezName)
      return
    } else {
      // Validate fezName format for non-URL names
      if (fezName && !fezName.includes('-')) {
        console.error(`Fez: Invalid custom element name "${fezName}". Custom element names must contain a dash (e.g., 'my-element', 'ui-button').`)
      }
      compile(fezName, node.innerHTML)
      return
    }
  }
  else {
    let root = data ? Fez.domRoot(data) : document.body

    root.querySelectorAll('template[fez], xmp[fez]').forEach((n) => {
      compile_bulk(n)
    })

    return
  }
}

function compile_from_url(url) {
  Fez.log(`Loading from ${url}`)

  // Load HTML content via AJAX from URL
  Fez.fetch(url)
    .then(htmlContent => {
      // Check if remote HTML has template/xmp tags with fez attribute
      const parser = new DOMParser()
      const doc = parser.parseFromString(htmlContent, 'text/html')
      const fezElements = doc.querySelectorAll('template[fez], xmp[fez]')

      if (fezElements.length > 0) {
        // Compile each found fez element
        fezElements.forEach(el => {
          const name = el.getAttribute('fez')
          if (name && !name.includes('-') && !name.includes('.') && !name.includes('/')) {
            console.error(`Fez: Invalid custom element name "${name}". Custom element names must contain a dash (e.g., 'my-element', 'ui-button').`)
          }
          const content = el.innerHTML
          compile(name, content)
        })
      } else {
        // No fez elements found, use extracted name from URL
        const name = url.split('/').pop().split('.')[0]
        compile(name, htmlContent)
      }
    })
    .catch(error => {
      console.error(`FEZ template load error for "${url}": ${error.message}`)
    })
}

// <template fez="ui-form">
//   <script>
//     ...
// Fez.compile()                                  # compile all
// Fez.compile(templateNode)                      # compile template node or string with template or xmp tags
// Fez.compile('ui-form', templateNode.innerHTML) # compile string
function compile(tagName, html) {
  // Handle single argument cases
  if (arguments.length === 1) {
    return compile_bulk(tagName)
  }

  // If html contains </xmp>, send to compile_bulk for processing
  if (html && html.includes('</xmp>')) {
    return compile_bulk(html)
  }

  // Validate element name if it's not a URL
  if (tagName && !tagName.includes('-') && !tagName.includes('.') && !tagName.includes('/')) {
    console.error(`Fez: Invalid custom element name "${tagName}". Custom element names must contain a dash (e.g., 'my-element', 'ui-button').`)
  }

  let klass = compileToClass(html)
  let parts = klass.split(/class\s+\{/, 2)

  klass = `${parts[0]};\n\nwindow.Fez('${tagName}', class {\n${parts[1]})`

  // Add tag to global hidden styles container
  if (tagName) {
    let styleContainer = document.getElementById('fez-hidden-styles')
    if (!styleContainer) {
      styleContainer = document.createElement('style')
      styleContainer.id = 'fez-hidden-styles'
      document.head.appendChild(styleContainer)
    }
    const allTags = [...Object.keys(Fez.classes), tagName].sort().join(', ')
    styleContainer.textContent = `${allTags} { display: none; }\n`
  }

  // we cant try/catch javascript modules (they use imports)
  if (klass.includes('import ')) {
    Fez.head({script: klass})

    // best we can do it inform that node did not compile, so we assume there is an error
    setTimeout(()=>{
      if (!Fez.classes[tagName]) {
        Fez.error(`Template "${tagName}" possible compile error. (can be a false positive, it imports are not loaded)`)
      }
    }, 2000)
  } else {
    try {
      new Function(klass)()
    } catch(e) {
      Fez.error(`Template "${tagName}" compile error: ${e.message}`)
      console.log(klass)
    }
  }
}

export { compile_from_url }
export default compile
