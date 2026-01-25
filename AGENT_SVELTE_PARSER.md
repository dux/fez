# Svelte & Malinajs Parser Analysis for Fez Optimization

This document analyzes how Svelte 5 and Malinajs handle efficient DOM updates to help optimize Fez's rendering engine.

## The Problem in Fez

When a parent component's state changes (even a tiny detail like an h1 title), **ALL child components and the entire DOM tree re-renders**:

```javascript
// instance.js:467-474
handler ||= (o, k, v, oldValue) => {
  if (v != oldValue) {
    this.onStateChange(k, v, oldValue)
    this.fezNextTick(this.fezRender, 'fezRender')  // <-- FULL RE-RENDER
  }
}
```

The `fezRender()` method:
1. Executes the **entire template function** (all expressions evaluate)
2. Creates a **complete new DOM tree**
3. Uses Idiomorph to diff and patch (efficient, but still processes everything)

---

## How Svelte 5 Solves This

### 1. Signals-Based Reactivity (Fine-Grained Tracking)

Svelte uses **signals** - reactive primitives that track dependencies automatically:

```javascript
// Source (reactive value)
{
  v: value,           // Current value
  reactions: [],      // Effects/deriveds that depend on this
  equals: fn,         // Equality check
  wv: writeVersion    // Tracks when last written
}

// Derived (computed value)
{
  deps: [],           // Dependencies
  fn: computation,    // Lazy - only runs when read
  reactions: []       // What depends on this derived
}

// Effect (side effect/DOM update)
{
  deps: [],           // What this effect reads
  fn: updateFunction  // Runs when deps change
}
```

**Key insight**: Each reactive value knows exactly which effects depend on it.

### 2. Compile-Time DOM Generation

Templates are compiled to **static HTML strings** that are cloned, not diffed:

```javascript
// Template is parsed once, then cloned
const template = document.createElement('template')
template.innerHTML = '<div class="card"><h1></h1><p></p></div>'

// On mount: clone the structure
const node = template.content.cloneNode(true)
```

### 3. Fine-Grained Update Effects

Instead of re-rendering everything, Svelte creates **tiny effects** for each dynamic part:

```javascript
// Conceptual compiled output:
// <h1>{title}</h1><p>{description}</p>

// Creates TWO separate effects:
effect(() => {
  h1Node.textContent = title  // Only runs when `title` changes
})

effect(() => {
  pNode.textContent = description  // Only runs when `description` changes
})
```

### 4. Branch Isolation for Child Components

Child components are rendered in **isolated branch effects**:

```javascript
// Parent re-rendering does NOT trigger child re-render
// unless the specific props passed to child actually changed

branch(() => {
  // Child component - has its own effect tree
  // Only re-runs if props.item actually changed
  ChildComponent({ item: props.item })
})
```

### 5. Smart List Reconciliation

For `{#each}` blocks, Svelte uses keyed reconciliation:

```javascript
// Map: key -> { element, effect, rebind }
const items = new Map()

// On update:
for (item of newArray) {
  const existing = items.get(key(item))
  if (existing) {
    existing.rebind(item)  // Just update data, don't recreate DOM
  } else {
    create(item)  // Only create new items
  }
}
```

---

## How Malinajs Solves This

### 1. Watcher-Based Change Detection

Malinajs uses **watchers** that poll values during a digest cycle:

```javascript
class WatchObject {
  fn: () => value,   // Getter function
  cb: (v) => void,   // Update callback
  value: prev,       // Previous value for comparison
  cmp: comparator    // Optional deep comparison
}

// Digest loop
while (hasChanges) {
  for (watcher of watchers) {
    const newValue = watcher.fn()
    if (newValue !== watcher.value) {
      watcher.cb(newValue)
      watcher.value = newValue
    }
  }
}
```

### 2. Hierarchical Change Detectors

Each component/block has its **own change detector**:

```javascript
function $ChangeDetector(parent) {
  this.watchers = []   // Only THIS component's watchers
  this.children = []   // Child change detectors
}
```

Child components have isolated watcher lists - they don't re-run when parent changes unless their specific inputs changed.

### 3. Direct DOM Binding

Each reactive expression gets a dedicated DOM updater:

```javascript
// For text: {title}
$watch(() => title, value => {
  textNode.textContent = value
})

// For attribute: class={active}
$watch(() => active, value => {
  element.classList.toggle('active', value)
})
```

### 4. Compile-Time Optimization

The compiler analyzes templates to:
- Detect **static content** (rendered once, no watchers)
- Track **which variables** each expression uses
- Generate **minimal update code**

```javascript
// Compiler output for static vs dynamic
if (this.inuse.apply) {
  // Dynamic - creates watcher
  ctx.writeLine(`$runtime.bindText(${el}, () => ${expr})`)
} else {
  // Static - no watcher
  ctx.writeLine(`${el}.textContent = ${expr}`)
}
```

---

## Key Patterns for Fez

### Pattern 1: Dependency Tracking

**Problem**: Fez doesn't track which state properties affect which DOM parts.

**Solution**: Track dependencies during template execution:

```javascript
// During render, track reads
let currentDeps = []
const trackableState = new Proxy(state, {
  get(target, prop) {
    currentDeps.push(prop)
    return target[prop]
  }
})

// Store deps with each DOM node/expression
nodeUpdateInfo.set(node, {
  deps: [...currentDeps],
  update: () => node.textContent = state[prop]
})
```

### Pattern 2: Fine-Grained Updates

**Problem**: Any state change triggers full `fezRender()`.

**Solution**: Create update functions for each dynamic expression:

```javascript
// Instead of one big render, create micro-updates
const updates = [
  { deps: ['title'], update: () => h1.textContent = state.title },
  { deps: ['items'], update: () => renderList(ul, state.items) },
]

// On state change, only run affected updates
onStateChange(key) {
  for (update of updates) {
    if (update.deps.includes(key)) {
      update.update()
    }
  }
}
```

### Pattern 3: Component Isolation

**Problem**: Child components re-process when parent renders.

**Solution**: Mark child components for special handling:

```javascript
// During initial render, find child components
const childComponents = root.querySelectorAll('.fez')

// Before re-render, save their state
const savedChildren = childComponents.map(el => ({
  el,
  fez: el.fez,
  props: el.fez.props
}))

// After morph, check if props actually changed
savedChildren.forEach(({ el, fez, props }) => {
  const newProps = getProps(el)
  if (!shallowEqual(props, newProps)) {
    fez.fezRender()  // Only re-render if props changed
  }
})
```

### Pattern 4: Keyed List Optimization

**Problem**: Lists re-render completely on any change.

**Solution**: Use keys to track and reuse list items:

```javascript
// Track items by key
const itemMap = new Map()

function renderList(items, getKey, render) {
  const newMap = new Map()

  items.forEach((item, i) => {
    const key = getKey(item)
    let existing = itemMap.get(key)

    if (existing) {
      // Reuse existing DOM, just update data
      existing.update(item, i)
      newMap.set(key, existing)
    } else {
      // Create new
      const el = render(item, i)
      newMap.set(key, { el, update: (item, i) => ... })
    }
  })

  // Remove old items not in new list
  itemMap.forEach((v, k) => {
    if (!newMap.has(k)) v.el.remove()
  })

  itemMap = newMap
}
```

---

## Recommended Implementation Strategy for Fez

### Phase 1: Component Isolation (Low Risk, High Impact)

Prevent child component re-instantiation during parent re-render:

1. **Mark child components before morph**
2. **Skip morphing of `.fez` elements** (let Idiomorph preserve them)
3. **Compare old vs new props** - only trigger child update if changed

```javascript
// In fezRender(), before Fez.morphdom():
const childStates = this.captureChildStates()

Fez.morphdom(this.root, newNode, {
  onBeforeElUpdated: (fromEl, toEl) => {
    // Preserve child fez components entirely
    if (fromEl.classList.contains('fez') && fromEl.fez) {
      return false  // Don't morph this element
    }
    return true
  }
})

this.updateChildPropsIfChanged(childStates)
```

### Phase 2: Expression-Level Updates (Medium Risk, High Impact)

Create micro-update functions during template compilation:

1. **Modify `svelte-template.js`** to track which expressions use which variables
2. **Generate update functions** alongside the template
3. **On state change**, run only affected updates instead of full render

### Phase 3: Full Signals System (High Risk, Highest Impact)

Implement proper signals if Phase 1-2 aren't sufficient:

1. Create `Signal`, `Derived`, `Effect` primitives
2. Replace `fezReactiveStore` with signals
3. Connect template expressions to effects

---

## Comparison Summary

| Aspect | Svelte 5 | Malinajs | Fez (Current) |
|--------|----------|----------|---------------|
| Change Detection | Signals (push) | Watchers (poll) | Proxy (triggers full render) |
| Update Granularity | Per-expression | Per-expression | Full component |
| DOM Strategy | Clone + micro-updates | Clone + micro-updates | Full re-render + morph |
| Child Isolation | Branch effects | Separate CD | None (re-morphed) |
| List Updates | Keyed reconciliation | Keyed reconciliation | Idiomorph (tag-based) |
| Compile-time Analysis | Yes | Yes | Minimal |

---

## Quick Wins for Fez

1. **Idiomorph Config**: Configure Idiomorph to skip `.fez` child components
2. **Props Comparison**: Only trigger child re-render when props actually change
3. **Batch Updates**: Already implemented via `fezNextTick`

These changes can significantly reduce unnecessary re-renders without a complete architecture overhaul.

---

## Handling Complex Expressions: `{someNum * 3}` and `{foo()}`

This is the trickiest part of fine-grained reactivity. Here's how each framework handles it:

### The Challenge

Simple expressions like `{title}` clearly depend on `state.title`. But what about:
- `{someNum * 3}` - depends on `someNum`
- `{foo()}` - depends on whatever `foo()` reads internally
- `{items.filter(x => x.active).length}` - depends on `items` AND each item's `active` property

### How Svelte Handles It

Svelte wraps expressions in **getter functions** and tracks reads during execution:

```javascript
// {someNum * 3} compiles to:
effect(() => {
  // During execution, `get(someNum)` is called
  // which registers this effect as a dependency
  textNode.textContent = get(someNum) * 3
})

// When someNum changes, this effect re-runs automatically
```

For function calls like `{foo()}`:

```javascript
// {foo()} compiles to:
effect(() => {
  // foo() might read reactive values internally
  // Those reads are tracked during foo()'s execution
  textNode.textContent = foo()
})
```

**Key insight**: Svelte doesn't analyze the expression statically. It runs the expression and tracks what gets read.

### How Malinajs Handles It

Malinajs creates a watcher with a getter function:

```javascript
// {someNum * 3} becomes:
$watch(
  () => someNum * 3,  // Getter - re-evaluated each digest
  (value) => textNode.textContent = value
)

// The digest loop calls the getter and compares with previous value
// If different, the callback runs
```

For `{foo()}`:
```javascript
$watch(
  () => foo(),  // Re-calls foo() each digest
  (value) => textNode.textContent = value
)
```

**Key insight**: Malinajs re-evaluates ALL watchers on each digest, but only updates DOM if value changed.

### Recommended Approach for Fez

Since Fez already uses string templates (not a compiler), the most practical approach is **value-based diffing** similar to Malinajs:

```javascript
// Store previous values for each expression
this._exprCache = new Map()

// For each dynamic expression, track:
// 1. A getter function that returns current value
// 2. The DOM node(s) to update
// 3. The previous value

function createExpressionBinding(id, getter, updater) {
  return {
    id,
    getter,           // () => someNum * 3
    updater,          // (value) => node.textContent = value
    prevValue: undefined
  }
}

// On state change, instead of full render:
function updateExpressions() {
  for (const binding of this._exprBindings) {
    const newValue = binding.getter()
    if (newValue !== binding.prevValue) {
      binding.updater(newValue)
      binding.prevValue = newValue
    }
  }
}
```

### Static Analysis Alternative

If we want to avoid re-evaluating everything, we can do **simple static analysis** at compile time:

```javascript
function extractDependencies(expr) {
  // Match property access patterns
  const deps = new Set()

  // Match: state.foo, this.state.foo, props.bar
  const stateMatches = expr.match(/(?:state|props)\.(\w+)/g) || []
  stateMatches.forEach(m => deps.add(m.split('.')[1]))

  // Match: plain identifiers that might be state
  // This is trickier - need to know what's in scope

  return [...deps]
}

// {someNum * 3} -> deps: ['someNum'] (if someNum is state.someNum)
// {foo()} -> deps: [] (can't know statically, must re-run always)
```

For function calls like `{foo()}`, we have options:

1. **Conservative**: Always re-evaluate (treat as depending on everything)
2. **Explicit deps**: `{foo() /* deps: items */}` - developer specifies
3. **Runtime tracking**: Wrap state access during foo() execution

### Practical Implementation for Fez

Given Fez's architecture, I recommend a **hybrid approach**:

```javascript
// In svelte-template.js, mark expressions with IDs
// <h1>{title}</h1> becomes:
// <h1 data-fez-expr="0">{title}</h1>

// Generate both template AND update map:
{
  template: '<h1 data-fez-expr="0"></h1>',
  expressions: [
    { id: 0, expr: 'title', deps: ['title'] },
    { id: 1, expr: 'someNum * 3', deps: ['someNum'] },
    { id: 2, expr: 'foo()', deps: null }  // null = always re-evaluate
  ]
}

// On state change:
onStateChange(changedKey) {
  for (const expr of this._expressions) {
    // If deps is null (function call) or includes changed key
    if (expr.deps === null || expr.deps.includes(changedKey)) {
      const node = this.root.querySelector(`[data-fez-expr="${expr.id}"]`)
      const value = this.evaluateExpr(expr.expr)
      if (node.textContent !== String(value)) {
        node.textContent = value
      }
    }
  }
}
```

This approach:
- Simple expressions (`{title}`, `{count * 2}`) only update when their deps change
- Complex expressions (`{foo()}`, `{items.filter(...)}`) always re-evaluate but only update DOM if value changed
- No full re-render needed for most state changes

---

## What Was Implemented

### 1. Component Isolation (root.js)

Modified `Fez.morphdom()` to preserve child `.fez` components during morphing:

```javascript
Fez.morphdom = (target, newNode) => {
  Idiomorph.morph(target, newNode, {
    morphStyle: 'outerHTML',
    callbacks: {
      beforeNodeMorphed: (oldNode, newNode) => {
        // Skip morphing child fez components
        if (oldNode !== target &&
            oldNode.classList?.contains('fez') &&
            oldNode.fez) {
          // Only update if props changed
          const newProps = getProps(newNode, oldNode)
          if (!shallowEqual(oldProps, newProps)) {
            oldNode.fez.props = newProps
            oldNode.fez.onPropsChange?.(newProps, oldProps)
          }
          return false  // Don't morph
        }
        return true
      }
    }
  })
}
```

### 2. Fine-Grained Expression Updates (svelte-template.js + instance.js)

The template compiler now:
1. Tracks simple expressions and their dependencies
2. Wraps trackable expressions in `<span data-fez-expr="N">` markers
3. Attaches expression metadata to the render function (`fn._fezExpressions`)

The reactive store now:
1. Tries fine-grained update first via `fezFineGrainedUpdate()`
2. Falls back to full re-render if fine-grained update isn't possible

```javascript
// Expressions are only tracked when:
// - Not inside loops ({#each}, {#for})
// - Not inside conditionals ({#if})
// - Not inside attribute values
// - Have determinable dependencies (no function calls)

// Example: {state.count * 2}
// -> deps: ['state.count']
// -> Only updates when state.count changes
```

### 3. New Lifecycle Hook (instance.js)

Added `onPropsChange(newProps, oldProps)` lifecycle hook called when parent updates a child component's props.

### What This Achieves

1. **Child components don't re-render** when parent state changes (unless props changed)
2. **Simple expressions update directly** without full template re-execution
3. **Complex expressions** (loops, conditionals, function calls) still trigger full re-render
4. **Backwards compatible** - existing code works unchanged
