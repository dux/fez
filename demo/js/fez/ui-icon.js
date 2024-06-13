// component to render google fonts icons
Fez('ui-icon', class extends window.FezBaze {
  // default node name is div
  static nodeName = 'span'

  // if you want to load icons on first use, then instead of 'static preload()' use 'once()'
  static preload() {
    $(document.head).append(`
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
    `)
  }

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

  connect() {
    const icon = this.attrs.name || this.root.innerHTML.trim()
    this.color = this.attrs.color || '#00'

    this.$root.addClass('material-symbols-outlined')
    this.$root.css('color', this.color)
    this.$root.html(icon)
  }
})
