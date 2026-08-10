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

const strip = (selector) =>
  selector.replace(/:global\(([^)]*)\)/g, '$1').replace(/\s+/g, ' ').trim()

// drop the :global() wrapper from the selector, leave the body alone
const stripHead = (line) => {
  const i = line.indexOf('{')
  return i < 0 ? strip(line) : `${strip(line.slice(0, i))} ${line.slice(i)}`
}

const braceDelta = (text) => {
  let d = 0
  for (const ch of text) {
    if (ch === '{') d++
    else if (ch === '}') d--
  }
  return d
}

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
      depth += braceDelta(bare)
      capturing.body.push(line)
      if (depth === 0) {
        global.push(capturing.body.join('\n'))
        capturing = null
      }
      continue
    }

    if (depth === 0 && trimmed) {
      const isGlobalFn = trimmed.includes(':global(')
      const isAtRule = NOT_NESTABLE.test(trimmed)

      if (isGlobalFn || isAtRule) {
        // statement at-rule with no block, e.g. `@import url(...);`
        if (isAtRule && !trimmed.includes('{')) {
          global.push(trimmed)
          continue
        }

        const head = isGlobalFn ? stripHead(trimmed) : trimmed
        const delta = braceDelta(bare)

        // whole rule fits on one line, e.g. `@keyframes spin { to { ... } }`
        if (delta === 0) {
          global.push(head)
          continue
        }
        if (delta > 0) {
          capturing = { body: [head] }
          depth = delta
          continue
        }
      }
    }

    depth += braceDelta(bare)
    scoped.push(line)
  }

  // an unbalanced block is a syntax error the style validator reports
  if (capturing) return { scoped: style, global: '' }

  return { scoped: scoped.join('\n'), global: global.join('\n') }
}
