$.cde('ui-time', class extends BaseCde {
  static nodeName = 'div'

  static style = `
    border: 5px solid green;
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
    this.$root.find('.time').html(new Date())
  }

  refresh() {
    this.$root.css('border-color', this.getRandomColor())
  }

  connect() {
    this.root.innerHTML = `${this.attrs.city}: <span class="time">${new Date()}</span> &mdash; <button onclick="$.cde(this).refresh()">refresh</button>`
    this.setInterval(this.updateTime, 1000)
  }
})
