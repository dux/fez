const vscode = require("vscode");

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

function activate(context) {
  registerDefinitionProvider(context);

  const wrapWithIf = vscode.commands.registerCommand("fez.wrapWithIf", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    const indent = editor.document.lineAt(selection.start.line).text.match(/^\s*/)[0];

    editor.edit((edit) => {
      const indented = text.split("\n").map((l) => "  " + l).join("\n");
      edit.replace(selection, `{#if condition}\n${indented}\n${indent}{/if}`);
    });
  });

  const wrapWithEach = vscode.commands.registerCommand("fez.wrapWithEach", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    const indent = editor.document.lineAt(selection.start.line).text.match(/^\s*/)[0];

    editor.edit((edit) => {
      const indented = text.split("\n").map((l) => "  " + l).join("\n");
      edit.replace(selection, `{#each state.items as item}\n${indented}\n${indent}{/each}`);
    });
  });

  const compile = vscode.commands.registerCommand("fez.compile", () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;

    const filePath = editor.document.fileName;
    if (!filePath.endsWith(".fez") && !filePath.endsWith(".fez.html")) {
      vscode.window.showWarningMessage("Not a .fez file");
      return;
    }

    const terminal = vscode.window.createTerminal("Fez Compile");
    terminal.show();
    terminal.sendText(`bunx fez-compile "${filePath}"`);
  });

  const foldingProvider = vscode.languages.registerFoldingRangeProvider("fez", {
    provideFoldingRanges(document) {
      const ranges = [];
      const stack = [];
      const blockStart = /\{#(if|each|for|await|unless)\b/;
      const blockEnd = /\{\/(if|each|for|await|unless)\}/;

      for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i).text;

        if (blockStart.test(line)) {
          stack.push(i);
        } else if (blockEnd.test(line) && stack.length > 0) {
          const start = stack.pop();
          ranges.push(new vscode.FoldingRange(start, i));
        }
      }

      return ranges;
    },
  });

  context.subscriptions.push(wrapWithIf, wrapWithEach, compile, foldingProvider);
}

function deactivate() {}

module.exports = { activate, deactivate };
