# Fez JS lib Quick Reference for AI Assistants

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
9. **USE arrow functions** for event handlers: `onclick={() => method()}` or `onclick={(e) => method(e)}`

## Component Structure

```html
<script>
  // ES Module imports (optional)
  import library from 'https://cdn.jsdelivr.net/npm/library/+esm'

  // Or load scripts/styles dynamically
  Fez.head({js: 'https://cdn.example.com/script.js'})
  Fez.head({css: 'https://cdn.example.com/styles.css'})

  // component logic
  class {
    FAST = true  // Renders immediately (no flicker, only if does not have slot data)

    init(props) {
      // Props are passed as parameter - use props.name, NOT this.prop('name')
      // do not rewrite state, just add to it
      this.state.count = props.count || 0
      this.state.title = props.title || 'Default'
    }

    onMount(props) {
      // Props also available in onMount - use props.name
      // called after fezRender() method
      if (props.autoFocus) {
        this.find('input').focus()
      }
    }

    onDestroy() {} // Cleanup resources
    onWindowResize() {} // on Window resize
    onWindowScroll() {} // on window scroll

    // Custom methods
    increment() {
      this.state.count++  // Reactive assignment
    }
  }
</script>

<style>
  /* Global styles (affects entire page) */
  body {
    background: #f5f5f5;
  }

  /* Component-scoped styles - ALWAYS use nested SCSS syntax */
  :fez {
    /* Direct styles on component root */
    padding: 20px;

    /* Nested elements - this is the PREFERRED pattern */
    button {
      background: gold;
      cursor: pointer;

      /* Deep nesting is encouraged */
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
<button onclick={() => increment()} name={state.buttonName}>
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

<!-- For loop with index -->
{#for item, idx in state.items}
  <li>{idx}: {item}</li>
{/for}

<!-- Object iteration -->
{#each state.config as key, value, index}
  <div>{index}. {key} = {value}</div>
{/each}

<!-- Empty list fallback with :else -->
{#each state.items as item}
  <li>{item}</li>
{:else}
  <li>No items found</li>
{/each}
```

### Arrow Function Event Handlers

**This is the preferred way to handle events in Fez:**

```html
<!-- Simple handler -->
<button onclick={() => handleClick()}>Click me</button>

<!-- With event parameter -->
<button onclick={(e) => handleClick(e)}>Click me</button>
<input onchange={(e) => setValue(e.target.value)} />

<!-- Inside loops - variables are automatically interpolated -->
{#each state.tasks as task, index}
  <button onclick={() => removeTask(index)}>Remove #{index}</button>
  <button onclick={(e) => editTask(index, e)}>Edit</button>
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

```html
<input fez-bind="state.username">      <!-- Two-way binding -->
<div fez-this="myElement">             <!-- Element reference via this.myElement -->
<input fez-use="el => el.focus()">     <!-- DOM hook -->

<!-- IMPORTANT: Use colon prefix for evaluated attributes (functions, objects, etc.) -->
<ui-emoji :onselect="handleEmojiSelect">   <!-- Pass function reference -->
<my-component :config="{foo: 'bar'}">      <!-- Pass object literal -->
<user-card :user="state.currentUser">      <!-- Pass state object -->
<toggle :checked="state.isActive">         <!-- Pass boolean -->

<!-- Without colon, values are treated as strings -->
<my-component title="Hello World">         <!-- String value (no colon needed) -->
```

## Best Practices

### Props Handling

* **IMPORTANT**: Props are passed as parameter to `init(props)` and `onMount(props)`
* Use `props.name` to access props, NOT `this.prop('name')`
* **ALWAYS** use lowercase with underscores for prop names (e.g., `fill_color`, `read_only`)
* **Use colon prefix (`:`) for evaluated attributes** - functions, objects, booleans:
  ```html
  <!-- Passing evaluated values (functions, objects, etc.) -->
  <my-component :onclick="handleClick" :config="{theme: 'dark'}" :is_active="true">

  <!-- Passing string values (no colon needed) -->
  <my-component title="Hello" class_name="primary">
  ```
* Example:
  ```javascript
  init(props) {
    this.state.font_size = props.font_size || 24
    this.state.background_color = props.background_color || '#000'
    this.state.is_active = props.is_active !== undefined
    // Function props are already resolved
    if (props.onselect) {
      this.onSelectHandler = props.onselect
    }
  }
  ```
* For dynamic prop changes, use `onPropsChange(name, value)` method
* Check prop existence: `if (props.is_loading !== undefined)`

### State Management

* Initialize ALL properties in `init()`
* Modify arrays/objects directly (they're deeply reactive)
* Use `onMount()` for updates that need mounted template

### Performance

* Use throttled events: `this.on('scroll', callback, 100)`
* Use `FAST = true` for components that don't work with slots to prevent render flicker

### Component Communication

```javascript
// Subscribe (auto-cleanup)
init() {
  this.subscribe('event', this.handler)
}

// Publish
Fez.publish('event', data)
```

## Common Mistakes to Avoid

- Using React hooks (useState, useEffect)
- Forgetting `:fez` in scoped styles
- Using string interpolation in onclick instead of arrow functions
- Direct DOM manipulation (use state instead)
- Missing `init()` for state initialization
- Using `{#if}` blocks inside attributes (use ternary operators instead)
- Writing flat CSS instead of nested SCSS syntax
- Using `this.prop('name')` instead of `props.name` in `init()` and `onMount()`
- Forgetting to use `{index}` or arrow functions for loop variables in event handlers

## External Libraries & Modules

```javascript
// ES Module imports (use /+esm for CDN modules)
import library from 'https://cdn.jsdelivr.net/npm/library/+esm'

// Dynamic script/style loading
Fez.head({js: 'https://cdn.example.com/script.js'})
Fez.head({css: 'https://cdn.example.com/styles.css'})
```

## Utility Shortcuts

```javascript
this.find('.selector')      // Scoped querySelector
this.setInterval(fn, 1000)  // Auto-cleaned interval
Fez.fetch('/data')          // Built-in cached fetch
this.formData()             // Get form values

// Resolve a function from a string or function reference
Fez.getFunction(this.props.onclick)
Fez.getFunction('alert("Hi")', window)

// to check if value is true, that comes from props
Fez.isTrue(value)
```

## Debugging Helpers

```javascript
Fez.LOG = true             // Enable framework logs
Fez('component').state     // Inspect component state
Fez.state.get('key')       // Check global state
```

## When Unsure

* Prefer Fez utilities over vanilla JS
* Use `this.globalState` for cross-component data
* Access elements via `fez-this` instead of querySelector
* Put DOM-dependent logic in `onMount()` not `init()`
* Use arrow functions for event handlers: `onclick={() => method()}`

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
