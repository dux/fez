# Fez JS lib Quick Reference for AI Assistants

## CDN

```html
<script src="https://dux.github.io/fez/dist/fez.js"></script>

<!-- Load components with fez attribute (NOT type="fez" src="...") -->
<script fez="path/to/component.fez"></script>
```

## CLI Tools

```bash
# Compile and validate components - catches JS syntax errors and template issues
bunx fez-compile path/to/component.fez
```

## Core Rules for Claude

1. **ALWAYS** use Fez-specific Svelte-like syntax (NO React/Vue conventions)
2. **NEVER** use hooks - `this.state` replaces useState/useEffect
3. **ALWAYS** scope styles with `:fez` selector and use nested SCSS-style syntax
4. **ALWAYS** initialize state in `init()`
5. **ALWAYS** use kebab-case component names (e.g., `user-profile`)
6. **NEVER** use `{#if}` blocks inside HTML attributes - use ternary operators `{condition ? 'value' : ''}` instead
7. **Attribute expressions** are automatically quoted - write `attr={value}` (quotes added automatically)
8. **ALWAYS** use lowercase with underscores for props (e.g., `fill_color`, `read_only`, `stroke_width`)
9. **PREFER `onclick="fez.func({value})"`** for event handlers with inline template values - use function pointers only when passing complex data (objects, arrays)

## Component Structure

```html
<!-- Optional: Documentation shown in demo pages -->
<info>
  <ul>
    <li>Component description</li>
    <li>Props: <code>name</code>, <code>value</code></li>
  </ul>
</info>

<!-- Optional: Example usage shown in demo pages -->
<demo>
  <my-component name="example"></my-component>
</demo>

<script>
  // Import map: declare once, use bare specifiers in imports below
  Fez.head({ importmap: {
    'tiptap': 'https://esm.sh/@tiptap/core@2',
    'tiptap/': 'https://esm.sh/@tiptap/',
  }})

  import { Editor } from 'tiptap'
  import StarterKit from 'tiptap/starter-kit@2'

  // Or load scripts/styles dynamically
  Fez.head({css: 'https://cdn.example.com/styles.css'})

  class {
    // FAST = true — sync render, prevents flicker.
    // Do NOT use if component reads innerHTML or slot content in init().
    FAST = true

    init(props) {
      // runs BEFORE template render — props available, DOM refs are not
      // do not rewrite state, just add to it
      this.state.count = props.count || 0
      this.state.title = props.title || 'Default'
    }

    onMount(props) {
      // runs AFTER template render — DOM is ready, fez:this refs work
      this.editor = new Editor({
        element: this.editorNode,
        extensions: [StarterKit],
      })
    }

    onDestroy() {
      // cleanup external resources
      this.editor?.destroy()
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
  /* ALWAYS put ALL styles inside :fez — never write global/body styles */
  :fez {
    /* styles on component root element */
    padding: 20px;

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

    .card {
      border: 1px solid #ddd;

      .header {
        font-size: 18px;

        h3 {
          margin: 0;
        }
      }
    }
  }
</style>

<!-- Template (Svelte-like syntax) -->
<button onclick="fez.increment()" name="{state.buttonName}">
  Count: {state.count}
</button>
```

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
{#if state.isActive}
<div>Active</div>
{:else}
<div>Inactive</div>
{/if}

<!-- With else if -->
{#if state.status === 'loading'}
<span>Loading...</span>
{:else if state.status === 'error'}
<span>Error!</span>
{:else}
<span>Ready</span>
{/if}

<!-- Unless (opposite of if) -->
{#unless state.items.length}
<p>No items found</p>
{/unless}
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
{#each state.tasks as task, index}
<button onclick="{()" ="">editTask(task)}>Edit</button>
{/each}
```

Arrow functions are automatically transformed:

- `onclick={() => foo()}` becomes `onclick="fez.foo()"`
- `onclick={(e) => foo(e)}` becomes `onclick="fez.foo(event)"`
- Loop variables like `index`, `item`, `i` are evaluated at render time

### Self-Closing Custom Elements

```html
<!-- Self-closing custom elements are automatically converted -->
<ui-icon name="star" />
<!-- becomes: <ui-icon name="star"></ui-icon> -->

<my-component attr="value" />
<!-- becomes: <my-component attr="value"></my-component> -->
```

## Special Attributes

All `fez:` attributes use namespace syntax. `fez-keep` also works (`fez:` is converted to `fez-` at compile time).

```html
<!-- Two-way binding -->
<input fez:bind="state.username" />

<!-- Element reference via this.myElement (auto-generates stable ID for Idiomorph) -->
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

- **Props are ALWAYS strings** - use `parseInt()` for numbers: `parseInt(props.speed) || 50`
- **ALWAYS** use lowercase with underscores for prop names (e.g., `fill_color`, `read_only`)
- **Use colon prefix (`:`) for evaluated attributes** - functions, objects, booleans:

  ```html
  <!-- Passing evaluated values (functions, objects, etc.) -->
  <my-component
    :onclick="handleClick"
    :config="{theme: 'dark'}"
    :is_active="true"
  >
    <!-- Passing string values (no colon needed) -->
    <my-component title="Hello" class_name="primary"></my-component
  ></my-component>
  ```

- **ALWAYS use `Fez.getFunction()` for handler props** (onclick, ping, onselect, etc.):
  Props can come as strings or functions, so always normalize them with `Fez.getFunction()`:

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
- Use `onMount()` for updates that need mounted template
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
    this.onClickHandler = Fez.getFunction(props.onclick)
  }
  ```

### Performance

- Use throttled events: `this.on('scroll', callback, 100)`
- `FAST = true` — synchronous render, prevents flash of unstyled content
  - Place as a **class property** (first line inside `class { }`), never as a standalone statement
  - Do **NOT** use when component reads innerHTML, slot content, or `this.root.textContent` in `init()`
  - Use for self-contained components that generate their own content (icons, badges, viewers)

### External DOM Libraries (Three.js, Charts, Video players, etc.)

When integrating libraries that create/manage their own DOM elements:

- **Use template markup normally** - define your container structure in the template
- **Get references with `this.find()`** - store element references in `onMount()`
- **NEVER use `this.state` for UI updates** - state changes trigger Idiomorph diffing which doesn't handle external DOM well
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

  // WRONG - state triggers Idiomorph diff, breaks external DOM
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

- Same `fez:keep` value → Element preserved (all internal state intact)
- Different `fez:keep` value → Element recreated
- No `fez:keep` → Element may be recreated on parent re-render
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

Elements with static `fez:this` attributes automatically get stable IDs (`id="fez-{UID}-{name}"`). This helps Idiomorph preserve form inputs across re-renders:

```html
<!-- Auto-generates id="fez-42-nameInput" -->
<input fez:this="nameInput" type="text" />

<!-- User-typed value survives parent re-renders because Idiomorph matches by ID -->
```

This is automatic - no extra configuration needed.

## Common Mistakes to Avoid

- Using React hooks (useState, useEffect)
- Forgetting `:fez` in scoped styles
- Using string interpolation in onclick instead of arrow functions
- Direct DOM manipulation for simple reactive UI (use state instead) - BUT use direct DOM for external libraries (Three.js, charts, etc.) since Idiomorph diffing doesn't handle them well
- Missing `init()` for state initialization
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
      <child-component
        :data="fez.state.items"
      ></child-component></child-component
  ></child-component>
  ```

  Note: `:attr="expr"` syntax uses component's `fezGlobals` to pass values to child components - automatically cleaned up when component destroys.

## External Libraries & Modules

```javascript
// ES Module imports (use /+esm for CDN modules)
import library from "https://cdn.jsdelivr.net/npm/library/+esm";

// Import map for bare specifiers (avoids duplicate library instances)
// Rewrites bare specifiers to full URLs at compile time
Fez.head({
  importmap: {
    three: "https://esm.sh/three@0.160.0",
    "three/addons/": "https://esm.sh/three@0.160.0/examples/jsm/",
  },
});
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// Dynamic script/style loading
Fez.head({ js: "https://cdn.example.com/script.js" });
Fez.head({ css: "https://cdn.example.com/styles.css" });
```

## Utility Shortcuts

```javascript
this.find(".selector"); // Scoped querySelector
this.setTimeout(fn, 1000); // Auto-cleaned timeout
this.setInterval(fn, 1000); // Auto-cleaned interval
Fez.fetch("/data"); // Built-in cached fetch
this.formData(); // Get form values
this.childNodes(); // Get child elements as array
this.childNodes(fn); // Get children mapped with function
this.childNodes(true); // Get children as objects: { html, ROOT, ...attrs }

// localStorage with JSON serialization (preserves types)
Fez.localStorage.set("count", 42);
Fez.localStorage.get("count"); // 42 (number)
Fez.localStorage.get("missing", "default"); // fallback value

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
Fez.index["ui-btn"].class; // Component class
Fez.index["ui-btn"].meta; // Metadata from META = {...}
Fez.index["ui-btn"].demo; // Demo HTML string
Fez.index["ui-btn"].info; // Info HTML string
Fez.index["ui-btn"].source; // Raw .fez source code

Fez.index.get("name"); // { class, meta, demo: DOMNode, info: DOMNode, source }
Fez.index.apply("name", el); // Render demo into element and execute scripts
Fez.index.names(); // ['ui-btn', 'ui-card', ...] all component names
Fez.index.withDemo(); // Component names that have demos
Fez.index.all(); // All components as { name: { class, meta, demo, info, source } }
Fez.index.info(); // Log all component names to console
```

## Debugging Helpers

```javascript
Fez.LOG = true; // Enable framework logs
Fez("component").state; // Inspect component state
Fez.state.get("key"); // Check global state
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
