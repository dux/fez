// component to render google fonts icons
Fez('ui-list', class {
  css = `
    li {
      font-weight: bold;
    }
  `

  HTML = `
    {{#if @colors[0]}}
      <p>
        Inside code blocks <code>{ { ... } }</code>, <code>@</code> will be replaced with <code>this.</code>
      </p>
      <h4>for loop, with index</h4>
      <ul>
        {{#for color, index in @colors}}
          <li style="color: {{ color }};">
            {{ index + 1}}. {{ color }}
          </li>
        {{/for}}
      </ul>
    {{else}}
      <p>no colors</p>

      <h3>Insert HTML example - bold italic</h3>

      <p>Escaped: {{ @example }}</p>
      <p>Raw: {{@html @example }} (prefix with <code>@html</code>)</p>
    {{/if}}
  `

  connect() {
    this.colors = this.root.innerHTML.trim().split(',')

    this.example = `<strong><i>bold & italic</i></strong>`
  }
})
