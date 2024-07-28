$(document.head).append(`
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
`)

// component to render google fonts icons
Fez('ui-icon', class {
  // default node name is div
  NAME = 'span'

  CSS = `
    &.material-symbols-outlined {
      font-variation-settings:
      'FILL' 0,
      'wght' 400,
      'GRAD' 0,
      'opsz' 24
    }
  `

  setSize(size) {
    this.$root.css('font-size', `${size}px`)
  }

  onPropsChange(name, value) {
    if (name == 'color') {
      this.$root.css('color', value)
    }
  }

  connect(root, props) {
    this.copy('onclick')

    const icon = this.props.name || this.root.innerHTML.trim()
    this.color = this.props.color || '#00'

    this.$root.addClass('material-symbols-outlined')
    this.$root.css('color', this.color)
    this.render(icon)
  }
})
