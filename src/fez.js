// base class for custom dom objects
import FezBase from './fez/instance.js'
if (typeof window !== 'undefined') window.FezBase = FezBase

// base class for custom dom objects
import Fez from './fez/root.js'
if (typeof window !== 'undefined') window.Fez = Fez

// clear all unattached nodes
setInterval(() => {
  for (const [key, el] of Fez.instances) {
    if (!el?.isConnected) {
      // Fez.error(`Found junk instance that is not connected ${el.fezName}`)
      el.fez?.fezRemoveSelf()
      Fez.instances.delete(key)
    }
  }
}, 5_000)

// define Fez observer
const observer = new MutationObserver((mutations) => {
  for (const { addedNodes, removedNodes } of mutations) {
    addedNodes.forEach((node) => {
      if (node.nodeType !== 1) return; // only elements

      if (node.matches('template[fez], xmp[fez], script[fez]')) {
        Fez.compile(node);
        node.remove();
      }

      if (node.querySelectorAll) {
        const nestedTemplates = node.querySelectorAll('template[fez], xmp[fez], script[fez]');
        nestedTemplates.forEach(template => {
          Fez.compile(template);
          template.remove();
        });
      }
    });

    removedNodes.forEach((node) => {
      if (node.nodeType === 1 && node.querySelectorAll) {
        const fezElements = node.querySelectorAll('.fez, :scope.fez');
        fezElements
          .forEach(el => {
            if (el.fez && el.root) {
              Fez.instances.delete(el.fez.UID)
              el.fez.fezRemoveSelf()
            }
          });
      }
    });
  }
});

// start observing the whole document
observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

// fez custom tags

// include fez component by name
//<fez-component name="some-node" :props="fez.props"></fez-node>
Fez('fez-component', class {
  FAST = true

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
  FAST = true

  init(props) {
    Fez.fetch(props.src, (data)=>{
      const dom = document.createElement('div')
      dom.innerHTML = data
      Fez.head(dom) // include scripts and load fez components
      this.root.innerHTML = dom.innerHTML
    })
  }
})

export default Fez
export { Fez }
