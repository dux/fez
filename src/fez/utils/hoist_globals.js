// `:global(SEL) { ... }` inside a scoped <style> is an escape hatch for rules
// that must land outside the component - third-party widgets that mount
// themselves on document.body are the usual reason. The rule is lifted out of
// the scoped block and emitted on the global channel with the wrapper removed.
//
// Only depth-0 rules are hoisted. A nested `:global()` would need the parent
// selector rewritten to make sense, which is a different feature.

const OPENS_RULE = /\{\s*$/
const ONE_LINER = /^([^{}]*?):global\(([^)]*)\)([^{}]*)\{(.*)\}\s*$/

const strip = (selector) =>
  selector.replace(/:global\(([^)]*)\)/g, '$1').replace(/\s+/g, ' ').trim()

/**
 * Split a scoped style block into what stays scoped and what gets hoisted.
 * @param {string} style
 * @returns {{ scoped: string, global: string }}
 */
export default function hoistGlobals(style) {
  if (!style || !style.includes(':global(')) return { scoped: style || '', global: '' }

  const lines = style.split('\n')
  const scoped = []
  const global = []

  let depth = 0
  let capturing = null

  for (const line of lines) {
    const bare = line.replace(/\/\*.*?\*\//g, '')
    const trimmed = bare.trim()

    if (capturing) {
      for (const ch of bare) {
        if (ch === '{') depth++
        else if (ch === '}') depth--
      }
      if (depth === 0) {
        global.push(capturing.body.join('\n'), line.trim())
        capturing = null
      } else {
        capturing.body.push(line)
      }
      continue
    }

    if (depth === 0 && trimmed.includes(':global(')) {
      const one = trimmed.match(ONE_LINER)
      if (one) {
        global.push(`${strip(one[1] + ':global(' + one[2] + ')' + one[3])} {${one[4]}}`)
        continue
      }
      if (OPENS_RULE.test(trimmed)) {
        capturing = { body: [`${strip(trimmed.replace(/\{\s*$/, ''))} {`] }
        depth = 1
        continue
      }
    }

    for (const ch of bare) {
      if (ch === '{') depth++
      else if (ch === '}') depth--
    }
    scoped.push(line)
  }

  // an unbalanced block is a syntax error the style validator reports
  if (capturing) return { scoped: style, global: '' }

  return { scoped: scoped.join('\n'), global: global.join('\n') }
}
