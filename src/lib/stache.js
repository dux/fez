// https://github.com/ryanmorr/stache
export default function renderStache(tpl, data) {
  const NEW_LINES_RE = /(\r\n|\r|\n)/g;
  const TEMPLATE_RE = /{{\s*(.+?)\s*}}/g;
  const EACH_RE = /^each\s+(.*)\s+as\s+(.*)$/;
  const IF_RE = /^if\s+(.*)$/;
  const ELSE_IF_RE = /^else if\s+(.*)$/;

  function stache(source) {
    let tpl;
    return (data) => {
      if (!tpl) {
        let func = `
          let _strings = [], _sequence = [], _values = [];
          let ${Object.keys(data)
            .filter((key)=>key[0] != '$' && !['class', 'connect', 'oldRoot', 'root'].includes(key))
            .map((key) => `${key} = _data['${key}']`).join(`,\n`)};
          _sequence.push('${
            source.trim().replace(NEW_LINES_RE, '\\n').replace(TEMPLATE_RE, (all, code) => {
              if (code.startsWith('each')) {
                let loop = EACH_RE.exec(code);
                if (loop) {
                    return `');\n (${loop[1]}.constructor === Object ? Array.from(Object.entries(${loop[1]}), ([key, value]) => [key, value]) : ${loop[1]}).forEach((${loop[2]}) => { _sequence.push('`
                  }
                } else if (code.startsWith('if')) {
                  let conditional = (IF_RE).exec(code);
                  if (conditional) {
                    return `');\n if (${conditional[1]}) { _sequence.push('`
                  }
                } else if (code.startsWith('else if')) {
                  let conditionalElse = (ELSE_IF_RE).exec(code);
                  if (conditionalElse) {
                    return `');\n } else if (${conditionalElse[1]}) { _sequence.push('`
                  }
                } else if (code === 'else') {
                  return `');\n } else { _sequence.push('` // eslint-disable-line quotes
                } else if (code === '/each') {
                  return `');\n }); _sequence.push('` // eslint-disable-line quotes
                } else if (code === '/if') {
                  return `');\n } _sequence.push('` // eslint-disable-line quotes
                }
                return `');\n _strings.push(_sequence.join(''));\n _sequence = [];\n _values.push(${code});\n _sequence.push('`;
            })
          }');
          _strings.push(_sequence.join(''));
          return [_strings, _values];
        `
        // console.log(func)
        tpl = new Function('_data', func);
      }
      return tpl(data);
    };
  }

  function createTemplate(source) {
    const tpl = stache(source);
    return (data) => {
      const [strings, values] = tpl(data);
      return strings.reduce((acc, str, i) => acc + (values[i - 1]) + str);
    };
  }

  function closeCustomTags(html) {
    const selfClosingTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'
    ])

    return html.replace(/<([a-z-]+)\b([^>]*)\/>/g, (match, tagName, attributes) => {
      return selfClosingTags.has(tagName) ? match : `<${tagName}${attributes}></${tagName}>`
    })
  }

  tpl = closeCustomTags(tpl)
  return createTemplate(tpl)(data).replace(/\n\s*\n/g, "\n")
}
