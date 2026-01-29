// Template utility functions for svelte-template parser
// Extracted to keep main parser file smaller

/**
 * Parse loop binding to get params and detect object iteration
 */
export function parseLoopBinding(binding) {
  const isDestructured = binding.startsWith('[')

  if (isDestructured) {
    const match = binding.match(/^\[([^\]]+)\](?:\s*,\s*(\w+))?$/)
    if (match) {
      return {
        params: match[1].split(',').map(s => s.trim()),
        indexParam: match[2] || null,
        isDestructured: true
      }
    }
  }

  const parts = binding.split(',').map(s => s.trim())

  // 2 params without brackets = destructuring
  // Runtime auto-converts: Array.isArray(c) ? c : Object.entries(c)
  if (parts.length === 2) {
    return { params: parts, indexParam: null, isDestructured: true }
  }

  return { params: parts, indexParam: null, isDestructured: false }
}

/**
 * Get loop variable names from binding
 */
export function getLoopVarNames(binding) {
  const parsed = parseLoopBinding(binding)
  const names = [...parsed.params]
  if (parsed.indexParam) names.push(parsed.indexParam)
  // Add implicit i for single-param
  if (parsed.params.length === 1 && !names.includes('i')) names.push('i')
  return names
}

/**
 * Get loop item variables (non-index) from binding
 * These are variables that could be objects/arrays (not primitives like indices)
 */
export function getLoopItemVars(binding) {
  const parsed = parseLoopBinding(binding)
  // For 2-param destructuring: [value, index] - only first is item var
  if (parsed.isDestructured && parsed.params.length === 2) {
    return [parsed.params[0]]
  }
  // For other destructured bindings, all params are item vars
  if (parsed.isDestructured) {
    return parsed.params
  }
  // For {#each items as item, index}, only 'item' is the item var
  // For {#each obj as key, value, index}, 'key' and 'value' are item vars
  if (parsed.params.length >= 3) {
    // Last param is index, rest are item vars
    return parsed.params.slice(0, -1)
  }
  if (parsed.params.length === 2) {
    // Could be "item, index" - first is item, second is index
    return [parsed.params[0]]
  }
  // Single param is the item var
  return parsed.params
}

/**
 * Build collection expression for iteration
 */
export function buildCollectionExpr(collection, binding) {
  const parsed = parseLoopBinding(binding)

  // 2-param destructuring uses Fez.toPairs for unified array/object handling
  // Array: ['a', 'b'] → [['a', 0], ['b', 1]] (value, index)
  // Object: {x: 1} → [['x', 1]] (key, value)
  if (parsed.isDestructured && parsed.params.length === 2) {
    return `Fez.toPairs(${collection})`
  }

  // 3+ params: object iteration with explicit index
  if (parsed.isDestructured || parsed.params.length >= 3) {
    return `((_c)=>Array.isArray(_c)?_c:(_c&&typeof _c==="object")?Object.entries(_c):[])(${collection})`
  }

  return `(${collection}||[])`
}

/**
 * Build loop callback params
 */
export function buildLoopParams(binding) {
  const parsed = parseLoopBinding(binding)

  if (parsed.isDestructured) {
    const destructure = '[' + parsed.params.join(', ') + ']'
    const indexName = parsed.indexParam || (parsed.params.includes('i') ? '_i' : 'i')
    return destructure + ', ' + indexName
  }

  if (parsed.params.length >= 3) {
    const params = [...parsed.params]
    const index = params.pop()
    return '[' + params.join(', ') + '], ' + index
  }

  if (parsed.params.length === 2) {
    return parsed.params.join(', ')
  }

  // If loop var is 'i', use '_i' for index to avoid collision
  const indexName = parsed.params[0] === 'i' ? '_i' : 'i'
  return parsed.params[0] + ', ' + indexName
}

/**
 * Check if expression is an arrow function
 */
export function isArrowFunction(expr) {
  // Match: () => ..., (e) => ..., (e, foo) => ..., e => ...
  return /^\s*(\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/.test(expr)
}

/**
 * Transform arrow function to onclick-compatible string
 * Input: "(e) => removeTask(index)" with loopVars = ['item', 'index', 'i']
 *
 * For loop variables that are item references (not indices), we store the handler
 * in fezGlobals to capture the value at render time. For index-only references,
 * we use simple interpolation since indices are primitives.
 *
 * Output for index-only: "fez.removeTask(${index})"
 * Output for item refs: "${'Fez(' + UID + ').fezGlobals.delete(' + fez.fezGlobals.set(() => fez.removeTask(item)) + ')()'}"
 */
export function transformArrowToHandler(expr, loopVars = [], loopItemVars = []) {
  // Extract the arrow function body
  const arrowMatch = expr.match(/^\s*(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*(.+)$/s)
  if (!arrowMatch) return expr

  let body = arrowMatch[1].trim()

  // Check if arrow has event param: (e) => or (event) => or e =>
  const paramMatch = expr.match(/^\s*\(?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?\s*(?:,\s*[^)]+)?\)?\s*=>/)
  const eventParam = paramMatch?.[1]
  const hasEventParam = eventParam && ['e', 'event', 'ev'].includes(eventParam)

  // Check if body references loop item variables (non-index vars that could be objects)
  const usedItemVars = loopItemVars.filter(varName => {
    const varRegex = new RegExp(`\\b${varName}\\b`)
    return varRegex.test(body)
  })

  // If arrow function uses item variables (not just indices), store the function in fezGlobals
  // This ensures object references are captured at render time
  if (usedItemVars.length > 0) {
    // Replace event param with 'event' in the body if needed
    if (hasEventParam && eventParam !== 'event') {
      const eventRegex = new RegExp(`\\b${eventParam}\\b`, 'g')
      body = body.replace(eventRegex, 'event')
    }

    // Prefix bare function calls with fez.
    body = body.replace(/(?<![.\w])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, (match, funcName) => {
      const globals = ['console', 'window', 'document', 'Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'alert', 'confirm', 'prompt', 'fetch', 'event']
      if (globals.includes(funcName)) {
        return match
      }
      return `fez.${funcName}(`
    })

    // Store the function with captured loop vars, retrieve and call at click time
    // Uses IIFE to build the string at render time with UID and set() evaluated
    return `\${'Fez(' + UID + ').fezGlobals.delete(' + fez.fezGlobals.set(() => ${body}) + ')()'}`
  }

  // No item variables - use simple interpolation for indices (original behavior)
  // Replace event param with 'event' (the actual DOM event)
  if (hasEventParam && eventParam !== 'event') {
    const eventRegex = new RegExp(`\\b${eventParam}\\b`, 'g')
    body = body.replace(eventRegex, 'event')
  }

  // Interpolate loop variables - they need to be evaluated at render time
  // e.g., removeTask(index) becomes removeTask(${index})
  for (const varName of loopVars) {
    // Match the variable as a standalone identifier (not part of another word)
    // and not already inside a template literal
    const varRegex = new RegExp(`(?<!\\$\\{)\\b${varName}\\b(?![^{]*\\})`, 'g')
    body = body.replace(varRegex, `\${${varName}}`)
  }

  // Prefix bare function calls with fez.
  body = body.replace(/(?<![.\w])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, (match, funcName) => {
    const globals = ['console', 'window', 'document', 'Math', 'JSON', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean', 'parseInt', 'parseFloat', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'alert', 'confirm', 'prompt', 'fetch', 'event']
    if (globals.includes(funcName)) {
      return match
    }
    return `fez.${funcName}(`
  })

  return body
}

/**
 * Extract a braced expression with proper depth counting
 */
export function extractBracedExpression(text, startIndex) {
  let depth = 0
  let i = startIndex

  while (i < text.length) {
    const char = text[i]
    if (char === '{') {
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0) {
        return { expression: text.slice(startIndex + 1, i), endIndex: i }
      }
    } else if (char === '"' || char === "'" || char === '`') {
      // Skip string literals
      const quote = char
      i++
      while (i < text.length && text[i] !== quote) {
        if (text[i] === '\\') i++
        i++
      }
    }
    i++
  }
  throw new Error(`Unmatched brace at ${startIndex}`)
}

/**
 * Check if position is inside an attribute (attr={...})
 * Returns the attribute name if inside one, null otherwise
 */
export function getAttributeContext(text, pos) {
  // Look backwards for pattern like: attr={
  // We need to find the last '=' before pos that's preceded by an attribute name
  let j = pos - 1
  // Skip whitespace and opening brace
  while (j >= 0 && (text[j] === '{' || text[j] === ' ' || text[j] === '\t')) j--
  if (j >= 0 && text[j] === '=') {
    // Found '=', now look for attribute name
    j--
    while (j >= 0 && (text[j] === ' ' || text[j] === '\t')) j--
    // Extract attribute name
    let attrEnd = j + 1
    while (j >= 0 && /[a-zA-Z0-9_:-]/.test(text[j])) j--
    const attrName = text.slice(j + 1, attrEnd)
    if (attrName && /^[a-zA-Z]/.test(attrName)) {
      return attrName.toLowerCase()
    }
  }
  return null
}

/**
 * Check if position is inside an event attribute (onclick=, onchange=, etc.)
 * Returns the attribute name if inside one, null otherwise
 */
export function getEventAttributeContext(text, pos) {
  const attr = getAttributeContext(text, pos)
  if (attr && /^on[a-z]+$/.test(attr)) {
    return attr
  }
  return null
}
