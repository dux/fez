<img src="demo/fez.png" align="right" width="110" />

# FEZ - Custom DOM Elements

Check the Demo site https://dux.github.io/fez/

FEZ is a small library (20kb minified) that allows writing of [Custom DOM elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Components/Using_custom_elements) in a clean and easy-to-understand way.

It uses

* [Goober](https://goober.js.org/) to enable runtime SCSS (similar to styled components)
* [Idiomorph](https://github.com/bigskysoftware/idiomorph) to morph DOM from one state to another (as React or Stimulus/Turbo does it)

Latest version of libs are baked in Fez distro.

It uses minimal abstraction. You will learn to use it in 15 minutes, just look at examples, it includes all you need to know.

## How to install

`<script src="https://dux.github.io/fez/dist/fez.js"></script>`

## Little more details

Uses DOM as a source of truth and tries to be as close to vanilla JS as possible. There is nothing to learn or "fight", or overload or "monkey patch" or anything. It just works.

Although fastest, Modifying DOM state directly in React / Vue / etc. is considered an anti-pattern. For `Fez` this is just fine if you want to do it. `Fez` basically modifies DOM, you just have a few helpers to help you do it.

It replaces modern JS frameworks by using native Autonomous Custom Elements to create new HTML tags. This has been supported for years in [all major browsers](https://caniuse.com/custom-elementsv1).

This article, [Web Components Will Replace Your Frontend Framework](https://www.dannymoerkerke.com/blog/web-components-will-replace-your-frontend-framework/), is from 2019. Join the future, ditch React, Angular and other never defined, always "evolving" monstrosities. Vanilla is the way :)

There is no some "internal state" that is by some magic reflected to DOM. No! All methods Fez use to manipulate DOM are just helpers around native DOM interface. Work on DOM raw, use jQuery, use built in [node builder](https://github.com/dux/fez/blob/main/src/lib/n.js) or full template mapping with [morphing](https://github.com/bigskysoftware/idiomorph).

It great in combination with another widely used JS libs, as jQuery, Zepto, underscore of loDash.

## How it works

* define your custom component - `Fez('ui-foo', class UiFoo extends FezBase)`
* add HTML - `<ui-foo bar="baz" id="node1"></ui-foo>`
  * lib will call `node1.fez.init()` when node is added to DOM and connect your component to dom.
  * use `Fez` helper methods, or do all by yourself, all good.

That is all.

## Example: Counter Component

Here's a simple counter component that demonstrates Fez's core features:

```html
<!-- Define a counter component in ex-counter.fez.html -->
<script>
  init() {
    // called when Fez node is connected to DOM
    this.MAX = 6
    this.state.count = 0
  }

  isMax() {
    // is state is changed, template is re-rendered
    return this.state.count >= this.MAX
  }

  more() {
    this.state.count += this.isMax() ? 0 : 1
  }
</script>

<style>
  /* compiles from scss to css and injects class in head */
  /* body style */
  background-color: #f7f7f7;

  /* scoped to this component */
  :fez {
    zoom: 2;
    margin: 10px 0;

    button {
      position: relative;
      top: -3px;
    }

    span {
      padding: 0 5px;
    }
  }
</style>

<button onclick="fez.state.count -= 1" disabled={{ state.count == 1 }}>-</button>

<span>
  {{ state.count }}
</span>

<button onclick="fez.more()" disabled={{ isMax() }}>+</button>
{{if state.count > 0}}
  <span>&mdash;</span>
  {{if state.count == MAX }}
    MAX
  {{else}}
    {{#if state.count % 2 }}
      odd
    {{else}}
      even
    {{/if}}
  {{/if}}
{{/if}}
```

To use this component in your HTML:

```html
<!-- Load Fez library -->
<script src="https://dux.github.io/fez/dist/fez.js"></script>

<!-- Load component via template tag -->
<template fez="/fez-libs/ex-counter.fez.html"></template>

<!-- Use the component -->
<ex-counter></ex-counter>
```

This example showcases:
- **Reactive state**: Changes to `this.state` automatically update the DOM
- **Template syntax**: `{{ }}` for expressions, `@` as shorthand for `this.`
- **Event handling**: Direct DOM event handlers with access to component methods
- **Conditional rendering**: `{{#if}}`, `{{:else}}` blocks for dynamic UI
- **Scoped styling**: SCSS support with styles automatically scoped to component
- **Component lifecycle**: `init()` method called when component mounts

## What can it do and why is it great?

### Core Features

* **Native Custom Elements** - Creates and defines Custom HTML tags using the native browser interface for maximum performance
* **Server-Side Friendly** - Works seamlessly with server-generated HTML, any routing library, and progressive enhancement strategies
* **Semantic HTML Output** - Transforms custom elements to standard HTML nodes (e.g., `<ui-button>` → `<button class="fez fez-button">`), making components fully stylable with CSS
* **Single-File Components** - Define CSS, HTML, and JavaScript in one file, no build step required
* **No Framework Magic** - Plain vanilla JS classes with clear, documented methods. No hooks, runes, or complex abstractions
* **Runtime SCSS** - Style components using SCSS syntax via [Goober](https://goober.js.org/), compiled at runtime
* **Smart Memory Management** - Automatic garbage collection cleans up disconnected nodes every 5 seconds

### Advanced Templating & Styling

* **Powerful Template Engine** - Multiple syntaxes (`{{ }}` and `[[ ]]`), control flow (`#if`, `#unless`, `#for`, `#each`), and block templates
* **Reactive State Management** - Built-in reactive `state` object automatically triggers re-renders on property changes
* **DOM Morphing** - Uses [Idiomorph](https://github.com/bigskysoftware/idiomorph) for intelligent DOM updates that preserve element state and animations
* **Style Macros** - Define custom CSS shortcuts like `Fez.styleMacro('mobile', '@media (max-width: 768px)')` and use as `:mobile { ... }`
* **Scoped & Global Styles** - Components can define both scoped CSS (`:fez { ... }`) and global styles in the same component

### Developer Experience

* **Built-in Utilities** - Helpful methods like `formData()`, `setInterval()` (auto-cleanup), `onResize()`, and `nextTick()`
* **Two-Way Data Binding** - Use `fez-bind` directive for automatic form synchronization
* **Advanced Slot System** - Full `<slot />` support with event listener preservation
* **Publish/Subscribe** - Built-in pub/sub system for component communication
* **Dynamic Component Loading** - Load components from URLs with `<template fez="path/to/component.html">`
* **Auto HTML Correction** - Fixes invalid self-closing tags (`<fez-icon name="gear" />` → `<fez-icon name="gear"></fez-icon>`)

### Performance & Integration

* **Fast/Slow Render Modes** - Optimize initial render with `FAST = true` to prevent flickering
* **Request Animation Frame** - Smart RAF integration for smooth updates
* **Built-in Fetch with Caching** - `Fez.fetch()` includes automatic response caching and JSON/FormData handling
* **Global Component Access** - Register components globally with `GLOBAL = 'ComponentName'` for easy access
* **Rich Lifecycle Hooks** - `init`, `onMount`, `beforeRender`, `afterRender`, `onDestroy`, `onPropsChange`
* **Development Mode** - Enable detailed logging with `Fez.DEV = true`

### Why It's Great

* **Zero Build Step** - Just include the script and start coding
* **20KB Minified** - Tiny footprint with powerful features
* **Framework Agnostic** - Use alongside React, Vue, or any other framework
* **Progressive Enhancement** - Perfect for modernizing legacy applications one component at a time
* **Native Performance** - Leverages browser's native Custom Elements API
* **Intuitive API** - If you know vanilla JavaScript, you already know Fez

## Full available interface

### Fez Static Methods

```js
Fez('#foo')          // find fez node with id="foo"
Fez('ui-tabs', this) // find first parent node ui-tabs

// add global scss
Fez.globalCss(`
  .some-class {
    color: red;
    &.foo { ... }
    .foo { ... }
  }
  ...
`)

// internal, get unique ID for a string, poor mans MD5 / SHA1
Fez.fnv1('some string')

// get generated css class name, from scss source string
Fez.css(text)

// get generated css class name without global attachment
Fez.cssClass(text)

// display information about fast/slow bind components in console
Fez.info()

// low-level DOM morphing function
Fez.morphdom(target, newNode, opts)

// HTML escaping utility
Fez.htmlEscape(text)

// create HTML tags with encoded props
Fez.tag(tag, opts, html)

// execute function until it returns true
Fez.untilTrue(func, pingRate)

// add scripts/styles to document head
// Load JavaScript from URL: Fez.head({ js: 'path/to/script.js' })
// Load JavaScript with attributes: Fez.head({ js: 'path/to/script.js', type: 'module', async: true })
// Load JavaScript with callback: Fez.head({ js: 'path/to/script.js' }, () => console.log('loaded'))
// Load JavaScript module and auto-import to window: Fez.head({ js: 'path/to/module.js', module: 'MyModule' })
// Load CSS: Fez.head({ css: 'path/to/styles.css' })
// Load CSS with attributes: Fez.head({ css: 'path/to/styles.css', media: 'print' })
// Execute inline script: Fez.head({ script: 'console.log("Hello world")' })
Fez.head(config, callback)

// define custom style macro
// Fez.styleMacro('mobile', '@media (max-width:  768px)')
// :mobile { ... } -> @media (max-width:  768px) { ... }
Fez.styleMacro(name, value)

// define custom DOM node name -> <foo-bar>...
Fez('foo-bar', class {
  // set element node name, set as property or method, defaults to DIV
  // why? because Fez renames custom dom nodes to regular HTML nodes
  NAME = 'span'
  NAME(node) { ... }
  // alternative: static nodeName = 'span'

  // set element style, set as property or method
  CSS = `scss string... `

  // unless node has no innerHTML on initialization, bind will be set to slow (fastBind = false)
  // if you are using components that to not use innerHTML and slots, enable fast bind (fastBind = true)
  // component will be rendered as parsed, and not on next tick (reduces flickering)
  // <fez-icon name="gear" />
  FAST = true
  FAST(node) { ... }
  // alternative: static fastBind() { return true }

  // define static HTML. calling `this.render()` (no arguments) will refresh current node.
  // if you pair it with `reactiveStore()`, to auto update on props change, you will have Svelte or Vue style reactive behaviour.
  HTML = `...`

  // Make it globally accessible as `window.Dialog`
  // The component is automatically appended to the document body as a singleton. See `demo/fez/ui-dialog.fez` for a complete example.
  GLOBAL = 'Dialog'
  GLOBAL = true // just append node to document, do not create window reference

  // use connect or created
  init(props) {
    // copy original attributes from attr hash to root node
    this.copy('href', 'onclick', 'style')

    // set style property to root node. look at a clock example
    // shortcut to this.root.style.setProperty(key, value)
    this.setStyle('--color', 'red')

    // clasic interval, that runs only while node is attached
    this.setInterval(func, tick) { ... }

    // get closest form data, as object
    this.formData()

    // mounted DOM node root
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

    // you can publish globally, and subscribe locally
    Fez.publish('channel', foo)
    this.subscribe('channel', (foo) => { ... })

    // gets root childNodes
    this.childNodes()
    this.childNodes(func)  // pass function to loop forEach on selection, removed nodes from DOM

    // check if the this.root node is attached to dom
    this.isConnected()

    // on every "this.state" props change, auto update view.
    this.state = this.reactiveStore()
    // this.state has reactiveStore() attached by default. any change will trigger this.render()
    this.state.foo = 123

    // window resize event with cleanup
    this.onResize(func, delay)

    // requestAnimationFrame wrapper with deduplication
    this.nextTick(func, name)

    // get/set unique ID for root node
    this.nodeId()

    // get/set attributes on root node
    this.attr(name, value)

    // hide the custom element wrapper and move children to parent
    this.fezHide()

    // execute after connect and initial component render
    this.onMount() { ... } // or this.connected() { ... }

    // execute before or after every render
    this.beforeRender() { ... }
    this.afterRender() { ... }

    // if you want to monitor new or changed node attributes
    // monitors all original node attributes
    // <ui-icon name="home" color="red" />
    this.onPropsChange(attrName, attrValue) { ... }

    // called when component is destroyed
    this.onDestroy() { ... }

    // automatic form submission handling if defined
    this.onSubmit(formData) { ... }

    // render template and attach result dom to root. uses Idiomorph for DOM morph
    this.render()

    // you can render to another root too
    this.render(this.find('.body'), someHtmlTemplate)
  }
})
```

## Fez script loading and definition

```html
  <!-- Remote loading for a component via URL in fez attribute -->
  <!-- Component name is extracted from filename (ui-button) -->
  <!-- If remote HTML contains template/xmp tags with fez attributes, they are compiled -->
  <!-- Otherwise, the entire content is compiled as the component -->
  <script fez="path/to/ui-button.fez.html"></script>

  <!-- prefix with : to calc before node mount -->
  <foo-bar :size="document.getElementById('icon-range').value"></foo-bar>

  <!-- pass JSON props via data-props -->
  <foo-bar data-props='{"name": "John", "age": 30}'></foo-bar>

  <!-- pass JSON template via data-json-template -->
  <script type="text/template">{...}</script>
  <foo-bar data-json-template="true"></foo-bar>

  <!-- override slow bind behavior -->
  <foo-bar fez-fast="true"></foo-bar>
```

## Component structure

All parts are optional

```html
<!-- Head elements support (inline only in XML tags) -->
<xmp tag="some-tag">
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
    b {
      color: red; /* will be global style*/
    }

    :fez {
      /* component styles */
    }
  </style>
  <style>
    color: red; /* if "body {" or ":fez {" is not found, style is considered local component style */
  </style>

  <div> ... <!-- any other html after head, script or style is considered template-->
    <!-- resolve any condition -->
    {{if foo}} ... {{/if}}

    <!-- unless directive - opposite of if -->
    {{unless fez.list.length}}
      <p>No items to display</p>
    {{/unless}}

    <!-- runs in node scope, you can use for loop -->
    {{each fez.list as name, index}} ... {{/each}}
    {{for name, index in fez.list}} ... {{/for}}

    <!-- Block definitions -->
    {{block image}}
      <img src={{ props.src}} />
    {{/block}}
    {{block:image}}<!-- Use the header block -->
    {{block:image}}<!-- Use the header block -->

    <!-- fez-this will link DOM node to object property (inspired by Svelte) -->
    <!-- this.listRoot -->
    <ul fez-this="listRoot">

    <!-- when node is added to dom fez-use will call object function by name, and pass current node -->
    <!-- this.animate(node) -->
    <li fez-use="animate">

    <!-- fez-bind for two-way data binding on form elements -->
    <input type="text" fez-bind="state.username" />
    <input onkeyup="fez.list[{{ index }}].name = fez.value" value="{{ name }}" />

    <!-- fez-class for adding classes with optional delay -->
    <span fez-class="active:100">Delayed class</span>

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
const data = await Fez.fetch('https://api.example.com/data')

// GET request with callback, does not create promise
Fez.fetch('https://api.example.com/data', (data) => {
  console.log(data)
})

// POST request
const result = await Fez.fetch('POST', 'https://api.example.com/data', { key: 'value' })
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
    console.error('Fetch failed:', error)
    // Show user-friendly error message
  }
}
```
