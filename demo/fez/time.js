Fez('ui-time', class extends FezBase {
  static nodeName = 'div'

  static css = `
    // :fez will be replaced with .fez-ui-time, so you can add local styles in global css
    :fez {
      border-radius: 10px;
      padding: 10px;

      button {
        font-size: 16px;
      }
    }
  `
  css = `
    border: 10px solid green;
  `

  static html = `
    <p>Param city: {{ this.props.city }}</p>
    <p>Time now: <span class="time"></span></p>
    <p>Random num: <span>{{ Math.random() }}</span></p>
    <button onclick="$$.setRandomColor()">random color</button>
    &sdot;
    <button onclick="$$.render()">refresh & preserve slot</button>
    <hr />
    <slot />
  `

  getRandomColor() {
    const colors = ['red', 'blue', 'green', 'teal', 'black', 'magenta', 'orange', 'lightblue']
    return colors[Math.floor(Math.random() * colors.length)]
  }

  setRandomColor() {
    const color = this.getRandomColor()
    // this.find('.color-name').innerHTML = color
    this.val('.color-name', color)
    this.root.style.borderColor = color
  }

  getTime() {
    return (new Date()).getTime()
  }

  setTime() {
    this.val('.time', this.getTime())
  }

  afterRender() {
    this.setTime()
  }

  connect() {
    this.setInterval(this.setTime, 1000)
    this.setRandomColor()
  }

})
