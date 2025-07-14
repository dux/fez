function parseBlock(data, ifStack) {
  data = data
    .replaceAll('#raw', '@html')
    .replaceAll('#html', '@html')

  // Handle #if directive
  if (data.startsWith('#if') || data.startsWith('if')) {
    ifStack.push(false)
    data = data.replace(/^#?if/, '')
    return `\${ ${data} ? \``
  }
  else if (data.startsWith('#unless') || data.startsWith('unless')) {
    ifStack.push(false)
    data = data.replace(/^#?unless/, '')
    return `\${ !(${data}) ? \``
  }
  else if (data.startsWith('#block') || data.startsWith('block')) {
    // do not use, but supported
    // {{#block avatar}}
    //   <img ... />
    // {{/block}}
    // {{#block:avatar}}
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
  else if (data == '/if' || data == '/unless') {
    return ifStack.pop() ? '`}' : '` : ``}'
  }
  else if (data == '/for' || data == '/each') {
    return '`).join("")}'
  }
  else {
    const prefix = '@html '

    if (data.startsWith(prefix)) {
      data = data.replace(prefix, '')
    } else {
      data = `Fez.htmlEscape(${data})`
    }

    // return '${' + (returnRaw ? Fez.htmlEscape(data) : data) + '}'
    return '${' + data + '}'
  }
}

// let tpl = createTemplate(string)
// tpl({ ... this state ...})
export default function createTemplate(text, opts = {}) {
  const ifStack = []

  // some templating engines, as GoLangs use {{ for templates. Allow usage of [[ for fez
  text = text
    .replaceAll('[[', '{{')
    .replaceAll(']]', '}}')

  // {{#for el in list }}}}
  //   <ui-comment :comment="el"></ui-comment>
  //   -> :comment="{{ JSON.stringify(el) }}"
  text = text.replace(/:(\w+)="([\w\.\[\]]+)"/, (_, m1, m2) => { return `:${m1}="{{ JSON.stringify(${m2}) }}"` })

  let result = text.replace(/{{(.*?)}}/g, (match, content) => {
    content = content.replaceAll('&#x60;', '`')

    content = content
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
    const parsedData = parseBlock(content, ifStack);

    // return prefix == '=' ? `="${parsedData}"` : `${prefix}${parsedData}`
    return parsedData
  });

  result = '`' + result.trim() + '`'

  const funcBody = `
    const fez = this;

    // Use with statement to make all properties available as variables
    with (this) {
      return ${result}
    }
  `;

  try {
    const tplFunc = new Function(funcBody);
    const outFunc = (o) => {
      try {
        return tplFunc.bind(o)()
      } catch(e) {
        e.message = `FEZ template runtime error: ${e.message}\n\nTemplate source: ${text}`
        console.error(e)
      }
    }
    return outFunc
  } catch(e) {
    e.message = `FEZ template compile error: ${e.message}Template source:\n${text.trim()}\n\nCompile result (produced invalid JS):\nnew Function(${result})\n`
    console.error(e)
  }
}
