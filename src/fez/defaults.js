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

  // Render inline template with full component features (state, globalState, props)
  // <fez-inline :state="{count: 0}">
  //   <button onclick="fez.state.count++">+</button>
  //   Count: {state.count}
  // </fez-inline>
  Fez('fez-inline', class {
    init(props) {
      // Capture slot content as template (moved to root by fezSlot before init)
      const template = this.root?.innerHTML?.trim()

      if (template) {
        // Clear the literal template content (will be replaced by rendered output)
        this.root.innerHTML = ''
        // Compile and store on instance (not class) for reactivity
        this.fezHtmlFunc = Fez.createTemplate(template, { name: 'fez-inline' })
      }

      // Copy initial state from props
      if (props.state) {
        Object.assign(this.state, props.state)
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
