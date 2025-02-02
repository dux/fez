const compileToClass = (html) => {
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
    tagName.remove()
    html = tagName.innerHTML
    tagName = tagName.getAttribute('fez')
  }
  else if (typeof html != 'string') {
    document.body.querySelectorAll('template[fez]').forEach((n) => Fez.compile(n))
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
