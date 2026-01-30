/**
 * Fez Component Compiler
 *
 * Compiles component definitions from various sources:
 * - <template fez="name">...</template>
 * - <xmp fez="name">...</xmp>
 * - <script fez="name">...</script>
 * - Remote URLs
 *
 * Flow:
 * 1. Source (template/xmp/url) -> compile()
 * 2. Extract parts (script/style/html/demo) -> compileToClass()
 * 3. Generate class string -> Fez('name', class { ... })
 */

import demo from "./lib/demo.js";

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Remove common leading whitespace from all lines
 */
function dedent(text) {
  const lines = text.split("\n");
  // Find minimum indentation (ignoring empty lines)
  const nonEmptyLines = lines.filter((l) => l.trim());
  if (!nonEmptyLines.length) return text;

  const minIndent = Math.min(
    ...nonEmptyLines.map((l) => l.match(/^(\s*)/)[1].length),
  );
  if (minIndent === 0) return text;

  // Remove common indentation
  return lines.map((l) => l.slice(minIndent)).join("\n");
}

// =============================================================================
// MAIN COMPILE FUNCTION
// =============================================================================

/**
 * Check if HTML has top-level <xmp fez> or <template fez> elements
 * (not ones inside <demo> blocks)
 */
function hasTopLevelFezElements(html) {
  if (!html) return false;

  // Remove content inside <demo>...</demo> to avoid false positives
  const withoutDemo = html.replace(/<demo>[\s\S]*?<\/demo>/gi, "");

  // Check for <xmp fez= or <template fez= at top level
  return /<(xmp|template)\s+fez\s*=/i.test(withoutDemo);
}

/**
 * Compile a Fez component
 *
 * @example
 * Fez.compile()                        // Compile all templates in document
 * Fez.compile(templateNode)            // Compile a template node
 * Fez.compile('ui-foo', htmlString)    // Compile from string
 *
 * @param {string|Node} tagName - Component name or template node
 * @param {string} [html] - Component HTML source
 */
export default function compile(tagName, html) {
  // Single argument: compile node or all templates
  if (arguments.length === 1) {
    return compileBulk(tagName);
  }

  // Multiple xmp/template tags in html? Process them
  // Check for top-level fez definitions (not ones inside <demo> blocks)
  if (hasTopLevelFezElements(html)) {
    // Extract top-level demo/info before processing inner components
    if (tagName) {
      const parts = compileToClass(html);
      if (parts.info?.trim()) {
        demo.infoList[tagName] = parts.info;
      }
      if (parts.demo?.trim()) {
        demo.list[tagName] = parts.demo;
      }
    }
    return compileBulk(html);
  }

  // Validate component name
  if (
    tagName &&
    !tagName.includes("-") &&
    !tagName.includes(".") &&
    !tagName.includes("/")
  ) {
    console.error(
      `Fez: Invalid name "${tagName}". Must contain a dash (e.g., 'my-element').`,
    );
    return;
  }

  // Store original source
  demo.sourceList[tagName] = html;

  // Extract and compile
  const classCode = generateClassCode(tagName, compileToClass(html));

  // Hide custom element until compiled
  hideCustomElement(tagName);

  // Execute the class code
  executeClassCode(tagName, classCode);
}

// =============================================================================
// COMPILE FROM VARIOUS SOURCES
// =============================================================================

/**
 * Compile from node or HTML string containing templates
 */
function compileBulk(data) {
  // Single template node
  if (data instanceof Node) {
    const node = data;
    node.remove();

    const fezName = node.getAttribute("fez");

    // URL reference
    if (fezName?.includes(".") || fezName?.includes("/")) {
      return compileFromUrl(fezName);
    }

    // Validate name
    if (fezName && !fezName.includes("-")) {
      console.error(`Fez: Invalid name "${fezName}". Must contain a dash.`);
      return;
    }

    return compile(fezName, node.innerHTML);
  }

  // HTML string or document
  const root = data ? Fez.domRoot(data) : document.body;
  root
    .querySelectorAll("template[fez], xmp[fez]")
    .forEach((n) => compileBulk(n));
}

/**
 * Compile component(s) from remote URL
 * Supports .fez files and .txt files (component lists)
 */
function compileFromUrl(url) {
  Fez.consoleLog(`Loading from ${url}`);

  // Handle .txt files as component lists
  if (url.endsWith(".txt")) {
    Fez.head({ fez: url });
    return;
  }

  Fez.fetch(url)
    .then((content) => {
      const doc = new DOMParser().parseFromString(content, "text/html");
      const fezElements = doc.querySelectorAll("template[fez], xmp[fez]");

      if (fezElements.length > 0) {
        // Extract top-level info/demo before the xmp elements (for multi-component files)
        const fileName = url.split("/").pop().split(".")[0];
        const parts = compileToClass(content);
        if (parts.info?.trim()) {
          demo.infoList[fileName] = parts.info;
        }
        if (parts.demo?.trim()) {
          demo.list[fileName] = parts.demo;
        }

        // Multiple components in file
        fezElements.forEach((el) => {
          const name = el.getAttribute("fez");
          if (
            name &&
            !name.includes("-") &&
            !name.includes(".") &&
            !name.includes("/")
          ) {
            console.error(`Fez: Invalid name "${name}". Must contain a dash.`);
            return;
          }
          compile(name, el.innerHTML);
        });
      } else {
        // Single component, derive name from URL
        const name = url.split("/").pop().split(".")[0];
        compile(name, content);
      }
    })
    .catch((error) => {
      Fez.onError("compile", `Load error for "${url}": ${error.message}`);
    });
}

export { compileFromUrl as compile_from_url };

// =============================================================================
// PARSE COMPONENT SOURCE
// =============================================================================

/**
 * Parse component HTML into { script, style, html, head, demo, info }
 */
function compileToClass(html) {
  const result = {
    script: "",
    style: "",
    html: "",
    head: "",
    demo: "",
    info: "",
  };
  const lines = html.split("\n");

  let block = [];
  let type = "";

  for (let line of lines) {
    const trimmedLine = line.trim();

    // Start blocks - demo/info can contain other tags, so skip nested detection
    if (trimmedLine.startsWith("<demo") && !result.demo && !type) {
      type = "demo";
    } else if (trimmedLine.startsWith("<info") && !result.info && !type) {
      type = "info";
    } else if (
      trimmedLine.startsWith("<script") &&
      !result.script &&
      type !== "head" &&
      type !== "demo" &&
      type !== "info"
    ) {
      type = "script";
    } else if (
      trimmedLine.startsWith("<head") &&
      !result.script &&
      type !== "demo" &&
      type !== "info"
    ) {
      type = "head";
    } else if (
      trimmedLine.startsWith("<style") &&
      type !== "demo" &&
      type !== "info"
    ) {
      type = "style";

      // End blocks
    } else if (trimmedLine.endsWith("</demo>") && type === "demo") {
      result.demo = dedent(block.join("\n"));
      block = [];
      type = "";
    } else if (trimmedLine.endsWith("</info>") && type === "info") {
      result.info = dedent(block.join("\n"));
      block = [];
      type = "";
    } else if (
      trimmedLine.endsWith("</script>") &&
      type === "script" &&
      !result.script
    ) {
      result.script = block.join("\n");
      block = [];
      type = "";
    } else if (trimmedLine.endsWith("</style>") && type === "style") {
      result.style = block.join("\n");
      block = [];
      type = "";
    } else if (
      (trimmedLine.endsWith("</head>") || trimmedLine.endsWith("</header>")) &&
      type === "head"
    ) {
      result.head = block.join("\n");
      block = [];
      type = "";

      // Collect content - preserve original indentation for demo and info
    } else if (type) {
      block.push(type === "demo" || type === "info" ? line : trimmedLine);
    } else {
      result.html += trimmedLine + "\n";
    }
  }

  // Process head elements (scripts, links, etc.)
  if (result.head) {
    processHeadElements(result.head);
  }

  return result;
}

/**
 * Process <head> elements from component
 */
function processHeadElements(headHtml) {
  const container = Fez.domRoot(headHtml);

  Array.from(container.children).forEach((node) => {
    if (node.tagName === "SCRIPT") {
      const script = document.createElement("script");
      Array.from(node.attributes).forEach((attr) => {
        script.setAttribute(attr.name, attr.value);
      });
      script.type ||= "text/javascript";

      if (node.src) {
        document.head.appendChild(script);
      } else if (
        script.type.includes("javascript") ||
        script.type === "module"
      ) {
        script.textContent = node.textContent;
        document.head.appendChild(script);
      }
    } else {
      document.head.appendChild(node.cloneNode(true));
    }
  });
}

// =============================================================================
// GENERATE CLASS CODE
// =============================================================================

/**
 * Generate executable class code from parsed parts
 */
function generateClassCode(tagName, parts) {
  let klass = parts.script;

  // Wrap in class if needed
  if (!/class\s+\{/.test(klass)) {
    klass = `class {\n${klass}\n}`;
  }

  // Add CSS
  if (String(parts.style).includes(":")) {
    let css = Fez.cssMixin(parts.style);
    css =
      css.includes(":fez") || /(?:^|\s)body\s*\{/.test(css)
        ? css
        : `:fez {\n${css}\n}`;
    klass = klass.replace(/\}\s*$/, `\n  CSS = \`${css}\`\n}`);
  }

  // Add HTML
  if (/\w/.test(String(parts.html))) {
    const html = parts.html.replaceAll("`", "&#x60;").replaceAll("$", "\\$");
    klass = klass.replace(/\}\s*$/, `\n  HTML = \`${html}\`\n}`);
  }

  // Store demo content in demo.list registry
  if (parts.demo?.trim()) {
    demo.list[tagName] = parts.demo;
  }

  // Store info content in demo.infoList registry
  if (parts.info?.trim()) {
    demo.infoList[tagName] = parts.info;
  }

  // Wrap in Fez call
  const [before, after] = klass.split(/class\s+\{/, 2);
  return `${before};\n\nwindow.Fez('${tagName}', class {\n${after})`;
}

/**
 * Execute generated class code
 */
function executeClassCode(tagName, code) {
  // Module imports require script tag
  if (code.includes("import ")) {
    Fez.head({ script: code });

    // Check for compile errors after delay
    setTimeout(() => {
      if (!Fez.classes[tagName]) {
        Fez.consoleError(`Template "${tagName}" possible compile error.`);
      }
    }, 2000);
  } else {
    try {
      new Function(code)();
    } catch (e) {
      Fez.consoleError(`Template "${tagName}" compile error: ${e.message}`);
      console.log(code);
    }
  }
}

/**
 * Add CSS to hide custom element until compiled
 */
function hideCustomElement(tagName) {
  if (!tagName) return;

  let styleEl = document.getElementById("fez-hidden-styles");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "fez-hidden-styles";
    document.head.appendChild(styleEl);
  }

  const allTags = [...Object.keys(Fez.classes), tagName].sort().join(", ");
  styleEl.textContent = `${allTags} { display: none; }\n`;
}
