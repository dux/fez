const compileToClass = (html) => {
  const result = { script: '', style: '', html: '', head: '' }
  const lines = html.split('\n')

  let currentBlock = []
  let currentType = ''

  for (var line of lines) {
    line = line.trim()
    if (line.startsWith('<script') && !result.script && currentType != 'head') {
      currentType = 'script';
    } else if (line.startsWith('<head')) { // you must use XPM tag if you want to define <head> tag
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
    } else if (line.endsWith('</head>') && currentType === 'head') {
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
    container.querySelectorAll('script').forEach(node => {
      node.type ||= 'text/javascript'
      if (!node.src && node.type.includes('javascript') ) {
        const fn = new Function(node.textContent)
        fn()
      }
    })

    document.head.innerHTML += result.head
  }

  let klass = result.script

  if (!/class\s+\{/.test(klass)) {
    klass = `class {\n${klass}\n}`
  }

  if (String(result.style).includes(':')) {
    result.style = result.style.includes(':fez') ? result.style : `:fez {\n${result.style}\n}`
    klass = klass.replace(/\}\s*$/, `\n  CSS = \`${result.style}\`\n}`)
  }

  if (/\w/.test(String(result.html))) {
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

    // Check if src attribute is defined
    const src = node.getAttribute('src')
    const fezName = node.getAttribute('fez')

    if (src) {
      // Load HTML content via AJAX from src path
      fetch(src)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to load ${src}: ${response.status}`)
          }
          return response.text()
        })
        .then(htmlContent => {
          Fez.compile(fezName, htmlContent)
        })
        .catch(error => {
          console.error(`FEZ template load error for "${fezName}": ${error.message}`)
        })
      return
    } else {
      html = node.innerHTML
      tagName = fezName
    }
  }
  else if (typeof html != 'string') {
    document.body.querySelectorAll('template[fez], xmp[fez]').forEach((n) => Fez.compile(n))
    return
  }

  let klass = compileToClass(html)
  let parts = klass.split(/class\s+\{/, 2)
  klass = `${parts[0]};\n\nwindow.Fez('${tagName}', class {\n${parts[1]})`

  // if (tagName == 'x-counter') {
  //   console.log(klass)
  // }

  try {
    new Function(klass)()
  } catch(e) {
    console.error(`FEZ template "${tagName}" compile error: ${e.message}`)
    console.log(html)
    console.log(klass)
  }
}
