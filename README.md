<img src="demo/fez.png" align="right" width="110" />

# FEZ - Custom DOM Elements

Check the Demo site https://dux.github.io/fez/

FEZ is a small library (49KB minified, ~18KB gzipped) that allows writing of [Custom DOM elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Components/Using_custom_elements) in a clean and easy-to-understand way.

It uses

- [Goober](https://goober.js.org/) to enable runtime SCSS (similar to styled components)
- Custom component-aware DOM differ to morph DOM from one state to another (as React or Stimulus/Turbo does it), with hash-based render skipping for zero-cost no-op renders

It uses minimal abstraction. You will learn to use it in 15 minutes, just look at examples, it includes all you need to know.

## How to install

`<script src="https://dux.github.io/fez/dist/fez.js"></script>`

## CLI Tools

Fez provides command-line tools for development:

```bash
# Compile and validate a Fez component
bunx @dinoreic/fez compile demo/fez/ui-counter.fez

# Validate only the template block
bunx @dinoreic/fez template demo/fez/ui-counter.fez
```

Or install globally:

```bash
bun add -g @dinoreic/fez
fez compile my-component.fez
fez template my-component.fez
```

`fez compile` validates both JavaScript and Fez template syntax. Use `--debug-template` when a template compile error needs the generated render function:

```bash
fez compile --debug-template my-component.fez
fez template --debug my-component.fez
```

`.fez` files are compiled with Fez's own template compiler (`src/fez/lib/template-compiler.js`). The Svelte compiler is only for `.svelte` files.

## Why Fez is Simpler

| Concept           | React                    | Svelte 5        | Vue 3                  | **Fez**            |
| ----------------- | ------------------------ | --------------- | ---------------------- | ------------------ |
| State             | `useState`, `useReducer` | `$state` rune   | `ref`, `reactive`      | `this.state.x = y` |
| Computed          | `useMemo`                | `$derived` rune | `computed`             | Just use a method  |
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
    // computed value - just a getter
    return this.state.count * 2;
  }
}
```

The whole mental model:

1. Change `this.state` -> component re-renders
2. Component-aware differ updates only what changed (child components preserved automatically)
3. Hash-based skip avoids DOM work entirely when template output is identical

## Little more details

Uses DOM as a source of truth and tries to be as close to vanilla JS as possible. There is nothing to learn or "fight", or overload or "monkey patch" or anything. It just works.

Although fastest, Modifying DOM state directly in React / Vue / etc. is considered an anti-pattern. For `Fez` this is just fine if you want to do it. `Fez` basically modifies DOM, you just have a few helpers to help you do it.

It replaces modern JS frameworks by using native Autonomous Custom Elements to create new HTML tags. This has been supported for years in [all major browsers](https://caniuse.com/custom-elementsv1).

This article, [Web Components Will Replace Your Frontend Framework](https://www.dannymoerkerke.com/blog/web-components-will-replace-your-frontend-framework/), is from 2019. Join the future, ditch React, Angular and other never defined, always "evolving" monstrosities. Vanilla is the way :)

There is no some "internal state" that is by some magic reflected to DOM. No! All methods Fez use to manipulate DOM are just helpers around native DOM interface. Work on DOM raw, use built in [node builder](https://github.com/dux/fez/blob/main/src/lib/n.js) or full template mapping with DOM morphing.

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
2. **Debounced to next `requestAnimationFrame`** via `fezNextTick` - multiple state changes in the same tick are batched into one render
3. **`beforeRender()`** runs - compute derived/reactive state
4. **Template function** executes, producing an HTML string
5. **FNV-1 hash check** - the rendered string is hashed and compared to the previous render. If identical, the entire morph is skipped (zero-cost no-op render)
6. **Parse to detached DOM** - the string is set as `innerHTML` on a fresh detached element
7. **`fezMorph()`** runs - walks both trees and mutates the live DOM to match
8. **Post-processing** - `fez-this`, `fez-bind`, `fez-use` attributes are resolved, input values restored

### Element Matching

The differ uses priority-based key resolution when matching old (live) and new (template) children. Keys only need to be unique among siblings - they are scoped to the parent's direct children, not global.

| Priority    | Key               | Source                                            |
| ----------- | ----------------- | ------------------------------------------------- |
| 1 (highest) | `fez-uid-{UID}`   | Live fez component instances                      |
| 2           | `keep-{value}`    | `fez-keep` attribute                              |
| 3           | `key-{value}`     | Manual or auto-injected `key` attribute           |
| 4           | `id-{value}`      | `id` attribute                                    |
| 5 (lowest)  | scored soft match | Tag name + CSS class similarity + attribute count |

You can always use a manual `key` attribute for exact matching:

```html
{#each state.items as item}
<div key="{item.id}">{item.name}</div>
{/each}
```

At compile time, `autoInjectKeys()` also adds sequential `key` attributes to every element that doesn't already have one. Inside loops, keys automatically include the loop index variable (e.g. `key="3-{i}"`), so most cases work without manual keys.

Elements that don't match by key fall through to **scored soft matching** - a greedy algorithm that pairs unmatched old/new elements by tag name similarity, shared CSS classes, and attribute count. Fez components and `fez-keep` elements are excluded from soft matching - they only match by key.

### Two-Level Skip Optimization

Fez avoids unnecessary work at two levels:

**1. Parent level - hash check skips entire morph**

If a component's rendered HTML string hasn't changed (same FNV-1 hash), the morph is skipped entirely. No DOM tree walking, no diffing, no mutations. This makes re-renders triggered by unrelated global state changes essentially free.

**2. Child level - fez components are never morphed**

When the parent does re-render and the morph runs, child fez component nodes are **preserved as-is**. The differ sees the live component instance, matches it by UID, and only repositions it if needed (via `insertBefore`). No attribute sync, no subtree diffing. The child's internal DOM is completely untouched.

A child component only re-renders when:

- Its own `this.state` changes
- New props are passed, triggering `onPropsChange(name, value)`

This means a parent with 100 child components in a loop can re-render its own template without touching any of those children - they continue operating with their own state and DOM intact.

### Attribute and Class Syncing

- **Class changes** use `classList.add/remove` instead of `setAttribute` - this preserves CSS transitions and animations
- **Inline styles** set via JS (e.g. `element.style.left = '100px'`) are preserved when the template doesn't set a `style` attribute
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
```

**Loop behavior:**

- **null/undefined = empty list** - no errors, renders nothing (or `:else` block if present)
- **2-param syntax** (`key, val` or `item, idx`) works for both arrays and objects:
  - Arrays: first = value, second = index
  - Objects: first = key, second = value
- **Brackets optional** - `{#for key, val in obj}` same as `{#for [key, val] in obj}`

**Note on passing props:** Use `:prop="expr"` syntax to pass JavaScript objects, arrays, or functions as props. Regular `prop={expr}` will stringify the value.

**Component Isolation:** Child components in loops are automatically preserved during parent re-renders. They only re-render when their props actually change - making loops with many items very efficient.

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

### Arrow Function Event Handlers

Use arrow functions for clean event handling with automatic loop variable interpolation:

```html
<!-- Simple handler -->
<button onclick="{() => handleClick()}">Click me</button>

<!-- With event parameter -->
<button onclick="{(e) => handleClick(e)}">Click me</button>

<!-- Inside loops - index is automatically interpolated -->
{#each state.tasks as task, index}
<button onclick="{() => removeTask(index)}">Remove #{index}</button>
<button onclick="{(e) => editTask(index, e)}">Edit</button>
{/each}
```

Arrow functions in event attributes are automatically transformed:

- `{() => foo()}` becomes `onclick="fez.foo()"`
- `{(e) => foo(e)}` becomes `onclick="fez.foo(event)"`
- Loop variables like `index` are evaluated at render time

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

## Example: Counter Component

Here's a simple counter component that demonstrates Fez's core features:

```html
<!-- Define a counter component in ex-counter.fez -->
<script>
  class {
    // called when Fez node is connected to DOM
    init() {
      this.MAX = 6
      this.state.count = 0
    }

    isMax() {
      return this.state.count >= this.MAX
    }

    // if state is changed, template is re-rendered
    more() {
      this.state.count += this.isMax() ? 0 : 1
    }
  }
</script>

<style>
  /* All styles are locally scoped to the component */
  /* Root-level styles apply to the component root node */
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

<button onclick="{() => state.count -= 1}" disabled="{state.count" ="" ="1}">-</button>

<span> {state.count} </span>

<button onclick="{() => more()}" disabled="{isMax()}">+</button>
{#if state.count > 0}
<span>&mdash;</span>
{#if state.count == MAX} MAX {:else} {#if state.count % 2} odd {:else} even {/if} {/if} {/if}
```

To use this component in your HTML:

```html
<!-- Load Fez library -->
<script src="https://dux.github.io/fez/dist/fez.js"></script>

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
- **Scoped styling**: All styles locally scoped to the component, root-level styles apply to root node
- **Component lifecycle**: `init()` method called when component mounts

## What can it do and why is it great?

### Core Features

- **Native Custom Elements** - Creates and defines Custom HTML tags using the native browser interface for maximum performance
- **Server-Side Friendly** - Works seamlessly with server-generated HTML, any routing library, and progressive enhancement strategies
- **Semantic HTML Output** - Transforms custom elements to standard HTML nodes (e.g., `<ui-button>` → `<button class="fez fez-button">`), making components fully stylable with CSS
- **Single-File Components** - Define CSS, HTML, and JavaScript in one file, no build step required
- **No Framework Magic** - Plain vanilla JS classes with clear, documented methods. No hooks, runes, or complex abstractions
- **Runtime SCSS** - Style components using SCSS syntax via [Goober](https://goober.js.org/), compiled at runtime
- **Smart Memory Management** - MutationObserver automatically cleans up disconnected components and their resources (intervals, event listeners, subscriptions)

### Advanced Templating & Styling

- **Fez Template Compiler** - Single brace syntax (`{ }`), control flow (`{#if}`, `{#unless}`, `{#for}`, `{#each}`, `{#await}`), and block templates
- **Conditional Class Directives** - Svelte-style `class:name={condition}` for toggling CSS classes without ternary operators
- **Arrow Function Handlers** - Clean event syntax with automatic loop variable interpolation
- **Reactive State Management** - Built-in reactive `state` object automatically triggers re-renders on property changes
- **Component-Aware DOM Diffing** - Custom differ that understands Fez component boundaries, preserves element state and CSS animations, with hash-based render skipping for zero-cost no-op renders
- **Smart Component Isolation** - Child components are preserved during parent re-renders; only re-render when their props actually change
- **Preserve DOM Elements** - Use `fez:keep="unique-key"` attribute to preserve DOM elements across re-renders (useful for child components, animations, form inputs, or stateful elements)
- **Auto-ID for Form Inputs** - Elements with `fez:this` automatically get stable IDs, helping the differ preserve input state across re-renders
- **Import Maps** - Use `Fez.head({importmap: {...}})` to map bare import specifiers to full URLs, avoiding duplicate library instances
- **Style Macros** - Define custom CSS shortcuts like `Fez.cssMixin('mobile', '@media (max-width: 768px)')` and use as `:mobile { ... }`
- **Locally Scoped Styles** - All `<style>` content is locally scoped to the component. Root-level styles apply to the component root node. For global styles wrap in `body { ... }`, use `:fez { ... }` inside body block to reference the component root

### Developer Experience

- **Built-in Utilities** - Helpful methods like `formData()`, `setInterval()` (auto-cleanup), `onWindowResize()`, and `fezNextTick()`
- **Two-Way Data Binding** - Use `fez:bind` directive for automatic form synchronization
- **Advanced Slot System** - Full `<slot />` support with event listener preservation
- **Publish/Subscribe** - Built-in pub/sub system for component communication
- **Global State Management** - Automatic subscription-based global state with `this.globalState` proxy
- **Dynamic Component Loading** - Load components from URLs with `<template fez="path/to/component.fez">`
- **Auto HTML Correction** - Fixes invalid self-closing tags (`<ui-icon name="gear" />` → `<ui-icon name="gear"></ui-icon>`)

### Performance & Integration

- **Hash-Based Render Skipping** - FNV-1 hash of rendered HTML skips the entire morph when nothing changed (zero-cost no-op renders)
- **Batched State Updates** - Multiple state changes in the same tick are debounced into a single `requestAnimationFrame` render
- **Component Isolation** - Child fez components are never morphed during parent re-renders, only repositioned. They re-render only when their own state or props change
- **Priority-Based Element Matching** - Keyed matching (fez-keep > key > id) with scored soft-match fallback preserves DOM identity across renders
- **CSS Animation Preservation** - Class syncing uses `classList.add/remove`, not `setAttribute`, so transitions and animations survive re-renders
- **Active Input Protection** - `value` and `checked` are not synced on the focused input, preventing disruption during typing
- **Built-in Fetch with Caching** - `Fez.fetch()` includes automatic response caching and JSON/FormData handling
- **Rich Lifecycle Hooks** - `init`, `onMount`, `beforeRender`, `afterRender`, `onDestroy`, `onPropsChange`, `onStateChange`, `onGlobalStateChange`
- **Development Mode** - Enable detailed logging with `Fez.DEV = true`

### Why It's Great

- **Zero Build Step** - Just include the script and start coding
- **49KB Minified (~18KB gzipped)** - Tiny footprint with powerful features
- **Framework Agnostic** - Use alongside React, Vue, or any other framework
- **Progressive Enhancement** - Perfect for modernizing legacy applications one component at a time
- **Native Performance** - Leverages browser's native Custom Elements API
- **Intuitive API** - If you know vanilla JavaScript, you already know Fez

## Full available interface

### Fez Static Methods

```js
Fez('#foo')                  // find fez node with id="foo"
Fez('ui-tabs', this)         // find first parent node ui-tabs
Fez('ui-tabs', (fez)=> ... ) // loop over all ui-tabs nodes

// define custom DOM node name -> <foo-bar>...
Fez('foo-bar', class {
  // set element node name, set as property or method, defaults to DIV
  // why? because Fez renames custom dom nodes to regular HTML nodes
  NAME = 'span'
  NAME(node) { ... }
  // alternative: static nodeName = 'span'

  // set element style, set as property or method
  CSS = `scss string... `

  // define static HTML. calling `this.fezRender()` (no arguments) will refresh current node.
  // if you pair it with `fezReactiveStore()`, to auto update on props change, you will have Svelte or Vue style reactive behaviour.
  HTML = `...`

  // Make it globally accessible as `window.Dialog`
  // The component is automatically appended to the document body as a singleton. See `demo/fez/ui-dialog.fez` for a complete example.
  GLOBAL = 'Dialog'
  GLOBAL = true // just append node to document, do not create window reference

  // called when fez element is connected to dom, before first render
  // here you still have your slot available in this.root
  init(props) { ... }

  // execute after init and first render
  onMount() { ... }

  // execute before or after every render
  beforeRender() { ... }
  afterRender() { ... }

  // if you want to monitor new or changed node attributes
  // monitors all original node attributes
  // <ui-icon name="home" color="red" />
  onPropsChange(attrName, attrValue) { ... }

  // called when local component state changes
  onStateChange(key, value, oldValue) { ... }

  // called when global state changes (only if component uses key in question that key)
  onGlobalStateChange(key, value) { ... }

  // called when component is destroyed
  onDestroy() { ... }

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

  // node attributes, converted to properties
  this.props

  // gets single node attribute or property
  this.prop('onclick')

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

  // this.state has fezReactiveStore() attached by default. any change will trigger this.fezRender()
  this.state.foo = 123

  // generic window event handler with automatic cleanup
  // eventName: 'resize', 'scroll', 'mousemove', etc.
  // delay: throttle delay in ms (default: 200ms)
  this.on(eventName, func, delay)

  // window resize event with cleanup (shorthand for this.on('resize', func, delay))
  // runs immediately on init and then throttled
  this.onWindowResize(func, delay)

  // window scroll event with cleanup (shorthand for this.on('scroll', func, delay))
  // runs immediately on init and then throttled
  this.onWindowScroll(func, delay)

  // requestAnimationFrame wrapper with deduplication
  this.fezNextTick(func, name)

  // get unique ID for root node, set one if needed
  this.rootId()

  // get/set attributes on root node
  this.attr(name, value)

  // dissolves child nodes or given node into parent
  this.dissolve()

  // automatic form submission handling if there is FORM as parent or child node
  this.onSubmit(formData) { ... }

  // render template and attach result dom to root. uses component-aware DOM differ
  this.fezRender()
  this.fezRender(this.find('.body'), someHtmlTemplate) // you can render to another root too
})

/* Utility methods */

// define custom style macro
// Fez.cssMixin('mobile', '@media (max-width:  768px)')
// :mobile { ... } -> @media (max-width:  768px) { ... }
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

// get generated css class name, from scss source string
Fez.css(text)

// get generated css class name without global attachment
Fez.cssClass(text)

// display information about registered components in console
Fez.info()

// inspect Fez element, dumps props/state/template info to console
Fez.log(nodeOrSelector)

// Dev helper: press Cmd/Ctrl + E to toggle overlays highlighting each component on the page.
// Click a label to call Fez.log for that element automatically.

// low-level DOM morphing function
Fez.morphdom(target, newNode, opts)

// HTML escaping utility
Fez.htmlEscape(text)

// create HTML tags with encoded props
Fez.tag(tag, opts, html)

// execute function until it returns true
Fez.untilTrue(func, pingRate)

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

// resolve and execute a function from string or function reference
// useful for event handlers that can be either functions or strings
// Fez.resolveFunction('alert("hi")', element) - creates function and calls with element as this
// Fez.resolveFunction(myFunc, element) - calls myFunc with element as this
Fez.resolveFunction(pointer, context)

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
Fez.head(config, callback)
```

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
Fez.head({ fez: './demo/components.txt' }, () => {
  console.log('All components loaded!');
});
```

**Path resolution:**

- Paths without `/` prefix are relative to the txt file location
- `.fez` extension is added automatically if not present
- Paths starting with `/` are absolute from root

Example with `./demo/fez.txt`:

```
ui-button          # loads ./demo/ui-button.fez
forms/input        # loads ./demo/forms/input.fez
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

<!-- pass JSON template via data-json-template -->
<script type="text/template">
  {...}
</script>
<foo-bar data-json-template="true"></foo-bar>
```

## Component structure

All parts are optional

```html
<!-- Head elements support (inline only in XML tags) -->
<xmp tag="some-tag">
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

  <script>
    class {
      init(props) { ... }     // when fez node is initialized, before template render
      onMount(props) { ... }  // called after first template render
    }
  </script>
  <script> // class can be omitted if only functions are passed
    init(props) { ... }
  </script>

  <style>
    /* All styles are locally scoped to the component */
    /* Root-level styles apply to the component root node */
    color: red;
    padding: 10px;

    .child { font-weight: bold; }
  </style>
  <style>
    /* For global styles, wrap in body { ... } */
    /* Use :fez { ... } inside body block to reference the component root */
    body {
      .some-global-class { color: blue; }
      :fez { border: 1px solid red; }
    }
  </style>

  <div> ... <!-- any other html after head, script or style is considered template-->
    <!-- All fez: attributes use namespace syntax (fez:keep, fez:this, fez:bind, fez:use, fez:class) -->
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

    <!-- Block definitions -->
    {@block image}
      <img src={props.src} />
    {/block}
    {@block:image} <!-- Use the block -->

    {@html data} <!-- unescaped HTML -->
    {@json data} <!-- JSON dump in PRE.json tag -->

    <!-- fez:this will link DOM node to object property (inspired by Svelte) -->
    <!-- links to -> this.listRoot -->
    <!-- also auto-generates stable id="fez-{UID}-listRoot" for stable DOM diffing -->
    <ul fez:this="listRoot">

    <!-- when node is added to dom fez:use will call object function by name, and pass current node -->
    <!-- this.animate(node) -->
    <li fez:use="animate">

    <!-- fez:bind for two-way data binding on form elements -->
    <input type="text" fez:bind="state.username" />

    <!--
      fez:class for adding classes with optional delay.
      class will be added to SPAN element, 100ms after dom mount (to trigger animations)
    -->
    <span fez:class="active:100">Delayed class</span>

    <!-- preserve element across re-renders (recreates only when key changes) -->
    <p fez:keep="unique-key">...</p>

    <!-- child components in loops - wrap in plain HTML element with fez:keep -->
    <span fez:keep="star-{i}-{rating}">
      <ui-star fill={fill} />
    </span>

    <!-- :attribute for evaluated attributes (converts to JSON) -->
    <div :data-config="state.config"></div>
  </div>
</xmp>
```

### how to call custom FEZ node from the outside, anywhere in HTML

Inside `init()`, you have pointer to `this`. Pass it anywhere you need, even store in window.

Example: Dialog controller

```html
<ui-dialog id="main-dialog"></ui-dialog>
```

```js
Fez('ui-dialog', class {
  init() {
    // makes dialog globally available
    window.Dialog = this
  }

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

Fez includes a built-in fetch wrapper with automatic JSON parsing and session-based caching:

### Basic Usage

```js
// GET request with promise
const data = await Fez.fetch('https://api.example.com/data');

// GET request with callback, does not create promise
Fez.fetch('https://api.example.com/data', (data) => {
  console.log(data);
});

// POST request
const result = await Fez.fetch('POST', 'https://api.example.com/data', {
  key: 'value',
});
```

### Features

- **Automatic JSON parsing**: Response is automatically parsed if Content-Type is application/json
- **Session caching**: All requests are cached in memory until page refresh
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

## Default Components

Fez includes several built-in components available when you include `defaults.js`:

### fez-component

Dynamically includes a Fez component by name:

```html
<fez-component name="some-node" :props="fez.props"></fez-component>
```

### fez-include

Loads remote HTML content via URL:

```html
<fez-include src="./demo/fez/ui-slider.html"></fez-include>
```

### fez-demo

Renders all components with their demos. Perfect for component documentation pages:

```html
<!-- Default: loads from ./demo/fez.txt -->
<fez-demo></fez-demo>

<!-- Custom component list -->
<fez-demo src="./my-components.txt"></fez-demo>
```

The component loads all components listed in the txt file and displays:

- Component name and live demo (left side)
- Info/documentation block (right side)
- Buttons to log demo HTML and component source to console

See `demo/raw.html` for a minimal example.

## Global State Management

Fez includes a built-in global state manager that automatically tracks component subscriptions. It automatically tracks which components use which state variables and only updates exactly what's needed.

### How it Works

- Components access global state via `this.globalState` proxy
- Reading a value by key automatically subscribes the component to changes to that key.
- Setting a value notifies all subscribed components to that key.
- Components are automatically cleaned up when disconnected

### Basic Usage

```js
class Counter extends FezBase {
  increment() {
    // Setting global state - all listeners will be notified
    this.globalState.count = (this.globalState.count || 0) + 1;
  }

  render() {
    // Reading global state - automatically subscribes this component
    return `<button onclick="fez.increment()">
      Count: ${this.globalState.count || 0}
    </button>`;
  }
}
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

// Subscribe to ALL state changes
Fez.state.subscribe((key, value, oldValue) => {
  console.log(`${key} changed to ${value}`);
});

// Iterate over all components listening to a key
Fez.state.forEach('count', (component) => {
  console.log(`${component.fezName} is listening to count`);
});
```

### Optional Change Handler

Components can define an `onGlobalStateChange` method for custom handling:

```js
class MyComponent extends FezBase {
  onGlobalStateChange(key, value) {
    console.log(`Global state "${key}" changed to:`, value);
    // Custom logic instead of automatic render
    if (key === 'theme') {
      this.updateTheme(value);
    }
  }

  render() {
    // Still subscribes by reading the value
    return `<div class="${this.globalState.theme || 'light'}">...</div>`;
  }
}
```

### Real Example: Language Switching

Control global state from outside Fez components:

```js
// From anywhere in your app (vanilla JS, other frameworks, etc.)
Fez.state.set('language', 'en');

// All components using this.globalState.language will automatically re-render
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

```js
// Multiple counter components sharing max count
class Counter extends FezBase {
  init(props) {
    this.state.count = parseInt(props.start || 0);
  }

  beforeRender() {
    // All counters share and update the global max
    this.globalState.maxCount ||= 0;

    // Find max across all counter instances
    let max = 0;
    Fez.state.forEach('maxCount', (fez) => {
      if (fez.state?.count > max) {
        max = fez.state.count;
      }
    });

    this.globalState.maxCount = max;
  }

  render() {
    return `
      <button onclick="fez.state.count++">+</button>
      <span>Count: ${this.state.count}</span>
      <span>(Global max: ${this.globalState.maxCount})</span>
    `;
  }
}
```

---

## Legacy Template Syntax

The original double-brace syntax `{{ }}` is still fully supported for backward compatibility. New projects should use the Svelte-like single-brace syntax documented above.

### Legacy Syntax Reference

```html
<!-- Expressions -->
{{ state.name }} {{ state.active ? 'yes' : 'no' }}

<!-- Conditionals -->
{{if state.show}}...{{/if}} {{if state.show}}...{{else}}...{{/if}} {{unless
state.hidden}}...{{/unless}}

<!-- Loops -->
{{for item in state.items}}...{{/for}} {{each state.items as item, index}}...{{/each}}

<!-- Raw HTML and JSON -->
{{raw state.htmlContent}} {{json state.data}}

<!-- Event handlers (string interpolation) -->
<button onclick="fez.remove({{index}})">Remove</button>
```

The legacy syntax uses `[[ ]]` as an alternative to `{{ }}` for compatibility with Go templates and other templating engines.

### Migration

To migrate from legacy to Svelte-like syntax:

| Legacy                     | Svelte-like              |
| -------------------------- | ------------------------ |
| `{{ expr }}`               | `{expr}`                 |
| `{{if cond}}`              | `{#if cond}`             |
| `{{else}}`                 | `{:else}`                |
| `{{/if}}`                  | `{/if}`                  |
| `{{for x in list}}`        | `{#for x in list}`       |
| `{{each list as x}}`       | `{#each list as x}`      |
| `{{raw html}}`             | `{@html html}`           |
| `onclick="fez.foo({{i}})"` | `onclick={() => foo(i)}` |
