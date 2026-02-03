If you are instructed to write fez component then ALWAYS write it in
demo/fez/[name].fez

All documentation and demos go INSIDE the .fez file (no separate .html files):

- `<info>` block - component description and props documentation
- `<demo>` block - usage examples with h4 titles

Example structure:

```html
<info>
  <ul>
    <li>Features: description</li>
    <li>Props: <code>name</code> - description</li>
  </ul>
</info>

<demo>
  <h4>Example title</h4>
  <my-component prop="value"></my-component>
</demo>

<script>
  ...
</script>
<style>
  :fez {
    /* all styles go inside :fez — never write global/body styles */
  }
</style>
<!-- template markup here -->
```

## FAST Rendering

- `FAST = true` — synchronous render, prevents flash of unstyled content
- Place as a **class property** (first line inside `class { }`), never as a standalone statement
- Do **NOT** use when component reads innerHTML, slot content, or `this.root.textContent` in `init()`

## External Libraries (Three.js, Charts, etc.)

When integrating external DOM libraries:

1. Template markup is fine - define containers normally
2. Get element references in `onMount()` with `this.find('.selector')`
3. **Avoid `this.state` for UI updates** - Idiomorph diffing doesn't work well with external DOM
4. Update elements directly: `this.overlay.style.display = 'none'`
5. Clean up in `onDestroy()`

See `ui-3d-viewer.fez` for a complete Three.js example.
