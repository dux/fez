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
      currentBlock.push(line);
    } else {
      result.html += line + '\n';
    }
  }

  if (result.head) {
    const container = document.createElement('div')
    container.innerHTML = result.head

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
    Object.entries(Fez._styleMacros).forEach(([key, val])=>{
      result.style = result.style.replaceAll(`:${key} `, `${val} `)
    })

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

// <template fez="ui-form">
//   <script>
//     ...
// Fez.compile()                                  # compile all
// Fez.compile(templateNode)                      # compile template node
// Fez.compile('ui-form', templateNode.innerHTML) # compile string
export default function (tagName, html) {
  if (tagName instanceof Node) {
    const node = tagName
    node.remove()

    const fezName = node.getAttribute('fez')

    // Check if fezName contains dot or slash (indicates URL)
    if (fezName && (fezName.includes('.') || fezName.includes('/'))) {
      const url = fezName

      Fez.log(`Loading from ${url}`)

      // Load HTML content via AJAX from URL
      fetch(url)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load ${url}: ${response.status}`)
          }
          return response.text()
        })
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
              Fez.compile(name, content)
            })
          } else {
            // No fez elements found, use extracted name from URL
            const name = url.split('/').pop().split('.')[0]
            Fez.compile(name, htmlContent)
          }
        })
        .catch(error => {
          console.error(`FEZ template load error for "${fezName}": ${error.message}`)
        })
      return
    } else {
      // Validate fezName format for non-URL names
      if (fezName && !fezName.includes('-')) {
        console.error(`Fez: Invalid custom element name "${fezName}". Custom element names must contain a dash (e.g., 'my-element', 'ui-button').`)
      }
      html = node.innerHTML
      tagName = fezName
    }
  }
  else if (typeof html != 'string') {
    document.body.querySelectorAll('template[fez], xmp[fez]').forEach((n) => Fez.compile(n))
    return
  }

  // Validate element name if it's not a URL
  if (tagName && !tagName.includes('-') && !tagName.includes('.') && !tagName.includes('/')) {
    console.error(`Fez: Invalid custom element name "${tagName}". Custom element names must contain a dash (e.g., 'my-element', 'ui-button').`)
  }

  let klass = compileToClass(html)
  let parts = klass.split(/class\s+\{/, 2)

  klass = `${parts[0]};\n\nwindow.Fez('${tagName}', class {\n${parts[1]})`

  try {
    new Function(klass)()
  } catch(e) {
    console.error(`FEZ template "${tagName}" compile error: ${e.message}`)
    console.log(klass)
  }
}
