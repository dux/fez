// base class for custom dom objects
import FezBase from './fez/base'
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

/* Init via observer and not DOMContentLoaded */

// document.addEventListener('DOMContentLoaded', Fez.compile)

// runtime fez tag creation
//<fez-compile tag="app-editor">
//  <script>
// Fez('fez-compile', class {
//   init(params) {

//     this.root.querySelectorAll('template[fez]').forEach(n=>{
//       Fez.compile(n)
//     })
//   }
// })

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

