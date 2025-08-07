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

  // include remote data from url
  // <fez-inline :state="{count: 0}">
  //   <button onclick="fez.state.count += 1">&plus;</button>
  //   {{ state.count }} * {{ state.count }} = {{ state.count * state.count }}
  // </fez-inline>
  Fez('fez-inline', class {
    init(props) {
      const html = this.root.innerHTML

      if (this.root.innerHTML.includes('<')) {
        const hash = Fez.fnv1(this.root.outerHTML)
        const nodeName = `inline-${hash}`
        Fez(nodeName, class {
          HTML = html
          init() {
            Object.assign(this.state, props.state || {})
          }
        })

        const el = document.createElement(nodeName)
        this.root.after(this.root.lastChild, el);
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