// Svelte-like template parser for Fez
// Compiles to a single function that returns HTML string
//
// Supports:
//   {#if cond}...{:else if cond}...{:else}...{/if}
//   {#unless cond}...{/unless}
//   {#each items as item}...{/each}        - implicit index `i` available
//   {#each items as item, index}...{/each} - explicit index name
//   {#for item in items}...{/for}          - implicit index `i` available
//   {#for item, index in items}...{/for}   - explicit index name
//   {#each obj as key, value, index}       - object iteration (3 params)
//   {@html rawContent}                     - unescaped HTML
//   {@json obj}                            - debug JSON output
//   {expression}                           - escaped expression

/**
 * Parse loop binding to get params and detect object iteration
 */
function parseLoopBinding(binding) {
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
  return { params: parts, indexParam: null, isDestructured: false }
}

/**
 * Get loop variable names from binding
 */
function getLoopVarNames(binding) {
  const parsed = parseLoopBinding(binding)
  const names = [...parsed.params]
  if (parsed.indexParam) names.push(parsed.indexParam)
  // Add implicit i for single-param
  if (parsed.params.length === 1 && !names.includes('i')) names.push('i')
  return names
}

/**
 * Build collection expression for iteration
 */
function buildCollectionExpr(collection, binding) {
  const parsed = parseLoopBinding(binding)
  const isObjectIteration = parsed.isDestructured || parsed.params.length >= 3

  if (isObjectIteration) {
    return `((_c)=>Array.isArray(_c)?_c:(_c&&typeof _c==="object")?Object.entries(_c):[])(${collection})`
  }
  return `(${collection}||[])`
}

/**
 * Build loop callback params
 */
function buildLoopParams(binding) {
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
function isArrowFunction(expr) {
  // Match: () => ..., (e) => ..., (e, foo) => ..., e => ...
  return /^\s*(\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/.test(expr)
}

/**
 * Transform arrow function to onclick-compatible string
 * Input: "(e) => removeTask(index)" with loopVars = ['item', 'index', 'i']
 * Output: "removeTask(${index})" (loop vars get interpolated)
 */
function transformArrowToHandler(expr, loopVars = []) {
  // Extract the arrow function body
  const arrowMatch = expr.match(/^\s*(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*(.+)$/s)
  if (!arrowMatch) return expr

  let body = arrowMatch[1].trim()

  // Check if arrow has event param: (e) => or (event) => or e =>
  const paramMatch = expr.match(/^\s*\(?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?\s*(?:,\s*[^)]+)?\)?\s*=>/)
  const eventParam = paramMatch?.[1]
  const hasEventParam = eventParam && ['e', 'event', 'ev'].includes(eventParam)

  // Replace event param with 'event' (the actual DOM event)
  if (hasEventParam && eventParam !== 'event') {
    // Replace the event param variable in the body with 'event'
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
  // This handles: removeTask(x) -> fez.removeTask(x)
  // But not: this.foo(), obj.method(), console.log()
  // Use negative lookbehind to avoid matching after a dot
  body = body.replace(/(?<![.\w])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g, (match, funcName) => {
    // Don't prefix if it's a known global or already qualified
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
function extractBracedExpression(text, startIndex) {
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
function getAttributeContext(text, pos) {
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
function getEventAttributeContext(text, pos) {
  const attr = getAttributeContext(text, pos)
  if (attr && /^on[a-z]+$/.test(attr)) {
    return attr
  }
  return null
}

/**
 * Compile template to a function that returns HTML string
 */
export default function createSvelteTemplate(text, opts = {}) {
  const componentName = opts.name || 'unknown'

  try {
    // Decode HTML entities that might have been encoded by browser DOM
    text = text
      .replaceAll('&#x60;', '`')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')

    // Process block definitions and references before parsing
    const blocks = {}
    text = text.replace(/\{@block\s+(\w+)\}([\s\S]*?)\{\/block\}/g, (_, name, content) => {
      blocks[name] = content
      return ''
    })
    text = text.replace(/\{@block:(\w+)\}/g, (_, name) => blocks[name] || '')

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, '')

    // Normalize whitespace between tags
    text = text.replace(/>\s+</g, '><').trim()

    // Convert self-closing custom elements to paired tags
    // <ui-icon name="foo" /> -> <ui-icon name="foo"></ui-icon>
    // Custom elements contain a hyphen in the tag name
    text = text.replace(/<([a-z][a-z0-9]*-[a-z0-9-]*)([^>]*?)\s*\/>/gi, '<$1$2></$1>')

    // Convert self-closing <slot /> to <slot></slot>
    text = text.replace(/<slot\s*\/>/gi, '<slot></slot>')

    // Parse and build template literal
    let result = ''
    let i = 0
    const ifStack = []  // Track if blocks have else
    const loopVarStack = []  // Track loop variables for arrow function transformation
    const loopStack = []  // Track loop info for :else support

    while (i < text.length) {
      // Escaped brace
      if (text[i] === '\\' && text[i + 1] === '{') {
        result += '{'
        i += 2
        continue
      }

      // Expression or directive
      if (text[i] === '{') {
        const { expression, endIndex } = extractBracedExpression(text, i)
        const expr = expression.trim()

        // Block directives
        if (expr.startsWith('#if ')) {
          const cond = expr.slice(4)
          result += '${(' + cond + ') ? `'
          ifStack.push(false)  // No else yet
        }
        else if (expr.startsWith('#unless ')) {
          const cond = expr.slice(8)
          result += '${!(' + cond + ') ? `'
          ifStack.push(false)  // No else yet
        }
        else if (expr === ':else') {
          // Check if we're inside a loop (for empty list handling)
          if (loopStack.length > 0 && !ifStack.length) {
            // :else inside a loop - for empty array case
            const loopInfo = loopStack[loopStack.length - 1]
            loopInfo.hasElse = true
            result += '`).join("") : `'
          } else {
            // :else inside an if block
            result += '` : `'
            ifStack[ifStack.length - 1] = true  // Has else
          }
        }
        else if (expr.startsWith(':else if ')) {
          const cond = expr.slice(9)
          result += '` : (' + cond + ') ? `'
          // Keep hasElse as false - still need final else
        }
        else if (expr === '/if' || expr === '/unless') {
          const hasElse = ifStack.pop()
          result += hasElse ? '`}' : '` : ``}'
        }
        else if (expr.startsWith('#each ') || expr.startsWith('#for ')) {
          const isEach = expr.startsWith('#each ')
          let collection, binding

          if (isEach) {
            const rest = expr.slice(6)
            const asIdx = rest.indexOf(' as ')
            collection = rest.slice(0, asIdx).trim()
            binding = rest.slice(asIdx + 4).trim()
          } else {
            const rest = expr.slice(5)
            const inIdx = rest.indexOf(' in ')
            binding = rest.slice(0, inIdx).trim()
            collection = rest.slice(inIdx + 4).trim()
          }

          const collectionExpr = buildCollectionExpr(collection, binding)
          const loopParams = buildLoopParams(binding)

          // Track loop variables for arrow function transformation
          loopVarStack.push(getLoopVarNames(binding))

          // Track loop info for :else support
          // Use a wrapper that allows checking length and provides else support
          // ((_arr) => _arr.length ? _arr.map(...).join('') : elseContent)(collection)
          loopStack.push({ collectionExpr, hasElse: false })

          result += '${((_arr) => _arr.length ? _arr.map((' + loopParams + ') => `'
        }
        else if (expr === '/each' || expr === '/for') {
          loopVarStack.pop()  // Remove loop vars when exiting loop
          const loopInfo = loopStack.pop()
          if (loopInfo.hasElse) {
            // Close the else branch
            result += '`)(' + loopInfo.collectionExpr + ')}'
          } else {
            // No else - just close the ternary with empty string
            result += '`).join("") : "")(' + loopInfo.collectionExpr + ')}'
          }
        }
        else if (expr.startsWith('@html ')) {
          const content = expr.slice(6)
          result += '${' + content + '}'
        }
        else if (expr.startsWith('@json ')) {
          const content = expr.slice(6)
          result += '${`<pre class="json">${Fez.htmlEscape(JSON.stringify(' + content + ', null, 2))}</pre>`}'
        }
        else if (isArrowFunction(expr)) {
          // Arrow function - check if we're in an event attribute
          const eventAttr = getEventAttributeContext(text, i)
          if (eventAttr) {
            // Get all current loop variables
            const allLoopVars = loopVarStack.flat()
            let handler = transformArrowToHandler(expr, allLoopVars)
            // Escape double quotes for HTML attribute
            handler = handler.replace(/"/g, '&quot;')
            // Output as quoted attribute value with interpolation for loop vars
            result += '"' + handler + '"'
          } else {
            // Arrow function outside event attribute - just output as expression
            result += '${' + expr + '}'
          }
        }
        else {
          // Plain expression - check if inside attribute
          const attrContext = getAttributeContext(text, i)
          if (attrContext) {
            // Inside attribute - wrap with quotes and escape
            result += '"${Fez.htmlEscape(' + expr + ')}"'
          } else {
            // Regular content - just escape HTML
            result += '${Fez.htmlEscape(' + expr + ')}'
          }
        }

        i = endIndex + 1
        continue
      }

      // Escape backticks and $ for template literal
      if (text[i] === '`') {
        result += '\\`'
      } else if (text[i] === '$' && text[i + 1] === '{') {
        result += '\\$'
      } else if (text[i] === '\\') {
        result += '\\\\'
      } else {
        result += text[i]
      }
      i++
    }

    // Build the function
    const funcBody = `
      const fez = this;
      with (this) {
        return \`${result}\`
      }
    `

    const tplFunc = new Function(funcBody)

    return (ctx) => {
      try {
        return tplFunc.bind(ctx)()
      } catch (e) {
        console.error(`FEZ svelte template runtime error in <${ctx.fezName || componentName}>:`, e.message)
        console.error('Template source:', result.substring(0, 500))
        return ''
      }
    }
  } catch (e) {
    console.error(`FEZ svelte template compile error in <${componentName}>:`, e.message)
    console.error('Template:', text.substring(0, 200))
    return () => ''
  }
}
