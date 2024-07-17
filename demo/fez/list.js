// component to render google fonts icons
Fez('ui-list', class extends FezBase {
  css = `
    li {
      font-weight: bold;
    }
  `

  static html = `
    {{#if @colors[0]}} @ will be replaced with this.
      <ul>
        {{#for color in @colors}}
          <li style="color: {{ color }};">{{ color }}</li>
        {{/for}}
      </ul>
    {{else}}
      <p>no colors, here is object</p>

      <h4>for loop, no index</h4>

      {{#for [key, value] in this.objectData}}
        <p>{{ key }} : {{ value }}</p>
      {{/for}}

      <h4>each loop, with index</h4>

      {{#each this.objectData as [key, value], index }}
        <p>
          {{ key }} : <i>{{ value }}</i> : {{ index }}
        </p>
      {{/each}}
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
