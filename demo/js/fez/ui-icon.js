$(document.head).append(`
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
`)

// component to render google fonts icons
Fez('ui-icon', class extends window.FezBase {
  // default node name is div
  static nodeName = 'span'

  static style() {
    return `
      &.material-symbols-outlined {
        font-variation-settings:
        'FILL' 0,
        'wght' 400,
        'GRAD' 0,
        'opsz' 24
      }
    `
  }

  setSize(size) {
    this.$root.css('font-size', `${size}px`)
  }

  connect(root, props) {
    const icon = this.props.name || this.root.innerHTML.trim()
    this.color = this.props.color || '#00'

    root.addClass('material-symbols-outlined')
    root.css('color', this.color)
    root.html(icon)
  }
})
