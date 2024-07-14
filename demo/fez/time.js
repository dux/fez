Fez('ui-time', class extends FezBase {
  static nodeName = 'div'

  static css = `
    border: 10px solid green;
    border-radius: 10px;
    padding: 10px;

    button {
      font-size: 16px;
    }
  `

  getRandomColor() {
    const colors = ['red', 'blue', 'green', 'teal', 'black', 'magenta']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  updateTime() {
    this.val('.time', new Date())
  }

  refresh() {
    this.root.style.borderColor = this.getRandomColor()
  }

  connect() {
    this.setInterval(this.updateTime, 1000)

    this.html(`
      ${this.props.city}: <span class="time">${new Date()}</span>
      <br />
      <br />
      <button onclick="Fez(this).refresh()">refresh color</button>
      &sdot;
      <button onclick="$$.refresh()">refresh color alt</button>
    `)
  }
})
