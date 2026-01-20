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
  // <fez-inline :state="{count: 0}" :wait-for="()=>window.SpritePet">
  //   <button onclick="fez.state.count += 1">&plus;</button>
  //   {{ state.count }} * {{ state.count }} = {{ state.count * state.count }}
  // </fez-inline>
  Fez('fez-inline', class {
    init(props) {
      // <fez-inline :wait-for="()=>window.SpritePet">
      props['wait-for'] ||= ()=>true
      Fez.untilTrue(() => {
        if (props['wait-for']()) {
          this.mountIt()
          return true
        }
      }, 100)
    }

    mountIt() {
      const html = this.root.innerHTML

      if (html) {
        const hash = Fez.fnv1(this.root.outerHTML)
        const nodeName = `inline-${hash}`
        Fez(nodeName, class {
          HTML = html
          init() {
            Object.assign(this.state, this.props.state || {})
          }
        })

        const el = document.createElement(nodeName)
        this.root.after(this.root.lastChild, el);
        this.root.remove()
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

  // Memory store for memoization with size limit
  const memoStore = new Map()
  const MEMO_STORE_MAX_SIZE = 50

  // Expose memoStore cleanup to Fez for manual clearing
  Fez.clearMemoStore = () => {
    memoStore.clear()
    Fez.consoleLog('Memoize store cleared')
  }

  // memoize component content by key
  // <fez-memoize key="unique-key">content to memoize</fez-memoize>
  Fez('fez-memoize', class {
    init(props) {
      if (!props.key) {
        Fez.consoleError('fez-memoize: key prop is required')
        return
      }

      if (memoStore.has(props.key)) {
        // Restore from memory in init
        const storedNode = memoStore.get(props.key)
        Fez.consoleLog(`Memoize - key: "${props.key}" - restore`)
        this.root.innerHTML = ''
        this.root.appendChild(storedNode.cloneNode(true))
      }
    }

    onMount(props) {
      // Only store if not already in memory
      if (!memoStore.has(props.key)) {
        requestAnimationFrame(() => {
          // Enforce max size by removing oldest entries
          if (memoStore.size >= MEMO_STORE_MAX_SIZE) {
            const oldestKey = memoStore.keys().next().value
            memoStore.delete(oldestKey)
            Fez.consoleLog(`Memoize - evicted oldest key: "${oldestKey}"`)
          }

          // Store current DOM content
          const contentNode = document.createElement('div')
          contentNode.innerHTML = this.root.innerHTML
          Fez.consoleLog(`Memoize - key: "${props.key}" - set`)
          memoStore.set(props.key, contentNode)
        })
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
