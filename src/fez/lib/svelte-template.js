// Svelte-like template parser for Fez
// Compiles to direct DOM operations with root-level state dependency tracking
//
// HTML void elements - these never have children and should not be pushed to stack
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr'
])

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
 * Skip over a string literal, handling escape sequences
 */
function skipString(text, startIndex, quote) {
  let i = startIndex + 1
  while (i < text.length) {
    if (text[i] === '\\') {
      i += 2
      continue
    }
    if (text[i] === quote) return i
    if (quote === '`' && text[i] === '$' && text[i + 1] === '{') {
      i += 2
      let depth = 1
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
        else if (text[i] === '"' || text[i] === "'" || text[i] === '`') {
          i = skipString(text, i, text[i])
        }
        i++
      }
      continue
    }
    i++
  }
  return text.length - 1
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
      i = skipString(text, i, char)
    }
    i++
  }
  throw new Error(`Unmatched brace at ${startIndex}`)
}

/**
 * Extract root-level state dependencies from expression
 * "state.users.length" -> ["users"]
 * "state.count + state.total" -> ["count", "total"]
 */
function extractStateDeps(expr) {
  const deps = new Set()
  const re = /\bstate\.(\w+)/g
  let match
  while ((match = re.exec(expr)) !== null) {
    deps.add(match[1])
  }
  return [...deps]
}

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
    return destructure + ', ' + (parsed.indexParam || 'i')
  }

  if (parsed.params.length >= 3) {
    const params = [...parsed.params]
    const index = params.pop()
    return '[' + params.join(', ') + '], ' + index
  }

  if (parsed.params.length === 2) {
    return parsed.params.join(', ')
  }

  return parsed.params[0] + ', i'
}

/**
 * Rewrite expression to use _ctx context
 * - state.foo -> _ctx.state.foo
 * - this.method() -> _ctx.method()
 * - Loop variables remain unchanged
 * @param {string} expr - The expression to rewrite
 * @param {string[]} loopVars - Current loop variable names to exclude
 */
function rewriteExpr(expr, loopVars = []) {
  // Replace this. with _ctx.
  let result = expr.replace(/\bthis\./g, '_ctx.')

  // Replace state. with _ctx.state. (but not if already prefixed)
  // Use negative lookbehind to avoid _ctx.state.state.
  result = result.replace(/(?<![._\w])state\./g, '_ctx.state.')

  // Replace props. with _ctx.props.
  result = result.replace(/(?<![._\w])props\./g, '_ctx.props.')

  return result
}

// Simple HTML parser to tokenize template
function tokenize(html) {
  const tokens = []
  let i = 0

  while (i < html.length) {
    // Escaped brace
    if (html[i] === '\\' && html[i + 1] === '{') {
      tokens.push({ type: 'text', value: '{' })
      i += 2
      continue
    }

    // Brace expression
    if (html[i] === '{') {
      const { expression, endIndex } = extractBracedExpression(html, i)
      tokens.push({ type: 'expr', value: expression.trim() })
      i = endIndex + 1
      continue
    }

    // HTML comment - skip entirely
    if (html.slice(i, i + 4) === '<!--') {
      const endComment = html.indexOf('-->', i + 4)
      if (endComment === -1) {
        // Unclosed comment, skip to end
        break
      }
      i = endComment + 3
      continue
    }

    // HTML tag - need to handle braces inside attributes
    if (html[i] === '<') {
      let j = i + 1
      // Find the actual end of the tag, handling braces
      while (j < html.length) {
        if (html[j] === '>') {
          // Found the tag end
          break
        } else if (html[j] === '{') {
          // Skip over braced expression
          const { endIndex } = extractBracedExpression(html, j)
          j = endIndex + 1
          continue
        } else if (html[j] === '"' || html[j] === "'") {
          // Skip over quoted string
          const quote = html[j]
          j++
          while (j < html.length && html[j] !== quote) {
            if (html[j] === '\\') j++
            j++
          }
          j++
          continue
        }
        j++
      }

      if (j >= html.length) {
        tokens.push({ type: 'text', value: html.slice(i) })
        break
      }
      const tag = html.slice(i, j + 1)
      tokens.push({ type: 'tag', value: tag })
      i = j + 1
      continue
    }

    // Text content
    let end = i
    while (end < html.length && html[end] !== '<' && html[end] !== '{') {
      if (html[end] === '\\' && html[end + 1] === '{') break
      end++
    }
    if (end > i) {
      tokens.push({ type: 'text', value: html.slice(i, end) })
    }
    i = end
  }

  return tokens
}

// Parse a tag string into name, attributes, and flags
function parseTag(tagStr) {
  const isClose = tagStr.startsWith('</')
  const isSelfClose = tagStr.endsWith('/>')

  let inner = tagStr.slice(isClose ? 2 : 1, isSelfClose ? -2 : -1).trim()
  const spaceIdx = inner.indexOf(' ')

  let name, attrStr
  if (spaceIdx === -1) {
    name = inner
    attrStr = ''
  } else {
    name = inner.slice(0, spaceIdx)
    attrStr = inner.slice(spaceIdx + 1).trim()
  }

  // Parse attributes
  const attrs = []
  if (attrStr) {
    let i = 0
    while (i < attrStr.length) {
      // Skip whitespace
      while (i < attrStr.length && /\s/.test(attrStr[i])) i++
      if (i >= attrStr.length) break

      // Match attribute name
      const nameStart = i
      while (i < attrStr.length && /[\w-]/.test(attrStr[i])) i++
      const attrName = attrStr.slice(nameStart, i)
      if (!attrName) break

      // Check for = sign
      if (attrStr[i] !== '=') {
        // Boolean attribute
        attrs.push({ name: attrName, value: true, isDynamic: false })
        continue
      }
      i++ // skip =

      let value, isDynamic = false
      if (attrStr[i] === '"' || attrStr[i] === "'") {
        // Quoted string value
        const quote = attrStr[i]
        i++
        const valueStart = i
        while (i < attrStr.length && attrStr[i] !== quote) i++
        value = attrStr.slice(valueStart, i)
        i++ // skip closing quote
      } else if (attrStr[i] === '{') {
        // Dynamic expression - need to handle nested braces
        isDynamic = true
        i++ // skip opening {
        let depth = 1
        const valueStart = i
        while (i < attrStr.length && depth > 0) {
          if (attrStr[i] === '{') depth++
          else if (attrStr[i] === '}') depth--
          else if (attrStr[i] === '"' || attrStr[i] === "'" || attrStr[i] === '`') {
            const quote = attrStr[i]
            i++
            while (i < attrStr.length && attrStr[i] !== quote) {
              if (attrStr[i] === '\\') i++
              i++
            }
          }
          if (depth > 0) i++
        }
        value = attrStr.slice(valueStart, i)
        i++ // skip closing }
      } else {
        // Unquoted value (shouldn't happen often)
        const valueStart = i
        while (i < attrStr.length && !/[\s>]/.test(attrStr[i])) i++
        value = attrStr.slice(valueStart, i)
      }

      attrs.push({ name: attrName, value, isDynamic })
    }
  }

  return { name, attrs, isClose, isSelfClose }
}

/**
 * Compile template to render function that builds DOM directly
 */
export default function createSvelteTemplate(text, opts = {}) {
  // Normalize whitespace
  text = text.replace(/>\s+</g, '><').trim()

  const tokens = tokenize(text)

  // Generate code that builds DOM
  let code = ''
  let varCounter = 0
  const stack = [] // stack of parent variable names
  const loopStack = [] // track loop variables
  const blockStack = [] // track block info for nested if/each/unless

  const newVar = () => `_n${varCounter++}`

  const currentParent = () => stack.length ? stack[stack.length - 1] : '_root'

  // Track dependencies per variable
  const depTracking = [] // [{varName, deps, updateCode}]

  for (let ti = 0; ti < tokens.length; ti++) {
    const token = tokens[ti]

    if (token.type === 'text') {
      const text = token.value.trim()
      if (text) {
        const v = newVar()
        code += `const ${v} = document.createTextNode(${JSON.stringify(text)});\n`
        code += `${currentParent()}.appendChild(${v});\n`
      }
    }

    else if (token.type === 'tag') {
      const tag = parseTag(token.value)

      if (tag.isClose) {
        stack.pop()
      } else {
        const v = newVar()
        code += `const ${v} = document.createElement('${tag.name}');\n`

        for (const attr of tag.attrs) {
          if (attr.name.startsWith('on')) {
            // Event handler
            const eventName = attr.name.slice(2)
            const allLoopVars = loopStack.flat()
            let handler = attr.value
              .replace(/^\(\s*\)\s*=>\s*/, '')
              .replace(/^\(\s*e\s*\)\s*=>\s*/, '(e) => ')
            handler = rewriteExpr(handler, allLoopVars)

            // Check if handler uses loop variables
            const usesLoopVar = loopStack.length > 0 && loopStack.some(vars =>
              vars.some(v => handler.includes(v))
            )

            if (usesLoopVar || handler.includes('=>')) {
              code += `${v}.addEventListener('${eventName}', (e) => { ${handler.startsWith('(e)') ? handler.slice(6) : handler} });\n`
            } else {
              // Handler already rewritten with _ctx. prefix
              code += `${v}.addEventListener('${eventName}', (e) => { ${handler} });\n`
            }
          } else if (attr.isDynamic) {
            // Dynamic attribute
            const deps = extractStateDeps(attr.value)
            const allLoopVars = loopStack.flat()
            const expr = rewriteExpr(attr.value, allLoopVars)

            if (attr.name === 'class' && attr.value.includes('?')) {
              // Conditional class
              code += `${v}.setAttribute('class', ${expr});\n`
            } else {
              code += `${v}.setAttribute('${attr.name}', ${expr});\n`
            }

            if (deps.length > 0) {
              depTracking.push({
                deps,
                code: `${v}.setAttribute('${attr.name}', ${expr});`
              })
            }
          } else if (attr.value !== true) {
            // Static attribute
            code += `${v}.setAttribute('${attr.name}', ${JSON.stringify(attr.value)});\n`
          } else {
            // Boolean attribute
            code += `${v}.setAttribute('${attr.name}', '');\n`
          }
        }

        code += `${currentParent()}.appendChild(${v});\n`

        // Don't push void elements or self-closing tags onto the stack
        const isVoidElement = VOID_ELEMENTS.has(tag.name.toLowerCase())
        if (!tag.isSelfClose && !isVoidElement) {
          stack.push(v)
        }
      }
    }

    else if (token.type === 'expr') {
      const expr = token.value

      // Block directives
      if (expr.startsWith('#if ')) {
        const allLoopVars = loopStack.flat()
        const cond = rewriteExpr(expr.slice(4), allLoopVars)
        const deps = extractStateDeps(expr)
        const fragVar = newVar()
        const anchorVar = newVar()

        code += `const ${anchorVar} = document.createComment('if');\n`
        code += `${currentParent()}.appendChild(${anchorVar});\n`
        code += `let ${fragVar} = null;\n`
        code += `const _render${fragVar} = () => {\n`
        code += `  if (${fragVar}) { ${fragVar}.remove(); ${fragVar} = null; }\n`
        code += `  if (${cond}) {\n`
        code += `    ${fragVar} = document.createDocumentFragment();\n`
        code += `    const _root = ${fragVar};\n`

        stack.push('_root')
        blockStack.push({ type: 'if', fragVar, anchorVar, deps, hasElse: false })
      }

      else if (expr === ':else') {
        const info = blockStack[blockStack.length - 1]
        code += `  } else {\n`
        info.hasElse = true
      }

      else if (expr.startsWith(':else if ')) {
        const allLoopVars = loopStack.flat()
        const cond = rewriteExpr(expr.slice(9), allLoopVars)
        code += `  } else if (${cond}) {\n`
      }

      else if (expr === '/if' || expr === '/unless') {
        stack.pop() // pop _root
        const info = blockStack.pop()
        code += `  }\n` // close if/else block
        code += `  if (${info.fragVar}) ${info.anchorVar}.parentNode.insertBefore(${info.fragVar}, ${info.anchorVar});\n`
        code += `};\n`
        code += `_render${info.fragVar}();\n`

        if (info.deps.length > 0) {
          depTracking.push({ deps: info.deps, code: `_render${info.fragVar}();` })
        }
      }

      else if (expr.startsWith('#unless ')) {
        const allLoopVars = loopStack.flat()
        const cond = rewriteExpr(expr.slice(8), allLoopVars)
        const deps = extractStateDeps(expr)
        const fragVar = newVar()
        const anchorVar = newVar()

        code += `const ${anchorVar} = document.createComment('unless');\n`
        code += `${currentParent()}.appendChild(${anchorVar});\n`
        code += `let ${fragVar} = null;\n`
        code += `const _render${fragVar} = () => {\n`
        code += `  if (${fragVar}) { ${fragVar}.remove(); ${fragVar} = null; }\n`
        code += `  if (!(${cond})) {\n`
        code += `    ${fragVar} = document.createDocumentFragment();\n`
        code += `    const _root = ${fragVar};\n`

        stack.push('_root')
        blockStack.push({ type: 'unless', fragVar, anchorVar, deps, hasElse: false })
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

        const deps = extractStateDeps(collection)
        const loopVars = getLoopVarNames(binding)
        loopStack.push(loopVars)

        const anchorVar = newVar()
        const containerVar = newVar()
        const allLoopVars = loopStack.flat()
        const collectionExpr = buildCollectionExpr(rewriteExpr(collection, allLoopVars), binding)
        const loopParams = buildLoopParams(binding)

        code += `const ${anchorVar} = document.createComment('each');\n`
        code += `${currentParent()}.appendChild(${anchorVar});\n`
        code += `let ${containerVar} = [];\n`
        code += `const _render${containerVar} = () => {\n`
        code += `  ${containerVar}.forEach(n => n.remove());\n`
        code += `  ${containerVar} = [];\n`
        code += `  ${collectionExpr}.forEach((${loopParams}) => {\n`
        code += `    const _frag = document.createDocumentFragment();\n`
        code += `    const _root = _frag;\n`

        stack.push('_root')
        blockStack.push({ type: 'each', anchorVar, containerVar, deps })
      }

      else if (expr === '/each' || expr === '/for') {
        stack.pop()
        loopStack.pop()
        const info = blockStack.pop()

        code += `    ${info.containerVar}.push(..._frag.childNodes);\n`
        code += `    ${info.anchorVar}.parentNode.insertBefore(_frag, ${info.anchorVar});\n`
        code += `  });\n`
        code += `};\n`
        code += `_render${info.containerVar}();\n`

        if (info.deps.length > 0) {
          depTracking.push({ deps: info.deps, code: `_render${info.containerVar}();` })
        }
      }

      else if (expr.startsWith('@html ')) {
        const allLoopVars = loopStack.flat()
        const content = rewriteExpr(expr.slice(6), allLoopVars)
        const deps = extractStateDeps(expr)
        const v = newVar()
        const spanVar = newVar()

        code += `const ${spanVar} = document.createElement('span');\n`
        code += `${spanVar}.innerHTML = ${content};\n`
        code += `${currentParent()}.appendChild(${spanVar});\n`

        if (deps.length > 0) {
          depTracking.push({ deps, code: `${spanVar}.innerHTML = ${content};` })
        }
      }

      else if (expr.startsWith('@json ')) {
        const allLoopVars = loopStack.flat()
        const content = rewriteExpr(expr.slice(6), allLoopVars)
        const deps = extractStateDeps(expr)
        const v = newVar()

        code += `const ${v} = document.createElement('pre');\n`
        code += `${v}.className = 'json';\n`
        code += `${v}.textContent = JSON.stringify(${content}, null, 2);\n`
        code += `${currentParent()}.appendChild(${v});\n`

        if (deps.length > 0) {
          depTracking.push({ deps, code: `${v}.textContent = JSON.stringify(${content}, null, 2);` })
        }
      }

      else {
        // Plain expression - text node
        const allLoopVars = loopStack.flat()
        const content = rewriteExpr(expr, allLoopVars)
        const deps = extractStateDeps(expr)
        const v = newVar()

        code += `const ${v} = document.createTextNode(${content});\n`
        code += `${currentParent()}.appendChild(${v});\n`

        if (deps.length > 0) {
          depTracking.push({ deps, code: `${v}.textContent = ${content};` })
        }
      }
    }
  }

  // Build dependency map
  const depMap = {}
  for (const { deps, code: updateCode } of depTracking) {
    for (const dep of deps) {
      depMap[dep] = depMap[dep] || []
      depMap[dep].push(updateCode)
    }
  }

  // Generate final function
  const depMapCode = Object.keys(depMap).length > 0
    ? `_ctx._fezDeps = ${JSON.stringify(depMap)};\n` +
      `_ctx._fezUpdate = (prop) => {\n` +
      `  const updates = _ctx._fezDeps[prop];\n` +
      `  if (updates) updates.forEach(code => eval(code));\n` +
      `};\n`
    : ''

  const funcBody = `
    return function(_ctx) {
      const _root = document.createDocumentFragment();
      ${code}
      ${depMapCode}
      return _root;
    }
  `

  try {
    const factory = new Function(funcBody)
    const renderFn = factory()

    return (ctx) => {
      try {
        return renderFn(ctx)
      } catch (e) {
        console.error('FEZ svelte template runtime error:', e.message)
        console.error('Generated code:', funcBody)
        return document.createDocumentFragment()
      }
    }
  } catch (e) {
    console.error('FEZ svelte template compile error:', e.message)
    console.error('Generated code:', funcBody)
    return () => document.createDocumentFragment()
  }
}
