# Fez - javascript DOM components framework (files ending in fez)

# Instructions for this local fez repo

- when you add new features, ensure related tests exists, demo and info in fez lib.
- use bun, not npm
- ./dist and ./tmp are generated output: never edit them and skip them when searching for code. Source is in ./src, site source in ./pages_src. Read ./dist or ./tmp only to debug build output.
- Deploy locally with `bun run deploy` - there is no CI.
  It runs `bun run test` first and stops on failure (plain `bun test` also picks up the browser suites and fails).
  It stamps the version from the `main` commit count, builds dist and the site on this machine, commits the site on top of the `pages` branch with the same commit-tree path as `fez gh-pages` (no worktree, no force push), and pushes `main` and `pages` (see "Publishing the docs site").
- GitHub Pages does not always start a build for the pushed `pages` commit. Check `gh api repos/dux/fez/pages/builds/latest` - if its commit is not the new `pages` head, trigger one with `gh api -X POST repos/dux/fez/pages/builds`, then confirm `https://dux.github.io/fez/dist/fez.min.js` starts with the new `// v:` banner.
- If you are instructed to write a fez component for this repo, ALWAYS write it in `pages_src/root/fez/[name].fez`; the generated site is published to the `pages` branch and is never edited in place.
- `fez agents` prints this file from the `fez agents: shared reference starts here` marker below; everything above it is repo-only and is not printed. Keep repo-only notes above the marker and the reference for other projects below it.

## Pjax source layout

The bundled pjax (see "Bundled Pjax navigation" in the shared reference) lives in `src/fez/pjax/`.

- `pjax.js` - the Pjax class and request lifecycle (created per `createPjax()` call so tests get fresh static state); `url-state.js` - `qs` / `hash` / `hpath` / `hqs`, attached to the class as statics; `scripts.js` - `runScripts` / `runHeadScripts` for response scripts; `onclick.js` - link click delegate; `boot.js` - boot, called from `src/fez.js` behind the `fezPrimary` guard.
- Tests: `test/pjax-core.test.js`, `test/pjax-onclick.test.js`, `test/pjax-events.test.js` (shared env and `installMockFetch` / `fakeResponse` / `respond` in `test/pjax-env.js`), browser coverage in `test/browser/pjax-url-state.test.js`. `fez refactor` flags legacy `Pjax.` calls (`bin/fez-refactor`, tested in `test/fez-bin.test.js`). Types in `fez.d.ts` (`PjaxStatic`, `PjaxLoadOptions`, `PjaxHashPathOptions`).
- The old `~/dev/libs/dux-pjax` repo is deprecated reference only - changes happen here.

## Publishing the docs site (`pages` branch)

This repo publishes its generated site from the `pages` branch, served by GitHub Pages at the branch root.
`main` tracks source only; `dist/` and `tmp/` are build output and ignored (the old `docs/` output is gone).
`fez-static.yaml` builds into `tmp/fez-pages`, which is exactly the deployable site root.
`bun run dev` builds the library and site, watches source changes, and uses the existing static server with live reload at `http://localhost:8000/`.
`bun run deploy` (`bin/deploy`) requires a clean `main` and runs `bun run test` before stamping, building, committing, or pushing.
A test failure stops deployment.
It stamps the version with `vstamp count --next` ([vstamp](https://github.com/dux/vstamp)): the main commit count including the release commit, rendered dotted (`357` -> `3.5.7`, `1123` -> `11.2.3`, `5` -> `0.0.5`), written to `.version` (YAML, `version: X.Y.Z`) and `package.json`.
It then builds dist + site and commits both files on `main` as `chore: release <version>`.
`fez version` prints the `version` from `.version`; `Fez.version` and the `// v:` dist banner read `package.json`. A checkout never stamped prints `dev`.
It commits the built site on top of the `pages` branch with `commitPages` from `src/static/pages.js` (a throwaway index + `git commit-tree` + `update-ref`, the same path `fez gh-pages` uses), so the primary checkout is never switched and the worktree under `tmp/` is gone.
It pushes both branches to `origin` atomically; both must fast-forward and `pages` is never force-pushed.
`--dry-run` runs tests, builds the next version and restores `.version` and `package.json`, without creating commits or pushing.
Build failures restore the manifest before any source commit; later failures keep local commits and Pages output for recovery.
Deployment does not publish to the package registry.
This repo's own `bin/deploy` drives its versioned release; a project using only the generic publisher runs `fez gh-pages`, which builds the site and commits it to the same `pages` branch without any version stamping (`--no-push` commits locally, `-s` serves the target afterwards).
`pages_src/root/fez.txt` is generated from `pages_src/root/fez/*.fez`, excluding scratch files, by the shared indexer in `lib/site.js`.
`bun run static`, `bun run dev`, and deployment all use that indexer; there is no separate `index` script.

---

<!-- fez agents: shared reference starts here -->

# Fez JS lib Quick Reference for AI Assistants (files ending in .fez or .html.fez)

## Writing New Components

All documentation and demos go INSIDE the .fez file (no separate .html files) using `<info>` and `<demo>` blocks.

## CDN

```html
<script src="https://dux.github.io/fez/dist/fez.min.js"></script>

<!-- Load components with fez attribute (NOT type="fez" src="...") -->
<script fez="path/to/component.fez"></script>
```

## Bundlers (Vite / Rollup)

Prefer this path in bundled apps: it compiles `.fez` to ES modules at build time (name,
script, style scope and template checks) and removes the runtime fetch.

```js
// vite.config.js or rollup.config.js
import fez from '@dinoreic/fez/plugin';
export default { plugins: [fez()] };
```

```js
import './components/ui-button.fez'; // side-effect: registers <ui-button>
import Button from './components/ui-button.fez'; // default export is the class
```

- Component name comes from the filename (`ui-button.fez` -> `ui-button`); `<xmp fez="...">`
  files compile every definition, and the default export is the first one.
  An unclosed `<xmp fez="...">` is a build error.
- Static imports (multi-line named imports included) are hoisted to the module top and deduped.
  The rest of each component's module-level code gets its own block scope, so two components of one
  file may both declare `const helper`.
- A `<head>` block is emitted as `Fez.head("<html>")` before the component class is defined.
- `minify` (default `false`; Vite defaults to `true` when `mode === 'production'`) drops
  `<info>` / `<demo>` metadata from the emitted module.
- Emitted modules read the runtime from `window.Fez` and never import it: load fez once on the
  page before the component modules, or the module throws `fez runtime not loaded`.
- One plugin for both bundlers: Vite-only hooks (`enforce`, `configResolved`) are ignored by
  Rollup, so minify follows Vite's mode and is false for Rollup.
- `<script lang="ts">` (or `type="text/typescript"`) is stripped by the plugin at build time
  with `esbuild` (Vite depends on it; install it when your setup cannot resolve it).
  `fez compile` validates TS too.
  The browser runtime cannot strip types, so `lang="ts"` only works through a bundler or the CLI.
- The `<script fez>` runtime loading above still works.

## CLI Tools

```bash
# Print this reference (run `fez --help` for all commands, source path and repo)
fez agents
# Add a pointer to ./AGENTS.md / ./CLAUDE.md of a project so agents know to run `fez agents`
fez agents --init
# Print the installed version (X.Y.Z from .version)
fez version

# Compile and validate components - catches JS syntax errors and template issues
fez compile path/to/component.fez
fez compile path/to/one.fez path/to/two.fez
fez compile 'path/to/**/*.fez'

# Validate only the .fez template block with the Fez template compiler
fez template path/to/component.fez

# Print generated template function body when template compilation fails
fez compile --debug-template path/to/component.fez
fez template --debug path/to/component.fez

# Print the final template (<slim>: one node per line with source lines), or errors as JSON
fez compile -t path/to/component.fez
fez compile --json path/to/component.fez

# Report removed APIs, legacy syntax, // comments in <style> and old Pjax calls (never changes files)
fez refactor [path-or-glob]

# Index files as JSON, or open an interactive Playwright debugging REPL
fez index path/to/files
fez debug http://localhost:3333

# Initialize or build ./web_src/root into the configured target
fez static init
fez static
fez static dev
fez static doctor

# Build the site and publish it to a rolling GitHub Pages branch (run from the project root)
fez gh-pages
fez gh-pages --no-push          # commit the pages branch locally only
fez gh-pages -s --port 4000     # publish, then serve the target with live reload
```

`.fez` files use Fez's own template compiler (`src/fez/lib/template-compiler.js`).

`fez gh-pages` builds the configured `source_dir` with the static builder and commits the result on top of the `pages` branch (`git commit-tree` + `update-ref`, no checkout), then pushes it to `origin`. It refuses with a clear error outside a Git repo, without an `origin` remote, when `pages` is checked out in a worktree, or when local `pages` diverges from `origin/pages`. `-s` serves the target with the same watcher and live reload as `fez static dev`.

## Static Site Builder

`fez static` reads `fez-static.yaml` or `fez-static.json` from the project root or its `config/` folder; the first match wins and YAML takes precedence.
`source_dir` (default `web_src`) holds `layouts/`, `parts/`, and `root/`; `target_dir` (default `web_build`) receives the build.
Both paths are relative to the project root, must stay inside it, and are always resolved even without a config file.
It uses `Bun.YAML` for front matter and `Bun.markdown` for Markdown, with no additional parser dependency.
It requires Bun 1.3.8 or newer.

```text
fez-static.yaml
web_src/
|-- layouts/
|   |-- default.html
|   `-- post.html
|-- parts/
|   `-- header.html
`-- root/
    |-- [blogs]/
    |   `-- YYYY-MM-DD-slug.md
    |-- index.html
    `-- about.md
```

Rules:

* Every `.md` and `.html` page accepts YAML front matter.
* A missing `layout` uses `web_src/layouts/default.html` or `default.md` without a config declaration.
* `layout: name` resolves an `.html` layout first, then `.md`.
* `layout: false` emits a page without a layout.
* `render: false` leaves a page body untouched; combine it with `layout: false` for passthrough HTML.
* Layouts may declare a parent layout in their own front matter.
* `index.md` becomes `index.html` and other pages preserve their relative path with an `.html` extension.
* `permalink: /docs/start/` becomes `build/docs/start/index.html`.
* Every generated HTML and Fez file starts with an HTML source-path notice identifying its file under `web_src/root`; JavaScript files use an equivalent `//` notice.
* Other non-page files are copied unchanged.
* A bracketed directory declares a collection: `[blogs]` populates `collections.blogs`, publishes as `blogs`, and generates `blogs/index.yaml`.
* Assets inside a bracketed directory are copied but are not collection entries.
* Collection pages are sorted newest first, `config.collections.<name>.layout` may set their default layout, and `config.collections.<name>.required` lists metadata fields checked by `fez static doctor`.
* `draft: true` pages are omitted unless `--drafts` is passed.
* HTML pages, layouts, and includes use Fez template syntax with `site`, `page`, `collections`, `include`, and `url(path)`.
* `url(path)` emits site-root-relative paths when `site.base_url` is unset (`css/app.css`); set `base_url` to prefix absolute site paths instead. Every page exposes `page.base` for `<base href={page.base}>`, plus `page.href` / `page.url`.
* `site.relative_urls`, `serve_root`, and `serve_prefix` are optional serving helpers; this demo site sets `serve_root: .` so `docs.html` can fetch `../README.md` from the repo root.
* Markdown braces are not evaluated, so documented Fez templates remain literal.
* `{@content}` inserts the page or child layout.
* `{@include "name.html"}` resolves from `web_src/parts` and may be nested.
* `{@include "card.html", { title: page.title }}` passes values through `include`.
* A `./name.html` include inside a part is relative to that part; all includes must remain under `parts`.
* Include paths are quoted literals, and recursive includes are build errors.
* `config.copy` maps files or directories outside `web_src/root` into target-relative paths; sources resolve from the project root, must remain inside it, and are watched by `dev` and `--watch`.
* Copied files remain byte-for-byte unchanged, directories copy recursively, and unsafe paths, symbolic links, scratch files, missing sources, or output collisions fail the build.
* `fez static doctor` performs a non-publishing render and validates required collection metadata, internal links, referenced assets, fragments, and `base_url` usage; `data-fez-static-ignore` opts one element out.
* `fez static dev` injects a development-only client and reloads connected browsers after successful rebuilds.
* The existing target remains unchanged when a build or doctor check fails.

## Core Rules for LLM

1. **ALWAYS** use Fez-specific Svelte-like syntax (NO React/Vue conventions)
2. **ALWAYS** use 2-space indentation inside template blocks (`{#if}`, `{#each}`, `{#for}`, `{#await}`, etc.) - content inside blocks must be indented by 2 spaces relative to the block tag
3. **NEVER** use hooks - `this.state` replaces useState/useEffect
4. **Style scope is declared on the tag, never inferred from the CSS.** `<style>` is component-scoped - the compiler wraps the **whole block**, always, no exceptions. `<style global>` is emitted verbatim, document-wide. A file may contain both. Inside `<style>`, root-level declarations style the generated outer wrapper node (the one with the `fez` class), *not* the first template child - so if the first element is `<nav>` and it needs `display: flex`, write `nav { display: flex; }`. Address the wrapper itself with `&` (`&:hover`, `& > div`). For a one-off rule that must escape the component, write the selector as `:global(.x)`; `:global(.dark) .btn` keeps `.btn` scoped under a global ancestor (see "Scoped CSS"). `:fez` and `:host` are **not** valid in source and are compile errors. Comments are `/* ... */` only - `//` line comments are not CSS.
5. **ALWAYS** initialize state in `init()`, put reactive/derived state in `beforeRender()`
6. **ALWAYS** use kebab-case component names (e.g., `user-profile`)
7. **NEVER** use `{#if}` blocks inside HTML attributes - use ternary operators `{condition ? 'value' : ''}` instead
8. **Attribute expressions** are automatically quoted - write `attr={value}` (quotes added automatically); `null` / `undefined` drop the attribute and a falsy value drops a boolean attribute (see "Attribute values")
9. **ALWAYS** use lowercase with underscores for props (e.g., `fill_color`, `read_only`, `stroke_width`)
   * Declare a `PROPS` schema for any prop that is not a plain string (`PROPS = { count: { type: Number, default: 0 }, open: Boolean }`) - never `parseInt`/`=== 'true'` props by hand when a schema entry does it
10. **PREFER `onclick="fez.func('{value}')"`** for event handlers with inline template values - use unquoted arrow handlers (`onclick={() => edit(item)}`) only when passing complex data (objects, arrays)
11. **`this.state` is the only per-instance store.** A write re-renders only if the last render read that top-level key, so editors, charts, timers, handlers and `fez:this` refs (`this.state.name`) all go in `state` and cost nothing until a template reads them. Never park data on bare `this`.

## App Rules for LLM

Rules for wiring components into an app; the component rules are above.

1. Mount order is `init`, first render, `onMount`, then `onRefresh(props, changed)` with every prop in `changed`.
2. A parent re-render hands a preserved child its new props: it re-renders when a value changed, then `onRefresh(props, changed)` fires with only the props whose value differs (`{}` when none did).
   There is no `onPropsChange`: load prop-driven data in `onRefresh` alone, `if ('container' in changed) this.load()`, never in `onMount` too and never by tracking the last value in state.
3. Data that depends on props loads in `onRefresh` (rule 2); everything else loads in `onMount`.
   Set `state.loading = true` only in `init()`: reloads then keep the current DOM and morph to the new data instead of flashing a spinner.
4. Renders are batched per animation frame (a timer while the tab is hidden); the DOM does not change synchronously after a state write.
   `await this.tick()` resolves once the pending render reached the DOM.
5. Pass anything that changes as a prop; slots are captured once.
   A child whose template does not read a prop skips the re-render when only that prop changes.
6. Pages and other components chosen at runtime: `<fez-component name={state.page} :props="state.query">fallback</fez-component>`.
   The same name keeps the child and hands it new props, a new name inserts the new tag, and an unregistered name shows the children.
7. Style another component by its wrapper class `.<name>-fez`; its tag is replaced on mount.
8. Scoped `<style>` rules reach into descendant components: in a component that renders others, never style bare tags or generic class names, and delete unused rules.
9. Shared data goes in `globalState`, commands go to a `GLOBAL` component, and notifications use publish (see "Component communication").
10. Check the result in a browser: stale props, double fetches and leaked styles all pass `fez compile`.

## Component Structure

Block order in a `.fez` file is fixed: `<info>`, `<demo>`, `<head>`, `<script>`, `<style>` / `<style global>`, and the template last (HTML or Slim, see Slim Templates).
Never put a `<style>` block after the template. The same order applies inside every `<xmp fez="...">` of a multi-component file.
`<script>`, `<head>`, `<info>`, `<demo>` and `<slim>` appear at most once per definition (a duplicate is an error); several `<style>` blocks are joined.
A `<style>` or `<script>` with template markup on both sides is part of the template, not a component block: its body is copied verbatim (braces are not expressions), so a JSON-LD `<script>` or a `<style>` inside `{#if}` works.
The `<head>` block holds plain HTML (`<link>`, `<script src>`, `<meta>`) that is appended to `document.head` when the component is defined; its scripts are re-created so they run.

The `<script>` block has two zones:

1. **Module-level code** (BEFORE `class {}`) - imports, `Fez.head()` calls, shared variables. Like `<script context="module">` in Svelte. These bindings close over class methods, but template expressions cannot see them (templates run as `with (this)`). Expose module data to a template via a class field or `state`.
2. **Component class** (MUST be the LAST thing in `<script>`) - all component logic. **NEVER put code after `class {}`**.

**CRITICAL: ALL class properties (META, NAME) go INSIDE `class {}`, never outside it.**

```html
<!-- Documentation shown in demo pages -->
<info>
  <ul>
    <li>Component description</li>
    <li>Props: <code>name</code>, <code>value</code></li>
  </ul>
</info>

<!-- Example usage shown in demo pages -->
<demo>
  <my-component name="example"></my-component>
</demo>

<script>
  // --- Module-level zone (before class) ---
  // Import maps, Fez.head(), imports, shared constants

  Fez.head({ importmap: {
    'tiptap': 'https://esm.sh/@tiptap/core@2',
    'tiptap/': 'https://esm.sh/@tiptap/',
  }})

  import { Editor } from 'tiptap'
  import StarterKit from 'tiptap/starter-kit@2'

  Fez.head({css: 'https://cdn.example.com/styles.css'})

  // --- Component class (MUST be last in <script>) ---
  class {
    // Class properties go here, INSIDE class - NEVER outside
    META = {}     // component metadata

    // optional props schema: validated + coerced into this.props before init()
    PROPS = {
      count: { type: Number, default: 0, state: true },  // seeds this.state.count before init()
      title: { type: String, default: 'Default' },
      open: Boolean,   // <my-tag open> -> true, missing -> false
    }

    init(props) {
      // the only init hook - runs BEFORE template render, props available, DOM refs are not
      // do not rewrite state, just add to it
      this.state.items = []
    }

    beforeRender() {
      // runs BEFORE every render - use for reactive computed state
      // (replacement for Svelte's $: reactive statements)
      this.state.isEmpty = this.state.items.length === 0
    }

    // a getter is a derived value too, recomputed on every render: {total} in the template
    get total() {
      return this.state.items.length + this.state.count
    }

    onMount(props) {
      // runs AFTER template render - DOM is ready, fez:this refs are in this.state
      // (the template never reads state.editor, so this write does not re-render)
      this.state.editor = new Editor({
        element: this.state.editorNode,
        extensions: [StarterKit],
      })

      // window events go through this.on - auto-removed on destroy, not called on its own
      this.on('resize', () => this.layout(), { throttle: 200 })
      this.layout()

      // a returned function runs on destroy
      return () => this.state.editor.destroy()
    }

    onDestroy() {
      // cleanup of anything not registered through this.on / this.setTimeout / onMount's return
    }

    onRefresh(props, changed) {
      // runs after onMount (changed = every prop), and again whenever the parent re-renders and
      // reuses this child (changed = props whose value differs); the child already re-rendered for those
    }

    // Custom methods
    layout() {
      this.state.width = this.root.offsetWidth  // a key the template never reads: no render
    }

    increment() {
      this.state.count++  // Reactive assignment
    }
  }
</script>

<style>
  /* The whole block is scoped to the component - always */
  /* Root-level declarations style the generated wrapper node, */
  /* not the first template child */
  padding: 20px;

  /* Use & to address the wrapper itself */
  &:hover {
    background: #fafafa;
  }

  /* Style the actual first template child when it needs layout */
  nav {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* nested SCSS syntax */
  button {
    background: gold;
    cursor: pointer;

    span {
      color: black;
      font-weight: bold;
    }

    &:hover {
      background: orange;
    }
  }

  /* single rule that must escape the component - :global() alone drops the
     component scope. Use <style global> for more than a rule or two. */
  :global(.third-party-widget) {
    z-index: 10;
  }

  /* global ancestor, scoped rest: .dark .fez.<name>-fez .btn */
  :global(.dark) .btn {
    color: #eee;
  }

  /* @keyframes / @font-face / @property and friends cannot legally sit
     inside a style rule, so they are hoisted out for you - write them
     here and they just work. @media/@supports/@container nest fine and
     stay scoped to the component. */
  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
</style>

<!-- Global styles: emitted verbatim, no scoping. -->
<!-- Use for rules that must escape the component: third-party widgets -->
<!-- mounted on document.body, :root variables, @font-face, app-wide classes. -->
<style global>
  :root {
    --brand: #c60;
  }

  .some-external-class { color: blue; }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>

<!-- Template (Svelte-like syntax) -->
<div fez:this="editorNode"></div>
<button onclick="fez.increment()" title={props.title}>Count: {state.count} (total {total})</button>
```

### Lifecycle hooks

Mount runs `init(props)`, the first render (`beforeRender`, template, `afterRender`), `onMount(props)`, `GLOBAL_STATE` publishing, then `onRefresh(props, changed)` with every prop in `changed`.

* `init(props)` - the only init hook; set initial state. Runs before the first render with state triggers off.
* `beforeRender()` - before every render; derive state here.
* `afterRender()` - after every render, also when the hash-skip left the DOM untouched.
* `onMount(props)` - once, after the first render; the DOM and `fez:this` refs exist. A returned function runs on destroy.
* `onRefresh(props, changed)` - at mount (every prop in `changed`), and whenever a preserved instance is handed props again: a fez parent re-render, a pjax / `Fez.nodeMorph` swap that keeps it, or `<fez-component>` passing new props. `changed` holds only the props whose value differs. It never fires for the component's own re-render, and `Fez(el).setAttribute()` writes `this.props` without it.
* `onDestroy()` - when the node leaves the DOM. A throw is reported and teardown still completes.
* `onStateChange(key, value, oldValue)` - every write to `this.state` outside a silent scope (see State Management).
* `onGlobalStateChange(key, value, oldValue)` - a `globalState` key this instance read changed.
* `onSubmit(formData)` - a `<form>` inside the component was submitted: the default is prevented and `formData` is a plain `{ name: value }` object. The listener is delegated, so a form rendered later (inside `{#if}`) works; a child component's form is left to the child.
* `onError(error, component)` - error boundary, see "Error boundaries".

A throw in `init`, the first render or `onMount` is reported as `Fez mount: [<name>] <name> failed to mount: ...` (or handed to an `onError` boundary) and the instance is destroyed, so its timers and subscriptions are released.
A template runtime error on a later render keeps the last rendered DOM.

## Scoped CSS

Every rule in `<style>` is nested under the component wrapper (`.fez.<name>-fez`) and flattened SCSS style, so nesting works in browsers without native CSS nesting.

* `:global(...)` follows Svelte: the `:global` part is never scoped, the rest is.
  * `:global(.x) { }` alone escapes the component: `.x { }`.
  * `:global(.dark) .btn { }` puts the global part above the scope: `.dark .fez.<name>-fez .btn`.
  * `:global(html.dark) & .btn { }` places the scope at `&`: `html.dark .fez.<name>-fez .btn`.
  * A list inside `:global` expands: `.card :global(.a, .b)` -> `.card .a`, `.card .b`, both scoped.
  * `:global(...)` inside `<style global>` is a compile error - those rules are already global.
* At-rules:
  * `@media`, `@supports`, `@container`, `@layer { }`, `@scope` and `@starting-style` nest inside rules and stay scoped.
  * `@keyframes`, `@font-face`, `@property`, `@counter-style`, `@page`, `@position-try`, `@view-transition` and friends are hoisted to the top level with their bodies untouched.
  * `@import` and `@layer a, b;` are hoisted to the front of the stylesheet even from a scoped `<style>` (they land in a separate `<style id="fez-css-head">` before the shared one); `@charset` is dropped.
* Commas inside quoted attribute selectors (`[data-x="a,b"]`) do not split the selector.
* Comments are `/* ... */`. A `//` line comment is not CSS: it swallows the declaration or selector that follows it; `fez refactor` reports them.
* `body { }` in a scoped `<style>`, `:host` and `:fez` are compile errors.

## Style Macros (mixins)

`Fez.cssMixin(name, value)` registers a CSS shortcut usable in any `<style>` or `<style global>` block.
A macro expands to a selector or an at-rule prelude, and `flattenCss` resolves whichever it gets - at-rules hoist outward, `&` binds to the parent.
Expansion happens at runtime in `Fez.globalCss`, so a macro registered in a `<head>` block is available to every component.

Built in: `mobile` (`max-width: 767px`), `tablet` (768-1023px), `desktop` (`min-width: 1200px`), `dark`.

```html
<style>
  h1 {
    font-size: 20px;
    :mobile { font-size: 14px; }
    :dark   { color: #eee; }
  }

  /* at block root, a macro applies to the component wrapper */
  :dark { border-color: #444; }
</style>
```

Both spellings work - `:mobile { ... }` and `@include mobile { ... }`.
**The trailing space is required**: `:dark {` expands, `:dark{` does not and silently emits dead CSS.

### Declaration mixins

End the usage with `;` instead of `{` and the body is inlined where it sits, as declarations - the SCSS `@include` / Tailwind `@apply` shape.
Use it for a bundle of properties shared across components; the body may carry nested rules too.

```js
Fez.cssMixin('card', 'padding: 16px; border-radius: 8px; box-shadow: var(--shadow)')
Fez.cssMixin('lift', 'transition: transform .2s; &:hover { transform: translateY(-2px); }')
```

```html
<style>
  .item { :card; color: #333; }
  .cta  { @include card; :lift; }
</style>
```

`:card;` only matches at declaration position, so a property value that shares a name (`pointer-events:none;`) is never touched.
An unregistered name stays as written and is dropped by the browser as an unknown declaration.

### Dark theme

`:dark` expands to `&:where(.dark, .dark *)`, so it applies when `<html>` carries a `dark` class.
Fez components are light DOM, so the class is a genuine ancestor and ordinary descendant matching reaches in - no shadow-boundary workaround needed.
`:where()` contributes zero specificity, so a `:dark` block ties with the rule it overrides and wins on source order alone (nested blocks always serialize after their parent's declarations).

Toggle it yourself - fez ships no theme runtime:

```js
document.documentElement.classList.toggle('dark', isDark)
```

Prefer defining tokens once in a `<style global>` and consuming them everywhere, so components carry no theme-specific rules at all:

```html
<style global>
  :root {
    --bg: #fff; --fg: #111; color-scheme: light;
    :dark { --bg: #111; --fg: #eee; color-scheme: dark; }
  }
</style>
```

To follow the OS setting instead of a class, re-register the macro at boot - no component CSS changes:

```js
Fez.cssMixin('dark', '@media (prefers-color-scheme: dark)')
```

Two caveats:

- **`<style global>` is not wrapped**, so a bare top-level `:dark { }` has no parent for `&` and emits invalid CSS. Nest it under `:root` (as above) or write `html:dark`.
- **Put the class on `<html>`, not `<body>`** - otherwise the `:root` token block never matches, and the page gets light overscroll gutters.

## Template Syntax (Svelte-like)

### Expressions

```html
<!-- Simple expression -->
<p>{state.user.name}</p>

<!-- Expressions in attributes (automatically quoted) -->
<input value={state.text} class={state.active ? 'active' : ''} />

<!-- Raw HTML (unescaped) -->
<div>{@html state.htmlContent}</div>

<!-- JSON debug output -->
{@json state.data}

<!-- Local constant for the rest of the enclosing branch (destructuring allowed) -->
{#each state.rows as row}
  {@const total = row.qty * row.price}
  {@const { name, sku } = row}
  <p onclick="fez.pick({total})">{name} ({sku}): {total}</p>
{/each}

<!-- Reusable static markup within one template -->
{@block avatar}
  <img src={state.user.avatar} class="avatar" />
{/block}
{@block:avatar}
```

* `{expr}` escapes any value as text; `null` / `undefined` render nothing and an array renders as `a,b` text. Use `{@html}` for markup.
* `{@const name = expr}` lasts until the end of its branch: `{:else}`, `{:then}`, `{:catch}` or the closing tag ends it. Handlers capture it like a loop variable.
* `{@block name}...{/block}` defines markup and `{@block:name}` pastes it; it is a compile-time copy, not a component.
* A backtick in text is a plain character (`` <p>use `npm i`</p> ``). `\{` and `\}` write literal braces.
* `<script>` and `<style>` bodies inside the template are copied verbatim, never evaluated.
* Svelte-only syntax fails to compile with a hint: `{@debug}`, `{@render}`, `{#snippet}`, `on:click|preventDefault`, `bind:value`.

### Conditionals

```html
<!-- With else if -->
{#if state.status === 'loading'}
<span>Loading...</span>
{:else if state.status === 'error'}
<span>Error!</span>
{:else}
<span>Ready</span>
{/if}

<!-- Unless (opposite of if) -->
<!-- renders if state.items is null, undefined, empty array, or empty object -->
{#unless state.items}
<p>No items found</p>
{/unless}
```

**Truthiness rules** for `#if`, `#unless`, and `:else if`:

- `null`, `undefined`, `false`, `0`, `""` -> **falsy**
- `[]` (empty array) -> **falsy**
- `{}` (empty object) -> **falsy**
- Non-empty arrays, non-empty objects, and other truthy values -> **truthy**

### Async/Await Blocks

Handle promises directly in templates with automatic loading/error states:

```html
<!-- Full syntax with all three states -->
{#await state.userData}
<p>Loading user...</p>
{:then user}
<div class="profile">
  <h1>{user.name}</h1>
  <p>{user.email}</p>
</div>
{:catch error}
<p class="error">Failed to load: {error.message}</p>
{/await}
```

```javascript
class {
  init() {
    // CORRECT - assign promise directly, template handles loading/resolved/rejected states
    this.state.userData = fetch('/api/user').then(r => r.json())

    // WRONG - using await loses the loading state (value is already resolved)
    // this.state.userData = await fetch('/api/user').then(r => r.json())
  }

  refresh() {
    // Re-assigning a new promise triggers new loading state
    this.state.userData = fetch('/api/user').then(r => r.json())
  }
}
```

**Key points:**

- **Assign promises directly** - don't use `await` keyword when assigning to state
- Template automatically shows pending/resolved/rejected content
- Re-renders happen automatically when promise settles
- Non-promise values show `:then` content immediately (no loading state)
- **Never build the promise in the template** (`{#await load()}`): every render gets a new promise, and every settle starts the next request. Fez detects the loop after 3 cycles, reports it and keeps the settled value - assign the promise to state once instead
- A rejection in a block without `{:catch}` is reported through `Fez.onError('await', ...)`

**IMPORTANT: NEVER use `{#if}` inside attributes! Use ternary operator instead:**

```html
<!-- WRONG -->
<div class="{#if state.active}active{/if}">

<!-- CORRECT -->
<div class={state.active ? 'active' : ''}>
<button disabled={state.loading}>Submit</button> <!-- false drops the attribute, true renders disabled="" -->
```

### Attribute values

An unquoted `name={expr}` renders the whole attribute through `Fez.htmlAttr(name, value)`:

* `null` / `undefined` leave the attribute out.
* On a boolean attribute (`hidden`, `disabled`, `checked`, `selected`, `open`, `readonly`, `required`, `multiple`, `inert`, `autofocus`, ... - `BOOLEAN_ATTRS` in `src/fez/lib/attrs.js`) the value's truthiness decides: falsy (`false`, `''`, `0`, and the string `"false"` a plain attribute prop carries) leaves it out, truthy renders `name=""` - so `disabled={busy ? 'disabled' : ''}` works too.
* On any other attribute `false` / `true` render as text, so `aria-expanded={state.open}` says `"false"` or `"true"`.
* Everything else is escaped text.

A quoted `name="{expr}"` is always text; after the render, a boolean attribute whose text is `false`, `null` or `undefined` is removed.

```html
<details open={state.open} aria-expanded={state.open} title={state.tip}>...</details>
<!-- state.open = false, state.tip = null  ->  <details aria-expanded="false"> -->
```

### Loops

```html
<!-- Each loop with implicit index 'i' -->
{#each state.items as item}
<li>{item.name} (index: {i})</li>
{/each}

<!-- Each loop with explicit index -->
{#each state.items as item, index}
<li>{index}: {item.name}</li>
{/each}

<!-- For loop syntax -->
{#for item in state.items}
<li>{item}</li>
{/for}

<!-- Object iteration (2-param = key/value pairs) -->
{#for key, val in state.config}
<div>{key} = {val}</div>
{/for}

<!-- Empty list fallback with :else -->
{#each state.items as item}
<li>{item}</li>
{:else}
<li>No items found</li>
{/each}
```

**Loop behavior:**

- **null/undefined treated as empty list** - no errors, just renders nothing (or `:else` block)
- **2-param syntax** (`key, val` or `item, idx`) works for both arrays and objects:
  - Arrays: first param = value, second param = index
  - Objects: first param = key, second param = value
- **Brackets optional** - `{#for key, val in obj}` same as `{#for [key, val] in obj}`

### Keyed each

`{#each list as item (key)}` keys every row, Svelte style: the key is written as `key={...}` on the first element of the body (unless it has a `key` already).
A reorder then moves the nodes, and the child components inside them, with their item instead of morphing row content in place.

```html
<ul>
  {#each state.todos as todo (todo.id)}
    <li><todo-row :todo="todo" /></li>
  {/each}
</ul>
<!-- same as <li key={todo.id}> -->
```

### Recreate on change: `{#key}`

`{#key expr}...{/key}` recreates its body whenever `expr` changes, instead of morphing it - fresh nodes, fresh child components, and `fez:in` plays again.
The value is compared as `String(expr)`, so key on a primitive (an id, an index), not an object.

```html
{#key state.slide.id}
  <img src={state.slide.url} fez:in="fade" />
{/key}
```

### Event Handlers

**PREFER `onclick="fez.method()"` with inline values from templates:**

```html
<!-- PREFERRED - pass simple/scalar values inline -->
<button onclick="fez.handleClick()">Click me</button>
<input onchange="fez.setValue(this.value)" />

<!-- Pass template values directly - evaluated at render time -->
{#each state.items as item}
<button onclick="fez.remove('{item.id}')">Remove</button>
<button onclick="fez.select('{item.id}', '{item.name}')">Select</button>
{/each}
```

**Use arrow handlers ONLY when passing complex data (objects, arrays):**

```html
<!-- Arrow handlers - only when passing objects/arrays from loops -->
<!-- Always unquoted: onclick="{() => x()}" is a plain string attribute and does nothing -->
{#each state.tasks as task, index}
<button onclick={() => editTask(task)}>Edit</button>
{/each}
```

Unquoted handler expressions are compiled:

- `onclick={save}` (a bare method name) becomes `onclick="fez.save(event)"`
- `onclick={() => foo()}` becomes `onclick="fez.foo()"`
- `onclick={(e) => foo(e)}` becomes `onclick="fez.foo(event)"` - the first parameter is the event whatever it is called (`(evt) => go(evt.target)`)
- `onclick={async () => save()}` works; the returned promise is ignored
- Loop variables and `{@const}` names (`index`, `item`, `i`, ...) are captured at render time: indexes are interpolated, objects are kept in a per-render slot
- Inside a quoted handler, `{value}` is escaped for a JS string: `onclick="fez.rm('{item.id}')"` is safe when the id contains a quote

### Strict Event Handlers (`on<event>!=`)

Append `!` to an event attribute to fire the handler ONLY when the element itself is the target (no child captured the event), and to auto `stopPropagation` + `preventDefault`:

```html
<!-- closes only on a click on the overlay itself; the click does not bubble out -->
<div class="overlay" onclick!="fez.close()"></div>

<!-- card opens on the card, but NOT when its inner button is clicked -->
<div class="card" onclick!="fez.open()">
  <button onclick="fez.edit()">edit</button>
</div>
```

Compiles to `onclick="fez.fezBang(event) && (fez.close())"`. Body must be a single expression. Works on any `on<event>`.

### Self-Closing Custom Elements

```html
<!-- Self-closing custom elements are automatically converted -->
<ui-icon name="star" />
<!-- becomes: <ui-icon name="star"></ui-icon> -->

<my-component attr="value" />
<!-- becomes: <my-component attr="value"></my-component> -->
```

### Whitespace Between Nodes

Whitespace-only runs between tags and `{#..}` / `{:..}` / `{/..}` blocks are dropped, on the same line or across lines: `<b>a</b> <b>b</b>` renders `<b>a</b><b>b</b>`.
Space elements with CSS (`gap`, margin), or write `{' '}` where a real space is wanted.
Text keeps its own spaces (`<p>Hello <b>you</b></p>`), and `<pre>` / `<textarea>` bodies are left as written.
Implementation: `stripNodeWhitespace` in `src/fez/lib/template-compiler-lib.js`.

## Slim Templates

Templates can use an indentation-based, Slim-like syntax whose class shorthand takes Tailwind classes as written.
`parseFezSource` (`src/fez/lib/source-parser.js`) converts it with `slimToFez` (`src/fez/lib/slim.js`) into a normal Fez template, so runtime, `fez compile`, `fez template` and the bundler plugin all accept it.
A template whose first line reads as Slim is Slim with no wrapper (`SLIM_START_RE`): a known HTML/SVG tag or custom element followed by `.` / `#` shorthand, `: `, `=`, an attribute or the line end (`div`, `a href="/" Home`, `ul: li`), bare shorthand (`.card`), `- if|each|for|unless|await`, a Ruby `.each do |x|`, or `= expr`.
Anything else (`<tag>`, `{...}`, plain text such as `Loading...` or `a new item`) stays HTML; wrap the template in a `<slim>` block when its first line is not detected (for example a first `| text` line).

```slim
.card.p-4.md:w-1/2.bg-[#fafafa] class:active={state.open}
  h3.text-lg.font-semibold= props.title
  - each state.items as item
    ui-icon name="star"
    span.text-sm = item.name
  - else
    p.text-gray-400 No items
  button.px-3.py-1.5 onclick="fez.toggle()" Toggle
  == state.html_note
```

Rules:

* Line kinds by first character: tag name, `.class` / `#id` (a `div`), `|` text, `{expr}` text, `=` output, `==` raw output, `-` control, `/` comment (with its nested lines), `<` raw HTML.
* After the tag, `name=value` tokens are attributes; the first token without `=` starts inline text: `p.text-sm No items`, `p Set foo="bar" here`.
* `tag: child` nests the rest of the line as the only child (`form: input name="q" required=""`, `ul: li: a href="/" Home`); indented lines below go into the innermost element. A `:` followed by a space never occurs inside a Tailwind class.
* An inline `|` forces text that itself starts with `name=value`: `p | foo="bar"`.
* `= expr` / `== raw` right after the tag or after attributes, stuck or spaced: `h1= x`, `h1 = x`, `a href="/x"= x`. A `=` stuck to a bare value stays in the value (`type=button=x`).
* Attribute values: `"..."`, `'...'`, `{expr}` (may contain spaces), or bare. Boolean attributes need a value: `disabled=""`, `disabled={state.busy}`.
* Fez attributes pass through unchanged: `:prop="..."`, `fez:this="x"`, `class:on={...}`, `onclick!="..."`, `fez:in="fade"`.
* Shorthand classes merge with `class`: `.p-2 class={state.x}` -> `class="p-2 {state.x}"`.
* Class shorthand is Tailwind-safe: `.` inside `[...]` / `(...)` or between digits does not split (`p-0.5`, `w-[calc(100%-2rem)]`), `.2xl:flex` still starts a class, `#` starts the id only outside brackets (`bg-[#fff]`), and `/ : ! @ * %` are ordinary characters (`w-1/2`, `!mt-0`, `mt-0!`, `*:p-2`).
* Control: `- if` / `- else if` / `- else` / `- unless`, `- each list as item, i` / `- for x in list` (with `- else` for empty), `- await p` / `- then v` / `- catch e`. The body is the indented block; a block closes when the indentation drops or the next sibling is not a continuation. Never write `- end`.
* Ruby Slim aliases: `- list.each do |item|`, `- list.each_with_index do |item, i|`, `- elsif cond`, `#{expr}` in text and attributes. Expressions are still JavaScript (`item.name.toUpperCase()`, not `.upcase`).
* Adjacent text lines join with one space; nested lines under a `|` line continue the text.
* Void elements take no content; custom elements always get a closing tag. A line ending in ` \` continues on the next line.
* Output has no whitespace between nodes (see above).
* Errors carry the `.fez` file line and column (`Slim error`), template compiler errors are mapped back to the Slim line, and `fez compile -t` prints the generated template beside the Slim line numbers. Demo: `pages_src/root/fez/demo-slim.fez`.

## Conditional Class Directives

Use `class:name={condition}` to conditionally toggle CSS classes (Svelte-style):

```html
<!-- Toggle 'active' class based on condition -->
<div class="btn" class:active="{state.isActive}">Click</div>

<!-- Multiple class directives on one element -->
<div class="card" class:selected="{state.id === props.current}" class:disabled="{state.loading}">
  Content
</div>

<!-- Without existing class attribute -->
<span class:highlight="{state.query}">Result</span>

<!-- Quote syntax also works -->
<div class:visible="state.show">...</div>
```

At compile time, `class:name={expr}` is converted to a ternary expression merged into the `class` attribute. The class name is added when the expression is truthy, removed when falsy.

## Style Directives

`style:prop={expr}` sets one CSS property and `style:--name={expr}` a custom property (Svelte-style).
Each directive is merged into the `style` attribute after its static part, and a `null`, `undefined` or `false` value leaves that property out.

```html
<div class="bar" style="height: 8px" style:width={state.pct + '%'} style:--accent={props.color}>
  ...
</div>
<!-- props.color unset -> style="height: 8px;width: 40%;" -->
```

The runtime helper is `Fez.styleProp(name, value)` (`'width: 40%;'`, or `''` when unset).

## Special Attributes

All `fez:` attributes use namespace syntax. `fez-keep` also works (`fez:` is converted to `fez-` at compile time).

```html
<!-- Two-way binding: input writes state.username, a render writes the input -->
<input fez:bind="state.username" />

<!-- Element reference via this.state.myElement (auto-generates stable ID for DOM diffing) -->
<div fez:this="myElement">
  <!-- Preserve element across re-renders (wrap component in plain HTML element) -->
  <span fez:keep="child-{state.id}-{state.value}">
    <child-component />
  </span>

  <!-- DOM hook (action), runs once per node -->
  <input fez:use="el => el.focus()" />

  <!-- add classes after insert: "dialog" now, the last one ("open") 1ms later, for CSS transitions -->
  <div fez:class="dialog open">...</div>

  <!-- IMPORTANT: Use colon prefix for evaluated attributes (functions, objects, etc.) -->
  <ui-emoji :onselect="handleEmojiSelect" />         <!-- function reference -->
  <my-component :config="{foo: 'bar'}" />            <!-- object literal -->
  <user-card :user="state.currentUser" />            <!-- state object -->
  <ui-toggle :checked="state.isActive" />            <!-- boolean -->

  <!-- Without colon, values are treated as strings -->
  <my-component title="Hello World" />
</div>
```

`fez:bind` reads the bound key during the render, so every keystroke re-renders the component.
That is fine in a small form; in a big component prefer `fez:this` and read `.value` when needed (see State Management).

### `:prop` - evaluated attributes

`:name="expr"`, `:name='expr'` and `:name={expr}` all hold one JavaScript expression in template scope (state, props, loop variables, methods).
Hyphenated names work (`:data-x="..."`) and an object literal needs no extra braces (`:cfg="{a: 1}"`).
The value is parked in the parent's render slots (`fezGlobals`, see `src/fez/lib/render-slots.js`) and the HTML carries only a positional key, so objects, arrays and functions arrive as themselves.
Slots are reset on every parent render, and a parent render whose HTML is unchanged is still morphed when a slot now holds a different object, so preserved children receive the new props and re-render.
`xlink:href` and `xml:lang` are not props - only a leading `:` counts.

Without the colon an attribute is a string: `data="{state.items}"` hands the child text (`a,b` for an array, `[object Object]` for an object), `:data="state.items"` hands it the array.

### `fez:use` - actions

The value is an arrow (`fez:use="el => el.focus()"` or unquoted `fez:use={(el) => el.focus()}`) or the name of a component method (`fez:use="setupChart"`, called as `this.setupChart(node)`).
An arrow runs outside the component, so use a method name when the action needs `this`.
It runs once per node, not on every render, and may return:

* a function - called when the node leaves the DOM or the component is destroyed
* `{ update(node), destroy() }` - `update` runs on later renders that keep the node, `destroy` when it leaves

```javascript
tooltip(node) {
  const tip = createTooltip(node, node.title)
  return {
    update: (n) => tip.setContent(n.title),
    destroy: () => tip.destroy(),
  }
}
// template: <button title={state.hint} fez:use="tooltip">?</button>
```

### Server-rendered identity: `fez-key`

In HTML that is morphed in from outside (pjax swaps, `Fez.nodeMorph`), an unkeyed component is preserved only while its source (tag, attributes and content) is byte-identical; anything else destroys it and mounts a fresh one.
Give it a `fez-key` to keep the instance across changed attributes or content; its props are re-read and `onRefresh(props, changed)` fires:

```html
<top-menu fez-key="main-menu" active="users"></top-menu>
```

A raw `<top-menu>` tag in the new HTML is matched against the mounted wrapper by its `.top-menu-fez` class, so the server keeps sending plain tags.
`fez-key` also works as a plain identity key on non-component elements in server HTML.

### Passing props from HTML

```html
<!-- JSON props: the object becomes props (URL-encoded JSON works too) -->
<foo-bar data-props='{"name": "John", "age": 30}'></foo-bar>

<!-- JSON from the previous element sibling, which is removed after reading -->
<script type="application/json">{"name": "John"}</script>
<foo-bar data-json-template="true"></foo-bar>

<!-- evaluated before mount -->
<foo-bar :size="document.getElementById('range').value"></foo-bar>
```

Values from `data-props` and `:prop` that already have the declared type pass through `PROPS` coercion unchanged.

### Transitions: `fez:in` / `fez:out`

Svelte-style enter/leave animations on plain HTML elements inside templates (`src/fez/lib/transitions.js`).
`fez:in` plays when the element first appears (initial render included); `fez:out` plays when a re-render drops the element, and the node is detached only after the outro finishes.
`fez:transition` is shorthand for both with the same spec.

```html
<div fez:in="fade">...</div>
<div fez:in="fly, y=20, duration=300" fez:out="fade, duration=150">...</div>
<div fez:in="fly; y: 20; duration: 300; easing: quintOut">...</div>
<div fez:in="slide, axis=x, delay={index * 50}">...</div>
<!-- same animation both ways (Svelte transition:) - explicit fez:in / fez:out override per direction -->
<div fez:transition="fade, duration=200">...</div>
```

Syntax: first token is the transition name, the rest are `key=value` or `key: value` pairs separated by `,` or `;`.
Numbers and `true`/`false` are coerced; `{...}` interpolation works inside the value.

Built-ins (all accept `duration` ms, `delay` ms, `easing`):

* `fade` - opacity 0 -> 1. Default 300ms linear.
* `fly` - slide in from an offset while fading. `from=left|right|top|bottom` + `distance` (px, default 40), or explicit `x`, `y` (px); `opacity` start (default 0). 400ms.
* `slide` - collapse/expand height (or width with `axis=x`) incl. padding/margin/border, like an accordion. Add `opacity=0` to fade too. 400ms.
* `scale` - grow from `start` (default 0) while fading; `opacity`. 300ms.
* `pop` - subtle scale from `start` (default 0.8) with `backOut` overshoot + fade. The dialog / popover / toast / dropdown default. 250ms.
* `blur` - unblur from `amount` px (default 5) while fading; `opacity`. 300ms.
* `flip` - 3D card flip; `axis=y` (default) or `x`, `angle` (default 90), `perspective` (px, default 600), `opacity`. 400ms.
* `rotate` - spin in from `angle` deg (default -90) with optional `start` scale, + fade. 300ms.
* `draw` - SVG stroke drawing via stroke-dashoffset on anything with `getTotalLength()` (`<path>`, `<circle>`, `<line>`...); `duration` (800ms) or `speed` px/ms. Non-SVG nodes fall back to `fade`.

`easing` accepts any CSS timing function (`ease-out`, `cubic-bezier(...)`) or a Svelte-style name (`cubicOut`, `quintOut`, `expoOut`, `backOut`, ...).
Animations run through the Web Animations API; the outro is the same keyframes played in reverse. `prefers-reduced-motion: reduce` skips the animation.

Custom transitions: register on `Fez.transitions` (returns intro keyframes, first frame = hidden, last = natural state):

```js
Fez.transitions.pop = (node, params) => ({
  keyframes: [{ transform: 'scale(0.8)', opacity: 0 }, { transform: 'none', opacity: 1 }],
  duration: params.duration || 200,
  easing: 'backOut',
})
```

A name that is not registered is used as a CSS `@keyframes` name (`<div fez:in="wiggle, duration=400">` + `@keyframes wiggle { ... }` in the component `<style>`).

#### List reordering: `fez:animate="flip"`

FLIP animation for elements the differ keeps but moves (sort, shuffle, remove-from-middle) - items glide to their new position instead of jumping. Requires stable identity (`key=` / `fez:keep`) so the differ reuses the node. Params: `duration` (300), `delay`, `easing` (cubicOut).

```html
{#each state.items as item}
  <li key="{item.id}" fez:animate="flip, duration=250" fez:in="fly, from=left" fez:out="fade">{item.name}</li>
{/each}
```

Implementation: positions are measured right before the morph (`measureFlip` in `src/fez/lib/transitions.js`), the translate delta is played after (`playFlip`). Newly inserted nodes have no old position (their `fez:in` covers that); leaving nodes are skipped.

#### Content size: `fez:animate="height"`

The element animates from its old to its new height whenever its content changes (accordion body, growing list, swapped text) - no wrapper component, no inline height left behind.
`width` and `size` (both axes) work the same; `fez:animate="flip, height"` combines with list reorder.
Params: `duration` (300), `delay`, `easing` (cubicOut).

```html
<div fez:animate="height, duration=250">
  {#each state.items as item}<p key="{item.id}">{item.text}</p>{/each}
</div>
```

Implementation (`animateSize` in `src/fez/lib/transitions.js`): a `ResizeObserver` on the element reports the new size after layout but before paint, the box is animated from the previous size with WAAPI (`overflow: hidden` for the duration).
The node is unobserved while its own animation plays (a self-observing node that resizes in its callback trips the browser's ResizeObserver loop guard) and observed again when it finishes.
Because it observes rather than hooks the morph, it catches nested component renders and outside DOM changes too.
For plain DOM outside templates: `Fez.animateSize(node, 'height, duration=250')`.

Caveats:

* Identity matters. The differ only fires `fez:in` / `fez:out` when it actually inserts/removes the node; an unkeyed sibling may be morphed in place instead. Use `key=` / `fez:keep` on list items you want to animate.
* Outro is not nested: only the node the differ removes animates, descendants go with it. Child fez components inside are destroyed immediately and just stay visible while the parent fades.
* While an outro runs the old node stays in the DOM flagged `_fezLeaving` (pointer-events disabled) and is invisible to the differ; re-adding the same element meanwhile inserts a fresh node.
* Not supported on fez component tags (`<my-comp fez:in>`), only on plain elements inside templates.

## Best Practices

### Props Handling

- **IMPORTANT**: Props are passed as parameter to `init(props)` and `onMount(props)`
- Use `props.name` in templates and `this.props.name` in methods
- **Use `props` directly** - do NOT copy props to `this` or `state`:

  ```javascript
  // WRONG - copying props to this is unnecessary and won't update
  init(props) {
    this.style = props.style  // Don't do this!
    this.state.label = props.label  // Don't do this!
  }

  // CORRECT - use props directly
  // In template: <div style={props.style}>{props.label}</div>
  // In JS methods: this.props.style, this.props.label
  ```

  Props copied to `this` or `state` won't update when parent re-renders with new values.
  - In templates: use `props.name`
  - In JS methods: use `this.props.name`

- **Props are reactive** - `this.props.x = y` schedules a render exactly like `this.state.x = y`, so a component
  that owns a list can keep it in props and mutate it there instead of copying it into state.
  Reactivity is one level deep, unlike `this.state`: nested values come back exactly as they went in, so
  `props.item === props.item`, `props.items.includes(props.item)` and identity comparisons against objects a
  parent or child holds all work. The trade is that a nested write does not re-render - assign the container:
  `this.props.user = { ...this.props.user, name }` (that also delivers the change to a child holding it through
  `:user="props.user"`).
  Components using `<slot unwrap />` render once by design, so a prop write lands but schedules no render.
  A parent re-render still replaces the whole props object (and fires `onRefresh`), so anything the component
  wrote is overwritten by the parent's value - when the component owns the data for good, seed state with
  `{ state: true }` below.

- **Props from HTML attributes are strings** unless declared in `PROPS`. Prefer the schema over hand-parsing:

  ```javascript
  PROPS = {
    name:    String,                                    // shorthand == { type: String }
    speed:   { type: Number, default: 50 },             // "50" -> 50, "abc" -> error + default
    open:    Boolean,                                   // <x open> -> true, "false"/"0" -> false, missing -> false
    size:    { type: String, default: 'md', enum: ['sm', 'md', 'lg'] },
    items:   { type: Array, default: [] },               // JSON string parsed, or pass :items="..."; literal default copied per instance
    user:    { type: Object, required: true },          // missing -> Fez.onError('props', ...)
    on_pick: { type: Function, state: true },           // :on_pick="fn" or on_pick="doIt()" -> this.state.on_pick
    since:   { type: Date },
    tags:    { type: Array, state: true,                // seeds this.state.tags before init()
               default: (raw) => (raw || '').split(/\s*,\s*/) },   // tags="a, b" -> ['a', 'b']
  }
  ```

  - Types: `String`, `Number`, `Boolean`, `Array`, `Object`, `Function`, `Date`, or a custom `(raw, name) => value` function
  - Fields: `type`, `default` (value or fn), `state`, `required`, `enum`; order: transform -> coerce -> required -> enum -> default
  - A literal `default: []` / `default: {}` is shallow-copied per instance, so instances never share one object - no need for `() => []`
  - `Function` accepts a real function (`:on_pick="..."`) or a string handler (`on_pick="doIt()"`, resolved with `Fez.getFunction`); its `default` is always the handler itself, never a transform
  - **`default` as a transform**: a `default` function that *declares a parameter* receives the raw attribute value
    (`undefined` when the attribute is missing) and its result is what gets type checked - the way to accept
    `tags="a, b, c"` and hand the component an Array. A zero-arg `default` stays a lazy default, called only
    when nothing came in. Two things to know: arity is read from `Function.length`, so write `(raw) => ...` -
    a default or rest parameter (`(raw = '') => ...`) counts as zero and stays a plain default; and a value that
    already arrived as the declared type (`:tags="someArray"`, `data-props` JSON) skips the transform, so a
    string parser never has to guard against an Array.
  - **`state`**: `state: true` copies the coerced value into `this.state[name]` before `init()` runs,
    `state: 'other_key'` copies it under that key. Use it when the component owns the value from then on
    (a list it adds to, a draft it edits) - it replaces the `init(props) { this.state.x = props.x }` line.
    Seeding happens once, on connect; later parent renders update `props`, not the seeded state key.
    Arrays and plain objects are seeded as a shallow copy, so `this.state.list.push(...)` does not write back
    into `props` or into the object a parent passed with `:prop="..."` - nested objects are still shared.
    Handler props go the same way: `{ type: Function, state: true }` replaces the `this.state.x = Fez.getFunction(props.x)` line.
    Seeding works in `<slot unwrap />` components too (they render once, so only keys the template never reads may change later).
  - Errors go to `Fez.onError('props', ...)`, never throw; bad value is dropped and `default` applies
  - Keys not in `PROPS` pass through as strings; a keyed parent refresh coerces the new values the same way
  - Also works as `static PROPS = {...}`; schema is exposed on `Fez.index[name].props`
- **ALWAYS** use lowercase with underscores for prop names (e.g., `fill_color`, `read_only`)
- **Use colon prefix (`:`) for evaluated attributes** - functions, objects, booleans:

  ```html
  <!-- Passing evaluated values (functions, objects, etc.) -->
  <my-component :onclick="handleClick" :config="{theme: 'dark'}" :is_active="true">
    <!-- Passing string values (no colon needed) -->
    <my-component title="Hello" class_name="primary"></my-component
  ></my-component>
  ```

- **Handler props (onclick, ping, onselect, etc.) go through the schema into `this.state`**:
  they can arrive as strings (`ping="doIt()"`) or functions (`:ping="fn"`); `type: Function` resolves both
  and `state: true` puts the callable where the component calls it from. `default: () => {}` makes it safe
  to call when the attribute is missing. No template reads it, so it never causes a render.

  ```javascript
  PROPS = {
    onclick:  { type: Function, state: true, default: () => {} },
    onselect: { type: Function, state: true, default: () => {} },
  }

  handleClick() {
    this.state.onclick()
  }
  ```

  Without a schema, normalize by hand with `Fez.getFunction(props.onclick)` (returns a no-op for empty
  strings and nulls) and store the result in `this.state`.

- Props change only through a parent re-render, `this.props.x = y`, or a call on the instance. A raw DOM
  `el.setAttribute()` on a mounted component is inert; the inbound channel is `Fez(el).setAttribute(name, value)`,
  which writes the wrapper attribute, casts through `PROPS` into `this.props` and updates a `state`-linked key
- Check prop existence: `if (props.is_loading !== undefined)`

### State Management

- Initialize ALL properties in `init()`
- Modify arrays/objects directly (they're deeply reactive)
- Use `beforeRender()` for reactive computed/derived state (replacement for Svelte's `$:` reactive statements) - runs before every re-render
- Use `onMount()` for updates that need mounted template
- **`this.state` is the only per-instance store, and a write re-renders only if the last render read that top-level key.** Library instances, `fez:this` refs (`this.state.name`), normalized handlers, timers, counters, measurements and parsed config all go in `state`; since no template reads them, writing them never renders. Fez records the keys each render reads (`{@json state}` / `Object.keys(state)` count as reading all), so the rule needs no help from the author. Class instances, DOM nodes, Date/Map/Set/Promise come back unwrapped; a plain-object library namespace (Leaflet's `L`) belongs in a module-level `let`, not in state. Never park data on bare `this` - it collides with the instance API.
  Two costs to know: plain objects and arrays come back proxied on every read, so `state.cfg !== state.cfg` (pull a big blob into a local before a hot loop, never use it as a Map key), and a write to a key the template did read still rebuilds and morphs the whole template even when the output is identical - read tracking prunes writes, it does not shrink renders.
- **`init()` and every render (`beforeRender`, template, `afterRender`) run with state triggers off** - a state write inside them fires no `onStateChange` and schedules no render (derived state in `beforeRender` is exactly this). `onMount` is outside the scope on purpose: a write there to a rendered key paints. A write inside `onStateChange` does not re-enter the hook, but it still paints when the key is rendered. The same scope is available as `this.noChangeStateTrigger(() => { ... })` for bulk writes that must not paint; scopes nest and the function's return value comes back.
- **Do not bind form input values to a rendered state key in a big component** - the template reads the key, so every keystroke re-renders the whole component (`fez:bind` does the same). Use `fez:this` instead:

  ```html
  <!-- WRONG -->
  <input value="{state.name}" />
  <!-- CORRECT -->
  <input fez:this="nameInput" />
  ```

  ```javascript
  submit() {
    const name = this.state.nameInput.value  // read when needed
  }
  ```

- **NEVER assign props to state if they are not used in state itself** - keep them as `props.name`:

  ```javascript
  // WRONG - don't copy props to state if not needed
  init(props) {
    this.state.onclick = props.onclick  // Don't do this!
  }

  // CORRECT - declare it, the schema puts the callable in this.state.onclick
  PROPS = { onclick: { type: Function, state: true, default: () => {} } }

  // also fine without a schema - the template never reads it, so no render
  init(props) {
    this.state.onclick = Fez.getFunction(props.onclick)
  }
  ```

- **Design toggleable views so close and open render visibly different HTML.** `fezRender` skips the morph when the new HTML hashes to the same value as the previous render (`src/fez/instance.js`, hash-skip), and rAF-batched state writes can collapse a `close()` + `open(sameThing)` pair into a single render whose output matches the last one - morph skipped, DOM stale. Use a `state.open` boolean + a stable root with `class:hidden={!state.open}` and `{#if state.open}` gating the body, so the closed render is `<div class="overlay hidden"></div>` and the open render emits the full subtree. **Do NOT** poke private fields like `this._fezHash = null` to force a morph, and **do NOT** sprinkle `data-tick={state.counter}` to force unique hashes - both are workarounds for a state design that doesn't differ enough.

  ```html
  <!-- CORRECT - close vs open differ in class AND inner content -->
  <div class="overlay" class:hidden={!state.open} onclick="fez.close()">
    {#if state.open}
      <img src={state.url} />
    {/if}
  </div>
  ```

  ```javascript
  open(url)  { this.state.url = url; this.state.open = true }
  close()    { this.state.open = false }
  ```

### Derived values: getters

A class getter is a derived value: the template reads it like a field and it is recomputed on every render.
Its reads of `this.state` count as template reads, so a write to a key it uses re-renders.

```javascript
get total() {
  return this.state.items.reduce((sum, item) => sum + item.qty * item.price, 0)
}
// template: <b>{total}</b>
```

Use a getter for values that are cheap to compute; use `beforeRender()` when several derived keys share one expensive pass.

### Waiting for the DOM: `tick()`

`await this.tick()` resolves after the pending render reached the DOM, and right away when no render is pending.

```javascript
async edit() {
  this.state.editing = true
  await this.tick()
  this.state.input.focus()   // the fez:this="input" node rendered by {#if state.editing}
}
```

### Context

`this.context(key, value)` provides a value to every descendant component; `this.context(key)` returns it from the nearest component up the DOM tree, this one included (`undefined` when none provides it).
Provide it in `init()` (it is set before children mount) and read it in the child's `init()`.
Context is not reactive: a child keeps what it read in `init()`, so use `globalState` for values that change.

```javascript
// <theme-root>
init() { this.context('theme', { name: 'dark', color: '#222' }) }

// any descendant
init() { this.state.theme = this.context('theme') }
```

### Error boundaries: `onError`

An `onError(error, component)` method on any ancestor catches a descendant's mount error, render throw or template runtime error; `component` is the instance that failed.
A failed mount is destroyed either way; a failed render keeps its last DOM.
Set state in `onError` to render a fallback; throw from it to pass the error to the next boundary up.
Without a boundary a mount error goes to `Fez.onError('mount', ...)`, a template runtime error is logged to the console, and a render throw propagates.

```javascript
onError(error, component) {
  this.state.failed = `${component.fezName}: ${error.message}`
}
// template: {#if state.failed}<p class="error">{state.failed}</p>{/if}<slot />
```

Demos: `pages_src/root/fez/demo-blocks.fez` (keyed each, `{@const}`, `{#key}`, `style:`, getters, `tick()`) and `pages_src/root/fez/demo-context.fez` (context, `onError`).

### Performance

- Use throttled events: `this.on('scroll', callback, { throttle: 100 })`
- Window resize and scroll: `this.on('resize', fn, { throttle: 200 })` / `this.on('scroll', fn, { throttle: 200 })`. `fn` is not called on its own - call it once yourself for the initial state
- Element size: `this.observeResize(el, (rect, el) => ..., delay = 200)` calls the function once right away and then, throttled, whenever `el` resizes (`ResizeObserver`, disconnected on destroy)

#### Fez does not own the page - the template render is opt-out, not mandatory

A render rebuilds the component's whole template and morphs it, so the cost is proportional to the **template size**, not to how much actually changed.
That is a deliberate trade: one mental model that is correct and fast enough for ~99% of components.
It is **not** a ceiling.

Never conclude "this data set is too big for Fez".
Conclude "this one component should not render through `this.state`".
Fez is a DOM node helper, not a page owner - the live DOM is always yours to write to directly, and dropping out of the template render for a single component costs you nothing elsewhere.
The data still lives in `this.state`; it is just never read by a template, so writing it never renders.

Two escape hatches, in order of how much of the reactive model you give up:

**1. Keep the template, protect one subtree with `fez:keep`**

The rest of the component stays reactive; the marked node is never touched by the differ.

```html
<h3>{state.title}</h3>
<div fez:keep="grid" fez:this="grid"></div>
```

```javascript
onMount() {
  this.state.cells = []
  for (const row of this.props.rows) this.state.grid.append(this.buildRow(row))
}

patch(i, value) {
  this.state.cells[i].textContent = value   // no render, no diff, no hash
}
```

`state.cells` and `state.grid` are never read by the template, so writing them never schedules a render.

**2. No template at all - the component is a pure controller**

Omit the template block entirely and `fezRender()` never runs (`instance.js` returns early when there is no template).
The tag's original children are left alone and `this.root` is yours.

```javascript
class {
  onMount() {
    this.state.cells = []
    const tbody = document.createElement('tbody')
    for (let i = 0; i < 10000; i++) tbody.append(this.buildRow(i))
    this.root.append(this.n('table', tbody))
  }

  patch(i, value) { this.state.cells[i].textContent = value }
}
```

10k rows build in roughly 9ms and a cell update is a plain `textContent` write - the same speed as vanilla JS, because it **is** vanilla JS.
You still keep lifecycle hooks, typed `PROPS`, scoped `<style>`, auto-cleanup, pub/sub and `globalState`.

Rule of thumb: reach for a hatch when a single component owns more than ~500 live nodes **and** updates them frequently.
Below that, use `this.state` and do not think about it.

### External DOM Libraries (Three.js, Charts, Video players, etc.)

When integrating libraries that create/manage their own DOM elements:

- **Use template markup normally** - define your container structure in the template
- **Get references with `fez:this`** (or `this.find()` in `onMount()`) - they live in `this.state`, next to the library instance; neither is read by the template, so neither write renders
- **NEVER drive the library's DOM through a key the template reads** - a rendered-key write morphs the template, and the differ does not know about DOM the library created. Keys the template never reads (the instance, refs, measurements) are fine in `state`
- **Use direct DOM manipulation** to update UI elements:

```javascript
// Template is fine:
// <div class="container" fez:this="container"></div>
// <div class="loading-overlay" fez:this="overlay">Loading...</div>

onMount() {
  // External library creates canvas inside container
  this.state.chart = new Chart(this.state.container)
}

hideLoading() {
  // CORRECT - direct DOM manipulation
  this.state.overlay.style.display = 'none'

  // WRONG - state triggers DOM diff, breaks external DOM
  // this.state.loading = false
}
```

- Clean up external resources in `onDestroy()`

See `ui-3d-viewer.fez` for a complete Three.js example.

### Component Communication (Pub/Sub)

```javascript
// Component-level: subscribe with auto-cleanup on destroy
init() {
  this.subscribe('user-login', (user) => {
    this.state.user = user
  })
}

// Component-level: publish bubbles up to parent components
handleSelect() {
  this.publish('item-selected', this.state.item) // parent can subscribe to handle this
}

// Global publish: broadcast to all subscribers
Fez.publish('theme-changed', 'dark')

// Global subscribe with targeting options:
Fez.subscribe('event', callback)                  // always fires
Fez.subscribe(node, 'event', callback)            // fires only if node.isConnected
Fez.subscribe('#modal', 'event', callback)        // fires only if #modal exists at publish time

// Global state subscriptions - both return an unsubscribe function
Fez.state.subscribe('key', (value, oldValue, key) => {}) // subscribe to specific key
Fez.state.subscribe((value, oldValue, key) => {})        // subscribe to ALL changes, same argument order
```

`this.subscribe` and `globalState` subscriptions survive a move in the DOM (detach and re-insert); only a destroyed component's subscriptions are dropped.

Any read of `this.globalState.key` subscribes the component: on change it gets `onGlobalStateChange(key, value, oldValue)` synchronously.
It re-renders only for keys its last render read - the same rule as `this.state` - batched with local `this.state` changes (one render per frame).
A key read only outside the render (in a click handler) fires `onGlobalStateChange` but does not re-render.
`Object.keys(this.globalState)`, `{...this.globalState}` and `{@json globalState}` read every key; `delete this.globalState.x` deletes the key and notifies its readers.
A component's own write during `init` or render does not schedule an extra render.

Declare `GLOBAL_STATE = { boardView: true, activeBoardId() { return this.state.boardId } }` inside the component class for state tied to DOM presence.
Fez publishes each key after `onMount()` and before `onRefresh()`; function values run once, synchronously, with the live instance as `this`.
Use method syntax for instance access: arrow functions retain their original `this`.
Values are not recomputed on refresh and promises are not awaited.
On destruction, the declared keys are deleted and readers are notified with `undefined`.
Deletion is unconditional, with no restoration or instance counting; use unique keys per active instance.
CSS visibility and scrolling do not affect presence.
`Fez.state.delete(key)` also deletes a key and notifies its readers; persistent app state still uses `Fez.state.set()`.
See `pages_src/root/fez/demo-global-state.fez` for the demo.

To show a global value in static HTML without writing a component, use `<fez-inline>{globalState.key}</fez-inline>`: children are compiled as the template, it re-renders on change and accepts `:state="{...}"` for local state.

To render a component chosen at runtime (a router outlet), use `<fez-component name={state.page} :props="state.query">fallback</fez-component>`: prop changes reach the same child (re-render + `onRefresh(props, changed)`), a new `name` swaps it, and the children show while `name` is not registered.

### DOM / `addEventListener` listeners

For events fired on `document`, `window`, or arbitrary DOM nodes (custom `pjax:render`, `keydown`, `resize`, third-party `CustomEvent`s, etc.), `this.subscribe` does not apply - those go through native `addEventListener`. Use **`this.on`** - it binds `this`, guards on `isConnected`, and auto-removes on destroy.

```javascript
// CORRECT - this.on binds this, auto-removes on destroy
onMount() {
  this.on('pjax:render', (e) => {
    this.state.active = matchLink(e.detail.to)
  })
}
```

Signature:

```javascript
this.on(eventName, handler)                     // string-first form, see target rule below
this.on(target, eventName, handler)             // any EventTarget (window, document, element, ...)
this.on('scroll', handler, { throttle: 100 })   // optional throttle (ms)
this.on(el, 'touchstart', handler, { passive: true })  // other keys go to addEventListener as options
```

String-first target rule: events in `Fez.WINDOW_EVENTS` (`resize`, `scroll`, `beforeunload`, `hashchange`, `popstate`, `online`, `offline`, `message`, `storage`, `load`, `unload`, `pagehide`, `pageshow`, `orientationchange`, `error`) default to `window`. Everything else defaults to `document`. Pass `target` explicitly when in doubt; mutate `Fez.WINDOW_EVENTS` to customize.

- `handler` is invoked with `this = component` and the event arg
- Listener is removed automatically on destroy (no `onDestroy` boilerplate)
- Handler is skipped while `this.isConnected === false`
- Returns a disposer function for early unregister
- Each call adds its own listener - every component instance owns its own subscription
- Just mutate state in the handler - no need to call `this.refresh()`; the state assignment re-renders

```javascript
// WRONG - manual addEventListener leaks unless paired with removeEventListener,
// and `this.handler` from the prototype isn't bound when the DOM invokes it
onMount() {
  document.addEventListener('pjax:render', this.activateActiveNav)
}
```

**Why not just declare the method as an arrow class property and use `addEventListener` directly?** That works but: (1) you still need a manual `removeEventListener` in `onDestroy`, (2) arrow properties live on `this` rather than the prototype so you lose prototype introspection, and (3) there's no `isConnected` guard. `this.on` covers all three.

**`onRefresh` vs DOM listeners.** `onRefresh` fires at mount (every prop in `changed`) and whenever this instance is handed props again: a fez parent re-render that preserves it, a pjax / `Fez.nodeMorph` swap that keeps it (`refreshPreservedComponent` in `src/fez/lib/fez-morph.js`), or `<fez-component>` passing new props.
It does *not* fire when the component refreshes itself, and it does *not* fire from external DOM events.
A component outside any fez parent and outside a pjax region (a portal, a body-mounted menu) gets it only once, at mount.
Hook the relevant DOM event with the pattern above instead.

### Component Isolation in Loops

Child components in loops are automatically preserved during parent re-renders. They only re-render when their props actually change - by identity, so an object read out of `this.state` (a fresh proxy per read) always counts as changed; that is what delivers an in-place `task.done = true` to the child:

```html
{#each state.users as user}
<user-card :user="user" />
{/each}
```

This makes loops with many child components very efficient.

### Preserving Elements with `fez:keep`

Use `fez:keep` to preserve plain HTML elements across parent re-renders. The element is only recreated when its `fez:keep` value changes.

**Important:** `fez:keep` must only be used on plain HTML elements (`div`, `span`, `input`, etc.), **never on fez components**. To preserve a fez component, wrap it in a plain HTML element with `fez:keep`:

```html
<!-- Wrap child components in a plain element with fez:keep -->
{#each state.users as user}
<span fez:keep="user-{user.id}">
  <user-card :user="user" />
</span>
{/each}

<!-- Wrap components in loops -->
{#for i in [0,1,2,3,4]}
<span fez:keep="star-{i}-{state.rating}-{state.color}">
  <ui-star fill="{getStarFill(i)}" />
</span>
{/for}

<!-- Preserve form inputs -->
<input fez:keep="search-input" type="text" />
```

**Rules:**

- Same `fez:keep` value -> Element preserved (all internal state intact)
- Different `fez:keep` value -> Element recreated
- No `fez:keep` -> Element may be recreated on parent re-render
- `fez:keep` on a fez component logs a console error at compile time - wrap the component instead

**Best practice:** Include ALL state that affects the element in `fez:keep`:

```html
<!-- CORRECT: wrapper recreates when fill changes -->
<span fez:keep="star-{i}-{fill}">
  <ui-star fill="{fill}" />
</span>

<!-- WRONG: wrapper never recreates even when fill changes -->
<span fez:keep="star-{i}">
  <ui-star fill="{fill}" />
</span>
```

### Auto-ID for `fez:this` Elements

Elements with static `fez:this` attributes automatically get stable IDs (`id="fez-{UID}-{name}"`). This helps the DOM differ preserve form inputs across re-renders:

```html
<!-- Auto-generates id="fez-42-nameInput" -->
<input fez:this="nameInput" type="text" />

<!-- User-typed value survives parent re-renders because the differ matches by ID -->
```

This is automatic - no extra configuration needed.
Inside a loop each row gets its own id (`fez-{UID}-{name}-{index}`, one index per loop level), so every row keeps its own typed value; `this.state.name` then holds the last row's node.
A `fez:this` value with `{...}` in it gets no auto-ID.

## Singleton / Global Components

Two independent class keys: `MOUNT` mounts, `GLOBAL` names.

```javascript
class {
  MOUNT = true        // append <my-tag> to body on ready, unless the page already placed it
  GLOBAL = 'Dialog'   // expose the live instance as window.Dialog (cleared on destroy)

  init() { ... }
}
```

- Overlays, dialogs, toast hosts (`image-preview`, `ui-dialog`, `ui-toast`): both keys - mounted for you, callable from anywhere via `Dialog.open(...)`.
- A service component the layout places itself (a viewport, a player): `GLOBAL = 'Viewport'` alone, then `Viewport.play('idle')` from any other component.
- Nameless singleton (`fez-control`): `MOUNT = true` alone. `GLOBAL = true` is reported as a compile error and ignored.

## Component communication: pick the channel

Three channels exist; pick by the kind of traffic, not by habit.

| Traffic | Example | Use |
|---|---|---|
| Shared state many components render | selected animation, playback speed, theme | `this.globalState.anim = 'idle'` - readers auto-subscribe, late-mounted components see the current value |
| Command to one known service component | play, seek, reset camera | direct call: `Viewport.play('idle')` (`GLOBAL = 'Viewport'`) or `Fez('#viewport').play('idle')` - you get a return value, `await`, and a TypeError on a typo |
| Event whose consumers the sender must not know | `chain:finished`, `model:loaded` | `this.publish('chain:finished')` (nearest subscribing ancestor) or `Fez.publish(...)` (everyone) |

Pub/sub is the wrong tool for commands (no return value, no error when nobody listens) and for shared state (a component mounted after the event misses it).
Most panels in a tool-style UI are shared-state readers; usually only one component is a command target.

## Page navigation (Fez.load / Fez.refresh)

On a page with a `<pjax>` or `.pjax` container (with an `id`), links and `data-pjax` forms swap server HTML in place of a hard navigation; fez components inside survive the morph.
From code, use `Fez.load` and `Fez.refresh`. Both take `(what?, opts?)` and return a Promise that never rejects:

```javascript
Fez.load('/users')                        // navigate
Fez.load('#panel')                        // re-fetch the current URL, swap only #panel (needs an id)
Fez.load('/users', { target: '#panel' })  // another URL into #panel
Fez.refresh()                             // fresh copy of the current page (no-cache, no debounce, keeps scroll)
Fez.refresh('#list')                      // fresh copy of one server-rendered region

const detail = await Fez.load('/users')   // pjax:render detail, or null when nothing was sent
if (detail?.error) { /* 'status' | 'network' | 'timeout' | 'abort' | 'apply' | 'layout' */ }
```

- Options: `target` (`'#sel'` or element with id), `source` (triggering element - scopes the swap to its `.ajax` region), `form` (GET to query, POST as FormData), `history` (`'push' | 'replace' | false`), `scroll` (boolean). Unknown keys are reported and dropped.
- Defaults apply only to `undefined`: `load` scrolls to top on a full swap and not for a node swap; fetching the current URL into a node adds no history entry.
- `Fez.refresh('#id')` re-fetches server HTML. `this.refresh()` re-renders a component from its state. Do not mix them up.
- URL state without fetching: `Fez.qs('page', 2)`, `Fez.hash('tab', 'x')`, hash routes with `Fez.hpath('logs')` / `Fez.hqs('app', 'y')`. Each takes `{ replace: true }` or `{ href: true }`.
- Follow navigation in a component with `this.on('pjax:render', () => this.refresh())`.
- Config and hooks: `Fez.pjax.config`, `Fez.pjax.before = (href, opts) => ...`, `Fez.pjax.after = (href) => ...`, `Fez.pjax.confirm = (message, node) => ...` (may return a Promise), `Fez.pjax.error = (msg) => ...`. There is no `window.Pjax`; `fez refactor` lists legacy `Pjax.` calls.
- Layout id: with `<meta name="pjax-layout" content="ID">` in the page, full swaps send `x-pjax-layout: ID`; a response that does not echo the same header loads as a full page and resolves `error: 'layout'`. `Fez.pjax.layout()` returns the current id (or `null`).
- Inline `<script>` tags in a response run after history is committed and before the morph; `<script pjax-delay>` runs after the swap.

Link and form attributes:

```html
<a href="/users">                                <!-- hijacked automatically -->
<a href="/users" class="no-pjax">                <!-- opt out, native navigation (also: direct, on the link or an ancestor) -->
<a href="/users" pjax-target="#panel">           <!-- swap only #panel -->
<button pjax-refresh="#panel">                   <!-- fresh copy of the current page into #panel -->
<a href="/del" pjax-confirm="Are you sure?">     <!-- confirm before navigating -->
<a href="/tab2" pjax-replace>                    <!-- replaceState instead of pushState -->
<form data-pjax="true">                          <!-- submit via pjax, full swap -->
<form data-pjax="#panel">                        <!-- submit via pjax into #panel -->
```

## Bundled Pjax navigation

Fez ships the former `dux-pjax` package (ported to JS) and exposes it as `Fez.pjax`; the user-facing API is in "Page navigation (Fez.load / Fez.refresh)" above; these are the guarantees behind it.
`Fez.load`, `Fez.refresh`, `Fez.qs`, `Fez.hash`, `Fez.hpath` and `Fez.hqs` delegate to `Fez.pjax` at call time, so an override on `Fez.pjax` also drives the shortcut. There is no `window.Pjax`.

- Boot gating: `Fez.pjax` is always set, but handlers (link hijack, popstate, `data-pjax` forms) bind only when the page has a `<pjax>` tag or `.pjax` class container; `Fez.pjax.start()` for late-injected containers.
- `load` / `refresh` share `(what?, opts?)` and one path: `getOpts` validates and copies, the constructor resolves the region, href and form and fills defaults. They differ only in the internal `fresh` mode: `refresh` sends no-cache, skips the 2s debounce and does not scroll. `what` is a URL, or a `#selector` / element that becomes `target` for the current URL. Options are `target`, `source`, `form`, `history` (`'push' | 'replace' | false`), `scroll`; unknown keys are reported through `Pjax.error` and dropped. Requests go through `fetch` with an `AbortController` per request (a `'timeout'` abort reason tells a timeout from a superseded request). Request state (`region`, `fragment`, `method`, `body`, `startedAt`, `redirects`, `key`) lives on the instance, never on `opts` - `opts` is what `pjax:start` / `pjax:render` publish.
- The promise never rejects: `run()` resolves the `pjax:render` detail (`emitDone`) or `null`. `load()` returns true only when a request went out; every other exit resolves `null`. Keep new exit paths on that contract.
- Debounce (`Pjax._lastLoad`) and in-flight requests (`Pjax.requests`, a Map) are keyed per swap node: the target id, the `.ajax` region id, or `'full'`. A new request aborts only the same key; a `'full'` request aborts all.
- `morphInto` hands `Fez.nodeMorph` a DocumentFragment - the parsed response node's children, moved (no string round trip), or a string via `createContextualFragment`. Never pass nodeMorph a raw string: its "unwrap single matching-tag root" heuristic would swallow a legitimate lone wrapper child. `runScripts` executes a response's inline scripts and removes them before the morph, so they are never carried into the page.
- A URL fragment never goes to the server: `'/page#section'` loads `/page`, pushes `/page#section` and scrolls to the anchor; on the current path it only scrolls, like the browser. A no-href load or refresh keeps `location.hash`, so a hash route survives `Fez.refresh()`. Back/Forward restores full-swap pages from `historyData` without a fetch when cached (`Pjax.onPopState`): it aborts any in-flight full request and fires `pjax:render` like a load.
- A full-page swap only morphs the pjax container, so `runHeadScripts` also compiles the response head's own fez definitions (`script[fez]`, `template[fez]`, `xmp[fez]` outside the pjax region) before the morph - that is what loads the `page.components` a layout emits per page. Without it a pjax navigation lands on a page whose components never registered (unknown custom elements, empty widgets).
- Components follow navigation via `this.on('pjax:render', () => this.refresh())`.
- URL state: `Fez.qs()` (real query) and `Fez.hash()` (slashless fragment params) are history-only setters/getters. `Fez.hpath()`/`Fez.hqs()` address a hash route: a fragment whose path part contains a `/` is a route (`#/traffic?app=x`), the route name is the last path segment, and `hqs` reads/writes its query. A slashless fragment (`#foo`, `#tab=settings`) stays an anchor or `hash()` parameter list. Path setters canonicalize to `#/name` and clear on empty.

## Slot Unwrap

Use `<slot unwrap />` when children must be inserted without a wrapper div. By default, `<slot />` wraps children in a `<div class="fez-slot">`. With `unwrap`, the wrapper div is dissolved after filling, leaving children directly in the parent element.

**Important:** Components using `<slot unwrap />` render once - a re-render would lose the unwrapped slot content. `this.state` works normally for keys the template never reads; a write to a key the render did read logs a console error and is not rendered.

```html
<!-- Default slot: children wrapped in <div class="fez-slot"> -->
<slot />

<!-- Unwrap slot: wrapper dissolved after fill, children in parent -->
<slot unwrap />
```

A component has one default slot. Named slots (`<slot name="header">`) are not supported: pass that markup as a prop, read the children with `this.childNodes()` / `this.childObjects()` in `init()`, or split it into child components.
Slot content is captured once at mount (see App Rules 5).

## Built-in components

* `<fez-component name={state.page} :props="state.query">fallback</fez-component>` - mounts the component named by `name` with `props` (or `data-props`, or its own other attributes); `name` itself is never passed on. The same name keeps the child and hands it new props (re-render on change + `onRefresh`), a new name swaps it, and the children show while `name` is not registered.
* `<fez-inline>{globalState.count}</fez-inline>` - its children are compiled as a reactive template that reads `state`, `globalState` and `props`; `:state="{n: 0}"` seeds local state. Renders as a `<span>`.
* `<fez-include src="/parts/menu.html"></fez-include>` - fetches HTML (through `Fez.fetch`), runs its scripts, compiles its fez definitions and inserts it.
* `<fez-if if="window.user">...</fez-if>` - removes itself at mount when the expression is falsy.

## Common Mistakes to Avoid

- **Putting `META` or other class properties outside `class {}`** - they MUST be inside the class body. Module-level code (imports, `Fez.head()`) goes before the class, everything else goes inside it.
- Using React hooks (useState, useEffect)
- **Confusing the wrapper with the first template child** - root-level declarations in a `<style>` block style the generated outer wrapper node, not the first element of your template:
  ```html
  <style>
    /* WRONG - this styles the generated wrapper, not a first-child <nav> */
    display: flex;

    /* CORRECT - style the actual first template child */
    nav { display: flex; }
  </style>
  ```
- **Reaching for `:fez`, `:host`, or `body { }` to control scope** - none of them work; all three are compile errors in a `<style>` block. Scope is the tag: `<style>` scopes, `<style global>` does not. Use `&` for the wrapper node:
  ```html
  <style>
    &:hover { background: #fafafa; }
    .card { padding: 10px; }
  </style>

  <style global>
    .global-thing { color: red; }
  </style>
  ```
  A `<style global>` block is injected verbatim and deduped, so it lands once no matter how many instances mount. `:root { }`, `html { }`, `@font-face` and `@keyframes` all work normally in one. Don't wrap its rules in `:global(...)` - they are already global, and doing so is a compile error.
- **Putting computed/derived state in `init()` instead of `beforeRender()`** - derived values that depend on state should go in `beforeRender()` so they update on every re-render (like Svelte's `$:`)
- **Quoting an arrow handler** - `onclick="{() => save()}"` is a plain string attribute that does nothing; write `onclick={() => save()}` or `onclick="fez.save()"`
- **`//` comments in `<style>`** - CSS has only `/* ... */`; a `//` line swallows the declaration or selector after it
- **Building a promise in the template** - `{#await load()}` starts a new request on every render; assign `this.state.data = load()` once and write `{#await state.data}`
- **Expecting `this.on('resize' | 'scroll', fn)` to run at mount** - it only fires on the event; call `fn` once yourself. `observeResize` does call right away
- **Using Svelte-only syntax** - `on:click`, `bind:value`, `{@debug}`, `{#snippet}`, `{@render}` fail to compile; use `onclick={...}`, `fez:bind`, `{@json}`, `{@block}` or a child component
- **Named slots** - only one default `<slot />` exists
- **Keying `{#key}` on an object** - it compares `String(expr)`; key on an id
- **Passing objects as plain attributes** - `data="{state.items}"` hands the child text (`[object Object]`, `a,b`); use `:data="state.items"`
- Direct DOM manipulation for simple reactive UI (use state instead) - BUT use direct DOM for external libraries (Three.js, charts, etc.) since DOM diffing doesn't handle them well
- Missing `init()` for state initialization
- **Putting per-instance data on bare `this` to dodge re-renders** - `this.state` only re-renders for keys the template read, so editor objects, callbacks, measurements and timers belong in `state` too. Keep module-level constants and library namespaces outside the component.
- Using `{#if}` blocks inside attributes (use ternary operators instead)
- Writing flat CSS instead of nested SCSS syntax
- Forgetting to use `{index}` or arrow functions for loop variables in event handlers
- **Calling handler props raw** - props like `onclick`, `ping`, `onselect` can be strings or functions; declare them `{ type: Function, state: true }` or normalize with `Fez.getFunction()`
- **Keeping a plain-object library namespace in state** - `state.L = leaflet` gets proxied; use a module-level `let` for it. Class instances (a Three.js scene, a Tiptap editor) are fine in state
- **Copying props to `this` or `state`** - use `props.style` directly in templates, not `this.style = props.style` which won't update

## External Libraries & Modules

```javascript
// ES Module imports (use /+esm for CDN modules)
import library from 'https://cdn.jsdelivr.net/npm/library/+esm';

// Import map for bare specifiers (avoids duplicate library instances)
// Rewrites bare specifiers to full URLs at compile time
Fez.head({
  importmap: {
    three: 'https://esm.sh/three@0.160.0',
    'three/addons/': 'https://esm.sh/three@0.160.0/examples/jsm/',
  },
});
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Dynamic script/style loading
Fez.head({ js: 'https://cdn.example.com/script.js' });
Fez.head({ js: 'https://cdn.example.com/lib.js' }, () => { /* loaded */ });
Fez.head({ js: 'https://cdn.example.com/mod.js', module: 'MyLib' }); // imports it as window.MyLib
Fez.head({ css: 'https://cdn.example.com/styles.css' });
Fez.head({ script: 'console.log("inline")' });
Fez.head({ fez: '/fez/ui-card.fez' });            // load a component (a .txt lists one path per line)

// HTML string: appended to document.head, scripts re-created so they run
// (what a component's <head> block compiles to)
Fez.head('<link rel="preconnect" href="https://cdn.example.com">');
```

`js` / `css` loads are deduped by URL; a second call runs the callback right away.

## Utility Shortcuts

```javascript
this.find('.selector'); // Scoped querySelector (null after destroy)
this.setTimeout(fn, 1000); // Auto-cleaned timeout
this.setInterval(fn, 1000); // Auto-cleaned interval; setInterval(fn, ms, name) replaces a running one by name
this.addOnDestroy(fn); // Run fn on destroy; returns a function that drops it
this.observeResize(el, (rect, el) => {}); // Now + on every resize of el, throttled (200ms)
await this.tick(); // After the pending render reached the DOM
this.context('key', value); this.context('key'); // Provide / read context up the tree
this.state.editor = editor; // never rendered, so never re-renders
this.formData(); // Get form values as { name: value } (closest or child form)
this.childNodes(); // Get child elements as array
this.childNodes(fn); // Get children mapped with function
this.childObjects(); // Get children as objects: { html, ROOT, NODE_NAME, ...attrs }

// Fetch: GET responses are cached for 5 minutes (max 100 entries) and concurrent
// identical GETs share one request; POST is never cached. JSON responses are parsed.
Fez.fetch('/data'); // Promise
Fez.fetch('/data', { page: 2 }); // GET with query params
Fez.fetch('/data', (data) => {}); // callback form
Fez.fetch('POST', '/save', { name: 'x' }); // POST as FormData
Fez.clearFetchCache();

// Lookup
Fez('ui-btn'); // first instance (by name, '#id' selector, DOM node or UID)
Fez('ui-btn', (fez) => fez.refresh()); // run for every live instance, returns them (FezBase[])
Fez.find(node, 'ui-btn'); // closest instance of a node or selector, undefined when none

// Morph a node to new content (DOM node, fragment or HTML string) with the component-aware differ
Fez.nodeMorph(target, newNodeOrHtml);

// Template runtime helpers (what compiled templates call)
Fez.htmlEscape(value); // any value as escaped text, '' for null/undefined
Fez.htmlAttr('disabled', false); // ' name="value"' or '' (see "Attribute values")
Fez.styleProp('width', '40%'); // 'width: 40%;' or ''

Fez.tag('ui-card', { title: 'Hi' }, '<p>body</p>'); // HTML string with data-props
Fez.untilTrue(() => window.ready, 200); // retry until the function returns true
Fez.version; // library version (`fez version` on the CLI)
Fez.WINDOW_EVENTS; // Set of event names this.on('name') binds on window

// localStorage with JSON serialization (preserves types)
Fez.localStorage.set('count', 42);
Fez.localStorage.get('count'); // 42 (number)
Fez.localStorage.get('missing', 'default'); // fallback value

// Resolve a function from a string or function reference
Fez.getFunction(this.props.onclick); // function as is, no-op for empty values
Fez.getFunction('alert("Hi")'); // a string is an arrow / function expression or a function body

// to check if value is true, that comes from props
Fez.isTrue(value);

// Short type identifier
Fez.typeof(data); // Returns: 'o' object, 'f' function, 's' string, 'b' boolean,
//          'a' array, 'i' integer, 'n' float, 'u' undefined/null

// Convert collection to pairs (used internally by loops)
Fez.toPairs([1, 2]); // [[1, 0], [2, 1]] - [value, index]
Fez.toPairs({ a: 1, b: 2 }); // [['a', 1], ['b', 2]] - [key, value]
Fez.toPairs(null); // [] - safe for null/undefined

// Component Index (unified registry for all component data)
Fez.index['ui-btn'].class; // Component class
Fez.index['ui-btn'].meta; // Metadata from META = {...}
Fez.index['ui-btn'].demo; // Demo HTML string
Fez.index['ui-btn'].info; // Info HTML string
Fez.index['ui-btn'].source; // Raw .fez source code

Fez.index.get('name'); // { class, meta, demo: DOMNode, info: DOMNode, source }
Fez.index.apply('name', el); // Render demo into element and execute scripts
Fez.index.names(); // ['ui-btn', 'ui-card', ...] all component names
Fez.index.withDemo(); // Component names that have demos
Fez.index.all(); // All components as { name: { class, meta, demo, info, source } }
Fez.index.info(); // Log all component names to console
```

## Debugging Helpers

```javascript
Fez.LOG = true; // Enable framework logs
Fez('component').state; // Inspect component state
Fez.state.get('key'); // Check global state
Fez.dump(nodeOrValue); // Pretty-print a value or DOM node into an on-page log dialog
Fez.onError = (kind, message, context) => {}; // Every reported error goes through it
```

`fez compile` catches most template and script errors before the browser does; `fez compile -t` shows the final template.

## When Unsure

- Prefer Fez utilities over vanilla JS
- Use `this.globalState` for cross-component data
- Access elements via `fez:this` instead of querySelector
- Put DOM-dependent logic in `onMount()` not `init()`
- Prefer simple `fez.` prefix for handlers: `onclick="fez.method()"`
