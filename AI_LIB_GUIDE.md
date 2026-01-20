# Fez JS lib Quick Reference for AI Assistants

## CLI Tools

```bash
# Compile and validate components - catches JS syntax errors and template issues
bunx @dinoreic/fez compile path/to/component.fez

# Compile multiple files
bunx @dinoreic/fez compile demo/fez/*.fez
```

## Core Rules for Claude
1. **ALWAYS** use Fez-specific syntax (NO React/Vue conventions)
2. **NEVER** use hooks - `this.state` replaces useState/useEffect
3. **ALWAYS** scope styles with `:fez` selector and use nested SCSS-style syntax
4. **ALWAYS** initialize state in `init()`
5. **ALWAYS** use kebab-case component names (e.g., `user-profile`)
6. **NEVER** use `{{if}}` blocks inside HTML attributes - use ternary operators `{{ condition ? 'value' : '' }}` instead
7. **NO QUOTES** needed around `{{ }}` expressions in attributes - write `attr={{ value }}` not `attr="{{ value }}"`
8. **ALWAYS** use lowercase with underscores for props (e.g., `fill_color`, `read_only`, `stroke_width`)

## Component Structure

```html
<script>
  // ES Module imports (optional)
  import library from 'https://cdn.jsdelivr.net/npm/library/+esm'

  // Or load scripts/styles dynamically
  Fez.head({js: 'https://cdn.example.com/script.js'})
  Fez.head({css: 'https://cdn.example.com/styles.css'})

  // FAST rendering control (optional)
  FAST = true  // Renders immediately (no flicker)

  onInit(props) {
    // Props are passed as parameter - use props.name, NOT this.prop('name')
    // do not rewrite state, just add to it
    this.state.count = props.count || 0
    this.state.title = props.title || 'Default'
  }

  onMount(props) {
    // Props also available in onMount - use props.name
    // called after render() method
    if (props.autoFocus) {
      this.find('input').focus()
    }
  } // DOM-ready logic
  onDestroy()	// Cleanup resources
  onWindowResize() // on Window resize
  onWindowScroll() // on window scroll
  // Custom methods

  increment() {
    this.state.count++  // Reactive assignment
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

<!-- Template -->
<button onclick="fez.increment()" name={{ state.buttonName }}>
  Count: {{ state.count }}
</button>
```

## Essential Syntax

### State & Data

```javascript
// Local state
this.state.value = "reactive"  // Triggers re-render

// Global state
this.globalState.theme = "dark"  // Auto-publishes changes
```

### Template Directives

```html
<!-- Interpolation -->
<p>{{ state.user.name }}</p>

<!-- Conditionals -->
{{if state.isActive}}<div>Active</div>{{else}}<div>Inactive</div>{{/if}}

<!-- IMPORTANT: NEVER use {{if}} inside attributes! Use ternary operator instead -->
<!-- ❌ WRONG: <div class="{{if state.active}}active{{/if}}"> -->
<!-- ✅ CORRECT: <div class={{ state.active ? 'active' : '' }}> -->

<!-- For attributes, ALWAYS use ternary operators -->
<!-- No quotes needed around {{ }} expressions in attributes -->
<button disabled={{ state.loading ? 'disabled' : '' }}>Submit</button>
<div class={{ state.error ? 'error' : 'success' }}>Status</div>
<input value={{ state.name || 'default' }}>
<span title={{ state.tooltip }}>Hover me</span>

<!-- Loops -->
{{for item in state.items}}
  <li>{{ item.name }}</li>
{{/for}}

<!-- Raw HTML -->
<div>{{raw state.htmlContent}}</div>
```

### Special Attributes

```html
<input fez-bind="state.username">      <!-- Two-way binding -->
<div fez-this="myElement">             <!-- Element reference via this.myElement -->
<input fez-use="el => el.foucs()">     <!-- DOM hook -->

<!-- IMPORTANT: Use colon prefix for evaluated attributes (functions, objects, etc.) -->
<ui-emoji :onselect="handleEmojiSelect">   <!-- Pass function reference -->
<my-component :config="{foo: 'bar'}">      <!-- Pass object literal -->
<user-card :user="state.currentUser">      <!-- Pass state object -->
<toggle :checked="state.isActive">         <!-- Pass boolean -->

<!-- Without colon, values are treated as strings -->
<my-component title="Hello World">         <!-- String value (no colon needed) -->
```

### Event Handling

Use `fez.` to access locally scoped components.

```html
<button onclick="fez.handleClick()">    <!-- Component method -->
<div onclick="Fez(this).method()">      <!-- Access from children -->
```

## Best Practices

### Props Handling

* **IMPORTANT**: Props are passed as parameter to `onInit(props)` and `onMount(props)`
* Use `props.name` to access props, NOT `this.prop('name')`
* **ALWAYS** use lowercase with underscores for prop names (e.g., `fill_color`, `read_only`, `stroke_width`)
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

* Initialize ALL properties in onInit()
* Modify arrays/objects directly (they're deeply reactive)
* Use onMount() for updates that need mounted template

### Performance

* Use throttled events: this.on('scroll', callback, 100)
=* Use `FAST = true` for components that don't work with slots to prevent render flicker

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

❌ Using React hooks (useState, useEffect)
❌ Forgetting :fez in scoped styles
❌ Using arrow functions in handlers
❌ Direct DOM manipulation (use state instead)
❌ Missing init() for state initialization
❌ Using {{if}} blocks inside attributes (use ternary operators instead)
❌ Writing flat CSS instead of nested SCSS syntax
❌ Not utilizing SCSS nesting capabilities
❌ Using `this.prop('name')` instead of `props.name` in init() and onMount()

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
this.setTimeout(fn, 1000)  // Auto-cleaned timeout
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
* Use this.globalState for cross-component data
* Access elements via fez-this instead of querySelector
* Put DOM-dependent logic in onMount() not init()
