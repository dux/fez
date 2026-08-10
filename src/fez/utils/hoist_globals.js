// Lift rules out of a scoped <style> block onto the global channel.
//
// Two kinds get hoisted:
//
// 1. `:global(SEL) { ... }` - the author's explicit escape hatch for rules that
//    must land outside the component, e.g. a third-party widget that mounts
//    itself on document.body. The wrapper is stripped on the way out.
//
// 2. At-rules that cannot legally sit inside a style rule. The compiler wraps
//    every scoped block in `:fez { ... }`, which would bury them one level too
//    deep and the browser drops them silently - taking any animation that
//    depends on them with it. @keyframes names are global anyway, so lifting
//    them out is what the author meant. @media/@supports/@container/@layer nest
//    fine and stay put.
//
// Only depth-0 rules are hoisted. A nested `:global()` would need its parent
// selector rewritten to mean anything, which is a different feature.

const NOT_NESTABLE =
  /^@(-\w+-)?(keyframes|font-face|property|counter-style|page|import|namespace|font-feature-values)\b/i

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
  if (!style) return { scoped: '', global: '' }
  if (!style.includes(':global(') && !/(^|\n)\s*@/.test(style)) {
    return { scoped: style, global: '' }
  }

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

    if (depth === 0 && trimmed) {
      const isGlobalFn = trimmed.includes(':global(')
      const isAtRule = NOT_NESTABLE.test(trimmed)

      if (isGlobalFn) {
        const one = trimmed.match(ONE_LINER)
        if (one) {
          global.push(`${strip(one[1] + ':global(' + one[2] + ')' + one[3])} {${one[4]}}`)
          continue
        }
      }

      if ((isGlobalFn || isAtRule) && OPENS_RULE.test(trimmed)) {
        const head = isGlobalFn ? strip(trimmed.replace(/\{\s*$/, '')) + ' {' : trimmed
        capturing = { body: [head] }
        depth = 1
        continue
      }

      // statement at-rule with no block, e.g. `@import url(...);`
      if (isAtRule && /;\s*$/.test(trimmed)) {
        global.push(trimmed)
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
