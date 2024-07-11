// https://github.com/ryanmorr/stache
export default function renderStache(tpl, context) {
  const NEW_LINES_RE = /(\r\n|\r|\n)/g;
  const TEMPLATE_RE = /{{\s*(.+?)\s*}}/g;
  const EACH_RE = /^each\s+(.*)\s+as\s+(.*)$/;
  const IF_RE = /^if\s+(.*)$/;
  const ELSE_IF_RE = /^else if\s+(.*)$/;

  function stache(source) {
    const monkey = (t) => t.replaceAll('@', 'this.')

    let func = `
      let _strings = [], _sequence = [], _values = [];

      function htmlEscape(text) {
        if (typeof text === 'string') {
          return text
            .replaceAll("'", '&apos;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
        } else {
          return text
        }
      }

      _sequence.push('${
        source.trim().replace(NEW_LINES_RE, '\\n').replace(TEMPLATE_RE, (all, code) => {
          // {{#if -> {{#if
          code = code.replace(/^[#:]/, '')

          if (code.startsWith('each') || code.startsWith('for')) {
            // support fro #for
            const parts = code.split(/\s+/)
            if (parts.shift() === 'for') {
              const list = parts.pop()
              parts.pop()
              code = `each ${list} as ${parts.join(' ')}`
            }

            let loop = EACH_RE.exec(code);
            if (loop) {
                loop[1] = monkey(loop[1])
                return `');\n (!Array.isArray(${loop[1]}) ? Array.from(Object.entries(${loop[1]} || []), ([key, value]) => [key, value]) : ${loop[1]}).forEach((${loop[2]}) => { _sequence.push('`
              }
          } else if (code.startsWith('if')) {
            let conditional = (IF_RE).exec(code);
            if (conditional) {
              conditional[1] = monkey(conditional[1])
              return `');\n if (${conditional[1]}) { _sequence.push('`
            }
          } else if (code.startsWith('else if')) {
            let conditionalElse = (ELSE_IF_RE).exec(code);
            if (conditionalElse) {
              conditionalElse[1] = monkey(conditionalElse[1])
              return `');\n } else if (${conditionalElse[1]}) { _sequence.push('`
            }
          } else if (code === 'else') {
            return `');\n } else { _sequence.push('` // eslint-disable-line quotes
          } else if (code === '/each' || code === '/for') {
            return `');\n }); _sequence.push('` // eslint-disable-line quotes
          } else if (code === '/if') {
            return `');\n } _sequence.push('` // eslint-disable-line quotes
          }

          // support for @html -> {{@html raw}} -> same as in svelte
          const codeParts = code.split(/^\@html\s+/)
          if (codeParts[1]) {
            code = monkey(codeParts[1])
          } else {
            code = `htmlEscape(${monkey(code)})`
          }

          return `');\n _strings.push(_sequence.join(''));\n _sequence = [];\n _values.push(${code});\n _sequence.push('`;
        })
      }');
      _strings.push(_sequence.join(''));
      return [_strings, _values];
    `
    // console.log(func)
    return new Function('_data', func);
  }

  function createTemplate(source) {
    const tpl = stache(source);
    return () => {
      const [strings, values] = tpl.bind(context)();
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
  return createTemplate(tpl)().replace(/\n\s*\n/g, "\n")
}
