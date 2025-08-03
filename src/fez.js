// base class for custom dom objects
import FezBase from './fez/instance.js'
if (typeof window !== 'undefined') window.FezBase = FezBase

// base class for custom dom objects
import Fez from './fez/root.js'
if (typeof window !== 'undefined') window.Fez = Fez

require('./fez/defaults.js')

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

export default Fez
export { Fez }
