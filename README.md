<img src="pages_src/root/fez.png" align="right" width="110" />

# FEZ - Custom DOM Elements

Check the Demo site https://dux.github.io/fez/ or try the live editor with recompile-as-you-type at https://dux.github.io/fez/playground.html

FEZ is a small library (about 140KB minified, about 48KB gzipped, Pjax navigation included) that allows writing of [Custom DOM elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Components/Using_custom_elements) in a clean and easy-to-understand way.

It uses

- A built-in CSS flattener to enable SCSS-style component styles with no build step and no CSS dependency
- Custom component-aware DOM differ to morph DOM from one state to another (as React or Stimulus/Turbo does it), with hash-based render skipping for zero-cost no-op renders

It uses minimal abstraction. You will learn to use it in 15 minutes, just look at examples, it includes all you need to know.

## How to install

`<script src="https://dux.github.io/fez/dist/fez.min.js"></script>`

Or `bun add @dinoreic/fez` and `import Fez from '@dinoreic/fez'` (see [Bundler imports](#bundler-imports-vite--rollup) for the `.fez` plugin and the CSP build).

## CLI Tools

Fez provides command-line tools for development:

```bash
# Print the LLM/agent reference (AGENTS.md); --init adds a pointer to your project's AGENTS.md
bunx @dinoreic/fez agents
bunx @dinoreic/fez agents --init

# Print the whole AGENTS.md, including the fez-repo-only notes
bunx @dinoreic/fez agents --full

# Compile and validate a Fez component
bunx @dinoreic/fez compile pages_src/root/fez/ui-counter.fez

# Validate only the template block
bunx @dinoreic/fez template pages_src/root/fez/ui-counter.fez
```

Or install globally:

```bash
bun add -g @dinoreic/fez
fez compile my-component.fez
fez template my-component.fez
```

`fez --help` lists all commands plus the source path and GitHub repo.
`fez <command> --help` (or `-h`) prints that command's usage and options; an unknown command exits 1.

`fez agents --init` appends a pointer block to `./AGENTS.md` (creating it when missing) and to `./CLAUDE.md` only when that file exists.
It skips any file that already mentions `fez agents`, and a `CLAUDE.md` that imports `@AGENTS.md`, so it is safe to run twice.

`fez compile` validates both JavaScript and Fez template syntax.
It also rejects component names without a dash and reports `<style>` errors: scope errors, unterminated comments or strings, and unbalanced braces or parentheses.
Use `--debug-template` (`-d`) when a template compile error needs the generated render function (`fez template -d` is short for `--debug`):

```bash
fez compile --debug-template my-component.fez
fez template --debug my-component.fez
```

`-t` / `--dump-template` prints the final template each component compiles to (a `<slim>` template one node per line, with source line numbers), `-o` / `--output` prints the compiled JavaScript (`Fez('name', class {...})`) of each component, and `--json` prints errors as a JSON array for editors:

```bash
fez compile -t my-component.fez
fez compile -o my-component.fez > compiled.js
fez compile --json my-component.fez

# Several files and globs work for both commands
fez template 'path/to/**/*.fez'
```

`fez compile` and `fez template` exit 1 when any file has an error, a glob that matches nothing is an error, and glob matches with `.tmp.` in the name are skipped.
`fez compile --json` prints `[]` on success, otherwise an array of `{ file, line, column, kind, message, detail }` objects.

`.fez` files are compiled with Fez's own template compiler (`src/fez/lib/template-compiler.js`).

```bash
# Report legacy syntax, removed APIs, window.Pjax calls and // comments in <style> (never changes files)
fez refactor pages_src/root/fez

# Index files as JSON, or open a URL in Playwright with an interactive debugging REPL
fez index pages_src/root/fez
fez debug http://localhost:8000
fez debug --headless http://localhost:8000

# Print the installed version (X.Y.Z from .version, dev when unstamped); Fez.version is the package.json version baked into dist
fez version
```

Without a path, `fez refactor` scans `pages_src/root/fez`, `src` and `test`.
It reads `.fez`, `.js` and `.ts` files, skipping `node_modules`, `dist`, `build`, `tmp`, `.next`, `.git`, `coverage` and `vendor`.
It also flags `var` declarations, and exits 1 when it finds any candidate, so it can gate CI.

`fez index` prints a JSON array of `{ "file": { "base", "path", "size", "modified", "created" } }` (times in Unix seconds).
A directory argument lists only its direct files; pass a glob such as `'src/**/*.js'` to recurse.

The `fez debug` REPL exposes `page`, `browser` and `context` (Playwright), accepts `await`, and exits on `.exit` or Ctrl+D.
It accepts `http:`, `https:` and `file:` URLs and opens a visible browser unless `--headless` is given.
It needs Playwright's Chromium, which is not downloaded with the package; when it is missing, `fez debug` prints the `bunx playwright@<version> install chromium` command to run.

## Repository development and deployment

```bash
bun run dev            # Build library + docs, watch, serve on port 8000, and reload browsers
bun run build          # Build the library bundles
bun run static         # Generate the component index and documentation site
bun run test           # Unit tests, then the browser suite (plain bun test also picks up browser files and fails)
bun run test:browser   # Browser suite only
bun run lint --fix     # Fix lint issues
bun run format         # Prettier on src/**/*.js (format:check only reports)
bun run vscode:install # Package and install the VS Code extension
bun run deploy --help  # Describe the complete GitHub deployment workflow
bun run deploy --dry-run
bun run deploy
```

`deploy` requires a clean working tree on `main`.
It runs `bun run test` first and stops on failure before stamping a version, building, committing, or pushing.
It stamps the version with `vstamp count --next` ([vstamp](https://github.com/dux/vstamp)): the main commit count including the release commit, rendered dotted (`357` -> `3.5.7`, `1123` -> `11.2.3`), written to `.version` (YAML, `version: X.Y.Z`) and `package.json`.
It then builds the library and pages, commits both files on `main`, and commits the built site on top of the `pages` branch with the same commit-tree path as `fez gh-pages`.
It tags the release commit `v<version>` (after the tests, aborting before the build with `.version`/`package.json` restored when that tag already exists) and pushes `main`, `pages` and the tag to `origin` atomically: both branches must fast-forward and `pages` is never force-pushed.
After the push it publishes the package to npm with `bun publish --access public --ignore-scripts` (tests and build already ran); it checks `bun pm whoami` before running tests, so an expired npm login fails before anything is committed.
The generated site is served from the root of the `pages` branch.
`--dry-run` also runs tests, builds the next version, runs `bun publish --dry-run`, restores `.version` and `package.json`, and leaves preview output without committing, pushing or publishing.
Build failures restore the manifest before any source commit; later failures retain local commits and the Pages output for recovery.
For a site that only needs the generic publisher, `fez gh-pages` builds `source_dir` and commits it to the same `pages` branch with no version stamping.

## Static Site Builder

Fez includes a convention-based static site builder for Markdown, HTML, layouts, includes, and browser-side `.fez` components.
It requires Bun 1.3.8 or newer for the native Markdown renderer.
Inside this repository, the same commands can be called directly through `./bin/fez-static`.

```bash
# Create a starter with a fully commented config, one page, two posts, navigation, and a footer
fez static init

# Build ./web_src/root into the configured target (./web_build by default)
fez static
fez static build

# Build, watch, serve, and reload the browser after successful builds
fez static dev

# Validate a complete build, metadata, links, fragments, and assets without publishing it
fez static doctor

# Serve the existing target, or remove it
fez static serve
fez static clean

# Rebuild on every source change without a server
fez static build --watch

# Include draft: true pages (build, dev, doctor)
fez static --drafts

# Pick the dev/serve address (defaults: 127.0.0.1:3000; port 0 picks a free port)
fez static dev --port 4000 --host 0.0.0.0

# Run any command against another project root
fez static doctor ../my-site
```

`fez static init` fails when `source_dir` already exists and never overwrites files.
It writes `fez-static.yaml` only when no config exists; otherwise it creates the site under the configured `source_dir`.
`fez static clean` validates the same paths as a build, so it fails when `source_dir/root` is missing.

Publish the built target to GitHub Pages with `fez gh-pages` (run from the project root):

```bash
# Build source_dir and commit it on the 'pages' branch, then push it to origin
fez gh-pages

# Commit the pages branch locally without pushing, or publish then preview it
fez gh-pages --no-push
fez gh-pages -s --port 4000
```

`fez gh-pages` writes the same `target_dir` the static builder produces, then commits it on top of the `pages` branch (`git commit-tree` + `update-ref`, without checking the branch out) and pushes it to `origin`.
It always uses the Git top-level directory as the project root, adds files with `--force` (a shipped `.gitignore` cannot hide them), and commits with the message `fez gh-pages <short HEAD>`.
It fails with a clear message instead of guessing when run outside a Git repository or when the `pages` branch is checked out in a worktree, and, unless `--no-push` is given, without an `origin` remote or when local `pages` diverges from `origin/pages`.
`-s` / `--serve` builds, publishes, then serves the target with auto-rebuild and live reload, like `fez static dev`.
With `-s`, later edits rebuild and reload the preview but are not committed or pushed; run `fez gh-pages` again to publish them.
It also accepts `--drafts`, `-p` / `--port` (default 3000) and `--host` (default 127.0.0.1).

A site uses this structure:

```text
my-site/
|-- fez-static.yaml
|-- web_src/
|   |-- layouts/
|   |   |-- default.html
|   |   `-- post.html
|   |-- parts/
|   |   `-- header.html
|   `-- root/
|       |-- [blogs]/
|       |   |-- first-post.md
|       |   `-- second-post.html
|       |-- index.html
|       `-- about.md
`-- web_build/
```

`web_src` and `web_build` are the default `source_dir` and `target_dir`; both are configurable.
Markdown and HTML pages share YAML front matter.
Pages without `layout` use `layouts/default.html` (or `default.md`), or the collection's configured layout; the build fails when that layout is missing, unless the page sets `layout: false`.
Use `layout: false` for an unwrapped page, or name another layout with `layout: post`.
Layouts can declare parent layouts.
Layouts and parts may use `.html` or `.md`.

```yaml
---
title: Hello, Fez
layout: post
date: 2026-08-24
permalink: /blog/hello-fez/
---
```

* Pages with `draft: true` are left out of the build, `collections` and `index.yaml` unless the command gets `--drafts`.
* `title` defaults to the slug in title case (`hello-world.md` -> `Hello World`).
* `slug` defaults to the filename without its extension and without a leading `YYYY-MM-DD-` date, which also becomes the default `date`.
* `index.md` builds `index.html`; any other page keeps its path with an `.html` extension (`about.md` -> `about.html`).
* `permalink` overrides the route; it must start with `/` and cannot contain `?`, `#` or `..`; `/a/` writes `a/index.html`, `/a` writes `a.html`, and `/a.txt` writes `a.txt`.
* Any other front matter key is available as `page.<key>`.

HTML pages, layouts, and includes use Fez template expressions, conditionals, and loops.
Markdown pages and parts are converted without evaluating `{...}` expressions, so Fez examples stay literal; `{@include}` still expands outside code blocks.
Markdown layouts are rendered as templates after conversion, so `{site.title}` and `{@content}` work there.
Text inside `<script>`, `<style>`, `<pre>`, `<code>`, `<xmp>`, `<fez-inline>` and HTML comments is copied verbatim: braces there are not evaluated and `{@include}` is not expanded.

```html
<!doctype html>
<html>
  <head>
    <title>{page.title} | {site.title}</title>
  </head>
  <body>
    {@include "header.html"}
    <main>
      {@content}
    </main>
  </body>
</html>
```

`{@content}` inserts the current page or child layout; each layout must contain exactly one `{@content}`.
`{@include "name.html"}` resolves from `parts/` in `source_dir` and may be used in pages, layouts, or other parts.
Use `./name.html` for a part relative to another part.
Pass one parameters object; its values are available through `include`:

```html
{@include "badge.html", { label: page.title, kind: "note" }}
```

```html
<strong class={include.kind}>{include.label}</strong>
```

* A part's own front matter supplies default `include` values; parameters passed by `{@include}` override them.
* Part paths need their `.html` or `.md` extension.
* Markdown parts are not evaluated as templates, so they cannot read `include`.

Templates receive `site`, `page`, `collections`, `include`, and the `url(path)` helper.

* `page` holds all front matter plus `title`, `slug`, `date`, `format` (`html` or `md`), `collection`, `layout`, `url`, `href`, `base` and `source_path`.
* Markdown pages also expose `page.content`, their rendered HTML, so a list can print a post body with `{@html post.content}`.
* `site.pages` lists every published page and `site.collections` equals `collections`.
* A layout reads its own front matter through `layout` (for example `{layout.title}`).

With no `site.base_url`, `url(path)` emits paths relative to the generated site root (`css/site.css`, `blogs/post.html`).
Put `<base href={page.base}>` in the layout so those paths resolve from every nested page.
The same files then work at `/` locally and `/fez/` on GitHub Pages, with no extra config.
If `site.base_url` is set, `url(path)` prefixes that value onto root-relative paths instead.
`site.relative_urls: true` makes `url(path)` return page-relative paths (`../../css/site.css` from `/deep/page/`), so pages work without `<base href>`.
Every page also exposes `page.href` (the prefixed form of `page.url`) and `page.base` (the relative href for `<base>`).
Without `site.base_url`, `page.href` and `page.url` are root-absolute (`/blogs/post.html`); link with `url(post.url)` so the `<base href>` setup also works under a sub-path.
With `base_url` set, `page.href` already carries the prefix.

```html
<a href={url("/")}>Home</a>
<a href={url(page.url)}>{page.title}</a>
<script src={url("/assets/app.js")}></script>
```

A bracketed directory declares a collection: files under `root/[blogs]/` are exposed as `collections.blogs` and sorted newest first (by `date`, then by URL; entries without a date come last).
The brackets are removed from public paths, so posts build under `web_build/blogs/` (the `target_dir`).
Each collection gets a generated `index.yaml` containing its published page metadata.
Assets inside a collection are copied to the same bracket-free output path but are not collection entries.
Collection names start with a letter and use letters, digits, `_` or `-`; nesting one collection inside another, or reusing a name, fails the build.
Non-page files under `root` keep their root-relative paths.
Files and directories whose name contains `.tmp.` are ignored, and output paths that differ only in letter case collide and fail the build.
For an existing complete HTML document whose body must pass through without rendering, set both `layout: false` and `render: false` in its front matter.
Every generated HTML and Fez file starts with `<!-- generated from src: web_src/root/PATH | DO NOT EDIT OR READ THIS FILE -->`, including unrendered HTML pages.
JavaScript files use the equivalent `// generated from src: web_src/root/PATH | DO NOT EDIT OR READ THIS FILE` notice; all other assets are copied unchanged.

Configuration is optional.
Fez looks for `fez-static.yaml`, then `fez-static.json`, in the project root and then in `config/`; the first match wins.
`source_dir` (default `web_src`) and `target_dir` (default `web_build`) are relative to the project root and must stay inside it; `target_dir` cannot be the project root and cannot contain, or sit inside, `source_dir/root`.
The old `target` key and a `default_layout` key fail the build; use `target_dir` and `layouts/default.html`.
Values under `site` are exposed to templates:

```yaml
source_dir: web_src
target_dir: web_build

site:
  title: Fez
  description: JavaScript DOM components framework
  # base_url: /my-site
  # relative_urls: true

# local server only, never the build
# serve_root: .
# serve_prefix: /repo

copy:
  "dist/main.min.js": "./assets/main.min.js"
  "public": "./vendor"

collections:
  blogs:
    layout: post
    required:
      - title
      - description
      - date
```

`site.base_url` must be an absolute site path such as `/my-site`; a trailing slash is dropped and a value like `docs` fails the build.
`serve_root` (project-relative directory) changes the document root of `fez static serve` and `dev`, for example `serve_root: .` to browse `/<target_dir>/` paths.
`serve_prefix` (for example `/repo`) mounts the served site under that prefix to mimic project-pages hosting; other paths redirect into it.

Collection configuration is optional.
Use it to provide a default layout for pages in a bracketed collection; page front matter can still override that layout.
The optional `required` list is checked by `fez static doctor` against the final page metadata, including inferred titles and filename dates.

Copy sources are relative to the project root, may live outside `source_dir`, and must remain inside the project root.
A file maps to one exact target path; a source directory copies its contents recursively into the mapped target directory.
Copy targets are relative to the generated target, copied bytes are unchanged, and copied sources participate in watch mode.
Missing sources, symbolic links, scratch files, unsafe paths, and output collisions fail the build.
A file copied to a destination ending in `/` (or to `.`) keeps its basename inside that directory.

`fez static doctor` renders into a temporary target and checks internal references, including those resolved through `<base href>`: `href` on `a`, `area` and `link`; `src` and `srcset` on `img` and `source`; `src` and `poster` on `video`; `src` on `audio`, `embed`, `iframe`, `input` and `track`; `src` and `fez` file paths on `script` (a bare component name such as `<script fez="ui-clock">` is skipped).
Fragments must match an `id` or an `<a name>` in the target page.
Use `url(path)` for internal links (`url(page.url)` for page links). When `site.base_url` is set, root-relative references must include it.
External and protocol URLs are ignored.
Add `data-fez-static-ignore` to an element when an intentional client-side route has no generated file.
Doctor prints each problem as a `- ` line under `Static doctor found N problems:` (`1 problem:` for one) and exits 1; missing `required` fields are reported first, before links are checked; `--drafts` also validates drafts.

The builder writes through a staging directory and replaces the target only after every page renders successfully.
Templates compile in strict mode and do not support `{#await}`; an expression that throws (for example reading a property of an undefined value) fails the build.
Missing layouts or parts, layouts without exactly one `{@content}`, invalid front matter, permalinks or `base_url`, nested or duplicate collections, output collisions, recursive includes or layouts, dynamic include paths, and unsafe paths also fail the build.
`fez static dev` injects a development-only reload client and refreshes connected pages after each successful rebuild.

* The local server answers clean URLs (`/docs` finds `docs.html` or `docs/index.html`; `/docs/` finds only `docs/index.html`), accepts paths with or without `base_url`, and sends `cache-control: no-store`.
* `fez static serve` does not build; run `fez static` first.
* `dev` and `--watch` watch `source_dir` and external `copy` sources, not `fez-static.yaml`; restart them after a config change.
* A failed rebuild prints the error, keeps the previous target and keeps watching.

This repository uses `pages_src/root/` as its publish root (`source_dir: pages_src`), builds into `tmp/fez-pages`, and publishes that tree to the `pages` branch, which GitHub Pages serves at its root.

## Why Fez is Simpler

| Concept           | React                    | Svelte 5        | Vue 3                  | **Fez**            |
| ----------------- | ------------------------ | --------------- | ---------------------- | ------------------ |
| State             | `useState`, `useReducer` | `$state` rune   | `ref`, `reactive`      | `this.state.x = y` |
| Computed          | `useMemo`                | `$derived` rune | `computed`             | A class getter     |
| Side effects      | `useEffect`              | `$effect` rune  | `watch`, `watchEffect` | `afterRender()`    |
| Global state      | Context, Redux, Zustand  | stores          | Pinia                  | `this.globalState` |
| Re-render control | `memo`, `useMemo`, keys  | `{#key}`        | `v-memo`               | Automatic          |

**No special syntax. No runes. No hooks. No compiler magic.** Just plain JavaScript:

```js
class MyComponent extends FezBase {
  init() {
    this.state.count = 0; // reactive - nested changes tracked too
  }

  increment() {
    this.state.count++; // triggers re-render automatically
  }

  get doubled() {
    // computed value - just a getter, recomputed on every render ({doubled} in the template)
    return this.state.count * 2;
  }
}
```

The whole mental model:

1. Change `this.state` -> component re-renders
2. Component-aware differ updates only what changed (child components preserved automatically)
3. Hash-based skip avoids DOM work entirely when template output is identical

## Fez does not own the page

This is the part that separates Fez from React, Svelte and Vue, and it is worth being explicit about.

Fez is a **DOM node helper**. It is not a page owner and it has no internal representation of your UI that magically gets reflected somewhere. Every method Fez uses to touch the DOM is a thin helper around the native DOM interface. The live document is the source of truth, and it is always yours to write to directly.

In React or Vue, reaching for `element.textContent = x` is an anti-pattern - you are lying to the framework about what it owns. In Fez it is just JavaScript. You can work on raw DOM, use the built-in [node builder](https://github.com/dux/fez/blob/main/src/fez/lib/n.js) via `this.n(...)`, or use full template mapping with DOM morphing. Mix all three in the same component.

It creates new HTML tags using native Autonomous Custom Elements, supported for years in [all major browsers](https://caniuse.com/custom-elementsv1). There is nothing to "fight", overload or monkey-patch.

### The template render is opt-out, not mandatory

A render rebuilds the component's whole template and morphs it, so the cost is proportional to the **template size**, not to how much actually changed. That is a deliberate trade: one mental model - *write a state key the template reads, the component re-renders* - that is correct and fast enough for ~99% of components, with no hooks, no runes, no dependency arrays and no memo tuning.

It is **not** a ceiling. If you hit a component that genuinely needs raw DOM throughput - a 10k-row table, a live log, a canvas overlay, a spreadsheet - the answer is never "don't use Fez". The answer is "this one component should not render through `this.state`". The data still lives in `this.state`, the template just never reads it, so you drop out of the render and the diff for that component alone, and every other component on the page is unaffected.

Two escape hatches, in order of how much of the reactive model you give up:

**1. Keep the template, protect one subtree with `fez:keep`**

The rest of the component stays reactive. The marked node is never touched by the differ, so whatever you build inside it survives every parent render.

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

`state.cells` and `state.grid` are never read by the template, so writing them never schedules a render - see [state and props](#state-and-props).

**2. No template at all - the component is a pure controller**

Omit the template block and no render ever runs. The tag's original children are left alone and `this.root` is yours.

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

10k rows build in roughly 9ms and a cell update is a plain `textContent` write - the same speed as vanilla JS, because it *is* vanilla JS. You keep everything else: lifecycle hooks, typed `PROPS`, scoped `<style>`, auto-cleanup of timers and listeners, pub/sub and `globalState`.

`this.n(name, attrs?, body?)` builds a DOM node:

* `name` is a tag with optional classes (`'.card.big'` is a `div`); an array as `name` is the body of a `div`.
* A string `body` may come before `attrs` (`n('p', 'hi', { class: 'x' })`); a Node, array or number in the second position is the body and the element gets no attrs.
* `body` is a string (set as innerHTML), a Node or an array of Nodes, and `0` / `''` count as content while `null` / `false` do not.
* A function attribute is assigned as a property bound to the component (`{ onclick: this.save }`), a boolean attribute is set only when truthy, and `fez.` in a string attribute points at the component.

Rule of thumb: reach for a hatch when a single component owns more than ~500 live nodes **and** updates them frequently. Below that, use `this.state` and do not think about it.

This article, [Web Components Will Replace Your Frontend Framework](https://www.dannymoerkerke.com/blog/web-components-will-replace-your-frontend-framework/), is from 2019. Join the future, ditch React, Angular and other never defined, always "evolving" monstrosities. Vanilla is the way :)

## How it works

- define your custom component - `Fez('ui-foo', class UiFoo extends FezBase)`
- add HTML - `<ui-foo bar="baz" id="node1"></ui-foo>`
  - lib will call `node1.fez.init()` when node is added to DOM and connect your component to dom.
  - use `Fez` helper methods, or do all by yourself, all good.
- a component name must contain a dash; otherwise Fez logs an error and registers nothing.
- registering a name again replaces its class for instances mounted afterwards; live instances keep the old one.

That is all.

## DOM Diffing Engine

Fez uses a custom real-DOM morph algorithm (not a virtual DOM). The live DOM is the source of truth - it is never thrown away. On every render, the template produces a new HTML string which is parsed into a detached DOM tree, and the differ mutates the live DOM in-place to match.

### Render Pipeline

When component state changes, the following happens:

1. **State Proxy setter** detects the change
2. **Debounced to next `requestAnimationFrame`** via `fezNextTick` - multiple state changes in the same tick are batched into one render (while `document.hidden`, a `setTimeout(0)` replaces the paused animation frame, so background writes still paint)
3. **`beforeRender()`** runs - compute derived/reactive state
4. **Template function** executes, producing an HTML string. A runtime error in the template is logged and the last rendered DOM is kept
5. **FNV-1 hash check** - the rendered string is hashed and compared to the previous render. If identical, the entire morph is skipped (zero-cost no-op render); `afterRender()` still runs
6. **Parse to detached DOM** - the string is set as `innerHTML` on a fresh detached element
7. **`Fez.nodeMorph()`** runs - walks both trees and mutates the live DOM to match
8. **Post-processing** - `fez-this`, `fez-bind`, `fez-use` attributes are resolved, input values restored, then `afterRender()` runs

`await this.tick()` resolves once the pending render has reached the DOM (right away when none is pending):

```js
async open() {
  this.state.open = true
  await this.tick()
  this.find('input').focus()
}
```

### Element Matching

The differ uses priority-based key resolution when matching old (live) and new (template) children. Keys only need to be unique among siblings - they are scoped to the parent's direct children, not global.

| Priority    | Key               | Source                                                              |
| ----------- | ----------------- | ------------------------------------------------------------------- |
| 1 (highest) | `fez-uid-{UID}`   | Live fez component instances                                        |
| 2           | `keep-{value}`    | `fez-keep` attribute                                                |
| 3           | `key-{value}`     | `fez-key` attribute or compiler-injected internal key               |
| 4           | `key-{value}`     | Manual `key` attribute                                              |
| 5           | `id-{value}`      | `id` attribute                                                      |
| 6           | `sig-{hash}`      | Source signature of unkeyed fez components (tag + attrs + content; tag + attrs with a live slot) |
| 7 (lowest)  | scored soft match | Tag name + CSS class similarity + attribute count                   |

You can always use a manual `key` attribute for exact matching:

```html
{#each state.items as item}
<div key="{item.id}">{item.name}</div>
{/each}

<!-- keyed each: the same key, written on the first element of the body for you -->
{#each state.items as item (item.id)}
<div>{item.name}</div>
{/each}
```

At compile time, `autoInjectKeys()` also adds internal `fez-key` markers to every element that doesn't already have one.
Inside loops, keys also carry each enclosing loop's row index (e.g. `fez-key="3-1"`, `fez-key="3-0-2"` in nested loops), whatever the index variable is named, so most cases work without manual keys.
Inside `{#key expr}` the marker is a `key` that includes a hash of `String(expr)`, so a new value never morphs into the old nodes.
The `fez-key` markers are moved off the DOM attribute surface before morphing, so they never appear in the live document; the `{#key}` marker stays as a `key` attribute.

Elements that don't match by key fall through to **scored soft matching** - a greedy algorithm that pairs unmatched old/new elements by tag name similarity, shared CSS classes, and attribute count. Fez components and `fez-keep` elements are excluded from soft matching - they only match by key or signature.

`Fez.nodeMorph(target, src, opts?)` morphs `target`'s children; its own attributes are never touched.
A string or element whose single root has `target`'s tag stands in for `target` (its children become `target`'s, its attributes are ignored); anything else becomes the new children; pass a DocumentFragment to keep a lone wrapper child.
`opts` may add differ hooks (`beforeRemove(node)`, `removeNode(parent, node)`, `onPreserve(old, new)`, `skipNode(old)`); they replace Fez's own hook of the same name.

### Component Identity: Preserve vs Recreate

When the differ pairs a new placeholder with a live fez component, identity decides what happens:

- **Explicit key** (`fez-key` or `key`; `id` does not count) - the instance is preserved when its attributes change.
  Props are re-read from the new placeholder, the component re-renders when any of them changed, and `onRefresh(props, changed)` fires; `changed` holds the props whose value differs.
  Changed children still rebuild it, unless it has a live `<slot />` of its own (then they are morphed into the slot).
- **No key** - identity is the source signature: an FNV-1 hash of the component's original source (`outerHTML` - tag, attributes and slot content), captured at mount; a component with a live `<slot />` hashes its tag and attributes only.
  A matching signature preserves the instance; its props are re-read, so a `:prop` that now holds another value re-renders it, and `onRefresh` fires.
  If the signature differs, the old instance is destroyed and a fresh one is created through `init()`.

A live component is matched by its `<name>-fez` wrapper class, so an unkeyed component is also preserved against the raw `<name>` tag of server HTML when the source is unchanged.
This matters most for pjax-style page swaps where the server renders fresh HTML.
Unchanged chrome (menus, headers) is preserved automatically, while any component whose source changed gets a clean rebuild instead of a silently stale preserve - no manual syncing in `onRefresh` required.
When you deliberately want an instance to survive changed attributes, give it a `fez-key`:

```html
<top-menu fez-key="main-menu"></top-menu>
```

A `fez-key` attribute also works as a plain identity key on non-component elements in server-rendered HTML.

### Two-Level Skip Optimization

Fez avoids unnecessary work at two levels:

**1. Parent level - hash check skips entire morph**

If a component's rendered HTML string hasn't changed (same FNV-1 hash), the morph is skipped entirely. No DOM tree walking, no diffing, no mutations. This makes re-renders triggered by unrelated global state changes essentially free.

**2. Child level - fez components are never morphed**

When the parent does re-render and the morph runs, child fez component nodes are **preserved as-is**. The differ sees the live component instance, matches it by UID, and only repositions it if needed (via `insertBefore`). No attribute sync, no subtree diffing. The child's internal DOM is completely untouched.

A child component only re-renders when:

- A state or globalState key its last render read changes, or `this.props.x = ...` is written
- A parent render hands it a prop with another value, or the same object written to in place

Children a template renders carry a compiler key, so a parent render keeps them when their attributes change (props refresh) and rebuilds them only when their children changed and they have no live `<slot />`.
The unkeyed signature rule applies to server HTML (pjax) and `Fez.nodeMorph` sources.

This means a parent with 100 child components in a loop can re-render its own template without touching any of those children - they continue operating with their own state and DOM intact.

### Attribute and Class Syncing

- **Class changes** use `classList.add/remove` instead of `setAttribute` - this preserves CSS transitions and animations
- **Inline styles** set via JS (e.g. `element.style.left = '100px'`) are preserved when the template doesn't set a `style` attribute **and** both nodes share a non-empty class (identity). Classless soft-matched tags (e.g. bare `<th>`) clear stale styles so column widths don't leak across pjax page swaps
- **Active input focus** - `value` and `checked` attributes are not synced on the currently focused input, preventing disruption during typing
- **Form state** - what the user typed, checked or selected survives a re-render; it is replaced only when the template's own `value` / `checked` / `selected` for that field changes, and file inputs are never assigned

## Template Syntax (Svelte-like)

Fez uses a Svelte-inspired template syntax with single braces `{ }` for expressions and block directives.

### Expressions

```html
<!-- Simple expression -->
<div>{state.name}</div>

<!-- Expressions in attributes (automatically quoted) -->
<input value={state.text} class={state.active ? 'active' : ''} />

<!-- Raw HTML (unescaped) -->
<div>{@html state.htmlContent}</div>

<!-- JSON debug output -->
{@json state.data}
```

Text expressions are HTML-escaped as text, whatever the value type (arrays and objects included); `null` and `undefined` render nothing.
`{@html value}` inserts the value as is, so `null` / `undefined` render as the text `null` / `undefined`: write `{@html state.body || ''}`.
`{@json value}` renders a `<pre class="json">` with the value as escaped, 2-space indented JSON.

**Attribute values.** An unquoted `name={expr}` writes the whole attribute, so the value decides whether it exists:

| value | ordinary attribute (`title`, `aria-expanded`, ...) | boolean attribute (`hidden`, `disabled`, `checked`, `open`, ...) |
|---|---|---|
| `null` / `undefined` | dropped | dropped |
| `false` | `name="false"` | dropped |
| `true` | `name="true"` | `name=""` |
| anything else | `name="escaped value"` | truthy: `name=""`, falsy (`''`, `0`, `"false"`): dropped |

```html
<button disabled={state.busy} aria-expanded={state.open} title={state.tip}>Save</button>
<!-- busy false, open false, tip null: <button aria-expanded="false">Save</button> -->
```

The boolean list is `BOOLEAN_ATTRS` in `src/fez/lib/attrs.js`; the same rule is available at runtime as `Fez.htmlAttr(name, value)`.
A quoted `name="{expr}"` is always written as text, and a boolean attribute whose text is `false`, `null` or `undefined` is turned off after the render.

**Raw text.** A backtick in text content is a plain character (`` `code` `` in prose is fine).
The body of a `<script>` or `<style>` inside a template is copied verbatim, never evaluated, so its braces are JavaScript and CSS.
A `<style>` or `<script>` with template markup on both sides stays part of the template (a JSON-LD script, a `<style>` inside `{#if}`) instead of becoming the component's script or style block.

* A brace group that starts with a key and a colon (`{a: 1}`, `{'a': 1}`) is copied as text, not evaluated, so `onclick="send({id: 1})"` and `data-opts="{dense: true}"` stay as written.
* Inside a tag, a JavaScript template literal is copied as is: in ``onclick="go(`/u/${id}`)"`` the `${id}` is evaluated by the handler at click time, not by the template.
* HTML comments are removed when the template compiles, so they never reach the DOM and `{...}` inside them is never evaluated.

Svelte-only syntax fails to compile with a hint at the Fez spelling: `{@debug}` (use `{@json}`), `{@render}` and `{#snippet}` (use a child component or `{@block}`), `on:click|mod` (use `onclick={...}`) and `bind:value` (use `fez:bind`).

Block errors name the problem: `{/each} closes {#if}`, `{#if} is never closed`, `{:else} without matching {#if}, {#unless}, {#each}, or {#for}`, `{:then} without matching {#await}`, `{#each} is missing " as "`, `{#for} is missing " in "` and `{@const} needs a name and a value`.
Any other `{#...}`, `{@...}`, `{/...}` or `{:...}` is `Unknown template directive`, and a JavaScript syntax error in any expression fails the whole template.

Old `{{ ... }}` templates still compile: a template that contains both `{{` and `}}` is converted to single-brace syntax with a console warning, and `fez refactor` lists it.
Avoid `{{` / `}}` in new templates (write `:cfg="{a: 1}"`, not `:cfg={{a: 1}}`).

### Conditionals

```html
{#if state.isLoggedIn}
<p>Welcome, {state.username}!</p>
{:else if state.isGuest}
<p>Hello, Guest!</p>
{:else}
<p>Please log in</p>
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
- Any object without own enumerable keys counts as empty, so a `Date`, `Map` or `Set` is **falsy**: test it explicitly (`{#if state.date != null}`)
- Non-empty arrays, non-empty objects, and other truthy values -> **truthy**
- The same rule is available as `Fez.isTruthy(value)`

`{:elseif}`, `{:elsif}` and the colonless `{else if}`, `{elseif}`, `{elsif}` and `{else}` are aliases of `{:else if}` / `{:else}`.

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

<!-- For loop with index -->
{#for item, idx in state.items}
<li>{idx}: {item}</li>
{/for}

<!-- Object iteration (2-param = key/value pairs) -->
{#for key, val in state.config}
<div>{key} = {val}</div>
{/for}

<!-- Object iteration with index (3 params) -->
{#each state.config as key, value, index}
<div>{index}. {key} = {value}</div>
{/each}

<!-- Nested values stay intact (not deconstructed) -->
{#for key, user in state.users}
<div>{key}: {user.name}</div>
{/for}

<!-- Empty list fallback with :else -->
{#each state.items as item}
<li>{item}</li>
{:else}
<li>No items found</li>
{/each}

<!-- :else also works with #for -->
{#for item in state.items}
<span>{item}</span>
{:else}
<p>List is empty</p>
{/for}

<!-- Child components in loops - automatically optimized -->
<!-- Use :prop="expr" to pass objects/functions (not just strings) -->
{#each state.users as user}
<user-card :user="user" />
{/each}

<!-- Keyed each: (key) after the binding, Svelte style -->
{#each state.users as user, index (user.id)}
<user-card :user="user" />
{/each}
```

**Keyed each:** `{#each list as item (expr)}` writes `key={expr}` on the first element of the loop body (unless it already has a `key`).
The differ matches rows by that key, so a reorder, insert or removal moves existing nodes and child components with their item instead of re-pairing them by position.

**Loop behavior:**

- **null/undefined = empty list** - no errors, renders nothing (or `:else` block if present)
- **2-param syntax** (`key, val` or `item, idx`) works for both arrays and objects:
  - Arrays: first = value, second = index
  - Objects: first = key, second = value
- **Brackets optional** - `{#for key, val in obj}` same as `{#for [key, val] in obj}`; brackets with an index work too: `{#each obj as [key, value], idx}` (a two-name bracket follows the 2-param rule, so on an array it gives `[item, index]`)
- **One-name loops need an array** - `{#each obj as v}` on a plain object renders nothing (or `:else`); use `key, value` for objects
- A `Map` or `Set` renders as empty - spread it first (`{#each [...state.tags] as tag}`)
- **Implicit `i`** - one-name and two-name loops also bind the row index as `i`; a `key, value, index` loop does not
- In nested loops an inner one-name loop shadows the outer `i`, so name the outer index (`{#each rows as row, r}`); an inner two-name loop keeps the outer `i`
- In a one-name loop an item named `i` moves the implicit index to `_i`; a two-name loop that uses the name `i` binds no implicit index

**Note on passing props:** Use `:prop="expr"` syntax to pass JavaScript objects, arrays, or functions as props. Regular `prop={expr}` will stringify the value.
`:x="expr"`, `:x='expr'` and `:x={expr}` are the same, names may be hyphenated (`:data-x="..."`), and the value may be an object literal (`:cfg="{a: 1}"`).
The expression runs in template scope (loop variables and `{@const}` names included) and the value reaches the child as is, through the parent's render slots.
Declare a `PROPS` schema (see [Typed props](#typed-props-props)) and stringified numbers, booleans and JSON are coerced back for you.

**Component Isolation:** Child components in loops are automatically preserved during parent re-renders. They only re-render when their props actually change: another value, or the same object written to in place (an object read from `this.state` is the same object on every read, and a store write bumps its version, so only the touched row's child re-renders).

### Local constants (`{@const}`)

`{@const name = expr}` declares a local for the rest of the enclosing branch; destructuring works too:

```html
{#each state.items as item}
  {@const total = item.price * item.qty}
  <p>{item.name}: {total}</p>
  <button onclick={() => pick(total)}>Pick</button>
{/each}

{@const { first, last } = state.user}
<h3>{first} {last}</h3>
```

The name is visible until the end of its branch: `{:else}`, `{:then}`, `{:catch}` and the closing tag end it.
Event handlers capture it at render time, like a loop variable.

### Recreating a subtree (`{#key}`)

`{#key expr}...{/key}` recreates its body whenever `expr` changes, instead of morphing it.
New nodes play their `fez:in` again, and child components inside start over through `init()`:

```html
{#key state.slide}
  <img src={state.slide.url} fez:in="fade" />
{/key}
```

### Preserving Elements with `fez:keep`

Use `fez:keep` to preserve plain HTML elements across parent re-renders. The element is only recreated when its `fez:keep` value changes.

**Important:** `fez:keep` must only be used on plain HTML elements (`div`, `span`, `input`, etc.), **never on fez components**.
On a component tag it logs `FEZ: fez:keep must be on plain HTML elements, not on fez components` and the attribute does nothing useful.
To preserve a fez component, wrap it in a plain HTML element with `fez:keep`:

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
  <ui-star fill="{getStarFill(i)}" color="{state.color}" />
</span>
{/for}

<!-- Preserve form inputs to keep user-entered values -->
<input fez:keep="search-input" type="text" />

<!-- Preserve animation state -->
<div fez:keep="animated-element" class="slide-in">...</div>
```

**How it works:**

- Same `fez:keep` value -> Element is fully preserved (no re-render, all state intact)
- Different `fez:keep` value -> Element is recreated from scratch
- No `fez:keep` -> Element may be recreated on every parent re-render

**When to use:**

- Wrapping child components in loops that have internal state
- Form inputs where you want to preserve user-entered values
- Elements with CSS animations you don't want to restart
- Any element where preserving DOM state is important

**Best practice:** Include all relevant state variables in the `fez:keep` value. This way the element is recreated exactly when it needs to be:

```html
<!-- Good: wrapper recreates when fill changes, so star is recreated too -->
<span fez:keep="star-{i}-{getStarFill(i)}">
  <ui-star fill="{getStarFill(i)}" />
</span>

<!-- Bad: wrapper never recreates even when fill changes -->
<span fez:keep="star-{i}">
  <ui-star fill="{getStarFill(i)}" />
</span>
```

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

<!-- Skip pending state (shows nothing while loading) -->
{#await state.data}{:then result}
<p>Result: {result}</p>
{/await}

<!-- With error handling but no pending state -->
{#await state.data}{:then result}
<p>{result}</p>
{:catch err}
<p>Error: {err.message}</p>
{/await}
```

```js
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
- A promise built in the template itself (`{#await load()}`) is a new promise on every render, so every settle starts the next request; after 3 such cycles Fez reports it and keeps the settled value. Assign the promise to state once instead
- A rejection in a block without `{:catch}` is reported through `Fez.onError`
- `{:then}` and `{:catch}` may omit the name; a block without `{:then}` renders nothing once the promise resolves
- Inside `{#each}` every row has its own await state, so `{#each state.jobs as job}{#await job.result}...{/await}{/each}` works
- When a new promise replaces the old one, the old one is ignored if it settles later

### Arrow Function Event Handlers

Use arrow functions for clean event handling with automatic loop variable interpolation.
Write the handler unquoted: `onclick={() => ...}`.
Do not wrap the braces in quotes - a quoted arrow is only a string attribute and does nothing.

```html
<!-- Simple handler -->
<button onclick={() => handleClick()}>Click me</button>

<!-- Method reference: called with the event -->
<button onclick={save}>Save</button>

<!-- With event parameter - any name works -->
<button onclick={(e) => handleClick(e)}>Click me</button>
<a onclick={(evt) => go(evt.target)}>Go</a>

<!-- async arrows work; the returned promise is ignored -->
<button onclick={async () => load()}>Load</button>

<!-- Inside loops - index is automatically interpolated -->
{#each state.tasks as task, index}
<button onclick={() => removeTask(index)}>Remove #{index}</button>
<button onclick={(e) => editTask(task, e)}>Edit</button>
{/each}
```

Arrow functions in event attributes are automatically transformed:

- `{() => foo()}` becomes `onclick="fez.foo()"`
- `{save}` becomes `onclick="fez.save(event)"`
- `{(e) => foo(e)}` becomes `onclick="fez.foo(event)"`; the first parameter is the DOM event whatever its name
- Loop variables like `index` are evaluated at render time; a handler that uses a loop item or a `{@const}` object captures it in a render slot
- In the body, `state`, `props` and `globalState` are the component's, and a bare call `save()` is `fez.save()` unless it is a JS global (`console`, `Math`, `fetch`, `alert`, `setTimeout`, ...)
- Other bare names are not rewritten: write `state.count++` or `fez.count++`, never `count++`

For scalar values, a plain string handler is just as good: `onclick="fez.remove('{item.id}')"`.
Inside a quoted handler, `{value}` is escaped for a JavaScript string (`Fez.jsEscape`), so an id that contains a quote cannot break out of `'{item.id}'`.

### Strict Event Handlers (`on<event>!=`)

Append `!` to any event attribute to make the handler fire **only when the element itself is the target** (no click bubbled up from a child), and to automatically `stopPropagation()` + `preventDefault()`:

```html
<!-- opens only when the card itself is clicked, not the button inside it;
     the click does not bubble to ancestors and its default is prevented -->
<div class="card" onclick!="fez.openCard()">
  <button onclick="fez.edit()">edit</button>
</div>
```

It compiles to a small gate:

- `onclick!="fez.openCard()"` becomes `onclick="fez.fezBang(event) && (fez.openCard())"`
- `fezBang(event)` skips the body unless `event.target === event.currentTarget`, otherwise runs `stopPropagation()` + `preventDefault()` then the body

The body must be a single expression (the usual `fez.method(...)` call). Works on any event (`onmousedown!=`, `onsubmit!=`, ...) - handy for modal backdrops, cards, and popovers that must not leak clicks to the page behind them.
The value must be quoted (`onclick!="fez.close()"`); an unquoted `onclick!={...}` is not supported.

### Self-Closing Custom Elements

Custom elements can use self-closing syntax:

```html
<ui-icon name="star" />
<!-- Automatically converted to: <ui-icon name="star"></ui-icon> -->
```

Any non-void tag may self-close (`<div class="spacer" />`, `<slot />`); void elements (`<input />`, `<br />`, `<img />`) are left as written.

### Conditional Class Directives

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

### Style Directives

Use `style:property={value}` to set one CSS property, custom properties included:

```html
<div style="padding: 4px" style:color={state.color} style:width={state.w + 'px'} style:--accent={props.accent}>...</div>
<!-- color red, accent unset: style="padding: 4px;color: red;width: 120px;" -->
```

Directives are merged into the `style` attribute after its own declarations.
A `null`, `undefined` or `false` value leaves that property out; the runtime helper is `Fez.styleProp(name, value)`.

### Whitespace between nodes

Templates drop whitespace-only runs between tags and `{#..}` / `{:..}` / `{/..}` / `{@const ..}` directives, on the same line or across lines (a directive with braces inside, such as `{@const { a } = x}`, keeps the whitespace after it):

```html
<span>a</span>   <span>b</span>
<!-- renders as <span>a</span><span>b</span> -->
```

A gap between nodes renders as a space glyph whose width depends on the font, so it is not a reliable way to space elements.
Space them with CSS (`gap`, margin), or write an explicit `{' '}` where a real space is wanted.
Text keeps its own spaces (`<p>Hello <b>you</b></p>` is unchanged), and `<pre>` / `<textarea>` bodies are left as written.

## Slim templates

Templates can be written in an indentation-based, Slim-like syntax instead of HTML.
A template whose first line reads as Slim is Slim - no wrapper needed: a tag followed by `.class` / `#id`, `: `, `=`, an attribute or the line end (`div`, `a href="/" Home`, `ul: li`), shorthand (`.card`), a custom element, `- if` / `- each` / `- for` / `- unless` / `- await`, or `= expr`.
Anything else - `<tag>`, `{...}`, plain text like `Loading...` or `a new item` - stays HTML.
Wrap the template in a `<slim>` block when its first line would not be detected.
It is converted to a normal Fez template when the component compiles, so every template feature works the same.
Class shorthand accepts Tailwind classes as written, so they never need a `class="..."` fallback.

```slim
.card.p-4.md:w-1/2.bg-[#fafafa] class:active={state.open}
  h3.text-lg.font-semibold= props.title
  - each state.items as item
    ui-icon name="star"
    span.text-sm.gap-1.5 = item.name
  - else
    p.text-gray-400 No items
  button.px-3.py-1.5 onclick="fez.toggle()" Toggle
  == state.html_note
```

compiles to

```html
<div class="card p-4 md:w-1/2 bg-[#fafafa]" class:active={state.open}><h3 class="text-lg font-semibold">{props.title}</h3>{#each state.items as item}<ui-icon name="star"></ui-icon><span class="text-sm gap-1.5">{item.name}</span>{:else}<p class="text-gray-400">No items</p>{/each}<button class="px-3 py-1.5" onclick="fez.toggle()">Toggle</button>{@html state.html_note}</div>
```

| Line | Meaning |
|---|---|
| `div.a.b#id attr="v" text` | element; `.class` / `#id` shorthand; `name=value` attributes, then inline text |
| `.a` / `#id` | `div` shorthand |
| `li: a href="/" Home` | inline nesting - the rest of the line is the only child |
| `h1= expr` / `h1 = expr` / `h1== raw` | inline output, stuck or spaced |
| `p \| a=b` | an inline `\|` forces text that itself starts with `name=value` |
| `\| text` / `{expr}` | text line; `#{expr}` also works |
| `= expr` / `== raw` | `{expr}` / `{@html raw}` |
| `- if` / `- else if` (`- elsif`) / `- else` / `- unless` | conditionals |
| `- each list as item` (`- list.each do \|item\|`) / `- for x in list` | loops, `- else` for the empty case |
| `- await promise` / `- then value` / `- catch error` | promises |
| `/ comment` | dropped with its nested lines |
| `<raw html>` | passed through |

* Tags nest by indentation; a block closes when the indentation drops or when the next sibling is not `- else` / `- then` / `- catch` (there is no `- end`).
* Attribute values are `"..."`, `'...'`, `{expr}` or a bare value; boolean attributes are written `disabled=""` or `disabled={state.busy}`.
* Fez attributes pass through: `:prop="..."`, `fez:this="x"`, `class:on={...}`, `onclick!="..."`.
* Shorthand classes merge with a `class` attribute: `.p-2 class={state.x}` becomes `class="p-2 {state.x}"`.
* In the class shorthand a `.` inside `[...]` / `(...)` or between digits (`p-0.5`) does not split, and `/ : ! @ * %` are ordinary class characters (`w-1/2`, `hover:bg-red-500/50`, `!mt-0`, `mt-0!`, `*:p-2`, `data-[state=open]:block`, `bg-(--brand)`).
* A line ending in ` \` continues on the next line.
* Nodes are joined without whitespace (see above); adjacent text lines join with one space, and void elements (`input`, `img`, `br`) take no content.
* Ruby aliases: `- list.each do |item|`, `- list.each_with_index do |item, i|`, `- elsif`, and `#{expr}` in text and attribute values; expressions stay JavaScript.
* Errors report the `.fez` file line and column, and `fez compile -t` shows the generated template next to the Slim source lines.
* Slim errors: mixed tabs and spaces or inconsistent indentation, `- end`, an unknown `- word`, `- if` / `- unless` / `- await` / `- else if` without an expression, `- else` with one, `- each` without ` as `, `- for` without ` in `, Ruby `.map` / `.times` / `.each_pair`, content on a void element, children under an `=` line, an uppercase tag name, two ids, an unclosed `[`, `(`, quote or `{`, and an attribute with nothing after `=` (write `disabled=""`; a bare `disabled` word is read as text).

## Example: Counter Component

Here's a simple counter component that demonstrates Fez's core features:

```html
<!-- Define a counter component in ex-counter.fez -->
<script>
  class {
    // called when Fez node is connected to DOM
    init() {
      this.state.max = 6      // read through isMax() during render, so a change re-renders
      this.state.count = 0    // rendered below, changing it re-renders
    }

    isMax() {
      return this.state.count >= this.state.max
    }

    // if state is changed, template is re-rendered
    more() {
      this.state.count += this.isMax() ? 0 : 1
    }
  }
</script>

<style>
  /* The whole block is scoped to the component */
  /* Root-level declarations apply to the component root node */
  zoom: 2;
  margin: 10px 0;

  button {
    position: relative;
    top: -3px;
  }

  span {
    padding: 0 5px;
  }
</style>

<button onclick={() => state.count -= 1} disabled={state.count === 0}>-</button>

<span> {state.count} </span>

<button onclick={() => more()} disabled={isMax()}>+</button>
{#if state.count > 0}
<span>&mdash;</span>
{#if isMax()} MAX {:else} {#if state.count % 2} odd {:else} even {/if} {/if} {/if}
```

> Template expressions resolve against the component instance, so `isMax()` (a method) works.
> A bare module-level `const MAX` would not - see "Template scope".

To use this component in your HTML:

```html
<!-- Load Fez library -->
<script src="https://dux.github.io/fez/dist/fez.min.js"></script>

<!-- Load component via template tag -->
<template fez="/fez-libs/ex-counter.fez"></template>

<!-- Use the component -->
<ex-counter></ex-counter>
```

This example showcases:

- **Reactive state**: Changes to `this.state` automatically update the DOM
- **Template syntax**: `{ }` for expressions, `{#if}`, `{#each}` for control flow
- **Arrow function handlers**: `onclick={() => method()}` for clean event binding
- **Conditional rendering**: `{#if}`, `{:else}` blocks for dynamic UI
- **Scoped styling**: `<style>` is scoped to the component (root-level declarations apply to the root node), `<style global>` is document-wide
- **Component lifecycle**: `init()` method called when component mounts

## What can it do and why is it great?

### Core Features

- **Native Custom Elements** - Creates and defines Custom HTML tags using the native browser interface for maximum performance
- **Server-Side Friendly** - Works seamlessly with server-generated HTML, any routing library, and progressive enhancement strategies
- **Semantic HTML Output** - Transforms custom elements to standard HTML nodes (e.g., `<ui-button>` -> `<button class="fez ui-button-fez">`), making components fully stylable with CSS
- **Single-File Components** - Define CSS, HTML, and JavaScript in one file, no build step required
- **Typed Props** - Opt-in `PROPS` schema validates and coerces attribute strings into numbers, booleans, arrays, dates... with defaults, `required` and `enum`, straight into `this.props`
- **No Framework Magic** - Plain vanilla JS classes with clear, documented methods. No hooks, runes, or complex abstractions
- **SCSS-style Nesting, No Dependency** - Write nested rules and `&` as you would in SCSS. Fez flattens them to plain CSS itself rather than relying on native CSS nesting, so components work on browsers older than late-2023 (old Android WebViews included). Comma-separated parents expand cartesian (`.a, .b { &:hover }` -> `.a:hover, .b:hover`), keeping each selector's own specificity and needing no `:is()` support. Everything lands in one `<style id="fez-css">` (`@import` and `@layer` order statements in `<style id="fez-css-head">` just before it)
- **Smart Memory Management** - MutationObserver automatically cleans up disconnected components and their resources (intervals, event listeners, subscriptions)

### Advanced Templating & Styling

- **Fez Template Compiler** - Single brace syntax (`{ }`), control flow (`{#if}`, `{#unless}`, `{#for}`, `{#each}`, `{#await}`, `{#key}`), keyed each (`{#each items as item (item.id)}`), `{@const}` locals, and block templates
- **Conditional Class and Style Directives** - Svelte-style `class:name={condition}` and `style:prop={value}` without ternary operators or string building
- **Arrow Function Handlers** - Clean event syntax with automatic loop variable interpolation
- **Reactive State Management** - Built-in reactive `state` object automatically triggers re-renders on property changes
- **Component-Aware DOM Diffing** - Custom differ that understands Fez component boundaries, preserves element state and CSS animations, with hash-based render skipping for zero-cost no-op renders
- **Smart Component Isolation** - Child components are preserved during parent re-renders; only re-render when their props actually change
- **Preserve DOM Elements** - Use `fez:keep="unique-key"` attribute to preserve DOM elements across re-renders (useful for child components, animations, form inputs, or stateful elements)
- **Auto-ID for Form Inputs** - Elements with `fez:this` automatically get stable IDs, helping the differ preserve input state across re-renders
- **Import Maps** - Use `Fez.head({importmap: {...}})` in a component `<script>` to map bare import specifiers to full URLs, avoiding duplicate library instances
- **Style Macros** - Define custom CSS shortcuts like `Fez.cssMixin('print', '@media print')` and use as `:print { ... }` or `@include print { ... }`. A macro expands to a selector or an at-rule, so it can also encode a theme. End the usage with `;` instead (`.item { :card; }`) and the body is inlined as declarations, SCSS `@include` / Tailwind `@apply` style
- **Dark Theme** - Built-in `:dark { ... }` macro expands to `&:where(.dark, .dark *)`, styling any component under a `dark` class on `<html>`. Zero added specificity; re-register it as `@media (prefers-color-scheme: dark)` to follow the OS instead, with no component changes
- **Scoped Styles** - `<style>` is always scoped to the component, `<style global>` is always document-wide. Scope is declared on the tag, never inferred from the CSS. `:global(...)` hoists a single rule out of a scoped block (using it inside `<style global>` is a compile error - those rules are already global)

### Developer Experience

- **Built-in Utilities** - Helpful methods like `formData()`, `setInterval()` (auto-cleanup), `on()`, `observeResize()`, `tick()` and `fezNextTick()`
- **Two-Way Data Binding** - Use `fez:bind` directive for automatic form synchronization
- **Slots** - One default `<slot />` with event listener preservation (named slots are not supported). A slot is live: when the parent re-renders different children they are morphed into it, so the component, typed values, focus and the components inside stay. Use `<slot rebuild />` to mount the component again instead (components that read or rearrange their children), or `<slot unwrap />` to dissolve the wrapper div, leaving children directly in the parent
- **Context and Error Boundaries** - `this.context(key, value)` hands values down the component tree; `onError(error, component)` on an ancestor catches a descendant's mount and render errors
- **Publish/Subscribe** - Built-in pub/sub system for component communication
- **Global State Management** - Automatic subscription-based global state with `this.globalState` proxy
- **Dynamic Component Loading** - Load components from URLs with `<template fez="path/to/component.fez">`
- **Auto HTML Correction** - Fixes invalid self-closing tags (`<ui-icon name="gear" />` -> `<ui-icon name="gear"></ui-icon>`)

### Performance & Integration

- **Hash-Based Render Skipping** - FNV-1 hash of rendered HTML skips the entire morph when nothing changed (zero-cost no-op renders)
- **Batched State Updates** - Multiple state changes in the same tick are debounced into a single `requestAnimationFrame` render
- **Component Isolation** - Child fez components are never morphed during parent re-renders, only repositioned. They re-render only when their own state, their props or a globalState key they rendered changes
- **Priority-Based Element Matching** - Keyed matching (fez-keep > fez-key > key > id for elements; fez-key > key > source signature for components) with scored soft-match fallback preserves DOM identity across renders
- **CSS Animation Preservation** - Class syncing uses `classList.add/remove`, not `setAttribute`, so transitions and animations survive re-renders
- **Active Input Protection** - `value` and `checked` are not synced on the focused input, preventing disruption during typing
- **Built-in Fetch with Caching** - `Fez.fetch()` caches GET responses for 5 minutes and handles JSON/FormData
- **Rich Lifecycle Hooks** - `init`, `onMount` (may return a cleanup), `beforeRender`, `afterRender`, `onDestroy`, `onRefresh(props, changed)`, `onStateChange`, `onGlobalStateChange`, `onError`
- **Development Mode** - `Fez.LOG = true` enables framework logs; `Fez.DEV = true` enables the Cmd/Ctrl + E component overlay (`Fez.highlightAll()`) on any port

### Why It's Great

- **Zero Build Step** - Just include the script and start coding
- **About 140KB Minified (about 48KB gzipped)** - Small footprint, page navigation included
- **Framework Agnostic** - Use alongside React, Vue, or any other framework
- **Progressive Enhancement** - Perfect for modernizing legacy applications one component at a time
- **Native Performance** - Leverages browser's native Custom Elements API
- **Intuitive API** - If you know vanilla JavaScript, you already know Fez

## Full available interface

### Fez Static Methods

```js
Fez('#foo')                  // find fez node with id="foo" (the element itself must be a component root)
Fez(42)                      // instance by UID (this.UID), reported when missing
Fez('ui-tabs', this)         // find first parent node ui-tabs
Fez('ui-tabs', (fez)=> ... ) // call for every live ui-tabs instance, returns the instances (FezBase[])
Fez.find(node, 'ui-tabs')    // closest ui-tabs instance of a node, selector, instance or jQuery object; undefined when none (reported only when the node exists)
// Fez('name') reports a lookup error when nothing is mounted; check silently with document.querySelector('.name-fez')?.fez
// Fez('name', fn) takes fn as a callback when it is an arrow or a function that uses neither this nor new

// define custom DOM node name -> <foo-bar>...
Fez('foo-bar', class {
  // set element node name, set as property or method, defaults to DIV
  // why? because Fez renames custom dom nodes to regular HTML nodes
  NAME = 'span'
  NAME(node) { ... }
  // alternative: static NAME = 'span'

  // component CSS (SCSS-style nesting, macros), string or method returning one.
  // In the JS class API it is NOT wrapped: put scoped rules under :fez { },
  // which becomes .fez.foo-bar-fez; rules outside :fez are document-wide.
  // (In .fez files <style> is wrapped for you and :fez is a compile error.)
  CSS = `:fez { color: red; .title { font-weight: 600; } }`

  // document-wide CSS, never scoped (what <style global> compiles to), string or method
  CSS_GLOBAL = `.app-card { border: 1px solid #ddd; }`

  // free-form metadata, exposed as Fez.index['foo-bar'].meta
  META = { title: 'Foo bar', group: 'forms' }

  // template source in Fez template syntax; this.state and this.props writes re-render it
  HTML = `...`

  // Expose the live instance as `window.Dialog` (works for tags you place yourself too)
  GLOBAL = 'Dialog'
  // Append one <foo-bar> to body on ready, unless the page already placed it. See `pages_src/root/fez/ui-dialog.fez`.
  MOUNT = true

  // optional props schema - validates and coerces attribute values into this.props
  // shorthand `name: String` or full `{ type, default, required, enum }`, see "Typed props" below
  PROPS = {
    name: String,
    count: { type: Number, default: 0 },
    open: Boolean,
  }

  // called when fez element is connected to dom, before first render (the only init hook)
  // here you still have your slot available in this.root
  init(props) { ... }

  // execute after init and first render; a returned function runs on destroy
  onMount() { ... }

  // execute before or after every render (afterRender also when the hash-skip leaves the DOM alone)
  beforeRender() { ... }
  afterRender() { ... }

  // after onMount (changed = every prop), then whenever a parent render, a pjax/nodeMorph swap
  // or fez-component hands this preserved instance its props (changed = props whose value differs)
  onRefresh(props, changed) { ... }

  // called when local component state changes (only when the value is not ===);
  // for a nested write key is the nested property (state.user.name = 'x' reports 'name',
  // state.list.push(x) reports the new index); delete this.state.x reports undefined
  onStateChange(key, value, oldValue) { ... }

  // called when a global state key this component has read changes
  onGlobalStateChange(key, value, oldValue) { ... }

  // error boundary: a descendant's mount error, render throw or template runtime error
  onError(error, component) { ... }

  // called when component is destroyed
  onDestroy() { ... }

  // derived value, recomputed on every render: {total} in the template
  get total() { return this.state.items.length }

  /* used inside lifecycle methods (init(), onMount(), ... */

  // copy original attributes from attr hash to root node
  this.copy('href', 'onclick', 'style')

  // set style property to root node. look at a clock example
  // shortcut to this.root.style.setProperty(key, value)
  this.setStyle('--color', 'red')

  // timeout and interval with auto-cleanup on destroy; the callback is skipped while the root is detached.
  // Both return the native id.
  this.setTimeout(func, delay)
  this.setInterval(func, tick)           // also (tick, func)
  this.setInterval(func, tick, 'poll')   // a named interval replaces the running one with that name

  // { name: value } of the closest or contained form ({} when none); a repeated name keeps its last value,
  // file inputs give File objects
  this.formData()

  // mounted DOM node root. Only in init() point to original <slot /> data, in onMount() to rendered data.
  this.root

  // mounted DOM node root wrapped in $, only if jQuery is available
  this.$root

  // node attributes, converted to properties (typed by PROPS)
  this.props

  // shortcut for this.root.querySelector(selector)
  this.find(selector)

  // gets value for FORM fields or node innerHTML
  this.val(selector)
  // set value to a node (checkbox: checked = !!value, radio: checked when value matches), else innerHTML
  this.val(selector, value)

  // Publish/Subscribe system
  // this.publish runs the component's own subscription first, then the nearest ancestor
  // subscribed to the channel; returns true when one handled it, false otherwise
  this.publish('channel', data)
  this.subscribe('channel', (data) => {}) // subscribe in component (auto-cleanup on destroy)

  // Global-level: reaches every Fez.subscribe subscriber and every connected component's
  // this.subscribe handler for that channel
  Fez.publish('channel', data)

  // Global subscribe with different targeting options:
  Fez.subscribe('channel', callback)                   // always fires
  Fez.subscribe(node, 'channel', callback)             // dropped at the first publish after the node left the DOM
  Fez.subscribe('#selector', 'channel', callback)      // fires only if selector found at publish time
  // in the node and selector forms the callback's this is the matched node;
  // the same callback, channel and target twice keeps one subscription;
  // a throwing subscriber is logged and the others still run

  // Unsubscribe manually (auto-cleanup for disconnected nodes)
  const unsub = Fez.subscribe('channel', callback)
  unsub() // manually remove subscription

  // the element children the tag had before mount (the slot content), as an array;
  // falls back to the root's current children only when the tag had no child nodes at all (a text-only slot gives [])
  this.childNodes()
  this.childNodes(func)       // map children with function
  this.childObjects()         // { html, ROOT, NODE_NAME, ...attrs } per child

  // check if the this.root node is attached to dom
  this.isConnected

  // reactive store: a write to a key the last render read schedules one batched render
  this.state.foo = 123

  // listen on any EventTarget with auto-cleanup, this binding, isConnected guard,
  // and optional throttle (other opts go to addEventListener). Returns a disposer for early unregister.
  // String-first form: target defaults to window for resize/scroll/beforeunload/...
  // (see Fez.WINDOW_EVENTS), document for everything else.
  this.on('resize', () => this.recompute(), { throttle: 200 })       // window, throttled
  this.on('scroll', this.markSection, { throttle: 100 })             // window
  this.on('pjax:render', e => this.refresh())                        // document
  this.on(window, 'keydown', e => ...)                               // explicit target
  this.on(this.find('.x'), 'click', e => ..., { throttle: 100 })     // throttled
  // on() does not call the handler at bind time - call it yourself when you need an initial run

  // calls func(rect, el) once right away, then on throttled element resize (ResizeObserver, default 200ms)
  this.observeResize(el, func, delay)

  // requestAnimationFrame wrapper with deduplication (setTimeout while the tab is hidden)
  this.fezNextTick(func, name)

  // resolves after the pending render reached the DOM, right away when none is pending
  await this.tick()

  // context: this.context(key, value) provides it, this.context(key) reads it from the
  // nearest component up the tree (this one included). Read it in init(); it is not reactive.
  this.context('theme', { color: 'teal' })
  this.context('theme')

  // register a cleanup for destroy; returns a function that unregisters it
  this.addOnDestroy(func)

  // get unique ID for root node, set to fez_<UID> when missing
  this.rootId()

  // numeric instance id (Fez(uid) finds it) and the tag name
  this.UID
  this.fezName

  // get/set attributes on root node
  this.attr(name, value)

  // replace the wrapper with its slot children (or with a given node) and return them
  this.dissolve()

  // form submission: a delegated submit listener on the root, so forms rendered later
  // (inside {#if}) submit too; a child component's form is left to the child
  onSubmit(formData) { ... }

  // re-render on the next frame (same batch as state writes)
  this.refresh()

  // render now and morph into root with the component-aware DOM differ
  this.fezRender()
  this.fezRender(templateStringOrFunction) // render a different template into root
})

// Pass a plain `class { ... }` to Fez(); that is the form the config keys are read from:
// HTML, CSS, CSS_GLOBAL and META as instance fields or methods; NAME, GLOBAL, MOUNT and PROPS also as statics.
// A class that already extends FezBase is used as is: only static html, static css, static cssGlobal,
// static nodeName, static GLOBAL and static PROPS apply, and MOUNT and META are ignored.

/* Utility methods */

// define custom style macro - expands to a selector or an at-rule prelude
// Fez.cssMixin('print', '@media print')
// :print { ... } -> @media print { ... }
// @include print { ... } -> same thing, both spellings work
// note: the trailing space is required, `:print{` is not expanded
//
// end the usage with `;` and the body is inlined as declarations instead
// Fez.cssMixin('card', 'padding: 16px; border-radius: 8px')
// .item { :card; color: red; } -> .item { padding: 16px; border-radius: 8px; color: red; }
//
// built in: mobile (max-width: 767px), tablet (768px - 1023px), desktop (min-width: 1200px), dark
// :dark { ... } -> &:where(.dark, .dark *) { ... }
// styles the component when <html> carries a `dark` class:
//   document.documentElement.classList.toggle('dark', isDark)
// to follow the OS instead, re-register it (no component CSS changes):
//   Fez.cssMixin('dark', '@media (prefers-color-scheme: dark)')
//
// Component CSS is injected once, when the component is defined, so register custom macros
// before the components that use them. With bundler imports, register them in a module imported
// before the .fez modules (ES imports run before the importing file's own code).
Fez.cssMixin(name, value)
// one argument: returns css with every registered macro expanded
Fez.cssMixin(css)

// inject a stylesheet (string or function returning one); macros expand, nesting is flattened,
// identical text is injected once; returns a stable 'fez-<hash>' key
Fez.globalCss(`
  .some-class {
    color: red;
    &.foo { ... }
    .foo { ... }
  }
`)
// scope it to a component: every :fez becomes .fez.ui-card-fez (without :fez nothing is scoped)
Fez.globalCss(':fez { .title { font-weight: 600; } }', { name: 'ui-card' })
// wrap: true wraps the whole text in :fez { } first, so bare declarations style the wrapper
Fez.globalCss('outline: 1px dotted;', { name: 'ui-card', wrap: true })

// localStorage with automatic JSON serialization (preserves types)
Fez.localStorage.set('count', 42)
Fez.localStorage.get('count')              // 42 (number, not string)
Fez.localStorage.set('user', { name: 'John' })
Fez.localStorage.get('user')               // { name: 'John' }
Fez.localStorage.get('missing', 'default') // 'default' (fallback value)
Fez.localStorage.get('missing')            // null without a default
Fez.localStorage.set('key', undefined)     // removes the key
Fez.localStorage.remove('key')
Fez.localStorage.clear()
// storage errors and unparsable values are logged, never thrown; get then returns the default

// internal, get unique ID for a string, poor mans MD5 / SHA1
Fez.fnv1('some string')

// get dom node containing passed html; the second argument picks the wrapper tag (default div)
Fez.domRoot(htmlData || htmlNode)
Fez.domRoot(html, 'ul')

// activates node by adding class to node, and removing it from siblings
Fez.activateNode(node, className = 'active')

// wrap rules in a generated class, inject them, return the class name (flattens nesting, does not expand macros)
Fez.cssClass(text)

// everything Fez has injected so far, in order (SSR, debugging)
Fez.extractCss()

// show any value in the dump dialog (objects as JSON, DOM nodes as HTML, functions as source).
// Every call adds an entry; Esc closes / reopens the dialog, Left/Right step one entry,
// Up/Down step five, "clear all" empties it; a closed dialog leaves a LOG button top-right.
// Also available as window.LOG(value) unless the page defines LOG.
Fez.dump(value)

// toggle red overlays naming every mounted component; click a label to Fez.dump that element.
// Cmd/Ctrl + E does the same (not while focus is inside a <form>).
// Active when Fez.DEV === true, or on a port above 2999 unless Fez.DEV === false.
Fez.highlightAll()

// component-aware DOM morph; source is an HTML string, an Element or a DocumentFragment
// opts may add differ hooks, see "DOM Diffing Engine"
Fez.nodeMorph(target, newNodeOrHtml, opts)

// escape any value as text (null / undefined -> ''), and the runtime helpers behind
// name={expr} and style:name={expr}
Fez.htmlEscape(value)
Fez.htmlAttr(name, value)
Fez.styleProp(name, value)

// create HTML tags with encoded props
Fez.tag(tag, opts, html)

// execute function until it returns true
Fez.untilTrue(func, pingRate)

// animate a plain node from its old to its new size whenever its content changes
Fez.animateSize(node, 'height, duration=250')

// short type code: 'o' object, 'f' function, 's' string, 'a' array,
// 'i' integer, 'n' float, 'b' boolean, 'u' undefined/null
Fez.typeof(value)

// park a function for inline HTML, returns the string 'Fez.POINTER[n]'; one call, then dropped
// (unused ones are swept after 5 minutes)
Fez.pointer(fn)
Fez.pointer(fn, { persist: true })   // kept until the page unloads

Fez.throttle(fn, 200)        // leading call plus one trailing call per window
Fez.onReady(fn)              // after DOMContentLoaded, or right away
Fez.uid()                    // 'fez_uid_...' unique string
Fez.isTruthy(value)          // template truthiness: [] and keyless objects are false
Fez.jsEscape(value)          // value escaped for a quoted JS string in handler code, '' for null/undefined
Fez.darkenColor('#336699', 20); Fez.lightenColor('#336699', 20)
Fez.nameFromPath('/c/ui-card.fez?v=2')   // 'ui-card'
Fez.instances                // Map of live instances by UID
Fez.nonce()                  // CSP nonce Fez uses for the scripts it inserts ('' without one)
Fez.runScript(code)          // run code in a nonced <script>, in a function scope
Fez.consoleLog(text)         // logs only when Fez.LOG is on (truncated to 180 chars)
Fez.consoleError(text, true) // error log; with show = true it also returns a red HTML badge to render

// compile .fez source at runtime: all template[fez] / xmp[fez] in the page, one node, or name + source.
// The name form returns the class and reuses it while the source is unchanged.
Fez.compile()
Fez.compile(templateNode)
Fez.compile('ui-foo', fezSource)

// compile Fez template source to a render function: render(component) -> HTML string
// strict: true throws compile and render errors instead of logging them
Fez.createTemplate(text, { name: 'my-tag', strict: false })

// library version, from package.json at build time (the `fez version` CLI reads .version; both match after a deploy)
Fez.version

// Component Index (unified registry for all component data)
Fez.index['ui-btn'].class         // Component class
Fez.index['ui-btn'].meta          // Metadata from META = {...}
Fez.index['ui-btn'].demo          // Demo HTML string
Fez.index['ui-btn'].info          // Info HTML string
Fez.index['ui-btn'].source        // Raw .fez source code
Fez.index.get('name')             // { class, meta, demo: DOMNode, info: DOMNode, source }
Fez.index.apply('name', el)       // Render demo into element and execute scripts
Fez.index.names()                 // ['ui-btn', 'ui-card', ...] all component names
Fez.index.withDemo()              // Component names that have demos
Fez.index.all()                   // All components as object
Fez.index.info()                  // Log all component names to console

// resolve a function from a string or function reference (handler props that can be either)
// Fez.getFunction(myFunc)            - myFunc
// Fez.getFunction('(e) => go(e)')    - the arrow function
// Fez.getFunction('alert("hi")')     - a function with that body
// Fez.getFunction(null)              - a no-op, safe to call
// Fez.getFunction('app.save')        - a function calling app.save()
Fez.getFunction(pointer)

// add scripts/styles to document head
// A js / css URL already on the page is not added again; the callback runs right away
// { script } runs in a function scope; code containing `import ` runs as a module and the callback gets (error | null)
// Fez.head(node): a <script> node's code is run, any other node has its inline scripts run and its
//   <template fez> / <xmp fez> definitions compiled (a <script src> or <script fez> inside it is not supported)
// { importmap } only works inside a component <script> compiled by the runtime (rewritten at compile time);
//   called directly, or in a module built by the bundler plugin, it throws
// Load JavaScript from URL: Fez.head({ js: 'path/to/script.js' })
// Load JavaScript with attributes: Fez.head({ js: 'path/to/script.js', type: 'module', async: true })
// Load JavaScript with callback: Fez.head({ js: 'path/to/script.js' }, () => console.log('loaded'))
// Load JavaScript module and auto-import to window: Fez.head({ js: 'path/to/module.js', module: 'MyModule' })
// Load CSS: Fez.head({ css: 'path/to/styles.css' })
// Load CSS with attributes: Fez.head({ css: 'path/to/styles.css', media: 'print' })
// Execute inline script: Fez.head({ script: 'console.log("Hello world")' })
// Load single Fez component: Fez.head({ fez: 'path/to/component.fez' })
// Load multiple components from txt list: Fez.head({ fez: 'path/to/components.txt' })
// Import map - rewrites bare specifiers to full URLs at compile time:
// Fez.head({ importmap: { "three": "https://esm.sh/three@0.160.0", "three/addons/": "https://esm.sh/three@0.160.0/examples/jsm/" } })
// Append HTML to document.head (scripts are re-created so they run) - what a component's <head> block does:
// Fez.head('<link rel="stylesheet" href="/app.css"><script src="/app.js"></script>')
Fez.head(config, callback)
```

## Lifecycle, cleanup and errors

Mount runs `init(props)`, the first render, `onMount(props)`, publishes `GLOBAL_STATE`, then calls `onRefresh(props, changed)` with every prop in `changed`.
`init` is the only init hook.

`onMount` may return a cleanup function; it runs on destroy, next to everything Fez already releases (`this.on`, `this.setTimeout`, `this.setInterval`, `this.subscribe`, `this.observeResize`, `addOnDestroy` callbacks):

```js
onMount() {
  const chart = new Chart(this.state.canvas)
  return () => chart.destroy()
}
```

`fez:use="action"` runs once per node, when the node first appears, not on every render.
The action may return a cleanup function, or `{ update(node), destroy() }`: `update` runs on later renders of the component, `destroy` when the node leaves the DOM or the component is destroyed.

```js
tooltip(node) {
  const tip = new Tooltip(node)
  return {
    update: (node) => tip.setText(node.title),
    destroy: () => tip.remove(),
  }
}
```

Errors never leave a half-built component behind:

* A throw in `init`, the first render or `onMount` is reported through `Fez.onError('mount', ...)` and the instance is destroyed, so timers and subscriptions made so far are released.
* A runtime error in the template is logged as `FEZ template runtime error in <name>: ...`, the component keeps its last rendered DOM, and the error goes to the nearest `onError` boundary.
* A template that fails to compile in the browser logs `FEZ template compile error in <name>: ...` with the start of the template, and the component renders empty.
  The bundler plugin throws on the same error instead, with `<slim> line N:` in front for Slim templates; `fez compile` reports it as `file:line: Template compiler error: ...` and exits 1.
* A throwing `onDestroy` is reported and teardown still completes.

A component is destroyed when its node is removed and is still detached in the microtask after the removal is observed, so a synchronous move (`appendChild` elsewhere) keeps the instance.
Teardown order: registered cleanups (`this.on`, timers, subscriptions, `onMount`'s return, `addOnDestroy`), then `fez:use` destroys, then `onDestroy()`.
`this.root` is still set inside `onDestroy` and is `undefined` afterwards.

`onError(error, component)` on any ancestor is an error boundary: it receives a descendant's mount error, render throw or template runtime error, and `component` is the instance that failed.
Set state to render a fallback; throw from `onError` to pass the error further up.
Without a boundary, the global `Fez.onError` report happens as before.

```html
<script>
  class {
    init() {
      this.state.error = null
    }

    onError(error, component) {
      this.state.error = `<${component.fezName}> ${error.message}`
    }
  }
</script>

<risky-widget />
{#if state.error}
  <p class="error">{state.error}</p>
{/if}
```

### Context

`this.context(key, value)` provides a value to every descendant, `this.context(key)` reads it from the nearest component up the tree (the component itself included), like Svelte's `setContext` / `getContext` in one call.
Read it in `init()`; context is not reactive, so provide an object, or use `globalState` for values that change.

```js
// provider
init() { this.context('theme', { name: 'ocean', color: '#1f7a8c' }) }

// any descendant
init() { this.state.theme = this.context('theme') }
```

See `pages_src/root/fez/demo-context.fez` (context and an error boundary) and `pages_src/root/fez/demo-blocks.fez` (keyed each, `{@const}`, `{#key}`, `style:`, getters, `tick()`).

## App rules

Rules for wiring components into an app.

1. Mount order is `init`, first render, `onMount`, then `onRefresh(props, changed)` with every prop in `changed`.
2. A parent re-render hands a preserved child its new props: it re-renders when a value changed, then `onRefresh(props, changed)` fires with only the props whose value differs (`{}` when none did).
   There is no `onPropsChange`: load prop-driven data in `onRefresh` alone (`if ('container' in changed) this.load()`), never in `onMount` too and never by tracking the last value in state.
3. Load data that does not depend on props in `onMount`, and set `state.loading = true` only in `init()`.
   Reloads then keep the current DOM and morph to the new data instead of flashing a spinner.
4. Renders are batched per animation frame; the DOM does not change synchronously after a state write (`await this.tick()` when you need it).
5. Pass anything that changes as a prop. A `<slot />` component stays when its slot content changes and takes the new children in place; one with `<slot rebuild />` is mounted again.
6. Pages and other components chosen at runtime: `<fez-component name={state.page} :props="state.query">fallback</fez-component>`.
7. Style another component by its wrapper class `.<name>-fez`; its tag is replaced on mount.
8. Scoped `<style>` rules reach into descendant components: in a component that renders others, never style bare tags or generic class names, and delete unused rules.
9. Shared data goes in `globalState`, commands go to a `GLOBAL` component, and notifications use publish (see [Component communication](#component-communication-pick-the-channel)).
10. Check the result in a browser: stale props, double fetches and leaked styles all pass `fez compile`.

## Singleton / Global Components

Two independent class keys cover singletons and named handles:

- `MOUNT = true` - Fez appends one `<tag>` to `<body>` on ready, unless the page already contains the tag. Useful for overlays, dialogs and global click/key listeners that should not require manual placement in every layout.
- `GLOBAL = 'Name'` - the connected instance is stored on `window.Name` so other code can call methods on it (`Dialog.open(...)`). The handle follows the live instance: a re-mounted component replaces it, a destroyed one clears it.

```js
// singleton overlay: mounted for you, callable from anywhere
Fez('ui-dialog', class {
  MOUNT = true
  GLOBAL = 'Dialog'

  open(message) { ... }
})

// service component you place in the layout yourself: named, not mounted
Fez('anim-viewport', class {
  GLOBAL = 'Viewport'

  play(name) { ... }
})
```

`GLOBAL = true` is a compile error - use `MOUNT = true` for a nameless singleton.
See `pages_src/root/fez/ui-dialog.fez` for a complete singleton example.

## Loading Multiple Components

For loading many components at once, use a `.txt` file listing component paths:

```bash
# components.txt - one component per line
# Lines starting with # are comments
ui-button
ui-dialog
forms/input-text
forms/input-select
```

Load all components with a single call:

```js
// Load all components listed in components.txt
// Paths are relative to the txt file location
Fez.head({ fez: './components.txt' }, () => {
  console.log('All components loaded!');
});
```

**Path resolution:**

- Paths without `/` prefix are relative to the txt file location
- `.fez` extension is added automatically if not present
- Paths starting with `/` are absolute from root
- Only whole lines starting with `#` are comments; a trailing `# note` becomes part of the path
- A component that fails to load is reported through `Fez.onError('compile', ...)` (a script error is logged as `Template "<name>" compile error: ...`); the others still load

Example with `./fez.txt`, where `ui-button` loads `./ui-button.fez`, `forms/input` loads `./forms/input.fez` and `/lib/shared-comp` loads `/lib/shared-comp.fez`:

```
ui-button
forms/input
/lib/shared-comp
```

## Import Maps

Use `Fez.head({importmap})` to map bare import specifiers to full URLs. This avoids duplicate library instances when multiple sub-modules import the same dependency:

```html
<script>
  Fez.head({importmap: {
    "three": "https://esm.sh/three@0.160.0",
    "three/addons/": "https://esm.sh/three@0.160.0/examples/jsm/"
  }})

  import * as THREE from 'three'
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

  class {
    // ...
  }
</script>
```

At compile time, Fez rewrites bare specifiers to full URLs (e.g. `from 'three'` becomes `from 'https://esm.sh/three@0.160.0'`). Prefix mappings like `"three/addons/"` expand paths that start with that prefix. The `Fez.head({importmap})` call is removed from the final output.

At runtime Fez also inserts a page-level `<script type="importmap">` with those entries when the page has none, so modules loaded transitively from a CDN resolve the same specifiers.
A page that already declares an importmap keeps its own; declare it in HTML for deterministic results.
`Fez.head({ importmap })` works only inside a component `<script>` compiled by the runtime (`<script fez>`, `Fez.compile`); called directly, or in a module built by the bundler plugin, it throws.

## Fez script loading and definition

```html
<!-- Remote loading for a component via URL in fez attribute -->
<!-- Component name is extracted from filename (ui-button) -->
<!-- If remote HTML contains template/xmp tags with fez attributes, they are compiled -->
<!-- Otherwise, the entire content is compiled as the component -->
<script fez="path/to/ui-button.fez"></script>

<!-- a .txt list works in the fez attribute too, same as Fez.head({ fez: 'components.txt' }) -->
<script fez="/fez/components.txt"></script>

<!-- prefix with : to calc before node mount -->
<foo-bar :size="document.getElementById('icon-range').value"></foo-bar>

<!-- pass JSON props via data-props (replaces all other attributes) -->
<foo-bar data-props='{"name": "John", "age": 30}'></foo-bar>

<!-- pass JSON props via data-json-template: read from the element right before the tag, which is removed -->
<script type="application/json">
  {"name": "John", "roles": ["admin"]}
</script>
<foo-bar data-json-template="true"></foo-bar>
```

From JavaScript, set `props` on the element before inserting it: `const el = document.createElement('ui-card'); el.props = { user }; parent.append(el)`.
The object is used as the props (cast through `PROPS`) and attributes are not read as props; `key`, `fez-key` and `fez-keep` still apply, and an `id` must be in the object.

The custom tag is replaced by the wrapper on mount, and only `id`, `key`, `fez-key`, `fez-keep` and `fez-on` (precompiled handlers) move to the wrapper.
Other attributes (`class`, `style`, `title`, `data-*`) arrive as props only; call `this.copy('class', 'style')` in `init()` to put them on the root (`class` is merged with the wrapper classes).

Once a runtime-loaded component's source is parsed, its tag is hidden with `display: none` (`<style id="fez-hidden-styles">`) until the class registers; while the `.fez` file is still being fetched, raw children can show.
In a multi-component file loaded at runtime, `<info>` and `<demo>` outside the `<xmp fez>` definitions are indexed under the file name (`ui-forms.fez` -> `Fez.index['ui-forms']`).
An inline `<template fez="...">` (and `<fez-inline>`) is read back from the DOM, so Fez decodes `&gt;`, `&lt;`, `&amp;` and quotes inside `{...}` only: `{a > b && c}` works, text keeps its entities.

## Bundler imports (Vite / Rollup)

Compile `.fez` files to ES modules at build time so components bundle into the app.

```bash
bun add @dinoreic/fez
```

```js
// vite.config.js
import fez from '@dinoreic/fez/plugin';
export default { plugins: [fez()] };
```

```js
// rollup.config.js
import fez from '@dinoreic/fez/plugin';
export default { plugins: [fez()] };
```

```js
import './components/ui-button.fez'; // registers <ui-button>
import Button from './components/ui-button.fez'; // or import the class
```

- The component name comes from the filename (`ui-button.fez` -> `ui-button`). A file that
  contains `<xmp fez="...">` definitions compiles every definition.
- Build-time checks run for the component name, script syntax, style scope and template
  compilation, so a broken component fails the build instead of the browser.
- `minify` (default `false`; the Vite plugin defaults it to `true` in production) drops
  `<info>` / `<demo>` metadata from the emitted module and strips comments and whitespace from
  `<style>` blocks (the nesting and style macros stay for the runtime).
- Static imports (multi-line named imports included) are hoisted to the top of the module and
  deduped across the components of one file.
- Each component of a multi-component file gets its own block scope, so two components may both
  declare `const helper`.
- A `<head>` block is emitted as `Fez.head("<html>")`, which appends it to `document.head`.
- An unclosed `<xmp fez="...">` is a build error.
- The template is compiled into the module as a render function, so the browser evaluates no template code from strings (required for the `@dinoreic/fez/csp` build).
- Relative `.fez` imports (`./`, `../`) resolve against the importing file; any other `.fez` specifier goes through the bundler's normal resolution.
- Each loaded `.fez` file is registered with the watcher, so editing it rebuilds in watch mode (Vite 8 / Rolldown included).
- The plugin emits no source maps for `.fez` modules.

The emitted module reads the fez runtime from `window.Fez`; it never imports the runtime itself,
so a page must load fez once before its component modules. A missing global fails the module with
a clear `fez runtime not loaded` error.

Vite and Rollup both import the same plugin from `@dinoreic/fez/plugin`: `enforce`/`configResolved`
are Vite-only and ignored by Rollup, so `minify` follows Vite's mode and stays `false` for Rollup.
The runtime `<script fez="...">` loading above still works; both paths are supported.

Every built file is importable by path: `@dinoreic/fez/dist/fez.js` is the classic script build,
for a page that inlines fez into a plain `<script>` (`import fezJS from '@dinoreic/fez/dist/fez.js?raw'` in Vite).

- `import Fez, { FezBase } from '@dinoreic/fez'` loads the runtime as a module (ESM, or CJS through `require`); the first copy on a page sets `window.Fez` and `window.FezBase` and loads the built-in components.
- The module is importable under Node/SSR without a DOM, where it only exports `Fez` and `FezBase`.
- `@dinoreic/fez/csp` is the Content-Security-Policy build (see below).
- `@dinoreic/fez/plugin` also exports the plugin as the named export `createFezPlugin`.
- `unpkg` / `jsdelivr` serve `dist/fez.min.js`.

## TypeScript

Mark a script block `lang="ts"` to write component logic in TypeScript. Types are stripped
at build time by the plugin, so this needs the bundler path (or `fez compile`); the browser
runtime cannot transpile TypeScript.

```html
<script lang="ts">
  import type { User } from './types';

  interface Config {
    maxItems: number;
  }

  const CONFIG: Config = { maxItems: 10 };

  class {
    count: number = 0;

    add(user: User): void {
      if (this.state.count < CONFIG.maxItems) {
        this.state.count += 1;
      }
    }
  }
</script>
```

- Type-only imports (`import type`), interfaces, type aliases and annotations are removed.
- The plugin strips types with `esbuild`; types are removed, not checked, so only syntax errors are reported.
  Vite 7 and older include esbuild; with Vite 8 or Rollup add `esbuild` as a dependency.
- `lang="typescript"`, `type="ts"` and `type="text/typescript"` are accepted as aliases for `lang="ts"` (case-insensitive).
- Loaded by the browser runtime, a TypeScript component is not defined and `Fez.onError('compile', ...)` says to compile it with the plugin or `fez compile`.
- Syntax errors are reported as `Fez TypeScript error: ...`; `fez compile` gives the `.fez` line and column, the plugin appends `(line N, column M)` counted from the `<script>` block; without esbuild the error says to install it.
- An import used only as a type is dropped even without `import type`; the body-only script form (methods without `class { }`) works in TypeScript too.
- `fez compile path/to/component.fez` checks the TypeScript syntax without running the bundler (types are not checked).

## Content-Security-Policy build

For a page whose Content-Security-Policy has no `'unsafe-eval'` / `'unsafe-inline'`, import the CSP build and precompile every component with the bundler plugin:

```js
import '@dinoreic/fez/csp' // dist/fez.csp.esm.js (also fez.csp.esm.min.js)
import './components/ui-button.fez'
```

- The CSP build never turns strings into code; anything that needs it fails with `fez CSP build: ... needs code evaluation ('unsafe-eval')` in the usual compile, template or attribute error report.
- That covers runtime compiling (`<script fez>`, `<template fez>`, `<xmp fez>`, `Fez.compile`, a string `HTML` field), `<fez-inline>`, `<fez-if>`, `Fez.getFunction('code')` and string handler props, `:attr="expr"` on server-rendered tags, and `<demo>` scripts.
- Precompiled templates put no inline handler in the DOM: every `on<event>` becomes a closure listed in one `fez-on` attribute and bound after the render, so the DOM shows `fez-on="..."` instead of `onclick`.
- A quoted handler still runs as a function body with `this` as the element, so `return false` cancels the default.
- Scripts that fez inserts (`<head>` blocks, `Fez.runScript(code)`, pjax response scripts) carry the page nonce, read from the script that loaded fez (`Fez.nonce()`).

## Template scope

Template expressions execute as `const fez = this; with (this) { ... }`, so a template can
read anything on the component instance.
The bundler plugin compiles the template to module code with the same lookup (a name is the component's property when it has one, else a global), so a template behaves the same in both paths (except that in the plugin path names the script imports also resolve) and needs no `new Function` in the browser.
A template can read:

- `state`, `props`, `globalState`
- methods (`isMax()`, event handlers)
- class fields (`SECTIONS = [...]`, `ICONS = {...}`)

A module-level `const`/`let` is available to class methods (they close over module scope) but
**not** to template expressions. Put lookup tables used by a template in a class field or in
`state`.

Class field initializers run once per instance, so `cache = {}` is never shared and an arrow field `inc = () => this.state.n++` is bound to its instance.
Fez also constructs the class once when it is registered, to read its config keys (`HTML`, `CSS`, `PROPS`, ...), so keep field initializers free of side effects.

```html
<script>
  const ROWS = ['a', 'b']; // ok in methods, not in the template

  class {
    ROWS = ROWS; // expose module data to the template
  }
</script>

{#each ROWS as row}<span>{row}</span>{/each}
```

## Component structure

All parts are optional.
A block tag (`<script>`, `<style>`, `<head>`, `<info>`, `<demo>`, `<slim>`) counts only at the start of a line; a tag that merely starts with a block name (`<demo-card>`, `<info-box>`) is template markup.
Several `<style>` blocks (and several `<style global>` blocks) are joined; `<script>`, `<head>`, `<info>`, `<demo>` and `<slim>` may appear once.
An unclosed block is an error (`Unclosed <script> block`), and a `<slim>` block next to an HTML template is an error too.
`<xmp fez="...">` or `<template fez="...">` inside `<demo>` / `<info>` is demo markup, not a component definition.

```html
<!-- Head elements support (inline only in XML tags) -->
<xmp fez="some-tag">
  <info>
    <!-- Documentation block - rendered in demo pages -->
    <ul>
      <li>Component description</li>
      <li>Props: <code>name</code>, <code>value</code></li>
    </ul>
  </info>

  <demo>
    <!-- Example usage - rendered in demo pages -->
    <my-component name="basic"></my-component>
    <my-component name="advanced" value="123"></my-component>
  </demo>

  <head>
    <!-- everything in head will be copied to document head-->
    <script>console.log('Added to document head, first script to execute.')</script>
  </head>

  <!-- one <script> block per definition; a second one is a compile error -->
  <!-- the component class is the first anonymous `class {` (a named `class Foo {` is ordinary module code); -->
  <!-- a script with no `class {` at all is the class body, wrapped in class { } for you -->
  <script>
    class {
      init(props) { ... }     // when fez node is initialized, before template render
      onMount(props) { ... }  // called after first template render
    }
  </script>

  <style>
    /* Always scoped to the component. & is the component root node. */
    color: red;
    padding: 10px;
    &:hover { color: darkred; }
    .child { font-weight: bold; }
    /* single escape hatch - hoisted out, wrapper stripped */
    :global(.third-party-widget) { z-index: 10; }
    /* @keyframes/@font-face are hoisted too (they cannot nest); @media stays scoped */
    @keyframes fade-in { from { opacity: 0 } to { opacity: 1 } }
    /* CSS comments are block comments only - a // line comment breaks the next rule */
  </style>

  <style global>
    /* Always document-wide, never wrapped (nesting and macros still resolve) */
    .some-global-class { color: blue; }
  </style>

  <div> ... <!-- any other html after head, script or style is considered template-->
    <!-- All fez: attributes use namespace syntax (fez:keep, fez:this, fez:bind, fez:use, fez:class, fez:in, fez:out, fez:transition, fez:animate) -->
    <!-- fez-keep also works (fez: is converted to fez- at compile time) -->

    <!-- Conditionals -->
    {#if foo}...{/if}
    {#if foo}...{:else}...{/if}
    {#if foo}...{:else if bar}...{:else}...{/if}

    <!-- Unless directive - opposite of if -->
    {#unless state.list.length}
      <p>No items to display</p>
    {/unless}

    <!-- Loops -->
    {#each state.list as name, index}...{/each}
    {#for name, index in state.list}...{/for}

    <!-- Keyed each - key={row.id} lands on the first element of the body -->
    {#each state.rows as row (row.id)}<li>{row.name}</li>{/each}

    <!-- Local constant for the rest of the branch -->
    {@const total = state.price * state.qty}

    <!-- Body recreated when the value changes -->
    {#key state.id}...{/key}

    <!-- Block definitions -->
    {@block image}
      <img src={props.src} />
    {/block}
    {@block:image} <!-- Use the block -->

    {@html data} <!-- unescaped HTML -->
    {@json data} <!-- JSON dump in PRE.json tag -->

    <!-- fez:this will link DOM node to this.state (inspired by Svelte) -->
    <!-- links to -> this.state.listRoot, assigned silently on every render -->
    <!-- also auto-generates stable id="fez-{UID}-listRoot" for stable DOM diffing -->
    <!-- inside a loop each row gets its own id (fez-{UID}-name-{index}) and keeps its typed value -->
    <ul fez:this="listRoot">

    <!-- fez:use calls this.animate(node) once, when the node first appears -->
    <!-- the action may return a cleanup function or { update(node), destroy() } -->
    <li fez:use="animate">

    <!-- fez:bind for two-way data binding on form elements (re-renders on every keystroke
         when the template reads the key; prefer fez:this in large components) -->
    <input type="text" fez:bind="state.username" />

    <!--
      fez:class adds classes after render. The value is split on spaces: every class but the
      last is added right away, the last one 1ms later, so a CSS transition can start
    -->
    <span fez:class="fade visible">Delayed class</span>

    <!--
      fez:in / fez:out - Svelte-style enter/leave transitions (Web Animations API for registered
      transitions; a CSS @keyframes name uses style.animation).
      "name, key=value, ..." or "name; key: value; ...". All take duration, delay, easing.
      Outro finishes before the node is detached. Unknown names are used as CSS @keyframes names.
      Custom: Fez.transitions.wobble = (node, params) => ({ keyframes, duration }).
      Built-ins:
        fade   - opacity 0 -> 1
        fly    - slide in from an offset + fade: from=left|right|top|bottom, distance=40 (or x, y px), opacity
        slide  - accordion collapse/expand of height (axis=x for width), opacity=0 to fade too
        scale  - grow from start=0 + fade
        pop    - scale from start=0.8 with backOut overshoot + fade (dialogs, popovers, toasts)
        blur   - unblur from amount=5 px + fade
        flip   - 3D card flip: axis=y|x, angle=90, perspective=600
        rotate - spin in from angle=-90 deg (+ start scale) + fade
        draw   - SVG stroke drawing (stroke-dashoffset), duration or speed px/ms
    -->
    <div fez:in="fly, from=left, duration=300" fez:out="fade; duration: 150">Animated</div>
    <div fez:transition="pop">Same in and out (fez:in / fez:out override per direction)</div>

    <!-- fez:animate="flip" - kept list items glide to their new position on reorder (needs key=) -->
    {#each state.items as item}
      <li key="{item.id}" fez:animate="flip, duration=250" fez:out="fade">{item.name}</li>
    {/each}

    <!-- fez:animate="height" - box animates old -> new height whenever its content changes (also width, size) -->
    <div fez:animate="height, duration=250">{#if state.open}<p>...</p>{/if}</div>

    <!-- preserve element across re-renders (recreates only when key changes) -->
    <p fez:keep="unique-key">...</p>

    <!-- child components in loops - wrap in plain HTML element with fez:keep -->
    <span fez:keep="star-{i}-{rating}">
      <ui-star fill={fill} />
    </span>

    <!-- Slot: children wrapped in a .fez-slot div (default). One default slot only, -->
    <!-- named slots are not supported - pass markup as a child component instead -->
    <slot />

    <!-- Slot unwrap: wrapper div dissolved, children directly in parent -->
    <!-- Components with <slot unwrap /> render once: only state keys the template never reads may change -->
    <slot unwrap />

    <!-- :prop passes the evaluated value itself (object, array, function) to a child component -->
    <user-card :user="state.user" :cfg="{dense: true}" :on_pick={pick} />

    <!-- style:prop merges one CSS property into style, dropped when null/false -->
    <div style:width={state.width + 'px'} style:--accent={state.color}></div>
  </div>
</xmp>
```

Every method of the class (and every inherited FezBase method) is bound to the instance at mount, so `this.method` can be passed as a callback and keeps `this`.
Getters are not bound or called.

Transition details:

* Easing names: `linear`, `ease`, `easeIn`, `easeOut`, `easeInOut`, and `In` / `Out` / `InOut` variants of `sine`, `quad`, `cubic`, `quart`, `quint`, `expo`, `circ`, `back` (`cubicOut`, `backInOut`, ...); any other value is used as a CSS timing function.
* A param without a value is a flag (`fly, global` gives `{ global: true }`), and quoted values lose their quotes.
* A custom transition returns `{ keyframes, duration?, delay?, easing?, cleanup? }`; `cleanup` runs when the animation ends, and a throwing transition is logged and skipped.
* Registering a built-in name (`fade`, `pop`, ...) on `Fez.transitions` replaces it.
* A CSS `@keyframes` name defaults to 300ms and `ease`, and the element is released even if the name does not exist.
* `prefers-reduced-motion: reduce` skips every transition; elements still enter and leave.
* A leaving node gets `pointer-events: none` while its outro runs.

### Styles

`<style>` is always scoped to the component and `<style global>` is always document-wide; the tag decides, never the CSS.
Inside a scoped block, `:global(...)` works the Svelte way - the part inside it is never scoped:

| written | emitted |
|---|---|
| `.btn { ... }` | `.fez.<name>-fez .btn` |
| `:global(.x) { ... }` | `.x` - escapes the component |
| `:global(.dark) .btn { ... }` | `.dark .fez.<name>-fez .btn` - the global part sits above the scope |
| `:global(html.dark) & .btn { ... }` | `html.dark .fez.<name>-fez .btn` - `&` places the scope |
| `.x :global(.a, .b) { ... }` | one selector per list item |

* Commas inside quotes and brackets (`[data-x="a,b"]`) never split a selector list.
* `@keyframes`, `@font-face`, `@property`, `@position-try`, `@view-transition` and friends are emitted at the top level, as written.
* `@media`, `@supports`, `@container`, `@layer { }`, `@scope` and `@starting-style` nest and stay scoped; a nested one is hoisted outward around the resolved selector.
* `@import`, `@charset` and the `@layer a, b;` order statement are hoisted to the front of the sheet even from a scoped block; `@import` and `@layer` go to a separate `<style id="fez-css-head">` before the shared one, `@charset` is dropped.
* Comments are `/* ... */` only; a `//` line comment becomes part of the next selector and breaks that rule (`fez refactor` reports them).
* These are compile errors (`<name> style error: ...`), at runtime, in `fez compile` and in the bundler: `body { }` in a scoped `<style>`, `:global(...)` in `<style global>`, and `:host` or `:fez` in either block (use `&` for the wrapper). Text inside `/* */` comments is never checked.
* `<style global>` is not wrapped, so a declaration at its top level has no selector and is dropped; put it under `:root`, `html` or a class.
* Component CSS lands in one `<style id="fez-css">` in `<head>`; a page may ship that node pre-filled (SSR), and if a navigation removes it Fez recreates it with every rule injected so far.
* Injected CSS is never removed; a component's rules stay after its last instance is destroyed.
* Custom style macros must be registered before the component that uses them is defined (see `Fez.cssMixin`).

### state and props

Every instance has two places to keep data, and one rule for when a write re-renders.

| store        | who writes it           | on change                                                  |
|--------------|-------------------------|------------------------------------------------------------|
| `this.state` | the component           | re-render, but only if the last render read that key       |
| `this.props` | the parent / HTML attrs | re-render; read it, do not copy it                         |

Everything the instance owns goes in `this.state`: rendered values, `fez:this` refs, library instances, handlers, timers, counters.
While the template renders, fez records every top-level `state` key it reads.
A later write to a key that was read schedules a render (batched, one per frame); a write to any other key changes nothing on screen and costs nothing, `onStateChange` aside.
The set is rebuilt on every render, so conditional branches stay exact.

```javascript
class {
  PROPS = {
    speed:   { type: Number, default: 50 },
    onclick: { type: Function, state: true, default: () => {} },   // this.state.onclick, string or function
  }

  init() {
    this.state.count = 0          // rendered below: writes re-render
    this.state.ticks = 0          // never rendered: writes are free
  }

  onMount() {
    this.state.chart = new Chart(this.state.canvas, { speed: this.props.speed })  // canvas = fez:this="canvas"
    this.setInterval(() => this.state.ticks++, 100)                                // no render, ever
  }

  onDestroy() {
    this.state.chart.destroy()
  }
}
```

Class instances, DOM nodes and anything with internal slots (Date, Map, Set, Promise) are handed back unwrapped, so a chart, an editor or a Three.js scene lives in state without any proxy in the way.
Plain objects and arrays are wrapped deeply, so `state.items.push(x)` re-renders when `items` is rendered.
A library namespace object such as Leaflet's `L` is a plain object; keep it in a module-level `let` above the class, it is shared and not instance data.
`fez:this="name"` refs are assigned to `this.state.name` on every render without firing `onStateChange`, and a ref can never shadow a method.
Do not park data on bare `this`; it collides with the instance API and gains nothing.

Two costs to know.
Plain objects and arrays come back as proxies: the same proxy on every read, so `state.cfg === state.cfg`, but never `===` the raw object a library handed you, so never use one as a Map key against raw values; pull a big blob into a local before a hot loop.
A write to a key the template did read still rebuilds and morphs the whole template, even when the output is identical; read tracking prunes writes, it does not shrink renders, so a large template with frequent rendered-key writes still wants a [hatch](#the-template-render-is-opt-out-not-mandatory).

`init()` (with prop seeding) and every render (`beforeRender`, the template, `afterRender`) run with state triggers off: a write inside them fires no `onStateChange` and schedules nothing, so a hook may derive or correct state freely.
A write inside `onStateChange` does not re-enter the hook, but it still paints when the key is rendered.
`onMount` is deliberately outside, so measuring the DOM there and writing a rendered key still paints.
The same scope is yours as `this.noChangeStateTrigger(() => { ... })` for a batch of writes that must not paint; scopes nest and the function's return value is passed back.

## Typed props (PROPS)

HTML attributes are strings. Declare a `PROPS` schema on the class and Fez validates and coerces them before `init(props)` runs, so `this.props`, templates (`{props.count}`) and `onRefresh` all see typed values, defaults included.
Props without a schema entry pass through untouched; components without `PROPS` behave exactly as before.

```html
<xmp fez="ui-pager">
  <script>
    class {
      PROPS = {
        title:   String,                                     // shorthand, same as { type: String }
        page:    { type: Number, default: 1 },
        open:    Boolean,                                    // <ui-pager open> -> true, missing -> false
        size:    { type: String, default: 'md', enum: ['sm', 'md', 'lg'] },
        items:   { type: Array, default: [] },                // JSON string is parsed; literal default is copied per instance
        user:    { type: Object, required: true },
        site:    Object,                                     // a declared Object/Array with no default reads as {} / []
        on_pick: { type: Function, state: true },            // :on_pick="fn" or on_pick="doIt()" -> this.state.on_pick
        since:   { type: Date },
        tags:    (raw) => String(raw).split(','),             // any other function = custom caster
      }

      init(props) {
        props.page + 1        // number, no parseInt
        props.open            // boolean
      }
    }
  </script>
  ...
</xmp>

<ui-pager page="3" open :user="{id: 1}" items='["a","b"]' since="2024-05-01"></ui-pager>
```

Works as an instance field (`PROPS = {...}`) or `static PROPS = {...}` on a plain class, and only as `static PROPS = {...}` on a class that extends `FezBase`.

Entry fields:

| field      | meaning                                                                     |
|------------|-----------------------------------------------------------------------------|
| `type`     | `String`, `Number`, `Boolean`, `Array`, `Object`, `Function`, `Date`, or a custom `(raw, name) => value` function |
| `default`  | used when the prop is missing or failed coercion; a zero-arg function is called, a literal `[]` / `{}` is copied per instance, a one-arg function is a transform (see below) |
| `state`    | `true` copies the coerced value into `this.state[name]` before `init()`, a string picks another key; the component owns it from then on. Also the home for handler props |
| `required` | missing value reports a `props` error                                       |
| `enum`     | allowed values, checked after coercion                                      |

Coercion rules (idempotent - values that already have the right type pass through, so `data-props` JSON and `:prop` expressions are fine):

- `String` - `String(v)`
- `Number` - `Number(v)`; `NaN` and an empty string are errors
- `Boolean` - present with no value (`<x open>`), `open="open"`, `"true"`, `"1"` and `"on"` are `true`; every other string (`"false"`, `"0"`, `"no"`, `"yes"`, ...) is `false`; a number is `true` unless `0`; a declared Boolean with no attribute is `false`
- `Array` / `Object` - strings are `JSON.parse`d; wrong shape is an error. A declared `Object` / `Array` with no explicit `default` reads as `{}` / `[]` when missing (an explicit `default: null` is kept, a missing `required` stays absent), so `site: Object` / `items: Array` is the terse `{ type: Object, default: {} }` / `{ type: Array, default: [] }`
- `Function` - a function passes through (`:on_pick="..."`, `Fez.pointer()`); a string is resolved with `Fez.getFunction` like an inline `onclick`; anything else is an error
- `Date` - ISO string or epoch number -> `Date`; invalid is an error
- Order per key: transform, coerce, `required`, `enum`, then `default`

A `default` function that declares a parameter is a transform: it receives the raw attribute value (`undefined` when missing) and its result is what gets type checked.
`tags: { type: Array, default: (raw) => (raw || '').split(',') }` turns `tags="a,b"` into `['a', 'b']`.
A `Function` prop's `default` is always the handler itself, never a transform.

`state` seeds once, on connect, with a shallow copy for arrays and plain objects, so an in place `this.state.list.push()` never writes back into `props`.
Later parent renders update `props`, not the seeded key.
Seeding works in `<slot unwrap />` components too; they render once, so only keys the template never reads may change afterwards.

Errors never throw. They are reported through `Fez.onError('props', '<ui-pager> prop "page": expected Number, got "abc"')` (console by default, see [Custom Error Handler](#custom-error-handler)), the offending value is dropped and the `default` applies if there is one.

Prop refreshes of keyed/preserved components run through the same schema, so the new values are already coerced there too.
So does `Fez(el).setAttribute(name, value)`, the inbound channel for outside code: it writes the wrapper attribute, puts the cast value in `this.props`, and updates the linked state key when the entry is flagged `state`. A raw DOM `el.setAttribute()` on a mounted component changes nothing.

Note: an `Array`/`Object` given as a JSON **string** is re-parsed on every parent render and therefore counts as changed (a fresh object each time), same as an inline `:items="[...]"` literal. Pass a stable reference (`:items="state.items"`) if you rely on the "re-render only when props change" optimization.

The schema is also exposed on `Fez.index[name].props` for tooling and docs.

### Props in the DOM inspector (`fez-props`)

On connect the source tag is replaced by the component wrapper, so the inspector would only show `<div class="fez ui-pager-fez">`. Fez mirrors `this.props` onto the wrapper as one read-only attribute, in CSS declaration style:

```html
<div class="fez ui-pager-fez" fez-props="page: 3; open: true; size: md; items: []; user: {}; on_pick: ()=>{}">
```

Primitives print their value (long strings are truncated); objects, arrays and functions are only typed as `{}`, `[]` and `()=>{}`. The attribute follows every props change (`this.props.x = ...`, keyed refresh from a parent render). It is orientation for the inspector, not an API - read `node.fez.props` for the real values, and note that writing an attribute on the wrapper never feeds props.

### how to call custom FEZ node from the outside, anywhere in HTML

Name the instance with `GLOBAL` and it is available as a window global while it is mounted (see [Singleton / Global Components](#singleton--global-components)), or look it up with `Fez(selector)`.

Example: Dialog controller

```html
<ui-dialog id="main-dialog"></ui-dialog>
```

```js
Fez('ui-dialog', class {
  // makes dialog globally available as window.Dialog, cleared on destroy
  GLOBAL = 'Dialog'

  close() {
    ...
  }
})

// close dialog window, from anywhere
Dialog.close()

// you can load via Fez + node selector
Fez('#main-dialog').close()
```

## Fez.fetch API

Fez includes a built-in fetch wrapper with automatic JSON parsing and a short-lived GET cache:

### Basic Usage

```js
// GET request with promise
const data = await Fez.fetch('https://api.example.com/data');

// GET request with callback, does not create promise
Fez.fetch('https://api.example.com/data', (data) => {
  console.log(data);
});

// GET with query params (?q=fez), with or without a callback
const found = await Fez.fetch('/api/search', { q: 'fez' });

// POST request, data sent as FormData
const result = await Fez.fetch('POST', 'https://api.example.com/data', {
  key: 'value',
});

// drop cached responses
Fez.clearFetchCache();
```

### Features

- **Automatic JSON parsing**: Response is automatically parsed if Content-Type is application/json, otherwise it is text
- **GET caching**: only GET responses are cached, in memory, for 5 minutes, at most 100 entries (oldest dropped first); concurrent identical GETs share one request. POST always hits the network
- **Error status rejects**: a non-2xx response rejects the promise and is never cached
- **Flexible parameter order**: Method can be omitted (defaults to GET), callback can be last parameter (`Fez.fetch(url, data, callback)` works too)
- **Methods**: pass the method uppercase as the first argument; `data` is the query string for GET and a FormData body for POST, and other methods (PUT, DELETE) send no body
- **Request header**: every request sends `x-requested-with: XMLHttpRequest`
- **Error handling**: When using callbacks, errors are passed to `Fez.onError` with kind 'fetch'
- **Logging**: Enable with `Fez.LOG = true` to see cache hits and live fetches

### Custom Error Handler

`Fez.onError(kind, message, context)` receives every error reported by kind (below); `message` is a string (the Error itself for `fetch`), and `context` holds details such as `componentName`.
The default prints `Fez <kind>: [<component>] <message>`, adds `context` when `Fez.LOG` is on, prints the stack of an Error, and returns the formatted string.
Kinds include `lookup`, `find`, `mount`, `props`, `attr`, `destroy`, `fez-use`, `fez-bind`, `fetch`, `compile`, `nodeMorph` and `await`.
Replacing it also replaces that console output.
Template compile and runtime errors, invalid component names, `Fez.localStorage`, pub/sub subscriber and demo-script errors bypass it and go straight to `console.error`.

```js
// Override default error handler
Fez.onError = (kind, message, context) => {
  if (kind === 'fetch') {
    console.error('Fetch failed:', message);
    // Show user-friendly error message
  }
};
```

## Page Navigation (Fez.load)

Fez bundles Pjax (PushState + AJAX) navigation, formerly the standalone `dux-pjax` package.
It renders a server HTML response into the current page instead of performing a hard navigation: browser history is preserved, assets are not re-parsed, and page swaps go through `Fez.nodeMorph`, so fez components on the page survive navigation (see "Component Identity" above).

The public API is `Fez.load` and `Fez.refresh`, plus the URL state helpers `Fez.qs`, `Fez.hash`, `Fez.hpath` and `Fez.hqs`.
Configuration and hooks live on `Fez.pjax`, the navigation class the shortcuts delegate to.
There is no `window.Pjax` global.

### Boot gating

`Fez.pjax` is always available, but the navigation handlers (link hijacking, popstate, `data-pjax` forms) bind only when the initial page contains a pjax container - a `<pjax>` tag or an element with the `pjax` class, carrying an `id`:

```html
<main id="pjax" class="pjax">
  ... server rendered content swapped on navigation ...
</main>
```

The container must not be `<body>`; a `<pjax>` tag wins over a `.pjax` element.
A full swap sets `document.title` from the response `<title>`, so every full-page response should include one.

Pages without a container keep native browser navigation.
If your app injects the container after DOMContentLoaded, call `Fez.pjax.start()` manually.

### Fez.load and Fez.refresh

Both take the same arguments, `(what?, opts?)`, and differ only in their defaults.

* nothing - the current URL, swapping the whole container
* `'/path'` or `'?query'` - that URL; a query is resolved against the source region's path or the current pathname
* `'#selector'` or an element - the current URL, swapping only that node (the same as `opts.target`)

```js
Fez.load('/users')                        // navigate
Fez.load('#panel')                        // re-fetch the current URL into #panel
Fez.load('/users', { target: '#panel' })  // another URL into #panel
Fez.refresh()                             // fresh copy of the current page
Fez.refresh('#sidebar')                   // fresh copy of #sidebar, no history entry
Fez.refresh('/users/1/edit')              // navigate, fresh, keep the scroll position
Fez.pjax.path()                           // current pathname + search
```

A URL fragment stays in the browser: `Fez.load('/docs#install')` fetches `/docs`, swaps it in, pushes `/docs#install` and scrolls to `#install`.
When you are already on `/docs`, it only scrolls, as the browser would.
An absolute `http(s)://` URL is never fetched: the same host gets a full navigation, another host opens in a new window, and the call resolves `null`.
Back/Forward restores recently visited pages from a cache without a request (`Fez.pjax.config.history_max` pages); pages not in the cache are fetched.
A restore aborts every in-flight request (full, target and region) and fires `pjax:render` like a load.
Only pages loaded by a full swap are cached, so the first page of the visit and node or region swaps are fetched again; a cached page also gets its scroll position back.

`Fez.refresh()` fetches the page again from the server.
A component's `this.refresh()` only re-renders the component.
Use `Fez.refresh('#id')` for a server-rendered region and `this.refresh()` for component state.

### Options

| Option | Value |
|---|---|
| `target` | `'#selector'` or an element with an `id` - swap only the node with the same id from the response |
| `source` | the element that started the load - inside a `.ajax` region, only that region is swapped and history is left alone |
| `form` | a form to submit - GET serializes it into the query string, POST sends it as `FormData` |
| `history` | `'push'`, `'replace'`, or `false` to leave history alone |
| `scroll` | `true` to smooth scroll to the URL's `#fragment` element, or the top, after the swap (not when the source or target is inside `.no-scroll`); `false` keeps the position |

Unknown keys are reported through `Fez.pjax.error` as `unknown load option: <key>` and dropped.
A target that does not exist or has no `id` is reported and nothing is requested.
The object you pass is copied, never written to.
When the response has no element with the target's id, the whole pjax container is swapped instead.

### Defaults

A default applies only when the option is `undefined` or `null`, so an explicit value always wins.

| | `Fez.load` | `Fez.refresh` |
|---|---|---|
| request cache | normal | `cache-control: no-cache` |
| same URL + node within 2s | skipped (double-click guard) | always sent |
| `scroll` | `true` for a full swap, `false` when a node or region is swapped | `false` |
| `history` | `false` for a `.ajax` region swap and when the current URL is fetched into a target node, otherwise `'push'` (a replace when the URL does not change) | same as `Fez.load` |

### Result

Both return a Promise that never rejects, so a fire-and-forget call is always safe.
It resolves with the `pjax:render` detail - `{ from, to, status, error, duration, mode, opts }` - or `null` when there is no result: debounced, cancelled by `before()` or `pjax:start`, handed to a full browser navigation (`paths_to_skip`, an absolute URL, an off-origin or sixth redirect), an invalid target, a same-page `#fragment` that only scrolled, or a late response that a newer load for the same node replaced.

```js
const detail = await Fez.load('/users')
if (detail?.error) {
  // 'status' | 'network' | 'timeout' | 'abort' | 'apply' | 'layout'
}
```

| `error` | When | Then |
|---|---|---|
| `null` | swapped | - |
| `'status'` | non-200 response without `Location` | full navigation to the URL |
| `'network'` | no response (offline, CORS, DNS) | page stays, `Fez.pjax.error` is called |
| `'timeout'` | no response within `config.timeout` | full navigation to the URL |
| `'abort'` | a newer load for the same node (or any full load) replaced it | nothing |
| `'apply'` | the response could not be swapped (no element with the pjax container's id in it - a target swap falls back to the container first -, a region or container without `id`, or `after()` / the swap threw) | full navigation to the URL |
| `'layout'` | `x-pjax-layout` mismatch | full navigation to the URL |

`status` is the HTTP status, or `0` for `'network'`, `'timeout'` and `'abort'`.
`duration` is the request time in ms, `mode` is `'full'`, `'target'` or `'ajax'`, and `opts` holds the options with their defaults filled in (`target` as the element).

### Layout id

When the page has `<meta name="pjax-layout" content="ID">`, a full swap sends `x-pjax-layout: ID`.
The server may then answer with only `<title>` and the pjax container (lux `render_html` does).
A response must echo the same `x-pjax-layout` header; a missing or different one (other layout, new deploy) is loaded as a full page and the result carries `error: 'layout'`.

### Requests and redirects

Every pjax request is a `fetch` with `x-requested-with: XMLHttpRequest`, so the server can tell it from a full page load.
`Fez.refresh` adds `cache-control: no-cache`, and full swaps add `x-pjax-layout` (see "Layout id").

* A redirect followed by `fetch` updates the URL: history, the cache and `detail.to` use the final path.
* A non-200 response with a `Location` header is followed in place through pjax; for a same-origin target the final URL replaces the current history entry instead of pushing one; another origin gets a full navigation.
* After 5 such redirects the URL is opened with a full navigation.
* Any other non-200 status (including 201 and 204) resolves `error: 'status'` and opens the URL with a full navigation, so the server's error page is shown.
* A `script-src 'nonce-...'` in the response `Content-Security-Policy` header authorizes the response's inline scripts (see "Response scripts").

### Concurrent loads

Each swap node has its own debounce and its own in-flight request, so `Fez.load('#a')` and `Fez.load('#b')` run side by side.
A new request for the same node aborts the older one, and a full page load aborts every pending node load.

### Query-string and hash state

`Fez.qs()` stores named values in `?key=value`, and `Fez.hash()` stores them in `#key=value`.
Both use the same options and preserve the pathname, the other URL section, and unrelated parameters.
Values are URL-encoded when written and decoded to strings when read; missing keys return `undefined`.
`Fez.hash()` treats a slashless fragment as a parameter list, never as an element ID; hash routes use `Fez.hpath()`/`Fez.hqs()` below.

```js
Fez.qs('page', 2)                            // push a history entry, without fetching
Fez.hash('tab', 'settings')                  // push a history entry, without fetching
Fez.qs('page')                               // '2'
Fez.hash('tab')                              // 'settings'
Fez.qs('page', 3, { replace: true })          // replace the current history entry
Fez.hash('tab', 'users', { replace: true })   // same option for hash state
Fez.qs('page', 4, { href: true })             // return the URL without changing it
Fez.hash('tab', 'users', { href: true })      // same option for hash state
Fez.qs('page', null)                         // remove a parameter (false also removes)
Fez.hash('tab', null)                        // remove a hash parameter
```

### Hash routes

`Fez.hpath()` and `Fez.hqs()` address a route inside the fragment.
A fragment whose path part contains a slash is a route (`#/traffic`, `#ns/traffic?app=shop`), and the route name is its last path segment.
A slashless fragment (`#foo`, `#tab=settings`) stays a native anchor or a `Fez.hash()` parameter list.
Both helpers use the same options, are history-only, and preserve the other URL section.

```js
Fez.hpath()                                  // 'traffic' ('' when the fragment is not a route)
Fez.hqs('app')                               // 'shop'
Fez.hpath('logs')                            // push '#/logs', preserving the query
Fez.hpath('logs', { qs: { app: 'x' } })       // push '#/logs?app=x'
Fez.hqs('app', 'x')                          // push '#/logs?app=x', keeping the path
Fez.hqs('app', null)                         // remove a parameter, drop an empty query
Fez.hpath('logs', { qs: {}, href: true })     // '/catalog#/logs' without changing the URL
Fez.hpath('')                                // clear the route
```

`href: true` takes precedence over `replace: true` and never changes history.
Setters do not fetch, scroll, fire `popstate` or `hashchange`, or automatically bind to component state.
Update component state after a setter and use `this.on('popstate', ...)` to read values again on Back/Forward; use `this.on('hashchange', ...)` for native fragment edits too.
Hash-only Back/Forward leaves the page mounted; path or query changes still use normal page restoration/navigation when pjax is active.
To change a query parameter and navigate, call `Fez.load(Fez.qs('page', 2, { href: true }))`.

### Link and form attributes

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

* Any element with an `href` attribute is hijacked, not only `<a>`, so `<tr href="/users/1">` navigates through pjax; `pjax-refresh` works on any element and ignores `href`.
* Links with a scheme (`https:`, `mailto:`, `tel:`), a `//host` href, or a `target` attribute are left to the browser; use root-relative hrefs for pjax links.
* `<a href="#section">` jumps natively; with `pjax-confirm` it jumps after the confirm, with `pjax-refresh` it refreshes that selector instead, and `pjax-target` cannot be combined with a `#` href (`target given twice`).
* Ctrl, Cmd, Shift, Alt and middle clicks on a link keep the browser behavior (new tab); on a non-link `[href]` element they open the URL in a new window.
* A click the page already handled with `preventDefault()` is ignored.
* `javascript:` hrefs are never run; a console warning is logged.
* A `pjax-target` link with an `href` pushes a history entry; add `pjax-replace` to replace the current one instead.
* A `data-pjax` form posts to its `action` (the current URL when absent); `method="post"` sends `FormData`, any other method is appended to the query string.
* The clicked submit button's `name`/`value` is not sent; use a hidden input when the server needs it.

Override `Fez.pjax.confirm = (message, node) => ...` to use a custom dialog; returning a Promise defers navigation until it resolves.

### Ajax regions

An element matching `.ajax` (with an `id`) is a self-contained region: links clicked inside it swap only the region, add no history entry and keep the scroll position.

```html
<div class="ajax" id="user-dialog" data-path="/users/1">
  <a href="/users/1/edit">Edit</a>          <!-- loads into #user-dialog only -->
  <a href="?tab=log">Log</a>                <!-- resolved against data-path: /users/1?tab=log -->
  <a href="/users" class="top">Close</a>    <!-- full page load (also: ajax-skip, skip-ajax, no-ajax) -->
</div>
```

* `data-path` (or `path`) is the region's own URL; `Fez.refresh(null, { source: el })` re-fetches it.
* After each swap `data-path` is set to the loaded URL (and `path` is removed).
* The response element with the region's id is swapped in; a response without it is used whole as the region content.
* A region without an `id` is reported (`Pjax .ajax node has no ID`) and the URL is opened with a full navigation.
* From code, pass any element inside the region as `source`: `Fez.load('/next', { source: el })`.

### Events and hooks

```js
document.addEventListener('pjax:start', e => ...)   // request about to start; preventDefault() cancels it
document.addEventListener('pjax:render', e => ...)  // a load finished or failed, also once at boot (see below); detail: from, to, status, error, duration, mode, opts

Fez.pjax.before = (href, opts) => true   // return false to cancel a navigation
Fez.pjax.after  = (href) => ...          // after a full page swap
Fez.pjax.error  = (msg) => ...           // route pjax errors into app toasts
```

`pjax:start` detail is `{ from, to, mode, opts }`; it fires again for each same-origin redirect the server answers with.
`pjax:render` fires once when pjax boots (`from: null`), after every load that resolves a detail, swapped or failed (check `detail.error`; loads that resolve `null` fire none), and after a Back/Forward restore from the cache.
`Fez.pjax.emit(name, detail)` dispatches a cancelable `pjax:<name>` event on `document` and returns `false` when a listener called `preventDefault()`.

`before(href, opts)` gets the resolved URL (without the fragment) and the normalized options; only a returned `false` cancels.
It runs for loads and refreshes, not for debounced calls or Back/Forward restores, and a throw resolves `null`.
`after(href)` also runs after a Back/Forward restore from the cache, before `pjax:render`; if it throws, the load resolves `error: 'apply'` and the URL opens with a full navigation.
The default `error` logs `Pjax error: <msg>` with `console.error`.

Inside a fez component, `this.on('pjax:render', () => this.refresh())` is the usual pattern for data that must follow navigation.

Other `Fez.pjax` members: `path()` (pathname + search), `last()` (last loaded href, or the current path), `refreshed()` (`true` when the last two loads hit the same href), `node()` (the pjax container), `layout()` (the `pjax-layout` meta id or `null`), `push(href)` / `replace(href)` (history writes that keep pjax's Back/Forward tracking in sync), `historyData` (the Back/Forward cache) and `requests` (in-flight `AbortController`s by swap key).

### Response scripts

Inline `<script>` tags in the swapped part of a response run after history is committed but before the new HTML is morphed in; tag a script with `pjax-delay` to run it on the next animation frame, after the swap.

* Only classic inline scripts run; `src=` scripts, `type="module"`, JSON and `fez` loaders are not executed.
* Each script runs in its own function scope, so top-level `const`/`let` do not leak and a throw does not stop the swap.
* A full swap also runs the inline scripts outside the pjax container (for example in `<head>`) and registers the `<script fez>`, `<template fez>` and `<xmp fez>` components found there.
* On a page with a CSP nonce, a response script runs only when its `nonce` matches the `script-src 'nonce-...'` of that response's `Content-Security-Policy` header; others are skipped with a console warning.

`Fez.runScripts(node, csp?)` applies the same rules to HTML you fetch yourself: it runs `node`'s inline scripts, removes them and returns `node`.
On a nonce-protected page pass the response's `Content-Security-Policy` header as `csp`.

```js
const res = await fetch('/dialog')
const box = document.createElement('div')
box.innerHTML = await res.text()
dialog.append(Fez.runScripts(box, res.headers.get('content-security-policy')))
```

### Configuration

Set keys on `Fez.pjax.config` before navigation starts, e.g. `Fez.pjax.config.timeout = 20000`.

| Key | Default | Effect |
|---|---|---|
| `paths_to_skip` | `[]` | Hrefs handled by a full browser navigation instead of pjax: a string prefix, a RegExp, or a function `(href) => boolean` |
| `no_pjax_class` | `['no-pjax', 'direct']` | Class names that opt a clicked link, or any ancestor of it, out of pjax |
| `ajax_selector` | `'.ajax'` | Selector of scoped ajax regions (see "Ajax regions") |
| `no_ajax_class` | `['ajax-skip', 'skip-ajax', 'no-ajax', 'top']` | Class names that make a link inside an ajax region load the full page instead |
| `no_scroll_selector` | `['.no-scroll']` | Selectors; a load whose source or target sits inside a match keeps the scroll position |
| `timeout` | `10000` | Request timeout in ms; a timeout resolves `error: 'timeout'` and falls back to a full navigation |
| `history_max` | `20` | Number of full-swap pages cached for Back/Forward |
| `is_silent` | `true`, `false` when `location.port` is 1000 or higher | When `false`, each load is logged to the console with its status and timing |

`Fez.pjax.DEV = true` forces the console log regardless of `is_silent`.
`Fez.pjax.useViewTransition = true` wraps full-page swaps in `document.startViewTransition()` when the browser supports it; `pjax:render` then fires after the transition has applied the swap.

### Upgrading from window.Pjax

`fez refactor <dir>` lists every `Pjax.` call in `.fez`, `.js` and `.ts` files with its replacement; it never changes files.
Files that declare their own `Pjax` (`class Pjax`, `let`/`const`/`var Pjax`, or a `function (Pjax)` taking it as its only parameter) get no `Pjax.` reports; calls inside `//` comments are ignored.

| Old | New |
|---|---|
| `Pjax.load`, `Pjax.qs`, `Pjax.hash`, `Pjax.hpath`, `Pjax.hqs` | `Fez.load`, `Fez.qs`, `Fez.hash`, `Fez.hpath`, `Fez.hqs` |
| `Pjax.refresh(path)` | `Fez.refresh(path)` |
| `Pjax.reload()` / `Pjax.reload('#x')` | `Fez.refresh()` / `Fez.refresh('#x')` |
| `Pjax.refresh(this)` (an element in a `.ajax` region) | `Fez.refresh(null, { source: this })` |
| `{ ajax: el }` | `{ source: el }` |
| `{ replace: true }` | `{ history: 'replace' }` |
| `load(href, '#t')` | `load(href, { target: '#t' })` |
| `load(href, fn)` / `{ done: fn }` | `load(href).then(fn)` |
| `Pjax.config`, `Pjax.before`, `Pjax.start()`, ... | `Fez.pjax.config`, `Fez.pjax.before`, `Fez.pjax.start()`, ... |

## Default Components

Fez registers these built-in components automatically when the runtime loads:

### fez-component

Mounts the component named by `name` with `props` (or `data-props`; without either, its own props minus `name`):

```html
<fez-component name={state.page} :props="state.query">
  <p>Page not found</p>
</fez-component>
```

* When a parent re-render changes only the props, the same child gets them, as it would from a parent: it re-renders on a changed value and `onRefresh(props, changed)` fires.
* When `name` changes, the child is replaced.
* Its children are the fallback, shown while `name` is not a registered component.

### fez-include

Loads remote HTML content via URL:

```html
<fez-include src="./fez/ui-slider.html"></fez-include>
```

The HTML is fetched through `Fez.fetch` (so the 5-minute GET cache applies), its inline `<script>` blocks run and its `<template fez>` / `<xmp fez>` definitions compile before it is inserted; a `<script src>` or `<script fez>` in the included HTML is not supported.
`src` is read once at mount; changing it later does not reload.

### fez-if

Removes itself at mount when its expression is falsy; otherwise its children stay.

```html
<fez-if if="window.currentUser">
  <a href="/account">Account</a>
</fez-if>
```

* `test="..."` is an alias for `if="..."`.
* The expression is evaluated once, at mount, in global scope (no component `state` or `props`); it is not reactive.
* Not available in the `@dinoreic/fez/csp` build, which cannot evaluate strings.

### fez-inline

Renders its children as a reactive template, without writing a component.
Expressions see `state`, `globalState` and `props`, and the node re-renders when any of them change - the easy way to drop a global value into static HTML.
It renders as a `<span>`, so it can sit inside running text, and its other attributes are available as `props`:

```html
<p>Global max: <fez-inline>{globalState.maxCount || 0}</fez-inline></p>

<fez-inline :state="{n: 0}">
  <button onclick="fez.state.n++">clicked {state.n}x</button>
</fez-inline>
```

### fez-demo

Renders the demos of the components already loaded on the page. Perfect for component documentation pages:

```html
<!-- Every loaded component that has a demo -->
<fez-demo></fez-demo>

<!-- Only one component; ?fez=ui-clock in the URL does the same -->
<fez-demo name="ui-clock"></fez-demo>
```

The component lists each registered component that ships a demo and displays:

- Component name with an "open" link (single view via `?fez=name`; "show all" goes back)
- Live demo (left side) and the `<info>` block (right side)
- "Demo HTML" and "Fez Component" buttons that open the source in the `Fez.dump` dialog, and a "CodePen" button that opens the component in a new pen
- An "Undocumented" list of loaded components without a demo (`fez-*` built-ins are skipped)

Each section has the anchor `#fez-demo-<name>`.

See `pages_src/root/raw.html` for a minimal example.

### fez-demo-nav

A filterable "quick select" picker for demo pages that lists every component with a demo.
Picking one stores it in `globalState.demoSelected` and the URL hash (`#fez-demo-<name>`); the page renders `<fez-demo-nav for={name}>` above the selected section, and that instance scrolls itself into view on mount.
`offset="76"` leaves room for a sticky header (default 16 px); `for="ui-x"` marks the instance placed above that component's section.

```html
<fez-demo-nav offset="76"></fez-demo-nav>
```

## Global State Management

Fez includes a built-in global state manager that automatically tracks component subscriptions. It automatically tracks which components use which state variables and only updates exactly what's needed.

### How it Works

- Components access global state via `this.globalState` proxy
- Reading a value by key automatically subscribes the component to changes to that key.
- Setting a value notifies all subscribed components to that key: `onGlobalStateChange(key, value, oldValue)` fires right away.
- Only a key the last render read re-renders the component (the same rule as `this.state`); the render is batched into the next frame together with local state changes. A key read only outside render (in a click handler, in `init`) still fires `onGlobalStateChange`, but changing it does not re-render.
- `Object.keys(this.globalState)`, `{...this.globalState}` and `{@json globalState}` read every key; `delete this.globalState.x` deletes the key and notifies its readers.
- Components are automatically cleaned up when destroyed
- Global state is one level deep: `this.globalState.list.push(x)` changes the array but notifies nobody, and writing back the same array is ignored (`===`).
  Assign a new value instead: `this.globalState.list = [...this.globalState.list, x]`.

### State tied to component presence

Declare `GLOBAL_STATE` to publish values immediately after `onMount()`, before `onRefresh()`:

```js
class {
  GLOBAL_STATE = {
    boardView: true,
    activeBoardId() {
      return this.state.boardId;
    },
  };

  init(props) {
    this.state.boardId = props.board_id;
  }
}
```

Function values run once, synchronously, with the live component as `this`; use method syntax when reading instance state, since arrows keep their original `this`.
They are not recomputed on refresh, and asynchronous results are not awaited.
Read the published values through `this.globalState.boardView`, `{globalState.boardView}` in a template, or `Fez.state.get('boardView')` in JavaScript.
On destruction, Fez deletes the declared keys and notifies readers with `undefined`.
Deletion is unconditional: previous values are not restored and overlapping instances are not counted, so use unique keys per active instance.
Presence means mounted in the DOM, regardless of CSS visibility or scrolling.
For state that outlives a component, continue using `Fez.state.set()`.
See `pages_src/root/fez/demo-global-state.fez` for a toggleable demo.

### Basic Usage

```html
<script>
  class {
    increment() {
      // Setting global state - all listeners will be notified
      this.globalState.count = (this.globalState.count || 0) + 1
    }
  }
</script>

<!-- Reading global state in the template subscribes this component and re-renders it -->
<button onclick="fez.increment()">Count: {globalState.count || 0}</button>
```

### External Access

```js
// Set global state from outside components
Fez.state.set('count', 10);

// Get global state value
const count = Fez.state.get('count');

// Subscribe to specific key changes (returns unsubscribe function)
const unsubscribe = Fez.state.subscribe('language', (value, oldValue, key) => {
  console.log(`Language changed from ${oldValue} to ${value}`);
});
unsubscribe(); // stop listening

// Subscribe to ALL state changes - same argument order as the per-key form
Fez.state.subscribe((value, oldValue, key) => {
  console.log(`${key} changed to ${value}`);
});

// Delete a key; readers are notified with undefined
Fez.state.delete('count');

// Iterate over all components listening to a key
Fez.state.forEach('count', (component) => {
  console.log(`${component.fezName} is listening to count`);
});
```

### Optional Change Handler

Components can define an `onGlobalStateChange` method for custom handling:

```js
class MyComponent extends FezBase {
  init() {
    // read outside render: subscribes, the hook fires, no re-render
    this.applyTheme(this.globalState.theme);
  }

  onGlobalStateChange(key, value, oldValue) {
    console.log(`Global state "${key}" changed from`, oldValue, 'to', value);
    if (key === 'theme') {
      this.applyTheme(value);
    }
  }

  applyTheme(theme) {
    this.root.classList.toggle('dark', theme === 'dark');
  }
}
```

A key the template reads (`{globalState.theme}`) also re-renders the component after the hook.

### Real Example: Language Switching

Control global state from outside Fez components:

```js
// From anywhere in your app (vanilla JS, other frameworks, etc.)
Fez.state.set('language', 'en');

// All components whose render reads this.globalState.language will automatically re-render
document.getElementById('lang-select').addEventListener('change', (e) => {
  Fez.state.set('language', e.target.value);
});
```

```html
<!-- Component automatically reacts to language changes -->
<script>
  class {
    get greeting() {
      const greetings = { en: 'Hello', de: 'Hallo', hr: 'Bok' }
      return greetings[this.globalState.language] || greetings.en
    }
  }
</script>

<div>{greeting}, {props.name}!</div>
```

### Real Example: Shared Counter State

```html
<!-- Multiple counter components sharing max count -->
<script>
  class {
    PROPS = { start: { type: Number, default: 0, state: 'count' } }

    beforeRender() {
      // All counters share and update the global max
      this.globalState.maxCount ||= 0

      // Find max across all counter instances
      let max = 0
      Fez.state.forEach('maxCount', (fez) => {
        if (fez.state?.count > max) {
          max = fez.state.count
        }
      })

      this.globalState.maxCount = max
    }
  }
</script>

<button onclick="fez.state.count++">+</button>
<span>Count: {state.count}</span>
<span>(Global max: {globalState.maxCount})</span>
```

## Component communication: pick the channel

Three channels exist; pick by the kind of traffic, not by habit.

| Traffic | Example | Use |
|---|---|---|
| Shared state many components render | selected animation, playback speed, theme | `this.globalState.anim = 'idle'` - readers auto-subscribe, late-mounted components see the current value |
| Command to one known service component | play, seek, reset camera | direct call: `Viewport.play('idle')` (`GLOBAL = 'Viewport'`) or `Fez('#viewport').play('idle')` - you get a return value, `await`, and a TypeError on a typo |
| Event whose consumers the sender must not know | `chain:finished`, `model:loaded` | `this.publish('chain:finished')` (nearest subscribing ancestor) or `Fez.publish(...)` (everyone) |

Pub/sub is the wrong tool for commands (no result from the handler - `this.publish` only tells whether someone handled it - and no error when nobody listens) and for shared state (a component mounted after the event misses it).
Most panels in a tool-style UI are shared-state readers; usually only one component is a command target.
A component's `this.subscribe` subscriptions survive a move (the node detached and re-inserted); only a destroyed component drops them.
