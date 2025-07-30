# Fez Framework Guide for AI Assistants

This guide helps AI assistants understand and work effectively with the Fez framework.

## What is Fez?

Fez is a lightweight, zero-build reactive JavaScript component framework that allows creating web components directly in HTML. Components are defined in `.fez` files or inline HTML with three sections: `<script>`, `<style>`, and template markup.

## Component Structure

### Basic Component Format
```html
<script>
  // Component logic here
  init() {
    this.state.message = 'Hello World'
  }
</script>

<style>
  :fez {
    /* Scoped SCSS styles */
    color: blue;
  }
</style>

<!-- Template with reactive bindings -->
<div>{{ state.message }}</div>
```

## Core Concepts

### 1. State Management
- Components have a reactive `this.state` object
- Any property assignment to `state` triggers re-render
- Arrays and objects are deeply reactive

```javascript
init() {
  this.state.count = 0        // Primitive
  this.state.items = []       // Array - all methods are reactive
  this.state.user = {         // Object - nested properties are reactive
    name: 'John',
    age: 30
  }
}
```

### 2. Lifecycle Methods
```javascript
init(props) {                         // Component initialized
onMount(props) {                      // After first render
beforeRender() {                      // Before each render
afterRender() {                       // After each render
onStateChange(key, value, oldValue) { // Local state changes
onGlobalStateChange(key, value) {     // Global state changes
onPropsChange(key, value) {           // Attribute changes
onDestroy() {                         // Component removed
```

### 3. Template Syntax

#### Interpolation
```html
{{ state.value }}
{{ state.count * 2 }}
{{ state.user.name }}
```

#### Conditionals
```html
{{if state.isActive}}
  <div>Active</div>
{{else}}
  <div>Inactive</div>
{{/if}}
```

#### Loops
```html
{{for item, index in state.items}}
  <li>{{ index }}: {{ item.name }}</li>
{{/for}}

<!-- Alternative syntax -->
{{each state.items as item}}
  <li>{{ item.name }}</li>
{{/each}}
```

#### Raw HTML
```html
{{raw state.htmlContent}}
{{@html state.htmlContent}}
```

### 4. Event Handling
```html
<!-- Method calls -->
<button onclick="fez.increment()">Click</button>

<!-- With parameters -->
<button onclick="fez.updateItem({{ index }})">Update</button>

<!-- Access component from any child element -->
<div onclick="Fez(this).handleClick()">Click me</div>
```

### 5. Two-Way Data Binding
```html
<input type="text" fez-bind="state.username" />
<textarea fez-bind="state.description"></textarea>
<select fez-bind="state.selectedOption">
  <option value="1">Option 1</option>
</select>
```

### 6. Special Attributes

#### fez-use
Calls method when element is added to DOM:
```html
<canvas fez-use="initCanvas"></canvas>
```

#### fez-this
Assigns DOM element reference:
```html
<input fez-this="emailInput" />
<!-- Access via this.emailInput -->
```

#### fez-class
Adds classes with optional animation delay:
```html
<div fez-class="fade-in bounce 100">Animated</div>
```

#### Conditional Attributes
```html
<button disabled={{ state.loading }}>Submit</button>
<input required={{ state.isRequired }} />
```

#### Passing function or any non string data
```html
<!-- prefix attribute with ":", content will be evaluated -->
<fez-component-only :attribute="funcPointer">Action</fez-component-only>
```

### 7. Component Communication

#### Pub/Sub Pattern
```javascript
// Subscribe (auto-cleanup on destroy)
init() {
  this.subscribe('user:updated', this.handleUserUpdate)
}

// Publish globally
someMethod() {
  Fez.publish('user:updated', { id: 123, name: 'John' })
}
```

#### Global State Management
```javascript
// Components automatically subscribe when reading global state
class Counter extends FezBase {
  increment() {
    // Setting global state - all listeners will be notified
    this.globalState.count = (this.globalState.count || 0) + 1
  }

  onGlobalStateChange(key, value) {
    // Optional: handle global state changes
    console.log(`Global state "${key}" changed to:`, value)
  }

  render() {
    // Reading global state - automatically subscribes this component
    return `<button onclick="fez.increment()">
      Count: ${this.globalState.count || 0}
    </button>`
  }
}

// External access (outside components)
Fez.state.set('count', 10)        // Set global state
const count = Fez.state.get('count')  // Get global state

// Iterate over components listening to a key
Fez.state.forEach('count', (component) => {
  console.log(`${component.fezName} is listening to count`)
})
```

### 8. Utility Methods

```javascript
// DOM Queries (scoped to component)
this.find('.button')           // querySelector
this.findAll('.item')          // querySelectorAll

// Value helpers
this.val('.input')             // Get value
this.val('.input', 'text')     // Set value

// Form data
const data = this.formData()   // Get all form values as object

// Styling
this.setStyle('--primary-color', '#007bff')

// State management
this.state.property = value    // Local reactive state
this.globalState.key = value   // Global state (auto-subscription)

// Rendering
this.render()                  // Force re-render

// Timers (auto-cleanup)
this.setInterval(() => {}, 1000)
this.setTimeout(() => {}, 1000)

// Debounced execution
this.nextTick(() => {}, 'uniqueName')
```

### 9. Component Registration

#### Method 1: Inline HTML
```html
<xmp fez="my-component">
  <script>/* component code */</script>
  <style>/* styles */</style>
  <!-- template -->
</xmp>
```

#### Method 2: External File
```html
<template fez="./components/my-component.fez"></template>
```

#### Method 3: JavaScript
```javascript
Fez('my-component', class extends FezBase {
  init() { /* ... */ }
})
```

### 10. Global Components
Make component instance globally accessible:
```javascript
GLOBAL = 'MyComponent'  // window.MyComponent = component instance
```

## Best Practices

### Component Naming
- Always use kebab-case with at least one dash
- Good: `user-profile`, `nav-menu`, `data-table`
- Bad: `userprofile`, `nav`, `component`

### State Management
- Initialize all state properties in `init()`
- Use reactive state for any data affecting rendering
- Avoid direct DOM manipulation when possible

### Event Handling
- Use component methods over inline JavaScript
- Access component via `fez` in event handlers
- Clean up external event listeners in `onDestroy()`

### Performance
- Use `FAST_BIND = true` for components that does not have slots (innerHTML)
- Batch state updates in same tick
- Use `fez-slot` class to preserve content during renders

### Code Organization
```javascript
class extends FezBase {
  // 1. Properties
  GLOBAL = 'ComponentName'
  FAST_BIND = true

  // 2. Lifecycle
  init() { /* ... */ }
  onMount() { /* ... */ } // if component uses this.state, use only onMount and put init on top

  // 3. Event handlers
  handleClick() { /* ... */ }

  // 4. Helper methods
  updateData() { /* ... */ }
}
```

## Common Patterns

### Loading States
```javascript
async loadData() {
  this.state.loading = true
  try {
    Fez.fetch('/api/data', (data) => this.state.data = data)
  } finally {
    this.state.loading = false
  }
}
```

### Form Handling
```javascript
handleSubmit() {
  const data = this.formData()
  // Process form data
}
```

### Dynamic Lists
```html
{{for item, index in state.items}}
  <div>
    <input fez-bind="state.items[{{ index }}].name" />
    <button onclick="fez.removeItem({{ index }})">Remove</button>
  </div>
{{/for}}
```

### Component Refs
```javascript
init() {
  // Get other component instance
  this.userProfile = Fez('user-profile')

  // Or find specific instance
  this.modal = Fez(this.find('.modal'))
}
```

### Global State Patterns
```javascript
// Shared counter across multiple components
onStateChange(key, value, oldValue) {
  // React to local state changes to update global state
  if (key === 'count') {
    // Find max across all counter instances
    let max = 0
    Fez.state.forEach('maxCount', fez => {
      if (fez.state?.count > max) {
        max = fez.state.count
      }
    })
    this.globalState.maxCount = max
  }
}

// Theme switching
toggleTheme() {
  const current = this.globalState.theme || 'light'
  this.globalState.theme = current === 'light' ? 'dark' : 'light'
}

// User authentication state
login(user) {
  this.globalState.currentUser = user
  this.globalState.isAuthenticated = true
}
```

## Fez API Methods

### Core
- `Fez(selector)` - Get component instance
- `Fez.register(name, component)` - Register component
- `Fez.publish(channel, data)` - Publish event
- `Fez.instances` - Map of all component instances

### Global State
- `Fez.state.set(key, value)` - Set global state
- `Fez.state.get(key)` - Get global state value
- `Fez.state.forEach(key, func)` - Iterate components listening to key

### Utilities
- `Fez.fetch(url, opts)` - Fetch with caching
- `Fez.head(url)` - Load external scripts/styles
- `Fez.dialog(options)` - Show dialog modal
- `Fez.asHTML(template, data)` - Render template string

## Key Differences from Other Frameworks

1. **No Build Step**: Works directly in browser
2. **HTML-First**: Components defined in HTML
3. **Scoped Styles**: SCSS compiled at runtime
4. **Auto Cleanup**: Subscriptions, timers cleaned automatically
5. **Simple State**: Direct property assignment triggers updates
6. **Morphing**: Efficient DOM updates preserve state

## Debugging Tips

1. Enable logging: `Fez.LOG = true`
2. Check component instance: `Fez('component-name')`
3. Inspect state: `Fez('component-name').state`
4. Force render: `Fez('component-name').render()`

## When Working with Fez

1. **Always check existing patterns** in the codebase
2. **Use reactive state** for any dynamic data
3. **Prefer component methods** over inline handlers
4. **Follow naming conventions** (kebab-case)
5. **Use built-in utilities** (don't reinvent)
6. **Handle loading/error states** appropriately
7. **Clean up resources** in lifecycle methods
