function parseBlock(data, ifStack) {
  data = data
    .replaceAll('#html', '@html')
    .replaceAll('@', 'this.')

  // Handle #if directive
  if (data.startsWith('#if') || data.startsWith('if')) {
    ifStack.push(false)
    data = data.replace(/^#?if/, '')
    return `\${ ${data} ? \``
  }
  if (data.startsWith('#block') || data.startsWith('block')) {
    const parts1 = data.split('block ', 2)
    const parts2 = data.split('block:', 2)

    if (parts1[1]) {
      return '${(this.fezBlocks.' + parts1[1] + ' = `'
    } else {
      return '${ this.fezBlocks.' + parts2[1] + ' }'
    }

  }
  else if (data == '/block') {
    return '`) && \'\'}'
  }
  else if (data.startsWith('#for') || data.startsWith('for')) {
    data = data.replace(/^#?for/, '')
    const el = data.split(' in ', 2)
    return '${' + el[1] + '.map((' + el[0] + ')=>`'
  }
  else if (data.startsWith('#each') || data.startsWith('each')) {
    data = data.replace(/^#?each/, '')
    const el = data.split(' as ', 2)
    return '${' + el[0] + '.map((' + el[1] + ')=>`'
  }
  else if (data == ':else' || data == 'else') {
    ifStack[ifStack.length - 1] = true
    return '` : `'
  }
  else if (data == '/if') {
    return ifStack.pop() ? '`}' : '` : ``}'
  }
  else if (data == '/for' || data == '/each') {
    return '`).join("")}'
  }
  else {
    const prefix = 'this.html '

    if (data.startsWith(prefix)) {
      data = data.replace(prefix, '')
    } else {
      data = `Fez.htmlEscape(${data})`
    }

    // return '${' + (returnRaw ? Fez.htmlEscape(data) : data) + '}'
    return '${' + data + '}'
  }
}

// let tpl = createTemplate(sting)
// tpl({ ... this sate ...})
export default function createTemplate(text, opts = {}) {
  const ifStack = []

  let result = text.replace(/(.?){{(.*?)}}/g, (match, prefix, content) => {
    content = content
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
    const parsedData = parseBlock(content, ifStack);

    // convert ={{ ... }} to ="{{ ... }}"
    return prefix == '=' ? `="${parsedData}"` : `${prefix}${parsedData}`
  });

  result = '`' + result + '`'

  try {
    const tplFunc = new Function(`return ${result}`)
    const outFunc = (o) => {
      try {
        return tplFunc.bind(o)()
      } catch(e) {
        const msg = `FEZ template runtime error: ${e.message}`
        console.error(msg)
        console.log(text)
        return `${msg} (check console for template info)`
      }
    }
    return outFunc
  } catch(e) {
    console.error(`FEZ template compile error: ${e.message}`)
    console.log(text.trim())
    console.log('---')
    console.log(result)
  }
}
