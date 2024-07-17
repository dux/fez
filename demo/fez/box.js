Fez('ui-box', class extends FezBase {
  static css = `
    .fez-ui-box {
      border: 2px solid #aaa;
    }
  `

 // demo for inline style
  css = `
    border-radius: 4px;
    padding: 1px 20px;
    margin-bottom: 20px;
    background-color: #eee;
    h3 {
      color: red;
    }
  `

  connect() {
    this.render(`
      <h3>${this.props.title || 'no title'}</h3>
      <slot />
    `)
  }
})
