# Fez VS Code Tools

Language support for Fez components (`.fez`, `.fez.html`).

## Features

* Syntax highlighting for `<script>` (JavaScript, or TypeScript with `lang="ts"`), `<style>`, `<head>`, `<info>`, `<demo>` and the template, including blocks indented inside `<xmp fez="...">` definitions.
* Template highlighting for `{expr}`, `{#if}` / `{#each}` / `{#for}` / `{#await}` blocks, `{@html}`, `:prop`, `fez:*` and `class:name` attributes.
* `<slim>` template blocks: tags, Tailwind-safe `.class` / `#id` shorthand, attributes, `- if` / `- each` control lines, `=` / `==` output, `|` text and `/` comments.
* Errors in the Problems panel: every `.fez` file is checked with `fez compile --json` when it is opened or saved (script, style, template and Slim errors, at the `.fez` line).
* Folding by indentation and by `{#if}` ... `{/if}` blocks.
* Go to definition on a component tag (`<ui-button>`, a `%ui-button` HAML tag, or a tag at the start of a `<slim>` line) opens its `.fez` file.
* Snippets: `fez-*` for component blocks and template syntax, `fez-slim` and `slim-*` for Slim.

## Commands

* `Fez: Compile Current File` - check the current file now and open the Problems panel on errors.
* `Fez: Wrap with {#if}` / `Fez: Wrap with {#each}` - wrap the selection in a block; inside `<slim>` the selected lines are indented under `- if` / `- each`.

## Settings

* `fez.cli` - command used for the checks (`<cli> compile --json <file>`).
  Empty (the default) uses the workspace `node_modules/.bin/fez`, then `bunx @dinoreic/fez`.
  In the Fez repository itself it is set to `./bin/fez`.

## Run Locally

1. Open the `vscode` folder in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. Open a `.fez` file.

Package and install with `bun run vscode:install` from the repository root.
