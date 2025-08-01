# Fez Framework Quick Reference for AI Assistants

## Core Rules for Claude
1. **ALWAYS** use Fez-specific syntax (NO React/Vue conventions)
2. **NEVER** use hooks - `this.state` replaces useState/useEffect
3. **ALWAYS** scope styles with `:fez` selector
4. **ALWAYS** initialize state in `init()`
5. **ALWAYS** use kebab-case component names (e.g., `user-profile`)

## Component Structure
```html
<xmp fez="component-name">
  <script>
    init() {
      // do not rewrite state, just add to it
      this.state.count = 0
    }
    onMount() { ... } // DOM-ready logic
    onStateChange(key, value)	// React to state changes
    onDestroy()	// Cleanup resources
    // Custom methods
    increment() {
      this.state.count++  // Reactive assignment
    }
  </script>

  <style>
    /* REQUIRED: Scoped styles, use SCSS nesting */
    :fez {
      button {
        background: gold;
        SPAN { color: black; }
      }
    }
  </style>

  <!-- Template -->
  <button onclick="fez.increment()">
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

### Performance

* Add FAST = true for slot-free components
* Use throttled events: this.on('scroll', callback, 100)
* Prefer fez-class for animations

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

## Utility Shortcuts

```javascript
this.find('.selector')      // Scoped querySelector
this.setTimeout(fn, 1000)  // Auto-cleaned timeout
Fez.fetch('/data')          // Built-in cached fetch
this.formData()             // Get form values
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
