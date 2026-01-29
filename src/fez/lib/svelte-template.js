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

import {
  getLoopVarNames,
  getLoopItemVars,
  buildCollectionExpr,
  buildLoopParams,
  isArrowFunction,
  transformArrowToHandler,
  extractBracedExpression,
  getAttributeContext,
  getEventAttributeContext
} from './svelte-template-lib.js'

/**
 * Compile template to a function that returns HTML string
 *
 * @param {string} text - Template source
 * @param {Object} opts - Options
 * @param {string} opts.name - Component name for error messages
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

    // Convert :attr="expr" to use Fez(UID).fezGlobals for passing values through DOM
    // This allows loop variables to be passed as props to child components
    // :file="el.file" -> :file={`Fez(${UID}).fezGlobals.delete(${fez.fezGlobals.set(el.file)})`}
    // Uses Fez(UID) so child component can find parent's fezGlobals
    text = text.replace(/:(\w+)="([^"{}]+)"/g, (match, attr, expr) => {
      // Only convert if expr looks like a variable access (not a string literal)
      if (/^[\w.[\]]+$/.test(expr.trim())) {
        return `:${attr}={\`Fez(\${UID}).fezGlobals.delete(\${fez.fezGlobals.set(${expr})})\`}`
      }
      return match
    })

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
    const loopVarStack = []  // Track all loop variables for arrow function transformation
    const loopItemVarStack = []  // Track item vars (non-index) that could be objects
    const loopStack = []  // Track loop info for :else support

    while (i < text.length) {
      // Skip JavaScript template literals (backtick strings)
      // Content inside backticks should not be processed as Fez expressions
      if (text[i] === '`') {
        result += '\\`'
        i++
        // Copy everything until closing backtick
        while (i < text.length && text[i] !== '`') {
          if (text[i] === '\\') {
            // Handle escaped characters
            result += '\\\\'
            i++
            if (i < text.length) {
              if (text[i] === '`') {
                result += '\\`'
              } else if (text[i] === '$') {
                result += '\\$'
              } else {
                result += text[i]
              }
              i++
            }
          } else if (text[i] === '$' && text[i + 1] === '{') {
            // Keep JS template literal interpolation as-is (escape $ for outer template)
            result += '\\${'
            i += 2
            // Copy until matching }
            let depth = 1
            while (i < text.length && depth > 0) {
              if (text[i] === '{') depth++
              else if (text[i] === '}') depth--
              if (depth > 0 || text[i] !== '}') {
                if (text[i] === '`') result += '\\`'
                else if (text[i] === '\\') result += '\\\\'
                else result += text[i]
              } else {
                result += '}'
              }
              i++
            }
          } else {
            // Regular character inside backticks - escape special chars for outer template
            if (text[i] === '$') {
              result += '\\$'
            } else {
              result += text[i]
            }
            i++
          }
        }
        if (i < text.length) {
          result += '\\`'
          i++
        }
        continue
      }

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

        // Check if this is a JavaScript object literal (e.g., {d: 'top'}, {foo: 1, bar: 2})
        // Object literals start with key: where key is identifier or quoted string
        if (/^(\w+|"\w+"|'\w+')\s*:/.test(expr)) {
          // Keep object literal as-is in the output
          result += '{' + expression + '}'
          i = endIndex + 1
          continue
        }

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
          loopItemVarStack.push(getLoopItemVars(binding))

          // Track loop info for :else support
          // Use a wrapper that allows checking length and provides else support
          // ((_arr) => _arr.length ? _arr.map(...).join('') : elseContent)(collection)
          loopStack.push({ collectionExpr, hasElse: false })

          result += '${((_arr) => _arr.length ? _arr.map((' + loopParams + ') => `'
        }
        else if (expr === '/each' || expr === '/for') {
          loopVarStack.pop()  // Remove loop vars when exiting loop
          loopItemVarStack.pop()  // Remove item vars when exiting loop
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
            const allItemVars = loopItemVarStack.flat()
            let handler = transformArrowToHandler(expr, allLoopVars, allItemVars)
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

      // Escape special characters for template literal
      if (text[i] === '$' && text[i + 1] === '{') {
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
