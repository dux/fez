Fez('ui-box', class extends window.FezBase {
 // demo for inline style
  static css = `
    border: 2px solid #aaa;
    border-radius: 4px;
    padding: 0 10px;
    background-color: #eee;

    h3 {
      color: red;
    }
  `

  connect() {
    this.html(`
      <h3>${this.props.title || 'no title'}</h3>
      <slot></slot>
    `)
  }
})
