// Fez template compiler
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
//   {#await promise}...{:then value}...{:catch error}...{/await}
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
  getEventAttributeContext,
  quotedAttrContext,
  stripNodeWhitespace,
  mapTags,
  scanAttributes,
  scanTagEnd,
} from './template-compiler-lib.js';
import closeCustomTags from './close-custom-tags.js';

/**
 * Compile template to a function that returns HTML string
 *
 * @param {string} text - Template source
 * @param {Object} opts - Options
 * @param {string} opts.name - Component name for error messages
 * @param {boolean} opts.strict - Throw compile and render errors
 * @param {boolean} opts.static - Skip browser-runtime template transforms
 */
export default function createTemplateCompiler(text, opts = {}) {
  const componentName = opts.name || 'unknown';
  const staticMode = opts.static === true;

  try {
    if (!staticMode) {
      // Allow Fez namespace syntax as alias for fez-attr
      text = text.replace(/\bfez:([a-z][a-z0-9-]*)=/gi, 'fez-$1=');

      // Strict event handlers: `on<event>!="body"` runs the body only when the
      // element itself is the target (no child captured the event) and swallows
      // it (stopPropagation + preventDefault). Body must be a single expression.
      text = text.replace(
        /\bon([a-z]+)!=(["'])([\s\S]*?)\2/gi,
        (_, ev, q, body) => `on${ev}=${q}fez.fezBang(event) && (${body})${q}`,
      );
    }

    // Convert class:name={expr} conditional class directives
    // e.g. class:active={state.value === key} -> merges ternary into class attribute
    text = mapTags(text, rewriteClassDirectives);
    mapTags(text, rejectForeignAttrs);

    // Error if fez-keep is placed on a fez component (custom element with dash in tag name)
    const keepOnComponent = text.match(/<([a-z]+-[a-z][a-z0-9-]*)\b[^>]*\bfez-keep=/);
    if (keepOnComponent) {
      console.error(
        `FEZ: fez:keep must be on plain HTML elements, not on fez components. Found on <${keepOnComponent[1]}> in <${componentName}>`,
      );
    }

    // Process block definitions and references before parsing
    const blocks = {};
    text = text.replace(/\{@block\s+(\w+)\}([\s\S]*?)\{\/block\}/g, (_, name, content) => {
      blocks[name] = content;
      return '';
    });
    text = text.replace(/\{@block:(\w+)\}/g, (_, name) => blocks[name] || '');

    // Convert :attr="expr" to a render slot lookup (see lib/render-slots.js).
    // The value is parked on the parent at render time and the HTML carries
    // only the slot key, so loop variables and objects can be passed as props.
    // :file="el.file" -> :file={`Fez(${UID}).fezGlobals.value(${fez.fezGlobals.set(el.file)})`}
    // Supports variable access, method calls, ternaries, arrow funcs, etc.
    if (!staticMode) {
      text = mapTags(text, rewriteColonProps);

      // Remove HTML comments
      text = text.replace(/<!--[\s\S]*?-->/g, '');

      text = stripNodeWhitespace(text).trim();
    }

    // Convert self-closing tags to paired tags (shared with connect/compile)
    text = closeCustomTags(text);

    // Convert self-closing <slot /> to <slot></slot>
    text = text.replace(/<slot\s*\/>/gi, '<slot></slot>');

    // Auto-generate internal fez-key markers for stable morph diffing, and ids
    // for static fez-this elements (see autoInjectKeys).
    if (!staticMode) {
      text = autoInjectKeys(text);
    }

    // Parse and build template literal
    let result = '';
    let i = 0;
    const ifStack = []; // Track if blocks have else
    const loopVarStack = []; // Track all loop variables for arrow function transformation
    const loopItemVarStack = []; // Track item vars (non-index) that could be objects
    const loopMaybeItemStack = []; // Vars that are an index or an object, known at render time
    const loopStack = []; // Track loop info for :else support
    const blockStack = []; // Open blocks in nesting order: { kind, open }
    const awaitStack = []; // Track await blocks for :then/:catch
    let awaitCounter = 0; // Unique ID for each await block
    let rawFrom = 0; // body range of the current <script>/<style>, copied verbatim
    let rawUntil = -1;

    const openBlock = (kind, open) => blockStack.push({ kind, open });
    const closeBlock = (kind, close) => {
      const top = blockStack.pop();
      if (top?.kind !== kind) {
        throw new Error(
          top ? `{${close}} closes {${top.open}}` : `{${close}} without an open block`,
        );
      }
    };
    const currentBlock = () => blockStack[blockStack.length - 1]?.kind;
    const currentAwait = (tag) => {
      if (currentBlock() !== 'await') {
        throw new Error(`{${tag}} without matching {#await}`);
      }
      return awaitStack[awaitStack.length - 1];
    };

    while (i < text.length) {
      // <script> / <style> bodies are raw text: their braces are JS and CSS, not expressions
      const rawOpen = text[i] === '<' && text.slice(i, i + 8).match(/^<(script|style)\b/i);
      if (rawOpen) {
        const close = text.slice(i).search(new RegExp(`</${rawOpen[1]}\\s*>`, 'i'));
        const end = close < 0 ? text.length : i + close;
        const openEnd = scanTagEnd(text, i + 1);
        // the opening tag itself may hold {expressions}; only the body is raw
        if (openEnd > 0 && openEnd < end) {
          rawUntil = end;
          rawFrom = openEnd + 1;
        }
      }
      if (rawUntil > i && i >= rawFrom) {
        result += text.slice(i, rawUntil).replace(/[\\`]|\$\{/g, (m) => '\\' + m);
        i = rawUntil;
        continue;
      }

      // A backtick in text content is a plain character (`code` in prose)
      if (text[i] === '`' && !insideTag(text, i)) {
        result += '\\`';
        i++;
        continue;
      }

      // Skip JavaScript template literals (backtick strings) in attribute code:
      // onclick="go(`${x}`)" is JS, not a Fez expression
      if (text[i] === '`') {
        result += '\\`';
        i++;
        // Copy everything until closing backtick
        while (i < text.length && text[i] !== '`') {
          if (text[i] === '\\') {
            // Handle escaped characters
            result += '\\\\';
            i++;
            if (i < text.length) {
              if (text[i] === '`') {
                result += '\\`';
              } else if (text[i] === '$') {
                result += '\\$';
              } else {
                result += text[i];
              }
              i++;
            }
          } else if (text[i] === '$' && text[i + 1] === '{') {
            // Keep JS template literal interpolation as-is (escape $ for outer template)
            result += '\\${';
            i += 2;
            // Copy until matching }
            let depth = 1;
            while (i < text.length && depth > 0) {
              if (text[i] === '{') {
                depth++;
              } else if (text[i] === '}') {
                depth--;
              }
              if (depth > 0 || text[i] !== '}') {
                if (text[i] === '`') {
                  result += '\\`';
                } else if (text[i] === '\\') {
                  result += '\\\\';
                } else {
                  result += text[i];
                }
              } else {
                result += '}';
              }
              i++;
            }
          } else {
            // Regular character inside backticks - escape special chars for outer template
            if (text[i] === '$') {
              result += '\\$';
            } else {
              result += text[i];
            }
            i++;
          }
        }
        if (i < text.length) {
          result += '\\`';
          i++;
        }
        continue;
      }

      // Escaped brace: \{ and \} are literal braces
      if (text[i] === '\\' && (text[i + 1] === '{' || text[i + 1] === '}')) {
        result += text[i + 1];
        i += 2;
        continue;
      }

      // Expression or directive
      if (text[i] === '{') {
        const { expression, endIndex } = extractBracedExpression(text, i);
        let expr = expression.trim();

        // Check if this is a JavaScript object literal (e.g., {d: 'top'}, {foo: 1, bar: 2})
        // Object literals start with key: where key is identifier or quoted string
        if (/^(\w+|"\w+"|'\w+')\s*:/.test(expr)) {
          // Keep object literal as-is in the output
          result += '{' + expression + '}';
          i = endIndex + 1;
          continue;
        }

        // Block directives
        const elseIf = expr.match(ELSE_IF_RE);
        if (expr.startsWith('#if ')) {
          const cond = expr.slice(4);
          result += '${Fez.isTruthy(' + cond + ') ? `';
          ifStack.push(false); // No else yet
          openBlock('if', '#if');
        } else if (expr.startsWith('#unless ')) {
          const cond = expr.slice(8);
          result += '${!Fez.isTruthy(' + cond + ') ? `';
          ifStack.push(false); // No else yet
          openBlock('if', '#unless');
        } else if (expr === ':else' || expr === 'else') {
          if (currentBlock() === 'loop') {
            // :else inside a loop - for empty array case
            loopStack[loopStack.length - 1].hasElse = true;
            result += '`).join("") : `';
          } else if (currentBlock() === 'if') {
            result += '` : `';
            ifStack[ifStack.length - 1] = true; // Has else
          } else {
            throw new Error('{:else} without matching {#if}, {#unless}, {#each}, or {#for}');
          }
        } else if (elseIf) {
          if (currentBlock() !== 'if') {
            throw new Error(`{${expr}} without matching {#if}`);
          }
          result += '` : Fez.isTruthy(' + expr.slice(elseIf[0].length) + ') ? `';
          // Keep hasElse as false - still need final else
        } else if (expr === '/if' || expr === '/unless') {
          closeBlock('if', expr);
          const hasElse = ifStack.pop();
          result += hasElse ? '`}' : '` : ``}';
        } else if (expr.startsWith('#each ') || expr.startsWith('#for ')) {
          const isEach = expr.startsWith('#each ');
          let collection, binding;

          if (isEach) {
            const rest = expr.slice(6);
            // last " as ": the collection expression may contain one
            const asIdx = rest.lastIndexOf(' as ');
            if (asIdx < 0) {
              throw new Error(`{#each} is missing " as ": {${expr}}`);
            }
            collection = rest.slice(0, asIdx).trim();
            binding = rest.slice(asIdx + 4).trim();
          } else {
            const rest = expr.slice(5);
            const inIdx = rest.indexOf(' in ');
            if (inIdx < 0) {
              throw new Error(`{#for} is missing " in ": {${expr}}`);
            }
            binding = rest.slice(0, inIdx).trim();
            collection = rest.slice(inIdx + 4).trim();
          }

          const depth = loopStack.length;
          const collectionExpr = buildCollectionExpr(collection, binding);
          const { params, implicitIndex } = buildLoopParams(binding, depth, loopVarStack.flat());

          // Track loop variables for arrow function transformation
          loopVarStack.push(getLoopVarNames(binding, implicitIndex));
          loopItemVarStack.push(getLoopItemVars(binding, !isEach));
          // {#each list as item, x}: x is the index of an array but the value of an
          // object, so handlers decide at render time (see transformArrowToHandler)
          const pairVars = getLoopItemVars(binding, true);
          loopMaybeItemStack.push(isEach ? pairVars.filter((v) => !loopItemVarStack.at(-1).includes(v)) : []);

          // ((_arr) => _arr.length ? _arr.map(...).join('') : elseContent)(collection)
          loopStack.push({ collectionExpr, hasElse: false, depth });
          openBlock('loop', isEach ? '#each' : '#for');

          result += '${((_arr) => _arr.length ? _arr.map((' + params + ') => `';
        } else if (expr === '/each' || expr === '/for') {
          closeBlock('loop', expr);
          loopVarStack.pop(); // Remove loop vars when exiting loop
          loopItemVarStack.pop(); // Remove item vars when exiting loop
          loopMaybeItemStack.pop();
          const loopInfo = loopStack.pop();
          if (loopInfo.hasElse) {
            // Close the else branch
            result += '`)(' + loopInfo.collectionExpr + ')}';
          } else {
            // No else - just close the ternary with empty string
            result += '`).join("") : "")(' + loopInfo.collectionExpr + ')}';
          }
        }
        // {#await promise}...{:then value}...{:catch error}...{/await}
        else if (expr.startsWith('#await ')) {
          // Inside a loop every iteration is its own await block: the id carries
          // the hidden index of each loop whose body (not :else) encloses it
          const loopKeys = loopStack.filter((l) => !l.hasElse).map((l) => ` + "-" + _fezI${l.depth}`);
          awaitStack.push({
            awaitKey: `"${awaitCounter++}"${loopKeys.join('')}`,
            promiseExpr: expr.slice(7).trim(),
            hasThen: false,
            hasCatch: false,
          });
          openBlock('await', '#await');
          // Start with pending block - Fez.await returns { status, value, error }
          result += '${((_aw) => _aw.status === "pending" ? `';
        } else if (expr === ':then' || expr.startsWith(':then ')) {
          const awaitInfo = currentAwait(':then');
          awaitInfo.hasThen = true;
          // optional value binding: {:then value} or just {:then}
          const thenVar = expr.slice(5).trim() || '_value';
          result += '` : _aw.status === "resolved" ? ((' + thenVar + ') => `';
        } else if (expr === ':catch' || expr.startsWith(':catch ')) {
          const awaitInfo = currentAwait(':catch');
          awaitInfo.hasCatch = true;
          // optional error binding: {:catch error} or just {:catch}
          const catchVar = expr.slice(6).trim() || '_error';
          // close the :then block first, if any
          result +=
            (awaitInfo.hasThen ? '`)(_aw.value)' : '`') +
            ' : _aw.status === "rejected" ? ((' +
            catchVar +
            ') => `';
        } else if (expr === '/await') {
          closeBlock('await', expr);
          const awaitInfo = awaitStack.pop();
          // pending ? ... : resolved ? ...then... : rejected ? ...catch... : ``
          const tail = awaitInfo.hasCatch
            ? '`)(_aw.error)'
            : awaitInfo.hasThen
              ? '`)(_aw.value)'
              : '`';
          result +=
            tail +
            ' : ``)(Fez.fezAwait(fez, ' +
            awaitInfo.awaitKey +
            ', ' +
            awaitInfo.promiseExpr +
            (awaitInfo.hasCatch ? ', true' : '') +
            '))}';
        } else if (expr.startsWith('@html ')) {
          const content = expr.slice(6);
          result += '${' + content + '}';
        } else if (expr.startsWith('@json ')) {
          const content = expr.slice(6);
          result +=
            '${`<pre class="json">${Fez.htmlEscape(JSON.stringify(' +
            content +
            ', null, 2))}</pre>`}';
        } else if (/^[#@/]/.test(expr) || /^:[a-z]/.test(expr)) {
          throw new Error(`Unknown template directive {${expr}}${directiveHint(expr)}`);
        } else if (
          (isArrowFunction(expr) && getAttributeContext(text, i)) ||
          (/^[A-Za-z_$][\w$]*$/.test(expr) && getEventAttributeContext(text, i))
        ) {
          // onclick={save} is the method reference: call it with the event
          if (!isArrowFunction(expr)) {
            expr = `(event) => ${expr}(event)`;
          }
          if (getEventAttributeContext(text, i)) {
            // Event attribute: compile to handler code, with interpolation for loop vars
            const allLoopVars = loopVarStack.flat();
            const allItemVars = loopItemVarStack.flat();
            const handler = transformArrowToHandler(expr, allLoopVars, allItemVars, loopMaybeItemStack.flat());
            result += '"' + handler.replace(/"/g, '&quot;') + '"';
          } else {
            // Any other attribute (fez:use) gets the function source as its value
            result += '"' + escapeLiteralAttr(expr) + '"';
          }
        } else {
          const attrContext = getAttributeContext(text, i);
          const written = attrContext && result.match(/\s([^\s=]+)\s*=\s*$/);
          if (written?.[1].toLowerCase() === attrContext) {
            // name={expr}: the whole attribute comes from Fez.htmlAttr, so null
            // and a false boolean attribute leave it out
            result = result.slice(0, written.index);
            result += '${Fez.htmlAttr(' + JSON.stringify(written[1]) + ', ' + expr + ')}';
          } else if (attrContext) {
            // Inside attribute - wrap with quotes and escape
            result += '"${Fez.htmlEscape(' + expr + ')}"';
          } else if (/^on[a-z]+$/i.test(quotedAttrContext(text, i)?.name || '')) {
            // Inside quoted handler code (onclick="fez.rm('{id}')"): the value
            // lands in a JS string, so it is escaped for JS and then for HTML
            result += '${Fez.htmlEscape(Fez.jsEscape(' + expr + '))}';
          } else {
            // Regular content - just escape HTML
            result += '${Fez.htmlEscape(' + expr + ')}';
          }
        }

        i = endIndex + 1;
        continue;
      }

      // Escape special characters for template literal
      if (text[i] === '$' && text[i + 1] === '{') {
        result += '\\$';
      } else if (text[i] === '\\') {
        result += '\\\\';
      } else {
        result += text[i];
      }
      i++;
    }

    if (blockStack.length) {
      throw new Error(`{${blockStack[blockStack.length - 1].open}} is never closed`);
    }

    // Warn about dynamic fez-this values in dev mode (won't get auto-ID)
    if (typeof Fez !== 'undefined' && Fez.LOG) {
      const dynamicFezThis = result.match(/fez-this="[^"]*\{[^}]+\}[^"]*"/g);
      if (dynamicFezThis) {
        console.warn(
          `Fez <${componentName}>: Dynamic fez-this values won't get auto-ID for DOM differ matching:`,
          dynamicFezThis,
        );
      }
    }

    // Build the function
    const funcBody = `
      const fez = this;
      with (this) {
        return \`${result}\`
      }
    `;

    const tplFunc = new Function(funcBody);

    return (ctx) => {
      try {
        return tplFunc.bind(ctx)();
      } catch (e) {
        if (opts.strict) {
          throw new Error(
            `FEZ template runtime error in <${ctx.fezName || componentName}>: ${e.message}`,
            { cause: e },
          );
        }
        console.error(
          `FEZ template runtime error in <${ctx.fezName || componentName}>:`,
          e.message,
        );
        console.error('Template source:', result.substring(0, 500));
        // null, not '': the render keeps the last good DOM instead of morphing to empty
        return null;
      }
    };
  } catch (e) {
    if (opts.strict) {
      throw new Error(`FEZ template compile error in <${componentName}>: ${e.message}`, {
        cause: e,
      });
    }
    console.error(`FEZ template compile error in <${componentName}>:`, e.message);
    console.error('Template:', text.substring(0, 200));
    return () => '';
  }
}

// Svelte spellings that have a Fez equivalent
const DIRECTIVE_HINTS = {
  '@debug': 'use {@json value} or console.log in beforeRender()',
  '@render': 'pass markup as a child component or slot',
  '#snippet': 'use a child component, or {@block name}...{/block} for static markup',
};

function directiveHint(expr) {
  const hint = DIRECTIVE_HINTS[expr.match(/^[#@][a-z]+/)?.[0]];
  return hint ? ` - ${hint}` : '';
}

/**
 * Svelte attribute syntax that Fez spells differently fails loudly instead of
 * rendering as a dead attribute.
 */
function rejectForeignAttrs(tag) {
  for (const attr of scanAttributes(tag)) {
    if (/^on:/.test(attr.name)) {
      throw new Error(`${attr.name} is Svelte syntax - write on${attr.name.slice(3).split('|')[0]}={...}`);
    }
    if (/^bind:/.test(attr.name)) {
      throw new Error(`${attr.name} is Svelte syntax - use fez:bind="state.key" on inputs`);
    }
  }
  return tag;
}

// pos sits between `<tag` and its `>`
function insideTag(text, pos) {
  return text.lastIndexOf('<', pos) > text.lastIndexOf('>', pos);
}

// {:else if x}, {:elseif x}, {:elsif x} and the colonless forms
const ELSE_IF_RE = /^:?(?:else\s+if|elseif|elsif)\s+/;

/**
 * Static text placed as a quoted attribute value inside the generated
 * template literal: escaped for HTML, then for the template literal.
 */
function escapeLiteralAttr(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('\\', '\\\\')
    .replaceAll('`', '\\`')
    .replaceAll('${', '\\${');
}

/**
 * Merge class:name={expr} / class:name="expr" directives of one tag into its
 * class attribute (quoted or {expr}) as ternaries.
 */
/**
 * `:name="expr"`, `:name='expr'` and `:name={expr}` all hold one JS expression
 * (an object literal too: `:cfg="{a: 1}"`). Each becomes a render slot lookup,
 * so names may be hyphenated (`:data-x`) and values may use braces. Only an
 * attribute starting with `:` counts, so `xlink:href` / `xml:lang` stay as is.
 */
function rewriteColonProps(tag) {
  if (!/\s:[\w-]+=/.test(tag)) {
    return tag;
  }
  let out = '';
  let pos = 0;
  for (const attr of scanAttributes(tag)) {
    const expr = attr.value.trim();
    if (attr.name.length < 2 || attr.name[0] !== ':' || !attr.quote || !expr) {
      continue;
    }
    out += tag.slice(pos, attr.start);
    out += ` ${attr.name}={\`Fez(\${UID}).fezGlobals.value(\${fez.fezGlobals.set((${expr}))})\`}`;
    pos = attr.end;
  }
  return out + tag.slice(pos);
}

function rewriteClassDirectives(tag) {
  if (!/\sclass:[\w-]+=/.test(tag)) {
    return tag;
  }
  const attrs = scanAttributes(tag);
  const directives = attrs.filter((a) => a.name.startsWith('class:'));
  if (!directives.length) {
    return tag;
  }
  const classAttr = attrs.find((a) => a.name === 'class');
  const dropped = new Set([...directives, classAttr]);

  let out = '';
  let pos = 0;
  for (const attr of attrs) {
    if (dropped.has(attr)) {
      out += tag.slice(pos, attr.start);
      pos = attr.end;
    }
  }
  out += tag.slice(pos);

  const base = !classAttr
    ? ''
    : classAttr.quote === '{'
      ? `{${classAttr.value}}`
      : classAttr.value;
  const ternaries = directives.map((d) => ` {(${d.value}) ? '${d.name.slice(6)}' : ''}`).join('');
  return out.replace(/\s*(\/?>)$/, ` class="${(base + ternaries).trim()}"$1`);
}

// ---------------------------------------------------------------------------
// Auto-inject internal key markers for morph stability
// ---------------------------------------------------------------------------

/**
 * Auto-inject fez-key="N" markers on HTML elements for stable morph diffing.
 *
 * - Static elements get fez-key="N" (sequential counter)
 * - Elements inside {#each}/{#for} get fez-key="N-{_fezI0}": the hidden
 *   per-depth loop index (see buildLoopParams), so nested loops never collide
 * - Nested loops stack: fez-key="N-{_fezI0}-{_fezI1}"
 * - Elements that already have key= are skipped
 *
 * A static fez-this="name" without an id also gets id="fez-{UID}-name", so the
 * differ matches the node (and keeps typed input) across re-renders.
 *
 * @param {string} text - preprocessed template source
 * @returns {string} template with internal key markers injected
 */
function autoInjectKeys(text) {
  let keyCounter = 0;
  const scopeStack = []; // { type: 'block' | 'loop', depth?, inElse? }
  let result = '';
  let pos = 0;

  const injectTag = (tag) => {
    const attrs = scanAttributes(tag);
    let extra = '';

    const loops = scopeStack.filter((s) => s.type === 'loop' && !s.inElse);
    const suffix = loops.map((loop) => `-{_fezI${loop.depth}}`).join('');

    if (!attrs.some((a) => a.name === 'key')) {
      extra += ` fez-key="${keyCounter++}${suffix}"`;
    }

    // inside a loop the index keeps the id unique per row
    const fezThis = attrs.find((a) => a.name === 'fez-this');
    if (fezThis?.quote === '"' && !fezThis.value.includes('{') && !attrs.some((a) => a.name === 'id')) {
      extra += ` id="fez-{UID}-${fezThis.value.replace(/[^a-zA-Z0-9]/g, '-')}${suffix}"`;
    }

    return tag.endsWith('/>') ? tag.slice(0, -2) + extra + '/>' : tag.slice(0, -1) + extra + '>';
  };

  while (pos < text.length) {
    const ch = text[pos];
    if (ch === '\\' && text[pos + 1] === '{') {
      result += '\\{';
      pos += 2;
    } else if (ch === '{') {
      let end;
      try {
        end = extractBracedExpression(text, pos).endIndex;
      } catch {
        end = pos;
      }
      const directive = text.slice(pos + 1, end).trim();
      if (/^#(if|unless|await) /.test(directive)) {
        scopeStack.push({ type: 'block' });
      } else if (/^#(each|for) /.test(directive)) {
        const depth = scopeStack.filter((s) => s.type === 'loop').length;
        scopeStack.push({ type: 'loop', depth, inElse: false });
      } else if (/^\/(if|unless|await|each|for)$/.test(directive)) {
        scopeStack.pop();
      } else if (directive === ':else' || directive === 'else' || ELSE_IF_RE.test(directive)) {
        const top = scopeStack[scopeStack.length - 1];
        if (top?.type === 'loop') {
          top.inElse = true;
        }
      }
      result += text.slice(pos, end + 1);
      pos = end + 1;
    } else if (ch === '<' && /[a-zA-Z]/.test(text[pos + 1] || '')) {
      const end = scanTagEnd(text, pos + 1);
      if (end < 0) {
        result += text.slice(pos);
        break;
      }
      result += injectTag(text.slice(pos, end + 1));
      pos = end + 1;
    } else {
      result += ch;
      pos++;
    }
  }

  return result;
}
