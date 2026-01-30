// Wrap defaults in a function to avoid immediate execution
const loadDefaults = () => {
  // include fez component by name
  //<fez-component name="some-node" :props="fez.props"></fez-component>
  Fez('fez-component', class {
    init(props) {
      const tag = document.createElement(props.name)
      tag.props = props.props || props['data-props'] || props

      while (this.root.firstChild) {
        this.root.parentNode.insertBefore(this.root.lastChild, tag.nextSibling);
      }

      this.root.innerHTML = ''
      this.root.appendChild(tag)
    }
  })

  // include remote data from url
  // <fez-include src="./demo/fez/ui-slider.html"></fez-include>
  Fez('fez-include', class {
    init(props) {
      Fez.fetch(props.src, (data)=>{
        const dom = Fez.domRoot(data)
        Fez.head(dom) // include scripts and load fez components
        this.root.innerHTML = dom.innerHTML
      })
    }
  })

  // Repeat template for each item in list or object
  // <fez-for list="a, b, c">
  //   <li>KEY (INDEX)</li>
  // </fez-for>
  // <fez-for object="name: John; age: 30">
  //   <li>KEY = VALUE</li>
  // </fez-for>
  Fez('fez-for', class {
    FAST = true

    init(props) {
      const template = this.root?.innerHTML?.trim()
      if (!template) return

      const divider = props.divider || ','

      if (props.list) {
        // Parse list: "a, b, c" -> replaces KEY and INDEX
        const html = props.list.split(divider).map((item, index) => {
          return template
            .replace(/KEY/g, item.trim())
            .replace(/INDEX/g, index)
        }).join('')
        this.root.innerHTML = html
      } else if (props.object) {
        // Parse object: "name: John; age: 30" -> replaces KEY and VALUE
        const html = props.object.split(';').map(pair => {
          const [key, ...valueParts] = pair.split(':')
          const keyTrimmed = key.trim()
          if (!keyTrimmed) return ''
          return template
            .replace(/KEY/g, keyTrimmed)
            .replace(/VALUE/g, valueParts.join(':').trim())
        }).join('')
        this.root.innerHTML = html
      }
    }
  })

  // Show node only if test validates
  // <fez-if if="window.foo">...
  Fez('fez-if', class {
    init(props) {
      const test = new Function(`return (${props.if || props.test})`)
      if (!test()) {
        this.root.remove()
      }
    }
  })

}

// Only load defaults if Fez is available
if (typeof Fez !== 'undefined' && Fez) {
  loadDefaults()
}

// Export for use in tests
export { loadDefaults }
