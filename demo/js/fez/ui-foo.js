Fez('ui-foo', class extends window.FezBase {
  get rand() {
    return parseInt(Math.random() * 1000)
  }

  css() {
    const colors = ['red', 'blue', 'green', 'teal', 'black', 'magenta']
    this.color = colors[Math.floor(Math.random() * colors.length)]
    return this.cssData = `border: 3px solid ${this.color}; padding: 15px; border-radius: 5px;`
  }

  time() {
    alert(`local css: ${this.cssData}`)
  }

  connect() {
    this.tick = 1
    this.htmlData ||= this.$root.html()

    this.$root.attr('style', this.css())

    // demo for interval, that is cleared when node is detached
    this.setInterval(
      () => {
        this.$root.find('.fez-target-info').html(`${this.tick++} &sdot; ${this.rand}`)
        const log = $('#log')
        if (log.html().length > 200) {
          log.html('')
        }
        log.append('. ')
      },
      1000, 'default'
    )

    this.html(`
      ${this.htmlData} (${this.color}): ${JSON.stringify(this.props)}
      &sdot;
      <button onclick="Fez(this).time()">click for css</button>
      &sdot;
      <button onclick="Fez(this, 'ui-foo').connect()">refresh</button>
      &sdot;
      <button onclick="$$.$root.remove()">x</button>
      &sdot;
      <span class="fez-target-info"></span>
    `)
  }
})
