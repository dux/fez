# Fez Development Quick Reference

## Development Workflow

### 1. Start Development Server
```bash
bun run dev          # Start server with file watching
```

### 2. Build Production
```bash
bun run build        # or: bun run b
```

### 3. Code Quality

#### Check for Issues
```bash
bun run lint          # Check for linting errors
bun run format:check  # Check code formatting
```

#### Fix Issues
```bash
bun run lint:fix      # Auto-fix linting errors
bun run format        # Format all source files
```

### 4. Testing

#### Run Tests
```bash
bun test test/*.test.js                    # All unit tests
bun test test/browser/integration.test.js  # Browser tests (slow)
bun test --coverage                        # With coverage
```

#### Test Specific Features
```bash
bun test test/svelte-template.test.js  # Template tests
bun test test/morph.test.js            # DOM morph tests
bun test test/pubsub.test.js           # Pub/sub tests
bun test test/fez-error.test.js        # Error handling tests
```

## New Features

### TypeScript Support

The framework now includes full TypeScript definitions:

```typescript
import { Fez, FezBase } from '@dinoreic/fez'

// Create component with full type support
Fez('my-component', class extends FezBase {
  // Props are typed
  init(props: ComponentProps & EvaluatedProps) {
    this.state.count = parseInt(props.start || '0')
  }

  // Lifecycle hooks are typed
  onMount(props) {
    // DOM is ready
  }

  beforeRender() {
    // Computed state
    this.state.doubled = this.state.count * 2
  }

  onDestroy() {
    // Cleanup
  }

  // Methods are available in templates
  increment() {
    this.state.count++
  }

  // HTML template
  HTML = `<button onclick="fez.increment()">
    Count: {state.count}, Doubled: {state.doubled}
  </button>`

  // CSS (scoped)
  CSS = `
    button {
      background: blue;
      color: white;
      &:hover { background: darkblue; }
    }
  `

  FAST = true
})
```

### Enhanced Error Messages

Errors now include helpful context:

```javascript
// Before
Fez lookup: node "ui-button" not found.

// After
Fez lookup [ui-button]: Component "ui-button" not found in DOM. 
  Ensure the component is defined and rendered.
```

Enable detailed logging:
```javascript
Fez.LOG = true  // Shows full error context and stack traces
```

### ESLint Rules

The project enforces:
- ✅ No unused variables (except `_` prefixed)
- ✅ No `eval` or `new Function` (warnings)
- ✅ Prefer `const` over `let`
- ✅ No `var`
- ✅ Strict equality (`===` instead of `==`)
- ✅ Consistent curly braces
- ✅ No trailing whitespace
- ✅ Semicolons required
- ✅ Single quotes (with escaping)
- ✅ 2-space indentation
- ✅ Trailing commas in multiline

### Prettier Formatting

- Semi: `true`
- Single quotes: `true`
- Tab width: `2`
- Trailing comma: `all`
- Print width: `100`
- Bracket spacing: `true`
- Arrow parens: `always`

## File Structure

```
fez/
├── src/
│   ├── fez.js                    # Entry point
│   └── fez/
│       ├── root.js               # Fez static API
│       ├── instance.js           # FezBase class
│       ├── connect.js            # Component registration
│       ├── compile.js            # Component compiler
│       ├── morph.js              # DOM morphing
│       ├── defaults.js           # Built-in components
│       ├── utility.js            # Utility methods
│       ├── lib/                  # Library modules
│       │   ├── template.js       # Template compiler
│       │   ├── pubsub.js         # Pub/sub system
│       │   ├── global-state.js   # Global state
│       │   └── ...
│       └── utils/                # Utility functions
├── test/
│   ├── *.test.js                 # Unit tests
│   └── browser/
│       └── integration.test.js   # Browser tests
├── demo/fez/                     # Component demos
├── dist/                         # Built files
├── fez.d.ts                      # TypeScript definitions
├── .eslintrc.json                # ESLint config
├── .prettierrc                   # Prettier config
└── package.json
```

## Common Tasks

### Add a New Component

1. Create file: `demo/fez/my-component.fez`
2. Write component with `<info>`, `<demo>`, `<script>`, `<style>`, and template
3. Run: `bun run dev` to see it live
4. Test manually or add automated tests

### Add a New Test

1. Create file: `test/my-feature.test.js`
2. Use Bun test syntax:
   ```javascript
   import { test, expect } from 'bun:test'

   test('my feature works', () => {
     expect(true).toBe(true)
   })
   ```
3. Run: `bun test test/my-feature.test.js`

### Fix Linting Errors

```bash
# See errors
bun run lint

# Auto-fix what's possible
bun run lint:fix

# Manually fix remaining issues
```

### Format Code

```bash
# Format all files
bun run format

# Just check if formatted
bun run format:check
```

## Performance Tips

1. **Use FAST = true** for components without slots
2. **Use fez:keep** to preserve expensive DOM nodes
3. **Keep state shallow** - deep nesting adds proxy overhead
4. **Use beforeRender()** for computed values, not init()
5. **Minimize template complexity** - split into child components

## Debugging

### Enable Logging
```javascript
Fez.LOG = true
```

### Inspect Component
```javascript
Fez('my-component')        // Find component instance
Fez('my-component').state  // View component state
Fez(123)                   // Find by UID
```

### View Component Info
```javascript
Fez.info()                 // Log all component names
Fez.index['my-component']  // View component metadata
```

### Check Global State
```javascript
Fez.state.get('key')       // Get global state value
```
