export default function simpleTemplate(data, context) {
  const monkey = (t) => t.replace(/@/, 'this.')

  const body = data.replace(/\{\{\s*(.*?)\s*\}\}/g, (el, m1) =>{
    const parts = m1.split(' ')
    const first = parts.shift()

    if (first === 'if') {
      return `\${${monkey(parts.join(' '))} && \``
    } else if (first === '/if') {
      return '}'
    } else if (first === 'else') {
      return '` || `'
    } else if (first === 'each') {
      const [cond, vars] = parts.join(' ').split(' as ', 2)
      return `\` + ${monkey(cond)}.map((${vars})=>\``
    } else if (first === 'for') {
      const [vars, cond] = parts.join(' ').split(' in ', 2)
      return `\` + ${monkey(cond)}.map((${vars})=>\``
    } else if (['/each', '/for'].includes(first)) {
      return '`).join("\\n")'
    } else {
      return `\` + (${m1}) + \``
    }
  })

  console.log(body)

  // const header = Object.keys(opts).map((key)=>`const ${key} = data['${key}'];`).join("\n")
  const func = new Function('data', `return \`${body}\``)

  if (context) {
    return func.bind(context)().replace(/\n\s*\n/g, "\n")
  } else {
    return func
  }
}
