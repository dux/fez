// base class for custom dom objects
import FezBase from './fez/instance'
window.FezBase = FezBase

// base class for custom dom objects
import Fez from './fez/root'
window.Fez = Fez

// clear all unattached nodes
setInterval(() => {
  FezBase.__objects = FezBase.__objects.filter(
    (el) => el.isConnected
  )
}, 5_000)

// define Fez observer
const observer = new MutationObserver((mutations) => {
  for (const { addedNodes } of mutations) {
    addedNodes.forEach((node) => {
      if (node.nodeType !== 1) return; // only elements
      // check the node itself
      if (node.matches('template[fez], xmp[fez], script[fez]')) {
        window.requestAnimationFrame(()=>{
          Fez.compile(node);
          node.remove();
        })
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

//<fez-component name="some-node" :props="fez.props"></fez-node>
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
