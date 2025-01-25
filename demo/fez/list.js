// component to render google fonts icons
Fez('ui-list', class {
  css = `
    li {
      font-weight: bold;
    }
  `

  HTML = `
    {{#if @colors[0]}} @ will be replaced with this.
      <ul>
        {{#for color in @colors}}
          <li style="color: {{ color }};">{{ color }}</li>
        {{/for}}
      </ul>
    {{else}}
      <p>no colors, here is object</p>

      <h4>for loop, no index</h4>

      <h4>each loop, with index</h4>

    {{/if}}
  `

  connect() {
    this.colors = this.root.innerHTML.trim().split(',')

    this.objectData = {
      foo: 'bar',
      baz: 1234
    }
  }
})
