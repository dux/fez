# Fez - javascript DOM components framework (files ending in fez)

# Instructions for this local fez repo

- when you add new features, ensure related tests exists, demo and info in fez lib.
- use bun, not npm
- ignore ./dist folder in local search, all code is in ./src and demo is in ./demo

## Bundled Pjax navigation (since 0.6.0)

Fez ships the former `dux-pjax` package (ported to JS) in `src/fez/pjax/` and exposes it as `window.Pjax`.

- `pjax.js` - the Pjax class (created per `createPjax()` call so tests get fresh static state); `onclick.js` - link click delegate; `boot.js` - boot, called from `src/fez.js` behind the `fezPrimary` guard.
- Boot gating: `window.Pjax` is always set, but handlers (link hijack, popstate, `data-pjax` forms) bind only when the page has a `<pjax>` tag or `.pjax` class container; `Pjax.start()` for late-injected containers. If another lib already set `window.Pjax`, fez backs off.
- `morphInto` converts HTML strings to a DocumentFragment before `Fez.nodeMorph` - never hand it raw strings; nodeMorph's "unwrap single matching-tag root" heuristic would swallow a legitimate lone wrapper child.
- Components follow navigation via `this.on('pjax:render', () => this.refresh())`.
- Tests: `test/pjax-core.test.js`, `test/pjax-onclick.test.js`, `test/pjax-events.test.js` (shared env in `test/pjax-env.js`). Types in `fez.d.ts` (`PjaxStatic`).
- The old `~/dev/gems/dux-pjax` repo is deprecated reference only - changes happen here.

---

# Fez JS lib Quick Reference for AI Assistants (files ending in .fez or .html.fez)

## Writing New Components

If you are instructed to write a fez component, ALWAYS write it in `docs_src/root/fez/[name].fez`; `docs/fez` is generated output.
All documentation and demos go INSIDE the .fez file (no separate .html files) using `<info>` and `<demo>` blocks.

## CDN

```html
<script src="https://raw.githubusercontent.com/dux/fez/main/dist/fez.js"></script>

<!-- Load components with fez attribute (NOT type="fez" src="...") -->
<script fez="path/to/component.fez"></script>
```

## CLI Tools

```bash
# Print this reference (run `fez --help` for all commands, source path and repo)
fez agents
# Add a pointer to ./AGENTS.md / ./CLAUDE.md of a project so agents know to run `fez agents`
fez agents --init

# Compile and validate components - catches JS syntax errors and template issues
fez compile path/to/component.fez
fez compile path/to/one.fez path/to/two.fez
fez compile 'path/to/**/*.fez'

# Validate only the .fez template block with the Fez template compiler
fez template path/to/component.fez

# Print generated template function body when template compilation fails
fez compile --debug-template path/to/component.fez
fez template --debug path/to/component.fez

# Report legacy syntax and modernization candidates (never changes files)
fez refactor [path-or-glob]

# Index files as JSON, or open an interactive Playwright debugging REPL
fez index path/to/files
fez debug http://localhost:3333

# Initialize or build ./web_src/root into the configured target
fez static init
fez static
fez static dev
fez static doctor
```

`.fez` files use Fez's own template compiler (`src/fez/lib/template-compiler.js`), not the Svelte compiler. Use the Svelte compiler only for `.svelte` files.

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
4. **Style scope is declared on the tag, never inferred from the CSS.** `<style>` is component-scoped - the compiler wraps the **whole block**, always, no exceptions. `<style global>` is emitted verbatim, document-wide. A file may contain both. Inside `<style>`, root-level declarations style the generated outer wrapper node (the one with the `fez` class), *not* the first template child - so if the first element is `<nav>` and it needs `display: flex`, write `nav { display: flex; }`. Address the wrapper itself with `&` (`&:hover`, `& > div`). For a one-off rule that must escape the component, wrap its selector in `:global(...)` and it is hoisted to the global channel. `:fez` and `:host` are **not** valid in source and are compile errors.
5. **ALWAYS** initialize state in `init()`, put reactive/derived state in `beforeRender()`
6. **ALWAYS** use kebab-case component names (e.g., `user-profile`)
7. **NEVER** use `{#if}` blocks inside HTML attributes - use ternary operators `{condition ? 'value' : ''}` instead
8. **Attribute expressions** are automatically quoted - write `attr={value}` (quotes added automatically)
9. **ALWAYS** use lowercase with underscores for props (e.g., `fill_color`, `read_only`, `stroke_width`)
   * Declare a `PROPS` schema for any prop that is not a plain string (`PROPS = { count: { type: Number, default: 0 }, open: Boolean }`) - never `parseInt`/`=== 'true'` props by hand when a schema entry does it
10. **PREFER `onclick="fez.func({value})"`** for event handlers with inline template values - use function pointers only when passing complex data (objects, arrays)

## Component Structure

The `<script>` block has two zones:

1. **Module-level code** (BEFORE `class {}`) - imports, `Fez.head()` calls, shared variables. Like `<script context="module">` in Svelte.
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
      count: { type: Number, default: 0 },
      title: { type: String, default: 'Default' },
      open: Boolean,   // <my-tag open> -> true, missing -> false
    }

    init(props) {
      // runs BEFORE template render - props available, DOM refs are not
      // do not rewrite state, just add to it
      this.state.count = props.count   // already a Number (PROPS)
    }

    beforeRender() {
      // runs BEFORE every re-render - use for reactive computed state
      // (replacement for Svelte's $: reactive statements)
      this.state.fullName = `${this.state.first} ${this.state.last}`
      this.state.isValid = this.state.items.length > 0
    }

    onMount(props) {
      // runs AFTER template render - DOM is ready, fez:this refs work
      this.editor = new Editor({
        element: this.editorNode,
        extensions: [StarterKit],
      })
    }

    onDestroy() {
      // cleanup external resources
      this.editor?.destroy()
    }

    onRefresh(props) {
      // runs after onMount, and again whenever the parent re-renders and reuses this child
      // call this.refresh() here if the child should re-render in response
    }

    onWindowResize() {} // on Window resize
    onWindowScroll() {} // on window scroll

    // Custom methods
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

  /* single rule that must escape the component - hoisted to the global
     channel with the wrapper stripped. Use <style global> for more than
     a rule or two. */
  :global(.third-party-widget) {
    z-index: 10;
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
<button onclick="fez.increment()" name="{state.buttonName}">Count: {state.count}</button>
```

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
```

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

**IMPORTANT: NEVER use `{#if}` inside attributes! Use ternary operator instead:**

```html
<!-- WRONG -->
<div class="{#if state.active}active{/if}">

<!-- CORRECT -->
<div class={state.active ? 'active' : ''}>
<button disabled={state.loading ? 'disabled' : ''}>Submit</button>
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

**Use function pointers ONLY when passing complex data (objects, arrays):**

```html
<!-- Function pointers - only when passing objects/arrays from loops -->
<!-- Unquoted {..}: quoting it turns the arrow into a plain string attribute -->
{#each state.tasks as task, index}
<button onclick={() => editTask(task)}>Edit</button>
{/each}
```

Arrow functions are automatically transformed:

- `onclick={() => foo()}` becomes `onclick="fez.foo()"`
- `onclick={(e) => foo(e)}` becomes `onclick="fez.foo(event)"`
- Loop variables like `index`, `item`, `i` are evaluated at render time

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

## Special Attributes

All `fez:` attributes use namespace syntax. `fez-keep` also works (`fez:` is converted to `fez-` at compile time).

```html
<!-- Two-way binding -->
<input fez:bind="state.username" />

<!-- Element reference via this.myElement (auto-generates stable ID for DOM diffing) -->
<div fez:this="myElement">
  <!-- Preserve element across re-renders (wrap component in plain HTML element) -->
  <span fez:keep="child-{state.id}-{state.value}">
    <child-component />
  </span>
  <input fez:use="el => el.focus()" />
  <!-- DOM hook -->

  <!-- IMPORTANT: Use colon prefix for evaluated attributes (functions, objects, etc.) -->
  <ui-emoji :onselect="handleEmojiSelect">
    <!-- Pass function reference -->
    <my-component :config="{foo: 'bar'}">
      <!-- Pass object literal -->
      <user-card :user="state.currentUser">
        <!-- Pass state object -->
        <toggle :checked="state.isActive">
          <!-- Pass boolean -->

          <!-- Without colon, values are treated as strings -->
          <my-component title="Hello World">
            <!-- String value (no colon needed) --></my-component
          ></toggle
        ></user-card
      ></my-component
    ></ui-emoji
  >
</div>
```

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
- Use `props.name` to access props, NOT `this.prop('name')`
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
  A parent re-render still replaces the whole props object (and fires `onPropsChange`), so anything the component
  wrote is overwritten by the parent's value - when the component owns the data for good, seed state with
  `{ state: true }` below.

- **Props from HTML attributes are strings** unless declared in `PROPS`. Prefer the schema over hand-parsing:

  ```javascript
  PROPS = {
    name:    String,                                    // shorthand == { type: String }
    speed:   { type: Number, default: 50 },             // "50" -> 50, "abc" -> error + default
    open:    Boolean,                                   // <x open> -> true, "false"/"0" -> false, missing -> false
    size:    { type: String, default: 'md', enum: ['sm', 'md', 'lg'] },
    items:   { type: Array, default: () => [] },         // JSON string parsed, or pass :items="..."
    user:    { type: Object, required: true },          // missing -> Fez.onError('props', ...)
    on_pick: { type: Function },                        // must come via :on_pick="..."
    since:   { type: Date },
    tags:    { type: Array, state: true,                // seeds this.state.tags before init()
               default: (raw) => (raw || '').split(/\s*,\s*/) },   // tags="a, b" -> ['a', 'b']
  }
  ```

  - Types: `String`, `Number`, `Boolean`, `Array`, `Object`, `Function`, `Date`, or a custom `(raw, name) => value` function
  - Fields: `type`, `default` (value or fn), `state`, `required`, `enum`; order: transform -> coerce -> required -> enum -> default
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
  - Errors go to `Fez.onError('props', ...)`, never throw; bad value is dropped and `default` applies
  - Keys not in `PROPS` pass through as strings; `onPropsChange(name, value)` receives the coerced value
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

- **ALWAYS use `Fez.getFunction()` for handler props** (onclick, ping, onselect, etc.):
  Props can come as strings or functions, so always normalize them with `Fez.getFunction()`:
  `Fez.getFunction()` returns void empty function for empty strings and nulls.

  ```javascript
  init(props) {
    this.state.font_size = props.font_size || 24
    this.state.background_color = props.background_color || '#000'
    this.state.is_active = props.is_active !== undefined

    // ALWAYS wrap handler props with Fez.getFunction()
    // This handles both string and function values correctly
    this.onClickHandler = Fez.getFunction(props.onclick)
    this.pingHandler = Fez.getFunction(props.ping)
    this.onSelectHandler = Fez.getFunction(props.onselect)
  }

  handleClick() {
    // Safe to call - Fez.getFunction returns empty function if prop was undefined
    this.onClickHandler()
  }
  ```

- For dynamic prop changes, use `onPropsChange(name, value)` method
- Check prop existence: `if (props.is_loading !== undefined)`

### State Management

- Initialize ALL properties in `init()`
- Modify arrays/objects directly (they're deeply reactive)
- Use `beforeRender()` for reactive computed/derived state (replacement for Svelte's `$:` reactive statements) - runs before every re-render
- Use `onMount()` for updates that need mounted template
- Use `this.local` for non-reactive per-instance values such as external library instances, normalized handler props, cached measurements, and parsed config. Mutating `this.local` does not refresh the component, and Fez clears it after `onDestroy()`.
- **NEVER bind state to form input values** - state changes trigger full re-render. Use `fez:this` instead:

  ```html
  <!-- WRONG -->
  <input value="{state.name}" />
  <!-- CORRECT -->
  <input fez:this="nameInput" />
  ```

  ```javascript
  submit() {
    const name = this.nameInput.value  // read when needed
  }
  ```

- **NEVER assign props to state if they are not used in state itself** - keep them as `props.name`:

  ```javascript
  // WRONG - don't copy props to state if not needed
  init(props) {
    this.state.onclick = props.onclick  // Don't do this!
  }

  // CORRECT - keep handler props as props, use directly
  init(props) {
    this.local.onClickHandler = Fez.getFunction(props.onclick)
  }
  ```

- **Design toggleable views so close and open render visibly different HTML.** `fezRender` skips the morph when the new HTML hashes to the same value as the previous render (`src/fez/instance.js`, hash-skip), and rAF-batched state writes can collapse a `close()` + `open(sameThing)` pair into a single render whose output matches the last one — morph skipped, DOM stale. Use a `state.open` boolean + a stable root with `class:hidden={!state.open}` and `{#if state.open}` gating the body, so the closed render is `<div class="… hidden"></div>` and the open render emits the full subtree. **Do NOT** poke private fields like `this._fezHash = null` to force a morph, and **do NOT** sprinkle `data-tick={state.counter}` to force unique hashes — both are workarounds for a state design that doesn't differ enough.

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

### Performance

- Use throttled events: `this.on('scroll', callback, { throttle: 100 })`

#### Fez does not own the page - `this.state` is opt-in, not mandatory

A render rebuilds the component's whole template and morphs it, so the cost is proportional to the **template size**, not to how much actually changed.
That is a deliberate trade: one mental model that is correct and fast enough for ~99% of components.
It is **not** a ceiling.

Never conclude "this data set is too big for Fez".
Conclude "this one component should not use `this.state`".
Fez is a DOM node helper, not a page owner - the live DOM is always yours to write to directly, and dropping out of state and diffing for a single component costs you nothing elsewhere.

Three escape hatches, in order of how much of the reactive model you give up:

**1. Keep the template, protect one subtree with `fez:keep`**

The rest of the component stays reactive; the marked node is never touched by the differ.

```html
<h3>{state.title}</h3>
<div fez:keep="grid" fez:this="grid"></div>
```

```javascript
onMount() {
  this.cells = []
  for (const row of this.props.rows) this.grid.append(this.buildRow(row))
}

patch(i, value) {
  this.cells[i].textContent = value   // no render, no diff, no hash
}
```

**2. Plain instance fields instead of `this.state`**

Only `this.state` schedules a render. `this.rows = []` does not.
Use plain fields for anything you intend to paint by hand and keep `this.state` for the parts you actually want re-rendered.

**3. No template at all - the component is a pure controller**

Omit the template block entirely and `fezRender()` never runs (`instance.js` returns early when there is no template).
The tag's original children are left alone and `this.root` is yours.

```javascript
class {
  onMount() {
    this.cells = []
    const tbody = document.createElement('tbody')
    for (let i = 0; i < 10000; i++) tbody.append(this.buildRow(i))
    this.root.append(this.n('table', tbody))
  }

  patch(i, value) { this.cells[i].textContent = value }
}
```

10k rows build in roughly 9ms and a cell update is a plain `textContent` write - the same speed as vanilla JS, because it **is** vanilla JS.
You still keep lifecycle hooks, typed `PROPS`, scoped `<style>`, auto-cleanup, pub/sub and `globalState`.

Rule of thumb: reach for a hatch when a single component owns more than ~500 live nodes **and** updates them frequently.
Below that, use `this.state` and do not think about it.

### External DOM Libraries (Three.js, Charts, Video players, etc.)

When integrating libraries that create/manage their own DOM elements:

- **Use template markup normally** - define your container structure in the template
- **Get references with `this.find()`** - store element references in `onMount()`
- **NEVER use `this.state` for UI updates** - state changes trigger DOM diffing which doesn't handle external DOM well
- **Use direct DOM manipulation** to update UI elements:

```javascript
// Template is fine:
// <div class="container"></div>
// <div class="loading-overlay">Loading...</div>

onMount() {
  this.container = this.find('.container')
  this.overlay = this.find('.loading-overlay')

  // External library creates canvas inside container
  this.chart = new Chart(this.container)
}

hideLoading() {
  // CORRECT - direct DOM manipulation
  this.overlay.style.display = 'none'

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

// Global state subscriptions
Fez.state.subscribe('key', (value, oldValue) => {}) // subscribe to specific key
Fez.state.subscribe((key, value, oldValue) => {})   // subscribe to ALL changes
```

Components that read `this.globalState.key` get `onGlobalStateChange(key, value, oldValue)` synchronously on change and re-render on the next frame, batched with local `this.state` changes (one render per frame).
A component's own write during `init` or render does not schedule an extra render.

To show a global value in static HTML without writing a component, use `<fez-inline>{globalState.key}</fez-inline>`: children are compiled as the template, it re-renders on change and accepts `:state="{...}"` for local state.

### DOM / `addEventListener` listeners

For events fired on `document`, `window`, or arbitrary DOM nodes (custom `pjax:render`, `keydown`, `resize`, third-party `CustomEvent`s, etc.), `this.subscribe` does not apply — those go through native `addEventListener`. Use **`this.on`** — it binds `this`, guards on `isConnected`, and auto-removes on destroy.

```javascript
// CORRECT — this.on binds this, auto-removes on destroy
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
```

String-first target rule: events in `Fez.WINDOW_EVENTS` (`resize`, `scroll`, `beforeunload`, `hashchange`, `popstate`, `online`, `offline`, `message`, `storage`, `load`, `unload`, `pagehide`, `pageshow`, `orientationchange`, `error`) default to `window`. Everything else defaults to `document`. Pass `target` explicitly when in doubt; mutate `Fez.WINDOW_EVENTS` to customize.

- `handler` is invoked with `this = component` and the event arg
- Listener is removed automatically on destroy (no `onDestroy` boilerplate)
- Handler is skipped while `this.isConnected === false`
- Returns a disposer function for early unregister
- Each call adds its own listener — every component instance owns its own subscription
- Just mutate state in the handler — no need to call `this.refresh()`; the state assignment re-renders

```javascript
// WRONG — manual addEventListener leaks unless paired with removeEventListener,
// and `this.handler` from the prototype isn't bound when the DOM invokes it
onMount() {
  document.addEventListener('pjax:render', this.activateActiveNav)
}
```

**Why not just declare the method as an arrow class property and use `addEventListener` directly?** That works but: (1) you still need a manual `removeEventListener` in `onDestroy`, (2) arrow properties live on `this` rather than the prototype so you lose prototype introspection, and (3) there's no `isConnected` guard. `this.on` covers all three.

**`onRefresh` vs DOM listeners.** `onRefresh` only fires when a fez **parent** re-renders and preserves this child (see `src/fez/lib/fez-morph.js:onPreserve`). It does *not* fire when the component refreshes itself, and it does *not* fire from external DOM events. If your component lives outside any fez parent (mounted directly under plain HTML — a layout shell, a portal, a global menu), `onRefresh` will never fire after the initial mount. Hook the relevant DOM event with the pattern above instead.

### Component Isolation in Loops

Child components in loops are automatically preserved during parent re-renders. They only re-render when their props actually change:

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
- `fez:keep` on a fez component will throw a compile error

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
- Nameless singleton (`fez-control`): `MOUNT = true` alone. `GLOBAL = true` is a compile error.

## Component communication: pick the channel

Three channels exist; pick by the kind of traffic, not by habit.

| Traffic | Example | Use |
|---|---|---|
| Shared state many components render | selected animation, playback speed, theme | `this.globalState.anim = 'idle'` - readers auto-subscribe, late-mounted components see the current value |
| Command to one known service component | play, seek, reset camera | direct call: `Viewport.play('idle')` (`GLOBAL = 'Viewport'`) or `Fez('#viewport').play('idle')` - you get a return value, `await`, and a TypeError on a typo |
| Event whose consumers the sender must not know | `chain:finished`, `model:loaded` | `this.publish('chain:finished')` (nearest subscribing ancestor) or `Fez.publish(...)` (everyone) |

Pub/sub is the wrong tool for commands (no return value, no error when nobody listens) and for shared state (a component mounted after the event misses it).
Most panels in a tool-style UI are shared-state readers; usually only one component is a command target.

## Slot Unwrap

Use `<slot unwrap />` when children must be inserted without a wrapper div. By default, `<slot />` wraps children in a `<div class="fez-slot">`. With `unwrap`, the wrapper div is dissolved after filling, leaving children directly in the parent element.

**Important:** Components using `<slot unwrap />` cannot use `this.state` - state changes trigger re-renders which would lose the unwrapped slot content. Setting state will log a console error.

```html
<!-- Default slot: children wrapped in <div class="fez-slot"> -->
<slot />

<!-- Unwrap slot: wrapper dissolved after fill, children in parent -->
<slot unwrap />
```

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
- **Reaching for `:fez`, `:host`, or `body { }` to control scope** - none of them work any more; all three are compile errors in a `<style>` block. Scope is the tag: `<style>` scopes, `<style global>` does not. Use `&` for the wrapper node:
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
- Using string interpolation in onclick instead of arrow functions
- Direct DOM manipulation for simple reactive UI (use state instead) - BUT use direct DOM for external libraries (Three.js, charts, etc.) since DOM diffing doesn't handle them well
- Missing `init()` for state initialization
- **Putting non-render data in `state` or directly on `this`** - use `this.local` for non-reactive per-instance values like editor objects, normalized callbacks, measurements, timers, and parsed config. Keep module-level constants outside the component.
- Using `{#if}` blocks inside attributes (use ternary operators instead)
- Writing flat CSS instead of nested SCSS syntax
- Using `this.prop('name')` instead of `props.name` in `init()` and `onMount()`
- Forgetting to use `{index}` or arrow functions for loop variables in event handlers
- **Not using `Fez.getFunction()` for handler props** - props like `onclick`, `ping`, `onselect` can be strings or functions, always normalize them
- **Copying props to `this` or `state`** - use `props.style` directly in templates, not `this.style = props.style` which won't update
- **Using `this.` in template expressions** - templates render in a deferred context where `this` is not bound. Use `fez.` prefix or curly brace syntax instead:

  ```html
  <!-- WRONG - this is not available in template context -->
  <child-component :name="this.name">
    <!-- CORRECT - use curly braces to capture values at render time -->
    <child-component name="{name}" data="{state.items}">
      <!-- CORRECT - fez. prefix works (fez is bound to this in templates) -->
      <child-component :data="fez.state.items"></child-component></child-component
  ></child-component>
  ```

  Note: `:attr="expr"` parks the value in the parent's render slots (`fezGlobals`, see `./src/fez/lib/render-slots.js`) and the HTML carries only a positional key.
  Slots are reset on every parent render, and a parent render whose HTML is unchanged is still morphed when a slot now holds a different object, so children get `onPropsChange`.

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
Fez.head({ css: 'https://cdn.example.com/styles.css' });
```

## Utility Shortcuts

```javascript
this.find('.selector'); // Scoped querySelector
this.setTimeout(fn, 1000); // Auto-cleaned timeout
this.setInterval(fn, 1000); // Auto-cleaned interval
Fez.fetch('/data'); // Built-in cached fetch
this.local.editor = editor; // Non-reactive per-instance storage
this.formData(); // Get form values
this.childNodes(); // Get child elements as array
this.childNodes(fn); // Get children mapped with function
this.childObjects(); // Get children as objects: { html, ROOT, ...attrs }

// localStorage with JSON serialization (preserves types)
Fez.localStorage.set('count', 42);
Fez.localStorage.get('count'); // 42 (number)
Fez.localStorage.get('missing', 'default'); // fallback value

// Resolve a function from a string or function reference
Fez.getFunction(this.props.onclick);
Fez.getFunction('alert("Hi")', window);

// to check if value is true, that comes from props
Fez.isTrue(value);

// Short type identifier
Fez.typeof(data); // Returns: 'o' object, 'f' function, 's' string,
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
```

## When Unsure

- Prefer Fez utilities over vanilla JS
- Use `this.globalState` for cross-component data
- Access elements via `fez:this` instead of querySelector
- Put DOM-dependent logic in `onMount()` not `init()`
- Prefer simple `fez.` prefix for handlers: `onclick="fez.method()"`

---

## Legacy Syntax (Still Supported)

The original double-brace syntax `{{ }}` is still supported for backward compatibility:

```html
<!-- Legacy expressions -->
{{ state.name }}

<!-- Legacy conditionals -->
{{if state.show}}...{{else}}...{{/if}}

<!-- Legacy loops -->
{{for item in state.items}}...{{/for}}

<!-- Legacy event handlers -->
<button onclick="fez.remove({{index}})">Remove</button>
```

New components should use the Svelte-like syntax documented above.
