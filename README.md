# CDE - Custom DOM Elements

CDE is a small library that allows writing of [Custom DOM elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Components/Using_custom_elements) in a clean and easy-to-understand way.

It uses minimal abstraction. You will learn to use it in 3 minutes, just look at example, it includes all you need to know.

Basically, it is logical variant of [lit.js](https://lit.dev/) or [Rails Stimulus](https://stimulus.hotwired.dev/). CDE uses native DOM instead of shadow DOM, has an easy-to-debug and "hack" interface, and tries to be as close to vanilla JS as possible. If you need TypeScript support, Shadow DOM, or a stronger community, use Lit.

It replaces modern JS frameworks by using native Autonomous Custom Elements to create new HTML tags. This has been supported for years in [all major browsers](https://caniuse.com/custom-elementsv1).

This article, [Web Components Will Replace Your Frontend Framework](https://www.dannymoerkerke.com/blog/web-components-will-replace-your-frontend-framework/), is from 2019. Join the future, ditch React, Anguar and other never defined, allways "evolving" monstrositoes. Vanilla is the way.

## How it works

* define your custom component - `Cde('ui-foo', class UiFoo extends BaseCde)`
* add HTML - `<ui-foo bar="baz" id="node1"></ui-foo>`
  * lib will call `node1.cde.connect()` when node is added to DOM and connect your component to dom.

That is all.

## What can it do?

* It can create and define Custom HTML tags
* it can style components using modern CSS, you do not need SCSS any more.
  CSS variables and nesting is fully supported in major browsers.
* It has garbage collector, just add tags to HTML and destroy as you which.
* It supports CSS animations, but you have to add them yourself in css.

## Wheat it does not do?

It has no build in routing. All else, you can easily do. Works great with any server side rendering or libs like [HTMLX](https://htmx.org/).

It has no global store, but do you really need it?.

## Why?

Because it is plain DOM + HTML. There is no framework, as React, Svelte, Vue, Angualr etc.
There is nothing to learn or "fight", or overload or "monkey patch" or anything. It just works.

There is on drawback too. If it works in Vannila JS, it will work here to.

It great in combination with another wide ude JS libs, as jQuery, Zepto, underscore of loDash.

## Examples

All examples are avaliable on [jsitor](https://jsitor.com/QoResUvMc).

### Show time ticker and change border color on refresh

This component explains all basic concepts.

If you understand how this works, you know CDE. I am sorry it is this simple.

* you add custom dom nodes as simple HTML tags. You can pass args too.
* you can set your desired node name via `nodeName` static method, defaults to `div`.
* you can define custom style with modern features.
* when tag (node) is added to HTML DOM
  * `Cde` component is created and `connect()` is called
  * `this.setInterval(...)` loops only if node is attached to doom.
    Clears itself once node is detached from DOM.
  * this is all, now you are free to do whatever you want.

###### HTML
```html
<ui-time city="Zagreb"></ui-time>
```

###### JS
```js
Cde('ui-time', class extends window.BaseCde {
  // default node name is DIV, fell free to change.
  // Why native node name, in this case "<ui-time" is not used is explained in FAQ.
  static nodeName = 'div'

  // when element is used for the first, global element style will be injected in document head
  // style will nave id="cde-style-ui-time"
  static style = `
    border: 5px solid green;
    border-radius: 10px;
    padding: 10px;
    font-family: var(--font-family);

    button {
      font-size: 16px;
    }
  `

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
    // Cde(this) will return pointer to first root CDE component.
    // If you want to target specific one by name, add it as second argument -> Cde(this, 'ui-time2')
    this.root.innerHTML = `
      ${this.attrs.city}:
      <span class="time">${new Date()}</span>
      &mdash;
      <button onclick="Cde(this).refresh()">refresh</button>
    `

    // use CDE internal setInterval, It is auto cleared when node is removed from DOM.
    this.setInterval(this.updateTime, 1000)
  }
})
```

## More in detail

### when cde init runs

* attaches HTML DOM  to`this.root`
* jQuery wrapped root node will be available via `this.$root`
* classes `cde` and `cde-ui-foo` will be aded to root.
* adds pointer to instance object to `cde` property (`<div class="cde cde-ui-foo" onclick="console.log(this.cde)"`)
  * in parent nodes access it via `Cde(this)` with optional tag name `Cde(this, 'ui-foo')`. It will look for closest CDE node.
* creates object for node attributes, accessible via `this.attrs`. `<ui-foo name="Split">` -> `this.attrs.name`

### style()

* You can define it as string or a method.
* If you omit style tag, css will be wrapped in component.
* if you define style tag, only ID will be added and content will be copied "as it is"

Do not forget nesting is supported in CSS now, you do not need scss and similar pre-processors.

#### Examples

```js
Cde('ui-foo', class extends window.BaseCde {
  static style = `color: blue;`

  // or
  static style() { return `color: blue;` }

  // or use this if you want to inject global styles
  static style = `<style>
    html {
      color: red;
    }

    .cde-ui-foo {
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
    <style id="cde-style-ui-foo">
    .cde-ui-foo {
      color: blue;
    }
    </style>
    ...
  <head>
  ...
```

### forms

There is CDE instance helper method `this.formData()`, that will get form data for a current or closest form.

You can pass node DOM refrence, for a form you want to capture data from.

### how to call custom CDE node from the outside, anywhere in HTML

Inside `connect()`, you have pointer to `this`. Pass it anywhere you need, even store in window.

Example: Dialog controller

```html
<ui-dialog id="main-dialog"></ui-dialog>
```

```js
Cde('ui-dialog', class extends BaseCde {
  close() {
    ...
  }

  connect() {
    window.Dialog = this
  }
})


// close dialog window, from anywhere
Dialog.close()

// you can load via Cde + node selector
Cde('#main-dialog').close()
```


