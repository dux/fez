function parseBlock(data, ifStack) {
  data = data
    .replace(/^#?raw/, '@html')
    .replace(/^#?html/, '@html')

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

    if (data.startsWith('json ')) {
      data = data.replace('json ', "@html '<pre class=json>'+JSON.stringify(")
      data += ", null, 2) + '</pre>'"
    }

    if (data.startsWith(prefix)) {
      data = data.replace(prefix, '')
    } else {
      data = `Fez.htmlEscape(${data})`
    }

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

  text = text.replace(/(\w+)=\{\{\s*(.*?)\s*\}\}([\s>])/g, (match, p1, p2, p3) => {
    return `${p1}="{`+`{ ${p2} }`+`}"${p3}`
  })

  // {{block foo}} ... {{/block}}
  // {{block:foo}}
  const blocks = {}
  text = text.replace(/\{\{block\s+(\w+)\s*\}\}([^§]+)\{\{\/block\}\}/g, (_, name, block) => {
    blocks[name] = block
    return ''
  })
  text = text.replace(/\{\{block:([\w\-]+)\s*\}\}/g, (_, name) => blocks[name] || `block:${name}?`)

  // {{#for el in list }}}}
  //   <ui-comment :comment="el"></ui-comment>
  //   -> :comment="{{ JSON.stringify(el) }}"
  // skip attr="foo.bar"
  text = text.replace(/:(\w+)="([\w\.\[\]]+)"/, (_, m1, m2) => {
    return `:${m1}=Fez.store.delete({{ Fez.store.set(${m2}) }})`
  })

  let result = text.replace(/{{(.*?)}}/g, (_, content) => {
    content = content.replaceAll('&#x60;', '`')

    content = content
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
    const parsedData = parseBlock(content, ifStack);

    return parsedData
  });

  result = result
    .replace(/<!\-\-.*?\-\->/g, '')
    .replace(/>\s+</g, '><')

  result = '`' + result.trim() + '`'

  try {
    const funcBody = `const fez = this;
      with (this) {
        return ${result}
      }
    `
    const tplFunc = new Function(funcBody);
    const outFunc = (o) => {
      try {
        return tplFunc.bind(o)()
      } catch(e) {
        e.message = `FEZ template runtime error: ${e.message}\n\nTemplate source: ${result}`
        console.error(e)
      }
    }
    return outFunc
  } catch(e) {
    e.message = `FEZ template compile error: ${e.message}Template source:\n${result}`
    console.error(e)
    return ()=>Fez.consoleError(`Template Compile Error`, true)
  }
}
