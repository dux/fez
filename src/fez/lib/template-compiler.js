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
} from "./template-compiler-lib.js";

/**
 * Compile template to a function that returns HTML string
 *
 * @param {string} text - Template source
 * @param {Object} opts - Options
 * @param {string} opts.name - Component name for error messages
 */
export default function createTemplateCompiler(text, opts = {}) {
  const componentName = opts.name || "unknown";

  try {
    // Decode HTML entities that might have been encoded by browser DOM
    text = text
      .replaceAll("&#x60;", "`")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&");

    // Allow Fez namespace syntax as alias for fez-attr
    text = text.replace(/\bfez:([a-z]+)=/gi, "fez-$1=");

    // Convert class:name={expr} conditional class directives
    // e.g. class:active={state.value === key} -> merges ternary into class attribute
    text = text.replace(/<[a-z][a-z0-9-]*\b[^>]*>/gi, (tag) => {
      if (!/\bclass:[\w-]+=/.test(tag)) return tag;

      const directives = [];

      // Extract class:name={expr} directives (brace-delimited)
      tag = tag.replace(
        /\s*\bclass:([\w-]+)=\{([^}]*)\}/g,
        (_, name, expr) => {
          directives.push({ name, expr });
          return "";
        },
      );

      // Extract class:name="expr" directives (quote-delimited)
      tag = tag.replace(
        /\s*\bclass:([\w-]+)="([^"]*)"/g,
        (_, name, expr) => {
          directives.push({ name, expr });
          return "";
        },
      );

      if (!directives.length) return tag;

      const ternaries = directives
        .map((d) => ` {(${d.expr}) ? '${d.name}' : ''}`)
        .join("");

      if (/\bclass="/.test(tag)) {
        // Append to existing class attribute
        tag = tag.replace(
          /class="([^"]*)"/,
          (_, val) => `class="${val}${ternaries}"`,
        );
      } else {
        // No existing class - create one before closing >
        tag = tag.replace(/(\s*\/?>)$/, ` class="${ternaries.trim()}"$1`);
      }

      return tag;
    });

    // Error if fez-keep is placed on a fez component (custom element with dash in tag name)
    const keepOnComponent = text.match(
      /<([a-z]+-[a-z][a-z0-9-]*)\b[^>]*\bfez-keep=/,
    );
    if (keepOnComponent) {
      console.error(
        `FEZ: fez:keep must be on plain HTML elements, not on fez components. Found on <${keepOnComponent[1]}> in <${componentName}>`,
      );
    }

    // Process block definitions and references before parsing
    const blocks = {};
    text = text.replace(
      /\{@block\s+(\w+)\}([\s\S]*?)\{\/block\}/g,
      (_, name, content) => {
        blocks[name] = content;
        return "";
      },
    );
    text = text.replace(/\{@block:(\w+)\}/g, (_, name) => blocks[name] || "");

    // Convert :attr="expr" to use Fez(UID).fezGlobals for passing values through DOM
    // This allows loop variables to be passed as props to child components
    // :file="el.file" -> :file={`Fez(${UID}).fezGlobals.delete(${fez.fezGlobals.set(el.file)})`}
    // Uses Fez(UID) so child component can find parent's fezGlobals
    text = text.replace(/:(\w+)="([^"{}]+)"/g, (match, attr, expr) => {
      // Only convert if expr looks like a variable access (not a string literal)
      if (/^[\w.[\]]+$/.test(expr.trim())) {
        return `:${attr}={\`Fez(\${UID}).fezGlobals.delete(\${fez.fezGlobals.set(${expr})})\`}`;
      }
      return match;
    });

    // Remove HTML comments
    text = text.replace(/<!--[\s\S]*?-->/g, "");

    // Normalize whitespace between tags
    text = text.replace(/>\s+</g, "><").trim();

    // Convert self-closing custom elements to paired tags
    // <ui-icon name="foo" /> -> <ui-icon name="foo"></ui-icon>
    // Custom elements contain a hyphen in the tag name
    // Uses (?:[^>]|=>) to skip => (arrow functions) inside attributes
    text = text.replace(
      /<([a-z][a-z0-9]*-[a-z0-9-]*)((?:=>|[^>])*)>/gi,
      (match, tag, attrs) => {
        if (attrs.trimEnd().endsWith("/")) {
          return `<${tag}${attrs.replace(/\s*\/$/, "")}></${tag}>`;
        }
        return match;
      },
    );

    // Convert self-closing <slot /> to <slot></slot>
    text = text.replace(/<slot\s*\/>/gi, "<slot></slot>");

    // Auto-generate key attributes on HTML elements for stable morph diffing.
    // Elements without key= get a sequential key injected. Elements inside
    // {#each}/{#for} loops include the loop index variable in the key.
    // User-provided key= attributes are preserved as-is.
    text = autoInjectKeys(text);

    // Parse and build template literal
    let result = "";
    let i = 0;
    const ifStack = []; // Track if blocks have else
    const loopVarStack = []; // Track all loop variables for arrow function transformation
    const loopItemVarStack = []; // Track item vars (non-index) that could be objects
    const loopStack = []; // Track loop info for :else support
    const blockStack = []; // Track if/loop nesting order for :else handling
    const awaitStack = []; // Track await blocks for :then/:catch
    let awaitCounter = 0; // Unique ID for each await block

    while (i < text.length) {
      // Skip JavaScript template literals (backtick strings)
      // Content inside backticks should not be processed as Fez expressions
      if (text[i] === "`") {
        result += "\\`";
        i++;
        // Copy everything until closing backtick
        while (i < text.length && text[i] !== "`") {
          if (text[i] === "\\") {
            // Handle escaped characters
            result += "\\\\";
            i++;
            if (i < text.length) {
              if (text[i] === "`") {
                result += "\\`";
              } else if (text[i] === "$") {
                result += "\\$";
              } else {
                result += text[i];
              }
              i++;
            }
          } else if (text[i] === "$" && text[i + 1] === "{") {
            // Keep JS template literal interpolation as-is (escape $ for outer template)
            result += "\\${";
            i += 2;
            // Copy until matching }
            let depth = 1;
            while (i < text.length && depth > 0) {
              if (text[i] === "{") depth++;
              else if (text[i] === "}") depth--;
              if (depth > 0 || text[i] !== "}") {
                if (text[i] === "`") result += "\\`";
                else if (text[i] === "\\") result += "\\\\";
                else result += text[i];
              } else {
                result += "}";
              }
              i++;
            }
          } else {
            // Regular character inside backticks - escape special chars for outer template
            if (text[i] === "$") {
              result += "\\$";
            } else {
              result += text[i];
            }
            i++;
          }
        }
        if (i < text.length) {
          result += "\\`";
          i++;
        }
        continue;
      }

      // Escaped brace
      if (text[i] === "\\" && text[i + 1] === "{") {
        result += "{";
        i += 2;
        continue;
      }

      // Expression or directive
      if (text[i] === "{") {
        const { expression, endIndex } = extractBracedExpression(text, i);
        const expr = expression.trim();

        // Check if this is a JavaScript object literal (e.g., {d: 'top'}, {foo: 1, bar: 2})
        // Object literals start with key: where key is identifier or quoted string
        if (/^(\w+|"\w+"|'\w+')\s*:/.test(expr)) {
          // Keep object literal as-is in the output
          result += "{" + expression + "}";
          i = endIndex + 1;
          continue;
        }

        // Block directives
        if (expr.startsWith("#if ")) {
          const cond = expr.slice(4);
          result += "${Fez.isTruthy(" + cond + ") ? `";
          ifStack.push(false); // No else yet
          blockStack.push("if");
        } else if (expr.startsWith("#unless ")) {
          const cond = expr.slice(8);
          result += "${!Fez.isTruthy(" + cond + ") ? `";
          ifStack.push(false); // No else yet
          blockStack.push("if");
        } else if (expr === ":else" || expr === "else") {
          const currentBlock = blockStack[blockStack.length - 1];
          if (currentBlock === "loop") {
            // :else inside a loop - for empty array case
            const loopInfo = loopStack[loopStack.length - 1];
            loopInfo.hasElse = true;
            result += '`).join("") : `';
          } else if (currentBlock === "if") {
            // :else inside an if block
            result += "` : `";
            ifStack[ifStack.length - 1] = true; // Has else
          } else {
            throw new Error("{:else} without matching {#if}, {#unless}, {#each}, or {#for}");
          }
        } else if (
          expr.startsWith(":else if ") ||
          expr.startsWith("else if ") ||
          expr.startsWith("elsif ") ||
          expr.startsWith("elseif ")
        ) {
          const cond = expr.startsWith(":else if ")
            ? expr.slice(9)
            : expr.startsWith("else if ")
              ? expr.slice(8)
              : expr.startsWith("elseif ")
                ? expr.slice(7)
                : expr.slice(6);
          result += "` : Fez.isTruthy(" + cond + ") ? `";
          // Keep hasElse as false - still need final else
        } else if (expr === "/if" || expr === "/unless") {
          const hasElse = ifStack.pop();
          blockStack.pop();
          result += hasElse ? "`}" : "` : ``}";
        } else if (expr.startsWith("#each ") || expr.startsWith("#for ")) {
          const isEach = expr.startsWith("#each ");
          let collection, binding;

          if (isEach) {
            const rest = expr.slice(6);
            const asIdx = rest.indexOf(" as ");
            collection = rest.slice(0, asIdx).trim();
            binding = rest.slice(asIdx + 4).trim();
          } else {
            const rest = expr.slice(5);
            const inIdx = rest.indexOf(" in ");
            binding = rest.slice(0, inIdx).trim();
            collection = rest.slice(inIdx + 4).trim();
          }

          const collectionExpr = buildCollectionExpr(collection, binding);
          const loopParams = buildLoopParams(binding);

          // Track loop variables for arrow function transformation
          loopVarStack.push(getLoopVarNames(binding));
          loopItemVarStack.push(getLoopItemVars(binding));

          // Track loop info for :else support
          // Use a wrapper that allows checking length and provides else support
          // ((_arr) => _arr.length ? _arr.map(...).join('') : elseContent)(collection)
          loopStack.push({ collectionExpr, hasElse: false });
          blockStack.push("loop");

          result +=
            "${((_arr) => _arr.length ? _arr.map((" + loopParams + ") => `";
        } else if (expr === "/each" || expr === "/for") {
          loopVarStack.pop(); // Remove loop vars when exiting loop
          loopItemVarStack.pop(); // Remove item vars when exiting loop
          const loopInfo = loopStack.pop();
          blockStack.pop();
          if (loopInfo.hasElse) {
            // Close the else branch
            result += "`)(" + loopInfo.collectionExpr + ")}";
          } else {
            // No else - just close the ternary with empty string
            result += '`).join("") : "")(' + loopInfo.collectionExpr + ")}";
          }
        }
        // {#await promise}...{:then value}...{:catch error}...{/await}
        else if (expr.startsWith("#await ")) {
          const promiseExpr = expr.slice(7).trim();
          const awaitId = awaitCounter++;
          awaitStack.push({
            awaitId,
            promiseExpr,
            hasThen: false,
            hasCatch: false,
            thenVar: "_value",
            catchVar: "_error",
          });
          // Start with pending block - Fez.await returns { status, value, error }
          result += '${((_aw) => _aw.status === "pending" ? `';
        } else if (expr.startsWith(":then")) {
          const awaitInfo = awaitStack[awaitStack.length - 1];
          if (awaitInfo) {
            awaitInfo.hasThen = true;
            // Extract optional value binding: {:then value} or just {:then}
            awaitInfo.thenVar = expr.slice(5).trim() || "_value";
            result +=
              '` : _aw.status === "resolved" ? ((' +
              awaitInfo.thenVar +
              ") => `";
          }
        } else if (expr.startsWith(":catch")) {
          const awaitInfo = awaitStack[awaitStack.length - 1];
          if (awaitInfo) {
            awaitInfo.hasCatch = true;
            // Extract optional error binding: {:catch error} or just {:catch}
            awaitInfo.catchVar = expr.slice(6).trim() || "_error";
            if (awaitInfo.hasThen) {
              // Close the :then block, open :catch
              result +=
                '`)(_aw.value) : _aw.status === "rejected" ? ((' +
                awaitInfo.catchVar +
                ") => `";
            } else {
              // No :then block, go directly from pending to catch (skip resolved state)
              result +=
                '` : _aw.status === "rejected" ? ((' +
                awaitInfo.catchVar +
                ") => `";
            }
          }
        } else if (expr === "/await") {
          const awaitInfo = awaitStack.pop();
          if (awaitInfo) {
            // Close the await expression
            // The structure depends on which blocks were present:
            // - pending + then + catch: pending ? ... : resolved ? ...then... : ...catch...
            // - pending + then: pending ? ... : resolved ? ...then... : ``
            // - pending + catch: pending ? ... : rejected ? ...catch... : ``
            // - pending only: pending ? ... : ``
            if (awaitInfo.hasThen && awaitInfo.hasCatch) {
              result +=
                "`)(_aw.error) : ``)(Fez.fezAwait(fez, " +
                awaitInfo.awaitId +
                ", " +
                awaitInfo.promiseExpr +
                "))}";
            } else if (awaitInfo.hasThen) {
              result +=
                "`)(_aw.value) : ``)(Fez.fezAwait(fez, " +
                awaitInfo.awaitId +
                ", " +
                awaitInfo.promiseExpr +
                "))}";
            } else if (awaitInfo.hasCatch) {
              result +=
                "`)(_aw.error) : ``)(Fez.fezAwait(fez, " +
                awaitInfo.awaitId +
                ", " +
                awaitInfo.promiseExpr +
                "))}";
            } else {
              // Only pending block (no :then or :catch)
              result +=
                "` : ``)(Fez.fezAwait(fez, " +
                awaitInfo.awaitId +
                ", " +
                awaitInfo.promiseExpr +
                "))}";
            }
          }
        } else if (expr.startsWith("@html ")) {
          const content = expr.slice(6);
          result += "${" + content + "}";
        } else if (expr.startsWith("@json ")) {
          const content = expr.slice(6);
          result +=
            '${`<pre class="json">${Fez.htmlEscape(JSON.stringify(' +
            content +
            ", null, 2))}</pre>`}";
        } else if (isArrowFunction(expr)) {
          // Arrow function - check if we're in an event attribute
          const eventAttr = getEventAttributeContext(text, i);
          if (eventAttr) {
            // Get all current loop variables
            const allLoopVars = loopVarStack.flat();
            const allItemVars = loopItemVarStack.flat();
            let handler = transformArrowToHandler(
              expr,
              allLoopVars,
              allItemVars,
            );
            // Escape double quotes for HTML attribute
            handler = handler.replace(/"/g, "&quot;");
            // Output as quoted attribute value with interpolation for loop vars
            result += '"' + handler + '"';
          } else {
            // Arrow function outside event attribute - just output as expression
            result += "${" + expr + "}";
          }
        } else {
          // Plain expression - check if inside attribute
          const attrContext = getAttributeContext(text, i);
          if (attrContext) {
            // Inside attribute - wrap with quotes and escape
            result += '"${Fez.htmlEscape(' + expr + ')}"';
          } else {
            // Regular content - just escape HTML
            result += "${Fez.htmlEscape(" + expr + ")}";
          }
        }

        i = endIndex + 1;
        continue;
      }

      // Escape special characters for template literal
      if (text[i] === "$" && text[i + 1] === "{") {
        result += "\\$";
      } else if (text[i] === "\\") {
        result += "\\\\";
      } else {
        result += text[i];
      }
      i++;
    }

    // Auto-generate IDs for fez-this elements (static values only)
    // This helps the DOM differ match and preserve nodes across re-renders
    result = result.replace(
      /(<[a-z][a-z0-9-]*\s+)([^>]*?)(fez-this="([^"{}]+)")([^>]*?)>/gi,
      (match, tagStart, before, fezThisAttr, fezThisValue, after) => {
        // Skip if id already exists
        if (/\bid=/.test(before) || /\bid=/.test(after)) {
          return match;
        }
        // Sanitize: replace non-alphanumeric with -
        const sanitized = fezThisValue.replace(/[^a-zA-Z0-9]/g, "-");
        return `${tagStart}${before}${fezThisAttr}${after} id="fez-\${UID}-${sanitized}">`;
      },
    );

    // Warn about dynamic fez-this values in dev mode (won't get auto-ID)
    if (typeof Fez !== "undefined" && Fez.LOG) {
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
        console.error(
          `FEZ template runtime error in <${ctx.fezName || componentName}>:`,
          e.message,
        );
        console.error("Template source:", result.substring(0, 500));
        return "";
      }
    };
  } catch (e) {
    console.error(
      `FEZ template compile error in <${componentName}>:`,
      e.message,
    );
    console.error("Template:", text.substring(0, 200));
    return () => "";
  }
}

// ---------------------------------------------------------------------------
// Auto-inject key attributes for morph stability
// ---------------------------------------------------------------------------

/**
 * Extract loop index variable name from a block directive.
 * {#each items as item, idx} -> "idx"
 * {#each items as item}      -> "i"
 * {#for item in items}       -> "i"
 */
function getLoopIndexVar(directive) {
  if (directive.startsWith("#each ")) {
    const rest = directive.slice(6);
    const asIdx = rest.indexOf(" as ");
    if (asIdx < 0) return "i";
    const binding = rest.slice(asIdx + 4).trim();
    const parts = binding.split(",").map((s) => s.trim());
    return parts.length >= 2 ? parts[parts.length - 1] : "i";
  }
  if (directive.startsWith("#for ")) {
    const rest = directive.slice(5);
    const inIdx = rest.indexOf(" in ");
    if (inIdx < 0) return "i";
    const binding = rest.slice(0, inIdx).trim();
    const parts = binding.split(",").map((s) => s.trim());
    // 3+ params: last is explicit index (e.g., {#for key, val, idx in obj})
    if (parts.length >= 3) return parts[parts.length - 1];
    // 1-2 params: implicit index 'i'
    return "i";
  }
  return "i";
}

/**
 * Auto-inject key="N" attributes on HTML elements for stable morph diffing.
 *
 * - Static elements get key="N" (sequential counter)
 * - Elements inside {#each}/{#for} get key="N-{indexVar}" (dynamic per iteration)
 * - Nested loops stack: key="N-{i}-{j}"
 * - Elements that already have key= are skipped
 *
 * @param {string} text - preprocessed template source
 * @returns {string} template with key attributes injected
 */
function autoInjectKeys(text) {
  let result = "";
  let pos = 0;
  let keyCounter = 0;
  const scopeStack = []; // {type: 'if'|'loop', indexVar?: string, inElse?: boolean}

  while (pos < text.length) {
    // Block directives: {#...}, {/...}, {:...}
    if (
      text[pos] === "{" &&
      pos + 1 < text.length &&
      /[#/:]/.test(text[pos + 1])
    ) {
      let j = pos + 1;
      let depth = 1;
      while (j < text.length) {
        if (text[j] === "{") depth++;
        else if (text[j] === "}") {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }

      const directive = text.slice(pos + 1, j).trim();

      if (directive.startsWith("#if ") || directive.startsWith("#unless ")) {
        scopeStack.push({ type: "if" });
      } else if (
        directive.startsWith("#each ") ||
        directive.startsWith("#for ")
      ) {
        scopeStack.push({
          type: "loop",
          indexVar: getLoopIndexVar(directive),
          inElse: false,
        });
      } else if (directive === "/if" || directive === "/unless") {
        if (scopeStack.length) scopeStack.pop();
      } else if (directive === "/each" || directive === "/for") {
        if (scopeStack.length) scopeStack.pop();
      } else if (
        directive === ":else" ||
        directive === "else" ||
        directive.startsWith(":else if ") ||
        directive.startsWith("else if ")
      ) {
        // Mark loop scope as "in else" so elements don't get index suffix
        const top = scopeStack[scopeStack.length - 1];
        if (top && top.type === "loop") {
          top.inElse = true;
        }
      }

      result += text.slice(pos, j + 1);
      pos = j + 1;
      continue;
    }

    // Opening HTML tag
    if (
      text[pos] === "<" &&
      pos + 1 < text.length &&
      /[a-zA-Z]/.test(text[pos + 1])
    ) {
      // Find closing > while skipping quoted strings and {expr} blocks
      let j = pos + 1;
      while (j < text.length) {
        if (text[j] === '"' || text[j] === "'") {
          const q = text[j++];
          while (j < text.length && text[j] !== q) j++;
        } else if (text[j] === "{") {
          let d = 1;
          j++;
          while (j < text.length && d > 0) {
            if (text[j] === "{") d++;
            else if (text[j] === "}") d--;
            j++;
          }
          continue;
        } else if (text[j] === ">") {
          break;
        }
        j++;
      }

      const tag = text.slice(pos, j + 1);

      // Skip closing tags
      if (text[pos + 1] === "/") {
        result += tag;
        pos = j + 1;
        continue;
      }

      // Skip if already has key=
      if (/\bkey\s*=/.test(tag)) {
        result += tag;
        pos = j + 1;
        continue;
      }

      // Build key value
      const n = keyCounter++;
      const activeLoops = scopeStack.filter(
        (s) => s.type === "loop" && !s.inElse,
      );
      let keyValue;
      if (activeLoops.length > 0) {
        const suffix = activeLoops.map((s) => `-{${s.indexVar}}`).join("");
        keyValue = `${n}${suffix}`;
      } else {
        keyValue = `${n}`;
      }

      // Inject key before closing > or />
      if (tag.trimEnd().endsWith("/>")) {
        const slashPos = tag.lastIndexOf("/");
        result += tag.slice(0, slashPos) + ` key="${keyValue}"/>`;
      } else {
        result += tag.slice(0, -1) + ` key="${keyValue}">`;
      }

      pos = j + 1;
      continue;
    }

    result += text[pos];
    pos++;
  }

  return result;
}
