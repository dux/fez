const vscode = require("vscode");
const cp = require("child_process");
const fs = require("fs");
const path = require("path");

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function isFezFile(document) {
  return /\.fez(\.html)?$/.test(document.fileName);
}

// Mirrors SLIM_START_RE in src/fez/lib/source-parser.js: a template whose first
// line reads as Slim is Slim without a <slim> block.
const SLIM_TAGS = "a|abbr|address|area|article|aside|audio|b|bdi|bdo|blockquote|br|button|canvas|caption|circle|cite|code|col|colgroup|data|datalist|dd|defs|del|details|dfn|dialog|div|dl|dt|ellipse|em|embed|fieldset|figcaption|figure|footer|form|g|h[1-6]|header|hgroup|hr|i|iframe|img|input|ins|kbd|label|legend|li|line|main|map|mark|menu|meter|nav|noscript|object|ol|optgroup|option|output|p|path|picture|polygon|polyline|pre|progress|q|rect|s|samp|section|select|slot|small|source|span|strong|sub|summary|sup|svg|table|tbody|td|template|textarea|tfoot|th|thead|time|tr|track|u|ul|use|var|video|wbr";
const SLIM_START = new RegExp(
  "^(?:[.#][a-zA-Z_!@*\\[(-]" +
    `|(?:${SLIM_TAGS}|[a-z][a-z0-9]*-[a-z0-9-]*)(?=[.#]|:\\s|=|\\s*$|\\s+[^\\s=]+=)` +
    "|-\\s*(?:if|unless|each|for|await)\\s" +
    "|-\\s*\\S.*\\.each(?:_with_index)?\\s+do\\s*\\|" +
    "|==?\\s)",
);
const BLOCK_OPEN = /^\s*<(script|style|head|info|demo|slim)\b[^>]*>/;

// Line is Slim: inside a <slim> block, or in a template whose first line reads as Slim
function inSlimBlock(document, lineNumber) {
  let block = null;
  let slim = null;
  for (let i = 0; i <= lineNumber; i++) {
    const text = document.lineAt(i).text;
    if (block) {
      const closes = new RegExp(`^\\s*</${block}>`).test(text);
      if (i === lineNumber) return block === "slim" && !closes;
      if (closes) block = null;
      continue;
    }
    const open = text.match(BLOCK_OPEN);
    if (open) {
      if (i === lineNumber) return false;
      if (!new RegExp(`</${open[1]}>`).test(text)) block = open[1];
      continue;
    }
    if (slim === null && text.trim()) slim = SLIM_START.test(text.trim());
  }
  return !!slim;
}

function getComponentAtPosition(document, position) {
  const line = document.lineAt(position.line).text;
  const lang = document.languageId;

  let start = position.character;
  let end = position.character;
  while (start > 0 && /[a-z0-9-]/i.test(line[start - 1])) start--;
  while (end < line.length && /[a-z0-9-]/i.test(line[end])) end++;

  const word = line.substring(start, end);
  if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)+$/.test(word)) return null;

  const before = line.substring(0, start).trimEnd();

  if (lang === "haml" && before.endsWith("%")) {
    return { name: word, range: new vscode.Range(position.line, start, position.line, end) };
  }

  if (lang === "fez" && /^\s*$/.test(before) && inSlimBlock(document, position.line)) {
    return { name: word, range: new vscode.Range(position.line, start, position.line, end) };
  }

  if (before.endsWith("<") || before.endsWith("</")) {
    return { name: word, range: new vscode.Range(position.line, start, position.line, end) };
  }

  const lineUpToEnd = line.substring(0, end);
  const lastOpen = lineUpToEnd.lastIndexOf("<");
  const lastClose = lineUpToEnd.lastIndexOf(">");
  if (lastOpen > lastClose) {
    const tagMatch = line.substring(lastOpen).match(/^<\/?\s*([a-z][a-z0-9]*(?:-[a-z0-9]+)+)/);
    if (tagMatch && tagMatch[1] === word) {
      return { name: word, range: new vscode.Range(position.line, start, position.line, end) };
    }
  }

  return null;
}

async function findComponentFile(name) {
  const patterns = [`**/${name}.fez`, `**/${name}.fez.html`];
  const all = [];
  for (const pattern of patterns) {
    const files = await vscode.workspace.findFiles(pattern, "**/node_modules/**", 10);
    all.push(...files);
  }
  return all;
}

function registerDefinitionProvider(context) {
  const selector = [
    { language: "fez" },
    { language: "html" },
    { language: "erb" },
    { language: "haml" },
    { scheme: "file", pattern: "**/*.html.erb" },
    { scheme: "file", pattern: "**/*.html" },
  ];

  const provider = vscode.languages.registerDefinitionProvider(selector, {
    async provideDefinition(document, position) {
      const comp = getComponentAtPosition(document, position);
      if (!comp) return null;

      const files = await findComponentFile(comp.name);
      if (files.length === 0) {
        vscode.window.showWarningMessage(`Fez component "${comp.name}" not found (searched **/${comp.name}.fez)`);
        return [{
          originSelectionRange: comp.range,
          targetUri: document.uri,
          targetRange: comp.range,
          targetSelectionRange: comp.range,
        }];
      }

      return files.map((uri) => ({
        originSelectionRange: comp.range,
        targetUri: uri,
        targetRange: new vscode.Range(0, 0, 0, 0),
        targetSelectionRange: new vscode.Range(0, 0, 0, 0),
      }));
    },
  });

  context.subscriptions.push(provider);
}

// Wraps the selected lines in a block: `{#if}..{/if}` in HTML, `- if` + indent in <slim>
function wrapSelection(open, close, slimOpen) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const { document, selection } = editor;
  const indent = document.lineAt(selection.start.line).text.match(/^\s*/)[0];

  if (inSlimBlock(document, selection.start.line)) {
    // slim nests by indentation, so wrap whole lines
    const end = document.lineAt(selection.end.line).range.end;
    const range = new vscode.Range(selection.start.line, 0, end.line, end.character);
    const lines = document.getText(range).split("\n").map((l) => (l.trim() ? "  " + l : l));
    editor.edit((edit) => edit.replace(range, `${indent}${slimOpen}\n${lines.join("\n")}`));
    return;
  }

  const text = document.getText(selection);
  editor.edit((edit) => {
    const indented = text.split("\n").map((l) => "  " + l).join("\n");
    edit.replace(selection, `${open}\n${indented}\n${indent}${close}`);
  });
}

// Runs `fez compile --json` on save/open and publishes the errors to the Problems panel
function registerDiagnostics(context) {
  const collection = vscode.languages.createDiagnosticCollection("fez");
  const running = new Map();

  function resolveCli(document) {
    const configured = vscode.workspace.getConfiguration("fez").get("cli");
    if (configured) return configured;
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    const local = folder && path.join(folder.uri.fsPath, "node_modules/.bin/fez");
    if (local && fs.existsSync(local)) return shellQuote(local);
    return "bunx @dinoreic/fez";
  }

  function check(document, { notify = false } = {}) {
    if (!isFezFile(document) || document.uri.scheme !== "file") return;

    const key = document.uri.toString();
    running.get(key)?.kill();
    const folder = vscode.workspace.getWorkspaceFolder(document.uri);
    const cwd = folder ? folder.uri.fsPath : path.dirname(document.fileName);
    const command = `${resolveCli(document)} compile --json ${shellQuote(document.fileName)}`;

    const child = cp.exec(command, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
      if (running.get(key) === child) running.delete(key);
      if (error?.killed) return;

      let rows;
      try {
        rows = JSON.parse(stdout);
      } catch {
        const reason = (stderr || error?.message || "no output").trim().split("\n")[0];
        vscode.window.showWarningMessage(`Fez: could not run "${command}" - ${reason}. Set "fez.cli" to your fez binary.`);
        return;
      }

      const diagnostics = rows.map((row) => {
        const line = Math.max(0, Math.min((row.line || 1) - 1, document.lineCount - 1));
        const text = document.lineAt(line).text;
        const start = row.column ? Math.min(row.column - 1, text.length) : text.search(/\S|$/);
        const diagnostic = new vscode.Diagnostic(
          new vscode.Range(line, start, line, Math.max(start + 1, text.length)),
          row.detail ? `${row.message}\nTemplate: ${row.detail}` : row.message,
          vscode.DiagnosticSeverity.Error,
        );
        diagnostic.source = `fez ${row.kind || ""}`.trim();
        return diagnostic;
      });
      collection.set(document.uri, diagnostics);

      if (notify) {
        if (diagnostics.length) {
          vscode.commands.executeCommand("workbench.actions.view.problems");
        } else {
          vscode.window.showInformationMessage(`${path.basename(document.fileName)}: compiled without errors`);
        }
      }
    });
    running.set(key, child);
  }

  context.subscriptions.push(
    collection,
    vscode.workspace.onDidOpenTextDocument((document) => check(document)),
    vscode.workspace.onDidSaveTextDocument((document) => check(document)),
    vscode.workspace.onDidCloseTextDocument((document) => collection.delete(document.uri)),
  );
  vscode.workspace.textDocuments.forEach((document) => check(document));

  return check;
}

// Folds every line over the lines indented deeper below it (script, style, HTML, <slim>),
// plus {#if}..{/if} style blocks. A folding provider replaces the editor's own
// indentation folding, so it has to cover both.
function foldingRanges(document) {
  const ranges = [];
  const stack = [];
  const blockStart = /\{#(if|each|for|await|unless)\b/;
  const blockEnd = /\{\/(if|each|for|await|unless)\}/;
  const indents = [];

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    indents.push(line.trim() ? line.match(/^\s*/)[0].length : -1);

    if (blockStart.test(line) && !blockEnd.test(line)) {
      stack.push(i);
    } else if (blockEnd.test(line) && !blockStart.test(line) && stack.length > 0) {
      ranges.push(new vscode.FoldingRange(stack.pop(), i));
    }
  }

  for (let i = 0; i < indents.length; i++) {
    if (indents[i] < 0) continue;
    let last = i;
    for (let j = i + 1; j < indents.length; j++) {
      if (indents[j] < 0) continue;
      if (indents[j] <= indents[i]) break;
      last = j;
    }
    if (last > i) ranges.push(new vscode.FoldingRange(i, last));
  }

  return ranges;
}

function activate(context) {
  registerDefinitionProvider(context);
  const check = registerDiagnostics(context);

  const wrapWithIf = vscode.commands.registerCommand("fez.wrapWithIf", () =>
    wrapSelection("{#if condition}", "{/if}", "- if condition"),
  );

  const wrapWithEach = vscode.commands.registerCommand("fez.wrapWithEach", () =>
    wrapSelection("{#each state.items as item}", "{/each}", "- each state.items as item"),
  );

  const compile = vscode.commands.registerCommand("fez.compile", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    if (!isFezFile(editor.document)) {
      vscode.window.showWarningMessage("Not a .fez file");
      return;
    }
    check(editor.document, { notify: true });
  });

  const foldingProvider = vscode.languages.registerFoldingRangeProvider("fez", {
    provideFoldingRanges: foldingRanges,
  });

  context.subscriptions.push(wrapWithIf, wrapWithEach, compile, foldingProvider);
}

function deactivate() {}

module.exports = { activate, deactivate };
