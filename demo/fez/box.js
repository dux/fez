Fez.globalCss(`
  .fez-ui-box {
    border: 2px solid #aaa;
  }
`)

Fez('ui-box', class extends FezBase {
 // demo for inline style
  static css = `
    border-radius: 4px;
    padding: 1px 20px;
    margin-bottom: 20px;
    background-color: #eee;

    h3 {
      color: red;
    }
  `

  connect() {
    this.html(`
      <h3>${this.props.title || 'no title'}</h3>
      <slot />
    `)
  }
})
