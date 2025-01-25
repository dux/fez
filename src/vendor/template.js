function parseTemplate(source) {
  const out =  source.replace(/{{(.*?)}}/g, (match, content) => {
    const parsedData = parseBlock(content);
    return parsedData
  });

  return '`' + out + '`'
}

function parseBlock(data) {
  data = data.replaceAll('@', 'this.')

  if (data.startsWith('#if') || data.startsWith('#if')) {
    data = data.replace(/^#?if/, '')
    return `\${ ${data} ? \``
  }
  else if (data.startsWith('#for') || data.startsWith('for')) {
    data = data.replace(/^#?for/, '')
    const el = data.split(' in ', 2)
    return '${' + el[1] + '.map((' + el[0] + ')=>`'
  }
  else if (data.startsWith('#each') || data.startsWith('each')) {
    data = data.replace(/^#?for/, '')
    const el = data.split(' as ', 2)
    return '${' + el[0] + '.map((' + el[1] + ')=>`'
  }
  else if (data == ':else' || data == 'else') {
    return '` : `'
  }
  else if (data == '/if') {
    return '`}'
  }
  else if (data == '/for' || data == '/each') {
    return '`).join("")}'
  }
  else {
    return '${' + data + '}'
  }
}

export default function renderTemplate(text, object) {
  const result = parseTemplate(template);

  let func
  let out

  try {
    func = new Function(`return ${result}`)
    out = func.bind(object)()
  } catch(e) {
    out = `Template compile error: ${e.message}`
  }

  return out
}
