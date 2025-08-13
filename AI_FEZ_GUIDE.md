# Fez Framework Quick Reference for AI Assistants

## Core Rules for Claude
1. **ALWAYS** use Fez-specific syntax (NO React/Vue conventions)
2. **NEVER** use hooks - `this.state` replaces useState/useEffect
3. **ALWAYS** scope styles with `:fez` selector and use nested SCSS-style syntax
4. **ALWAYS** initialize state in `init()`
5. **ALWAYS** use kebab-case component names (e.g., `user-profile`)
6. **NEVER** use `{{if}}` blocks inside HTML attributes - use ternary operators `{{ condition ? 'value' : '' }}` instead
7. **NO QUOTES** needed around `{{ }}` expressions in attributes - write `attr={{ value }}` not `attr="{{ value }}"`

## Component Structure

Omit XMP tag when writing fez components in .fez files

```html
<xmp fez="component-name">
  <script>
    // ES Module imports (optional)
    import library from 'https://cdn.jsdelivr.net/npm/library/+esm'

    // Or load scripts/styles dynamically
    Fez.head({js: 'https://cdn.example.com/script.js'})
    Fez.head({css: 'https://cdn.example.com/styles.css'})

    init() {
      // do not rewrite state, just add to it
      this.state.count = 0
    }
    onMount() { ... } // DOM-ready logic
    onStateChange(key, value)	// React to state changes
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
</xmp>
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
<input fez-bind="state.username">       <!-- Two-way binding -->
<div fez-this="myElement">             <!-- Element reference -->
<canvas fez-use="initCanvas">          <!-- DOM hook -->
<child :data="state.object">           <!-- Non-string data -->
```

### Event Handling

```html
<button onclick="fez.handleClick()">    <!-- Component method -->
<div onclick="Fez(this).method()">      <!-- Access from children -->
```

## Best Practices

### State Management

* Initialize ALL properties in init()
* Modify arrays/objects directly (they're deeply reactive)
* Use onMount() for updates that need mounted template

### Styling

* **ALWAYS use nested SCSS syntax** - Fez includes Goober which supports full SCSS nesting
* Scope component styles with `:fez` selector to avoid global conflicts
* Use deep nesting for element hierarchies:
  ```scss
  :fez {
    .container {
      padding: 20px;

      .header {
        font-size: 24px;

        h1 {
          margin: 0;
          color: #333;
        }
      }

      button {
        &:hover { background: #f0f0f0; }
        &.active { background: #007bff; }
      }
    }
  }
  ```
* Avoid flat CSS selectors - embrace nesting for better organization
* Use `&` for pseudo-selectors and modifiers

### Performance

* Use throttled events: this.on('scroll', callback, 100)
* Prefer fez-class for animations
* Components are automatically rendered with optimized batching

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
