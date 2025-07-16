<img src="demo/fez.png" align="right" width="110" />

# FEZ - Custom DOM Elements

### jQuery taught me simplicity, I added Svelte's elegance, just drop in and code!

#### First look at examples at [https://dux.github.io/fez/](https://dux.github.io/fez), and if everything else fails, then read this documentation :)

<hr />

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
{{#if state.count > 0}}
  <span>&mdash;</span>
  {{#if state.count == MAX }}
    MAX
  {{:else}}
    {{#if state.count % 2 }}
      odd
    {{:else}}
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

* It can create and define Custom HTML tags, libs main feature. It uses native, fast browser interface to do it.
* It plays great with server generated code, because this is a component library. You are free to use any routing and server logic you prefer.
* Before `init()`, it will rename custom dom node name and create standard HTML node. For example `<ui-button>` can be converted to `<button class="fez fez-button btn btn-empty">...`. This makes all `Fez` components stylable in root (you can't style `ui-button`).
* I will use one file to define CSS, HTML and code.
* It does not need server side compiling.
* There is no magic as Svelte runes, React hooks, states and whatever. Plain vanilla JS classes with "few" documented functions.
* it can style components using SCSS, using [goober](https://goober.js.org/).
* it has few useful built in helper methods as formData(), setInterval() that triggers only while node is connected, etc
* it has `<slot />` support
* It has garbage collector, just add tags to HTML and destroy DOM nodes as you wish.
* It will close "HTML invalid" inline items before rendering `<fez-icon name="gear" />` -> `<fez-icon name="gear"></fez-icon>`
* it has built in publish-subscribe, where only connected nodes will be able to publish and receive subs.
* It morphs DOM, state is preserved on changes.
* It can have full state &lt;> template sync using `reactiveStore()`
* Development mode logging - set `window.DEV = true` to see when components are created

## What it does not do?

* It has no build in routing. This is lib for building DOM components. Works great with any server side rendering or libs like [HTMLX](https://htmx.org/) or even React or Angular. Fez is great way to continue working on legacy JS apps that are too complicated to migrate. Just write new components in Fez.

## Full available interface

### Fez Static Methods

```js
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

// add scripts/styles to document head
Fez.head(text, kind)

// execute function until it returns true
Fez.untilTrue(func, pingRate)

// dynamic script/CSS loader
Fez.getScript(src, attributesOrCallback, callback)

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

  // use connect or created
  init(props) {
    // copy attributes from attr hash to root node
    this.copy('href', 'onclick', 'style')

    // set style property to root node. look at a clock example
    // shortcut to this.root.style.setProperty(key, value)
    this.style('--color', 'red')

    // clasic interval, that runs only while node is attached
    this.setInterval(func, tick) { ... }

    // get closest form data, as object
    this.formData()

    // mounted DOM node root
    this.root

    // mounted DOM node root wrapped in $, only if jQuery is available
    this.$root

    // node properties as Object
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

    // gets root childNodes. pass function to loop forEach on selection
    this.childNodes(func)

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

    // render template and attach result dom to root. uses Idiomorph for DOM morph
    this.render(`
      <!-- resolve any condition -->
      {{if fez.list[0]}}

        <!-- fez-this will link DOM node to object property (inspired by Svelte) -->
        <ul fez-this="listRoot">

          <!-- runs in node scope -->
          {{#each fez.list as name, index}}

          <!-- you can use for loop -->
          {{#for name, index in fez.list}}
            <!--
              fez-use will call object function by name, and pass current node,
              when node is added to dom (Inspired by Svelte)
            -->
            <li fez-use="animate">
              <!-- fez-bind for two-way data binding on form elements -->
              <input type="text" fez-bind="state.username" />
              <input onkeyup="fez.list[{{ index }}].name = fez.value" value="{{ name }}" />

              <!-- :attribute for evaluated attributes (converts to JSON) -->
              <div :data-config="state.config"></div>

              <!-- fez-class for adding classes with optional delay -->
              <span fez-class="active:100">Delayed class</span>

            </li>
          {{/each}}
        </ul>
      {{/if}}

      <!-- unless directive - opposite of if -->
      {{#unless fez.list.length}}
        <p>No items to display</p>
      {{/unless}}

      <!-- Block definitions and usage -->
      {{#block header}}
        <h1>Default header</h1>
      {{/block}}

      {{#block:header}}  <!-- Use the header block -->

      <!-- Head elements support (inline only in XML tags) -->
      <head>
        <script>console.log('Added to document head')</script>
      </head>
    `)
  }
  // you can render to another root too
  this.render(this.find('.body'), someHtmlTemplate)

  // execute after connect and initial component render
  this.onMount() { ... } // or this.connected() { ... }

  // execute before or after every render
  this.beforeRender() { ... }
  this.afterRender() { ... }

  // if you want to monitor new or changed node attributes
  this.onPropsChange(name, value) { ... }

  // called when component is destroyed
  this.onDestroy() { ... }

  // automatic form submission handling if defined
  this.onSubmit(formData) { ... }
})
```

```html
  <!-- Remote loading for a component via URL in fez attribute -->
  <template fez="path/to/ui-button.fez.html"></template>
  <xmp fez="https://example.com/components/ui-button.html"></xmp>

  <!-- Component name is extracted from filename (ui-button) -->
  <!-- If remote HTML contains template/xmp tags with fez attributes, they are compiled -->
  <!-- Otherwise, the entire content is compiled as the component -->

  <!-- wrap JS in {{ }} to calc before node mount -->
  <foo-bar size="{{ document.getElementById('icon-range').value }}"></foo-bar>

  <!-- pass JSON props via data-props -->
  <foo-bar data-props='{"name": "John", "age": 30}'></foo-bar>

  <!-- pass JSON template via data-json-template -->
  <!-- <script type="text/template">{...}</script> -->
  <foo-bar data-json-template="true"></foo-bar>

  <!-- override slow bind behavior -->
  <foo-bar fez-fast="true"></foo-bar>

  <!-- use : prefix for evaluated attributes -->
  <foo-bar :config="window.appConfig"></foo-bar>
```

## Examples / playground

Check the Demo site https://dux.github.io/fez/

## More in detail

### when fez init runs

* attaches HTML DOM  to`this.root`
* renames root node from original name to `static nodeName() // default DIV`
* classes `fez` and `fez-ui-foo` will be added to root.
* adds pointer to instance object to `fez` property (`<div class="fez fez-ui-foo" onclick="console.log(this.fez)"`)
  * in parent nodes access it via `Fez(this)` with optional tag name `Fez(this, 'ui-foo')`. It will look for closest FEZ node.
* creates object for node attributes, accessible via `this.props`. `<ui-foo name="Split">` -> `this.props.name == 'Split'`

### css()

You can add global or local styles.

### forms

There is FEZ instance helper method `this.formData()`, that will get form data for a current or closest form.

You can pass node DOM refrence, for a form you want to capture data from.

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

## static helper functions

* ### Fez.find(selectorOrNode, 'optional-tag-name')

Finds first closest Fez node.

* ### this.class.css(text)

  Static `css()` method adds css globally, to `document.body`.

## instance attributes

* ### this.props

  List of given node attributes is converted to props object

* ### this.root

  Pointer to Fez root node.

* ### this.$root

  jQuery wrapped root, if jQuery is present.

* ### this.state

  Reactive store that automatically triggers render() on changes (initialized by default)

* ### this.fezName

  Property containing the component's tag name

* ### this.fezHtmlRoot

  Property for getting the component reference string

* ### this.oldRoot

  Reference to original DOM node before transformation

* ### this.fezBlocks

  Internal storage for template blocks

## instance functions

* ### this.init(root, props)

  Called after DOM node is connected to Fez instance.

* ### this.copy(attr1, attr2, ...)

  Copies atrributes from attribute object to root as node attributes. If attribute is false, it is skipped.

  ```js
    init() => {
      this.copy('href', 'onclick', 'style', 'target')
    }
  ```

* ### this.slot(source, target = null)

  Moves all child nodes from one node to another node.

  ```js
    init() => {
      // move all current child nodes to tmpNode
      const tmpNode = this.slot(this)

      // move all child nodes from node1 to node2
      const tmpNode = this.slot(node1, node2)
    }
  ```

* ### this.render(htmlString)

  Inject htmlString as root node innerHTML

  * replace `fez.` with local pointer.
  * replaces `<slot />` with given root

  ```js
    getData() => {
      alert('data!')
    }

    init() => {
      this.render`
        <ul>
          {{#list}}
            <li>
              <input type="text" onkeyup="fez.list[{{num}}].name = this.value" value="{{ name }}" class="i1" />
            </li>
          {{/list}}
        </ul>
        <span class="btn" onclick="fez.getData()">read</span>
      `
    }
  ```

* ### this.parseHtml(text, context or this)

  Returns rendered string.


* ### this.css(text, optionalAddToRoot)

  Uses [goober](https://goober.js.org/) to render inline css.
  Same as React styled-components, it returns class that encapsulates given style.

  Pass second argument as true, to attach class to root node.

  ```js
  const className = this.css(`
    color: red;
      &.blue {
        color: blue;
      }
    }`
  )
  ```

* ### this.prop(name)

  Get single property. It will first look on original root node, if not found it will look for attribute.

  ```js
  const onClickFunction = this.prop('onclick')
  const idString = this.prop('id')
  ```

* ### this.onPropsChange(name, value)

  If you want to monitor new or changed node attributes.

  ```html
    <fez-icon id="icon-1" name="gear" color="red" />
  ```

  ```js
    Fez('fez-icon', class {
      // ...

      onPropsChange(name, value) {
        if (name == 'color') {
          this.setColor(value)
        }
      }
    })

    // same thing
    document.getElementById('icon-1').setAttribute('color', 'red')
    $('#icon-1').attr('color', 'red')
    Fez('#icon-1').setColor('red')
  ```

* ### this.reactiveStore({})

  Creates reactive store that updates this.render() on change. You can pass another reactivity function.

  Used in default TODO example.

  ```js
    this.reactiveStore({}, (o, k, v)=>{
      window.requestAnimationFrame(()=>{
        console.log(`key "${k}" changed to ${v}`)
        this.render())
      })
    })
  ```
