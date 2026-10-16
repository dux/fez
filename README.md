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

## CLI Tools

Fez provides command-line tools for development:

```bash
# Print the LLM/agent reference (AGENTS.md); --init adds a pointer to your project's AGENTS.md
bunx @dinoreic/fez agents
bunx @dinoreic/fez agents --init

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

`fez --help` lists all commands plus the source path and GitHub repo. `fez compile` validates both JavaScript and Fez template syntax. Use `--debug-template` when a template compile error needs the generated render function:

```bash
fez compile --debug-template my-component.fez
fez template --debug my-component.fez
```

`-t` / `--dump-template` prints the final template each component compiles to (a `<slim>` template one node per line, with source line numbers), and `--json` prints errors as a JSON array for editors:

```bash
fez compile -t my-component.fez
fez compile --json my-component.fez
```

`.fez` files are compiled with Fez's own template compiler (`src/fez/lib/template-compiler.js`).

```bash
# Report legacy syntax, removed APIs, window.Pjax calls and // comments in <style> (never changes files)
fez refactor pages_src/root/fez

# Index files as JSON, or open a URL in Playwright with an interactive debugging REPL
fez index pages_src/root/fez
fez debug http://localhost:8000

# Print the installed version (X.Y.Z from .version); Fez.version holds the same value at runtime
fez version
```

## Repository development and deployment

```bash
bun run dev            # Build library + docs, watch, serve on port 8000, and reload browsers
bun run build          # Build the library bundles
bun run static         # Generate the component index and documentation site
bun run lint --fix     # Fix lint issues
bun run deploy --help  # Describe the complete GitHub deployment workflow
bun run deploy --dry-run
bun run deploy
```

`deploy` requires a clean working tree on `main`.
It runs `bun run test` first and stops on failure before stamping a version, building, committing, or pushing.
It stamps the version with `vstamp count --next` ([vstamp](https://github.com/dux/vstamp)): the main commit count including the release commit, rendered dotted (`357` -> `3.5.7`, `1123` -> `11.2.3`), written to `.version` (YAML, `version: X.Y.Z`) and `package.json`.
It then builds the library and pages, commits both files on `main`, and commits the built site on top of the `pages` branch with the same commit-tree path as `fez gh-pages`.
It then pushes both branches to GitHub (`origin`) atomically: both must fast-forward and `pages` is never force-pushed.
The generated site is served from the root of the `pages` branch.
`--dry-run` also runs tests, builds the next version, restores `.version` and `package.json`, and leaves preview output without committing or pushing.
Build failures restore the manifest before any source commit; later failures retain local commits and the Pages output for recovery.
For a site that only needs the generic publisher, `fez gh-pages` builds `source_dir` and commits it to the same `pages` branch with no version stamping.
`bun run release` is separate: it publishes the library package to the public package registry.

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
```

Publish the built target to GitHub Pages with `fez gh-pages` (run from the project root):

```bash
# Build source_dir and commit it on the 'pages' branch, then push it to origin
fez gh-pages

# Commit the pages branch locally without pushing, or publish then preview it
fez gh-pages --no-push
fez gh-pages -s --port 4000
```

`fez gh-pages` writes the same `target_dir` the static builder produces, then commits it on top of the `pages` branch (`git commit-tree` + `update-ref`, without checking the branch out) and pushes it to `origin`.
It fails with a clear message instead of guessing when run outside a Git repository, without an `origin` remote, when the `pages` branch is checked out in a worktree, or when local `pages` diverges from `origin/pages`.
`-s` / `--serve` builds, publishes, then serves the target with auto-rebuild and live reload, like `fez static dev`.

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
Pages without `layout` use `layouts/default.html` from `source_dir` automatically.
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

HTML pages, layouts, and includes use Fez template expressions, conditionals, and loops.
Markdown is converted without evaluating braces, so Fez examples and other code remain unchanged.

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

`{@content}` inserts the current page or child layout.
`{@include "name.html"}` resolves from `parts/` in `source_dir` and may be used in pages, layouts, or other parts.
Use `./name.html` for a part relative to another part.
Pass one parameters object; its values are available through `include`:

```html
{@include "badge.html", { label: page.title, kind: "note" }}
```

```html
<strong class={include.kind}>{include.label}</strong>
```

Templates receive `site`, `page`, `collections`, `include`, and the `url(path)` helper.
With no `site.base_url`, `url(path)` emits paths relative to the generated site root (`css/site.css`, `blogs/post.html`). Put `<base href={page.base}>` in the layout so those paths resolve from every nested page. The same files then work at `/` locally and `/fez/` on GitHub Pages, with no extra config.
If `site.base_url` is set, `url(path)` prefixes that value onto root-relative paths instead.
Every page also exposes `page.href` (the prefixed form of `page.url`) and `page.base` (the relative href for `<base>`).

```html
<a href={url("/")}>Home</a>
<a href={page.href}>{page.title}</a>
<script src={url("/assets/app.js")}></script>
```

A bracketed directory declares a collection: files under `root/[blogs]/` are exposed as `collections.blogs` and sorted newest first.
The brackets are removed from public paths, so posts build under `build/blogs/`.
Each collection gets a generated `index.yaml` containing its published page metadata.
Assets inside a collection are copied to the same bracket-free output path but are not collection entries.
Non-page files under `root` keep their root-relative paths.
Use `permalink` to override a page route.
For an existing complete HTML document whose body must pass through without rendering, set both `layout: false` and `render: false` in its front matter.
Every generated HTML and Fez file starts with `<!-- generated from src: web_src/root/PATH | DO NOT EDIT OR READ THIS FILE -->`, including unrendered HTML pages.
JavaScript files use the equivalent `// generated from src: web_src/root/PATH | DO NOT EDIT OR READ THIS FILE` notice; all other assets are copied unchanged.

Configuration is optional.
Fez looks for `fez-static.yaml`, then `fez-static.json`, in the project root and then in `config/`; the first match wins.
`source_dir` (default `web_src`) and `target_dir` (default `web_build`) are relative to the project root and must stay inside it; values under `site` are exposed to templates:

```yaml
source_dir: web_src
target_dir: web_build

site:
  title: Fez
  description: JavaScript DOM components framework

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

Collection configuration is optional.
Use it to provide a default layout for pages in a bracketed collection; page front matter can still override that layout.
The optional `required` list is checked by `fez static doctor` against the final page metadata, including inferred titles and filename dates.

Copy sources are relative to the project root, may live outside `source_dir`, and must remain inside the project root.
A file maps to one exact target path; a source directory copies its contents recursively into the mapped target directory.
Copy targets are relative to the generated target, copied bytes are unchanged, and copied sources participate in watch mode.
Missing sources, symbolic links, scratch files, unsafe paths, and output collisions fail the build.

`fez static doctor` renders into a temporary target and checks internal `href`, `src`, `srcset`, and fragment references, including those resolved through `<base href>`.
Use `url(path)` or `page.href` for internal links. When `site.base_url` is set, root-relative references must include it.
External and protocol URLs are ignored.
Add `data-fez-static-ignore` to an element when an intentional client-side route has no generated file.

The builder writes through a staging directory and replaces the target only after every page renders successfully.
Missing layouts or parts, output collisions, recursive includes, recursive layouts, dynamic include paths, and unsafe paths fail the build.
`fez static dev` injects a development-only reload client and refreshes connected pages after each successful rebuild.

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

Rule of thumb: reach for a hatch when a single component owns more than ~500 live nodes **and** updates them frequently. Below that, use `this.state` and do not think about it.

This article, [Web Components Will Replace Your Frontend Framework](https://www.dannymoerkerke.com/blog/web-components-will-replace-your-frontend-framework/), is from 2019. Join the future, ditch React, Angular and other never defined, always "evolving" monstrosities. Vanilla is the way :)

## How it works

- define your custom component - `Fez('ui-foo', class UiFoo extends FezBase)`
- add HTML - `<ui-foo bar="baz" id="node1"></ui-foo>`
  - lib will call `node1.fez.init()` when node is added to DOM and connect your component to dom.
  - use `Fez` helper methods, or do all by yourself, all good.

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
| 6           | `sig-{hash}`      | Source signature of unkeyed fez components (tag + attrs + content)  |
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
Inside loops, keys automatically include the loop index variable (e.g. `fez-key="3-{i}"`), so most cases work without manual keys.
The markers are moved off the DOM attribute surface before morphing, so they never appear in the live document.

Elements that don't match by key fall through to **scored soft matching** - a greedy algorithm that pairs unmatched old/new elements by tag name similarity, shared CSS classes, and attribute count. Fez components and `fez-keep` elements are excluded from soft matching - they only match by key or signature.

### Component Identity: Preserve vs Recreate

When the differ pairs a new placeholder with a live fez component, identity decides what happens:

- **Explicit key** (`fez-key`, `key`, or `id`) - the instance is preserved even when attributes or content changed.
  Props are re-read from the new placeholder, the component re-renders when any of them changed, and `onRefresh(props, changed)` fires; `changed` holds the props whose value differs.
- **No key** - identity is the source signature: an FNV-1 hash of the component's original source (`outerHTML` - tag, attributes and slot content), captured at mount.
  Byte-identical source means the instance is preserved untouched (only `onRefresh` fires).
  If anything differs, the old instance is destroyed and a fresh one is created through `init()`.

A live component is matched by its `<name>-fez` wrapper class, so an unkeyed component is also preserved against the raw `<name>` tag of server HTML when the source is unchanged.
This matters most for pjax-style page swaps where the server renders fresh HTML.
Unchanged chrome (menus, headers) is preserved automatically, while any component whose source changed gets a clean rebuild instead of a silently stale preserve - no manual syncing in `onRefresh` required.
When you deliberately want an instance to survive changed attributes or content, give it a `fez-key`:

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

- Its own `this.state` changes
- New props are passed to an explicitly keyed component

An unkeyed child whose source (attributes or content) changed is not morphed - it is destroyed and recreated through a fresh `init()`, per the identity rules above.

This means a parent with 100 child components in a loop can re-render its own template without touching any of those children - they continue operating with their own state and DOM intact.

### Attribute and Class Syncing

- **Class changes** use `classList.add/remove` instead of `setAttribute` - this preserves CSS transitions and animations
- **Inline styles** set via JS (e.g. `element.style.left = '100px'`) are preserved when the template doesn't set a `style` attribute **and** both nodes share a non-empty class (identity). Classless soft-matched tags (e.g. bare `<th>`) clear stale styles so column widths don't leak across pjax page swaps
- **Active input focus** - `value` and `checked` attributes are not synced on the currently focused input, preventing disruption during typing

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

Svelte-only syntax fails to compile with a hint at the Fez spelling: `{@debug}` (use `{@json}`), `{@render}` and `{#snippet}` (use a child component or `{@block}`), `on:click|mod` (use `onclick={...}`) and `bind:value` (use `fez:bind`).

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

- `null`, `undefined`, `false`, `0`, `""` → **falsy**
- `[]` (empty array) → **falsy**
- `{}` (empty object) → **falsy**
- Non-empty arrays, non-empty objects, and other truthy values → **truthy**

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
- **Brackets optional** - `{#for key, val in obj}` same as `{#for [key, val] in obj}`

**Note on passing props:** Use `:prop="expr"` syntax to pass JavaScript objects, arrays, or functions as props. Regular `prop={expr}` will stringify the value.
`:x="expr"`, `:x='expr'` and `:x={expr}` are the same, names may be hyphenated (`:data-x="..."`), and the value may be an object literal (`:cfg="{a: 1}"`).
The expression runs in template scope (loop variables and `{@const}` names included) and the value reaches the child as is, through the parent's render slots.
Declare a `PROPS` schema (see [Typed props](#typed-props-props)) and stringified numbers, booleans and JSON are coerced back for you.

**Component Isolation:** Child components in loops are automatically preserved during parent re-renders. They only re-render when their props actually change (by identity: an object read from `this.state` is a fresh proxy each render, so it always counts as changed).

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
  <ui-star fill="{getStarFill(i)}" color="{state.color}" />
</span>
{/for}

<!-- Preserve form inputs to keep user-entered values -->
<input fez:keep="search-input" type="text" />

<!-- Preserve animation state -->
<div fez:keep="animated-element" class="slide-in">...</div>
```

**How it works:**

- Same `fez:keep` value → Element is fully preserved (no re-render, all state intact)
- Different `fez:keep` value → Element is recreated from scratch
- No `fez:keep` → Element may be recreated on every parent re-render

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

For scalar values, a plain string handler is just as good: `onclick="fez.remove('{item.id}')"`.

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

### Self-Closing Custom Elements

Custom elements can use self-closing syntax:

```html
<ui-icon name="star" />
<!-- Automatically converted to: <ui-icon name="star"></ui-icon> -->
```

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

Templates drop whitespace-only runs between tags and `{#..}` / `{:..}` / `{/..}` blocks, on the same line or across lines:

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

* Tags nest by indentation; a block closes when the indentation drops or when the next sibling is not `- else` / `- then` / `- catch`.
* Attribute values are `"..."`, `'...'`, `{expr}` or a bare value; boolean attributes are written `disabled=""` or `disabled={state.busy}`.
* Fez attributes pass through: `:prop="..."`, `fez:this="x"`, `class:on={...}`, `onclick!="..."`.
* Shorthand classes merge with a `class` attribute: `.p-2 class={state.x}` becomes `class="p-2 {state.x}"`.
* In the class shorthand a `.` inside `[...]` / `(...)` or between digits (`p-0.5`) does not split, and `/ : ! @ * %` are ordinary class characters (`w-1/2`, `hover:bg-red-500/50`, `!mt-0`, `mt-0!`, `*:p-2`, `data-[state=open]:block`, `bg-(--brand)`).
* A line ending in ` \` continues on the next line.
* Nodes are joined without whitespace (see above).
* Errors report the `.fez` file line and column, and `fez compile -t` shows the generated template next to the Slim source lines.

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
- **Semantic HTML Output** - Transforms custom elements to standard HTML nodes (e.g., `<ui-button>` → `<button class="fez ui-button-fez">`), making components fully stylable with CSS
- **Single-File Components** - Define CSS, HTML, and JavaScript in one file, no build step required
- **Typed Props** - Opt-in `PROPS` schema validates and coerces attribute strings into numbers, booleans, arrays, dates... with defaults, `required` and `enum`, straight into `this.props`
- **No Framework Magic** - Plain vanilla JS classes with clear, documented methods. No hooks, runes, or complex abstractions
- **SCSS-style Nesting, No Dependency** - Write nested rules and `&` as you would in SCSS. Fez flattens them to plain CSS itself rather than relying on native CSS nesting, so components work on browsers older than late-2023 (old Android WebViews included). Comma-separated parents expand cartesian (`.a, .b { &:hover }` → `.a:hover, .b:hover`), keeping each selector's own specificity and needing no `:is()` support. Everything lands in one `<style id="fez-css">`
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
- **Import Maps** - Use `Fez.head({importmap: {...}})` to map bare import specifiers to full URLs, avoiding duplicate library instances
- **Style Macros** - Define custom CSS shortcuts like `Fez.cssMixin('mobile', '@media (max-width: 768px)')` and use as `:mobile { ... }` or `@include mobile { ... }`. A macro expands to a selector or an at-rule, so it can also encode a theme. End the usage with `;` instead (`.item { :card; }`) and the body is inlined as declarations, SCSS `@include` / Tailwind `@apply` style
- **Dark Theme** - Built-in `:dark { ... }` macro expands to `&:where(.dark, .dark *)`, styling any component under a `dark` class on `<html>`. Zero added specificity; re-register it as `@media (prefers-color-scheme: dark)` to follow the OS instead, with no component changes
- **Scoped Styles** - `<style>` is always scoped to the component, `<style global>` is always document-wide. Scope is declared on the tag, never inferred from the CSS. `:global(...)` hoists a single rule out of a scoped block (using it inside `<style global>` is a compile error - those rules are already global)

### Developer Experience

- **Built-in Utilities** - Helpful methods like `formData()`, `setInterval()` (auto-cleanup), `on()`, `observeResize()`, `tick()` and `fezNextTick()`
- **Two-Way Data Binding** - Use `fez:bind` directive for automatic form synchronization
- **Slots** - One default `<slot />` with event listener preservation (named slots are not supported). Use `<slot unwrap />` to dissolve the wrapper div, leaving children directly in the parent
- **Context and Error Boundaries** - `this.context(key, value)` hands values down the component tree; `onError(error, component)` on an ancestor catches a descendant's mount and render errors
- **Publish/Subscribe** - Built-in pub/sub system for component communication
- **Global State Management** - Automatic subscription-based global state with `this.globalState` proxy
- **Dynamic Component Loading** - Load components from URLs with `<template fez="path/to/component.fez">`
- **Auto HTML Correction** - Fixes invalid self-closing tags (`<ui-icon name="gear" />` → `<ui-icon name="gear"></ui-icon>`)

### Performance & Integration

- **Hash-Based Render Skipping** - FNV-1 hash of rendered HTML skips the entire morph when nothing changed (zero-cost no-op renders)
- **Batched State Updates** - Multiple state changes in the same tick are debounced into a single `requestAnimationFrame` render
- **Component Isolation** - Child fez components are never morphed during parent re-renders, only repositioned. They re-render only when their own state or props change
- **Priority-Based Element Matching** - Keyed matching (fez-keep > fez-key > key > id > source signature) with scored soft-match fallback preserves DOM identity across renders
- **CSS Animation Preservation** - Class syncing uses `classList.add/remove`, not `setAttribute`, so transitions and animations survive re-renders
- **Active Input Protection** - `value` and `checked` are not synced on the focused input, preventing disruption during typing
- **Built-in Fetch with Caching** - `Fez.fetch()` caches GET responses for 5 minutes and handles JSON/FormData
- **Rich Lifecycle Hooks** - `init`, `onMount` (may return a cleanup), `beforeRender`, `afterRender`, `onDestroy`, `onRefresh(props, changed)`, `onStateChange`, `onGlobalStateChange`, `onError`
- **Development Mode** - Enable detailed logging with `Fez.DEV = true`

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
Fez('#foo')                  // find fez node with id="foo"
Fez('ui-tabs', this)         // find first parent node ui-tabs
Fez('ui-tabs', (fez)=> ... ) // call for every live ui-tabs instance, returns the instances (FezBase[])
Fez.find(node, 'ui-tabs')    // closest ui-tabs instance of a node, undefined (and reported) when none

// define custom DOM node name -> <foo-bar>...
Fez('foo-bar', class {
  // set element node name, set as property or method, defaults to DIV
  // why? because Fez renames custom dom nodes to regular HTML nodes
  NAME = 'span'
  NAME(node) { ... }
  // alternative: static nodeName = 'span'

  // set element style, set as property or method
  CSS = `scss string... `

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

  // called when local component state changes
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

  // clasic interval, that runs only while node is attached
  this.setInterval(func, tick) { ... }

  // get closest form data, as object. Searches for first parent or child FORM element
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
  // set value to a node, uses value or innerHTML
  this.val(selector, value)

  // Publish/Subscribe system
  // Component-level: publishes bubble up to parent components until a subscriber is found
  this.publish('channel', data)           // publish from component, bubbles up to parents
  this.subscribe('channel', (data) => {}) // subscribe in component (auto-cleanup on destroy)

  // Global-level: publish to all subscribers
  Fez.publish('channel', data)            // publish globally

  // Global subscribe with different targeting options:
  Fez.subscribe('channel', callback)                   // always fires
  Fez.subscribe(node, 'channel', callback)             // fires only if node.isConnected
  Fez.subscribe('#selector', 'channel', callback)      // fires only if selector found at publish time

  // Unsubscribe manually (auto-cleanup for disconnected nodes)
  const unsub = Fez.subscribe('channel', callback)
  unsub() // manually remove subscription

  // gets root childNodes
  this.childNodes()           // returns array of child elements
  this.childNodes(func)       // map children with function
  this.childObjects()         // convert to objects: { html, ROOT, ...attrs }

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

  // get unique ID for root node, set one if needed
  this.rootId()

  // get/set attributes on root node
  this.attr(name, value)

  // dissolves child nodes or given node into parent
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

/* Utility methods */

// define custom style macro - expands to a selector or an at-rule prelude
// Fez.cssMixin('mobile', '@media (max-width:  768px)')
// :mobile { ... } -> @media (max-width:  768px) { ... }
// @include mobile { ... } -> same thing, both spellings work
// note: the trailing space is required, `:mobile{` is not expanded
//
// end the usage with `;` and the body is inlined as declarations instead
// Fez.cssMixin('card', 'padding: 16px; border-radius: 8px')
// .item { :card; color: red; } -> .item { padding: 16px; border-radius: 8px; color: red; }
//
// built in: mobile, tablet, desktop, dark
// :dark { ... } -> &:where(.dark, .dark *) { ... }
// styles the component when <html> carries a `dark` class:
//   document.documentElement.classList.toggle('dark', isDark)
// to follow the OS instead, re-register it (no component CSS changes):
//   Fez.cssMixin('dark', '@media (prefers-color-scheme: dark)')
Fez.cssMixin(name, value)

// add global scss
Fez.globalCss(`
  .some-class {
    color: red;
    &.foo { ... }
    .foo { ... }
  }
  ...
`)

// localStorage with automatic JSON serialization (preserves types)
Fez.localStorage.set('count', 42)
Fez.localStorage.get('count')              // 42 (number, not string)
Fez.localStorage.set('user', { name: 'John' })
Fez.localStorage.get('user')               // { name: 'John' }
Fez.localStorage.get('missing', 'default') // 'default' (fallback value)
Fez.localStorage.remove('key')
Fez.localStorage.clear()

// internal, get unique ID for a string, poor mans MD5 / SHA1
Fez.fnv1('some string')

// get dom node containing passed html
Fez.domRoot(htmlData || htmlNode)

// activates node by adding class to node, and removing it from siblings
Fez.activateNode(node, className = 'active')

// wrap rules in a generated class, inject them, return the class name
Fez.cssClass(text)

// everything Fez has injected so far, in order (SSR, debugging)
Fez.extractCss()

// show any value in the dump dialog (objects as JSON, DOM nodes as HTML)
Fez.dump(value)

// Dev helper: press Cmd/Ctrl + E to toggle overlays highlighting each component on the page.
// Click a label to call Fez.dump for that element automatically.

// component-aware DOM morph; source is an HTML string, an Element or a DocumentFragment
Fez.nodeMorph(target, newNodeOrHtml)

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

// library version, from package.json at build time (the `fez version` CLI prints the same number)
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
Fez.getFunction(pointer)

// add scripts/styles to document head
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
* A runtime error in the template is logged and the component keeps its last rendered DOM.
* A throwing `onDestroy` is reported and teardown still completes.

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
5. Pass anything that changes as a prop; slots are captured once.
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

Example with `./fez.txt`:

```
ui-button          # loads ./ui-button.fez
forms/input        # loads ./forms/input.fez
/lib/shared-comp   # loads /lib/shared-comp.fez (absolute)
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

## Fez script loading and definition

```html
<!-- Remote loading for a component via URL in fez attribute -->
<!-- Component name is extracted from filename (ui-button) -->
<!-- If remote HTML contains template/xmp tags with fez attributes, they are compiled -->
<!-- Otherwise, the entire content is compiled as the component -->
<script fez="path/to/ui-button.fez"></script>

<!-- prefix with : to calc before node mount -->
<foo-bar :size="document.getElementById('icon-range').value"></foo-bar>

<!-- pass JSON props via data-props -->
<foo-bar data-props='{"name": "John", "age": 30}'></foo-bar>

<!-- pass JSON props via data-json-template: read from the element right before the tag, which is removed -->
<script type="application/json">
  {"name": "John", "roles": ["admin"]}
</script>
<foo-bar data-json-template="true"></foo-bar>
```

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
  `<info>` / `<demo>` metadata from the emitted module.
- Static imports (multi-line named imports included) are hoisted to the top of the module and
  deduped across the components of one file.
- Each component of a multi-component file gets its own block scope, so two components may both
  declare `const helper`.
- A `<head>` block is emitted as `Fez.head("<html>")`, which appends it to `document.head`.
- An unclosed `<xmp fez="...">` is a build error.

The emitted module reads the fez runtime from `window.Fez`; it never imports the runtime itself,
so a page must load fez once before its component modules. A missing global fails the module with
a clear `fez runtime not loaded` error.

Vite and Rollup both import the same plugin from `@dinoreic/fez/plugin`: `enforce`/`configResolved`
are Vite-only and ignored by Rollup, so `minify` follows Vite's mode and stays `false` for Rollup.
The runtime `<script fez="...">` loading above still works; both paths are supported.

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
- The plugin strips types with `esbuild`. Vite already depends on it; install `esbuild`
  yourself when your setup cannot resolve it (a bare Rollup config, a strict package manager).
- `type="text/typescript"` is accepted as an alias for `lang="ts"`.
- `fez compile path/to/component.fez` validates TypeScript without running the bundler.

## Template scope

Template expressions execute as `const fez = this; with (this) { ... }`, so a template can
read anything on the component instance:

- `state`, `props`, `globalState`
- methods (`isMax()`, event handlers)
- class fields (`SECTIONS = [...]`, `ICONS = {...}`)

A module-level `const`/`let` is available to class methods (they close over module scope) but
**not** to template expressions. Put lookup tables used by a template in a class field or in
`state`.

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

All parts are optional

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
  <!-- the class wrapper can be omitted: a bare method list is wrapped in class { } -->
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
    /* Always document-wide, emitted verbatim */
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
      fez:in / fez:out - Svelte-style enter/leave transitions (Web Animations API).
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
* `@media`, `@supports`, `@container`, `@layer { }` and `@starting-style` nest and stay scoped.
* `@import`, `@charset` and the `@layer a, b;` order statement are hoisted to the front of the sheet even from a scoped block; `@import` and `@layer` go to a separate `<style id="fez-css-head">` before the shared one, `@charset` is dropped.
* Comments are `/* ... */` only; a `//` line comment becomes part of the next selector and breaks that rule (`fez refactor` reports them).

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
Plain objects and arrays come back proxied on every read, so `state.cfg !== state.cfg`: pull a big blob into a local before a hot loop, and never use one as a Map key or compare it to an object a library handed you.
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

Works as an instance field (`PROPS = {...}`) or as `static PROPS = {...}` on a plain/`FezBase` class.

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
- `Number` - `Number(v)`; `NaN` is an error
- `Boolean` - attribute present with no value (`<x open>`) and `open="open"` are `true`; `"false"`, `"0"`, `"off"`, `"no"`, `"null"` are `false`; a declared Boolean with no attribute is `false`
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
- **Flexible parameter order**: Method can be omitted (defaults to GET), callback can be last parameter
- **Error handling**: When using callbacks, errors are passed to `Fez.onError` with kind 'fetch'
- **Logging**: Enable with `Fez.LOG = true` to see cache hits and live fetches

### Custom Error Handler

```js
// Override default error handler
Fez.onError = (kind, error) => {
  if (kind === 'fetch') {
    console.error('Fetch failed:', error);
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
Back/Forward restores recently visited pages from a cache without a request (`Fez.pjax.config.history_max` pages); pages not in the cache are fetched.

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
| `scroll` | `true` to smooth scroll to the top after the swap, `false` to keep the position |

Unknown keys are reported through `Fez.pjax.error` as `unknown load option: <key>` and dropped.
A target that does not exist or has no `id` is reported and nothing is requested.
The object you pass is copied, never written to.

### Defaults

A default applies only when the option is `undefined`, so an explicit value always wins.

| | `Fez.load` | `Fez.refresh` |
|---|---|---|
| request cache | normal | `cache-control: no-cache` |
| same URL + node within 2s | skipped (double-click guard) | always sent |
| `scroll` | `true` for a full swap, `false` when a node or region is swapped | `false` |
| `history` | `false` when the current URL is fetched into a node or region, otherwise `'push'` (a replace when the URL does not change) | same as `Fez.load` |

### Result

Both return a Promise that never rejects, so a fire-and-forget call is always safe.
It resolves with the `pjax:render` detail - `{ from, to, status, error, duration, mode, opts }` - or `null` when no request was sent (debounced, cancelled by `before()` or `pjax:start`, handed to a full browser navigation, or an invalid target).

```js
const detail = await Fez.load('/users')
if (detail?.error) {
  // 'status' | 'network' | 'timeout' | 'abort' | 'apply' | 'layout'
}
```

### Layout id

When the page has `<meta name="pjax-layout" content="ID">`, a full swap sends `x-pjax-layout: ID`.
The server may then answer with only `<title>` and the pjax container (lux `render_html` does).
A response must echo the same `x-pjax-layout` header; a missing or different one (other layout, new deploy) is loaded as a full page and the result carries `error: 'layout'`.

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
<a href="/users" class="no-pjax">                <!-- opt out, native navigation (also: direct) -->
<a href="/users" pjax-target="#panel">           <!-- swap only #panel -->
<button pjax-refresh="#panel">                   <!-- fresh copy of the current page into #panel -->
<a href="/del" pjax-confirm="Are you sure?">     <!-- confirm before navigating -->
<a href="/tab2" pjax-replace>                    <!-- replaceState instead of pushState -->
<form data-pjax="true">                          <!-- submit via pjax, full swap -->
<form data-pjax="#panel">                        <!-- submit via pjax into #panel -->
```

Override `Fez.pjax.confirm = (message, node) => ...` to use a custom dialog; returning a Promise defers navigation until it resolves.

### Events and hooks

```js
document.addEventListener('pjax:start', e => ...)   // request about to start; preventDefault() cancels it
document.addEventListener('pjax:render', e => ...)  // new content rendered; detail: from, to, status, error, duration, mode, opts

Fez.pjax.before = (href, opts) => true   // return false to cancel a navigation
Fez.pjax.after  = (href) => ...          // after a full page swap
Fez.pjax.error  = (msg) => ...           // route pjax errors into app toasts
```

Inside a fez component, `this.on('pjax:render', () => this.refresh())` is the usual pattern for data that must follow navigation.

Inline `<script>` tags in the response run after history is committed but before the new HTML is morphed in; tag a script with `pjax-delay` to defer it until after the swap.
Configuration lives on `Fez.pjax.config` (skip paths, no-scroll selectors, timeout, history cache size - see `src/fez/pjax/pjax.js`).

### Upgrading from window.Pjax

`fez refactor <dir>` lists every `Pjax.` call in `.fez`, `.js` and `.ts` files with its replacement; it never changes files.

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

Fez includes several built-in components available when you include `defaults.js`:

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

### fez-inline

Renders its children as a reactive template, without writing a component.
Expressions see `state`, `globalState` and `props`, and the node re-renders when any of them change - the easy way to drop a global value into static HTML:

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

- Component name and live demo (left side)
- Info/documentation block (right side)
- Buttons to log demo HTML and component source to console

See `pages_src/root/raw.html` for a minimal example.

## Global State Management

Fez includes a built-in global state manager that automatically tracks component subscriptions. It automatically tracks which components use which state variables and only updates exactly what's needed.

### How it Works

- Components access global state via `this.globalState` proxy
- Reading a value by key automatically subscribes the component to changes to that key.
- Setting a value notifies all subscribed components to that key: `onGlobalStateChange(key, value, oldValue)` fires right away.
- Only a key the last render read re-renders the component (the same rule as `this.state`); the render is batched into the next frame together with local state changes. A key read only outside render (in a click handler, in `init`) still fires `onGlobalStateChange`, but changing it does not re-render.
- `Object.keys(this.globalState)`, `{...this.globalState}` and `{@json globalState}` read every key; `delete this.globalState.x` deletes the key and notifies its readers.
- Components are automatically cleaned up when destroyed

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

Pub/sub is the wrong tool for commands (no return value, no error when nobody listens) and for shared state (a component mounted after the event misses it).
Most panels in a tool-style UI are shared-state readers; usually only one component is a command target.
A component's `this.subscribe` subscriptions survive a move (the node detached and re-inserted); only a destroyed component drops them.
