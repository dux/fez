<img src="public/fez.webp" align="right" />

# FEZ - Custom DOM Elements

FEZ is a small opinionated library that allows writing of [Custom DOM elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Components/Using_custom_elements) in a clean and easy-to-understand way.

## Why opinionated?

Uses [goober](https://goober.js.org/) to parse scss and [mustache](http://github.com/janl/mustache.js) to render templates. Latest version of libs is baked in Fez distro.

It uses minimal abstraction. You will learn to use it in 3 minutes, just look at example, it includes all you need to know.

## Litte more details

Basically, it is logical variant of [lit.js](https://lit.dev/) or [Rails Stimulus](https://stimulus.hotwired.dev/). FEZ uses native DOM instead of shadow DOM, has an easy-to-debug and "hack" interface, and tries to be as close to vanilla JS as possible. If you need TypeScript support, Shadow DOM, or a stronger community, use Lit.

It replaces modern JS frameworks by using native Autonomous Custom Elements to create new HTML tags. This has been supported for years in [all major browsers](https://caniuse.com/custom-elementsv1).

This article, [Web Components Will Replace Your Frontend Framework](https://www.dannymoerkerke.com/blog/web-components-will-replace-your-frontend-framework/), is from 2019. Join the future, ditch React, Anguar and other never defined, allways "evolving" monstrositoes. Vanilla is the way.

## How it works

* define your custom component - `Fez('ui-foo', class UiFoo extends FezBase)`
* add HTML - `<ui-foo bar="baz" id="node1"></ui-foo>`
  * lib will call `node1.fez.connect()` when node is added to DOM and connect your component to dom.

That is all.

## What can it do?

* It can create and define Custom HTML tags
* it can style components using SCSS [goober](https://goober.js.org/).
* it has all needed helper methods as scssToClass(), formData(), setInterval() that triggers only while node is connected, etc
* it can fill slots and call local methods easily
* It has garbage collector, just add tags to HTML and destroy as you which.
* It supports CSS animations, but you have to add them yourself in css :). No beautifull support as once can find in Svelte.

## Wheat it does not do?

It has no build in routing. All else, you can easily do. Works great with any server side rendering or libs like [HTMLX](https://htmx.org/).

It has no global store, but do you really need it?.

## Why?

Because it is plain DOM + HTML. There is no framework, as React, Svelte, Vue, Angualr etc.
There is nothing to learn or "fight", or overload or "monkey patch" or anything. It just works.

There is on drawback too. If it works in Vannila JS, it will work here to.

It great in combination with another wide ude JS libs, as jQuery, Zepto, underscore of loDash.

## Full available interface

```js
// add global css
Fez.globalCss(`
  .some-class {
    color: red;
    .foo { ... }
  }
  ...
`)

Fez('foo-bar', class extends FezBase {
  // set element style, set as property or method
  static style() { .. }
  static style = ` scss string... `

  // set element node name, set as property or method, defaults to DIV
  static nodeName = 'span'
  static nodeName(node) { ... }

  connect() {
    // internal, get unique ID for a string, poor mans MD5
    const uid = this.klass.fnv1('some string')

    // copy attributes from attr hash to root node
    this.copy('href', 'onclick', 'style')

    // internal, check if node is attached
    this.isAttached()

    // copy all child nodes from source to target, without target returns tm node
    this.slot(someNode, tmpRoot)
    const tmpRoot = this.slot(self.root)

    // interval that runes only while node is attached
    this.setInterval(func, tick) { ... }

    // get closest form data as object
    this.formData()

    // get generated css class (uses gobber.js)
    const localCssClass = this.css(text)

    // render string via mustache and attaches html to root
    // to return rendered string only, use renderString(text, context)
    this.html(`
      <ul>
        {{#list}}
          <li>
            <input type="text" onkeyup="$$.list[{{num}}].name = this.value" value="{{ name }}" class="i1" />
          </li>
        {{/list}}
      </ul>
      <span class="btn" onclick="$$.getData()">read</span>
    `)
  }
})
```

## Examples

All examples are avaliable on [jsitor](https://jsitor.com/QoResUvMc).

### Show time ticker and change border color on refresh

This component explains all basic concepts.

If you understand how this works, you know FEZ. I am sorry it is this simple.

* you add custom dom nodes as simple HTML tags. You can pass args too.
* you can set your desired node name via `nodeName` static method, defaults to `div`.
* you can define custom style with modern features.
* when tag (node) is added to HTML DOM
  * `Fez` component is created and `connect()` is called
  * `this.setInterval(...)` loops only if node is attached to doom.
    Clears itself once node is detached from DOM.
  * this is all, now you are free to do whatever you want.

###### HTML
```html
<ui-time city="Zagreb"></ui-time>
```

###### JS
```js
Fez('ui-time', class extends window.FezBase {
  // default node name is DIV, fell free to change.
  // Why native node name, in this case "<ui-time" is not used is explained in FAQ.
  static nodeName = 'div'

  // when element is used for the first, global element style will be injected in document head
  // style will nave id="fez-style-ui-time"
  static css(`
    border: 5px solid green;
    border-radius: 10px;
    padding: 10px;
    font-family: var(--font-family);

    button {
      font-size: 16px;
    }
  `)

  // plain JS function to get random color
  getRandomColor() {
    const colors = ['red', 'blue', 'green', 'teal', 'black', 'magenta']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  updateTime() {
    // this.$root will return jQuery root. shortcut for $(this.root)
    // without jQuery: this.root.querySelector('.time').innerHTML = new Date()
    this.$root.find('.time').html(new Date())
  }

  // update border color, with random color
  refresh() {
    this.$root.css('border-color', this.getRandomColor())
  }

  connect() {
    // Fez(this) will return pointer to first root FEZ component.
    // If you want to target specific one by name, add it as second argument -> Fez(this, 'ui-time2')
    this.html`
      ${this.props.city}:
      <span class="time">${new Date()}</span>
      &mdash;
      <button onclick="$$.refresh()">refresh</button>
    `

    // use FEZ internal setInterval, It is auto cleared when node is removed from DOM.
    this.setInterval(this.updateTime, 1000)
  }
})
```

## More in detail

### when fez init runs

* attaches HTML DOM  to`this.root`
* jQuery wrapped root node will be available via `this.$root`
* classes `fez` and `fez-ui-foo` will be aded to root.
* adds pointer to instance object to `fez` property (`<div class="fez fez-ui-foo" onclick="console.log(this.fez)"`)
  * in parent nodes access it via `Fez(this)` with optional tag name `Fez(this, 'ui-foo')`. It will look for closest FEZ node.
* creates object for node attributes, accessible via `this.props`. `<ui-foo name="Split">` -> `this.props.name`

### style()

* You can define it as string or a method.
* If you omit style tag, css will be wrapped in component.
* if you define style tag, only ID will be added and content will be copied "as it is"

Do not forget nesting is supported in CSS now, you do not need scss and similar pre-processors.

#### Examples

```js
Fez('ui-foo', class extends window.FezBase {
  static style = `color: blue;`

  // or
  static style() { return `color: blue;` }

  // or use this if you want to inject global styles
  static style = `<style>
    html {
      color: red;
    }

    .fez-ui-foo {
      color: blue;

      button {
        font-size: 20px;
        font-family: var(--button-font);
      }
    }
  <style>`

  // ...
}
```

###### produces
```html
<html>
  <head>
    <style id="fez-style-ui-foo">
    .fez-ui-foo {
      color: blue;
    }
    </style>
    ...
  <head>
  ...
```

### forms

There is FEZ instance helper method `this.formData()`, that will get form data for a current or closest form.

You can pass node DOM refrence, for a form you want to capture data from.

### how to call custom FEZ node from the outside, anywhere in HTML

Inside `connect()`, you have pointer to `this`. Pass it anywhere you need, even store in window.

Example: Dialog controller

```html
<ui-dialog id="main-dialog"></ui-dialog>
```

```js
Fez('ui-dialog', class extends FezBase {
  close() {
    ...
  }

  connect() {
    window.Dialog = this
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

* ### this.class.getAttributes(node)

  Gets node attributes as object

  ```js
    connect() => {
      const currentAttrs = this.class.getAttributes(this.root)
    }
  ```

* ### this.class.css(text)

  Static `css()` method adds css globaly, to `document.body`.

## instance attributes

* ### this.props

  List of given node attributes is converted to props object

* ### this.root

  Pointer to Fez root node.

* ### this.$root

  jQuery wrapped root, if jQuery is present.

## instance functions

* ### this.connect(root, props)

  Called after DOM node is connected to Fez instance.

* ### this.copy(attr1, artr2, ...)

  Copies atrributes from attribute object to root as node attributes. If attribute is false, it is skipped.

  ```js
    connect() => {
      this.copy('href', 'onclick', 'style', 'target')
    }
  ```

* ### this.slot(source, target = null)

  Moves all child nodes from one node to another node.

  ```js
    connect() => {
      // move all current child nodes to tmpNode
      const tmpNode = this.slot(this)

      // move all child nodes from node1 to node2
      const tmpNode = this.slot(node1, node2)
    }
  ```

* ### this.html(htmlString)

  Inject htmlString as root node innerHTML

  * replace `$$.` with local pointer.
  * replaces `<slot />` with given root

  ```js
    getData() => {
      alert('data!')
    }

    connect() => {
      this.html`
        <ul>
          {{#list}}
            <li>
              <input type="text" onkeyup="$$.list[{{num}}].name = this.value" value="{{ name }}" class="i1" />
            </li>
          {{/list}}
        </ul>
        <span class="btn" onclick="$$.getData()">read</span>
      `
    }
  ```

* ### this.renderString(text, context or this)

  Same as `this.html()` but

  * it does not render slot
  * returns string instead attaching to `this.root`.


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


