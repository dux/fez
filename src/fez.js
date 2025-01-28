// base class for custom dom objects
import FezBase from './lib/fez-base'
window.FezBase = FezBase

// base class for custom dom objects
import Fez from './lib/fez-root'
window.Fez = Fez

// clear all unattached nodes
setInterval(() => {
  FezBase.__objects = FezBase.__objects.filter(
    (el) => el.isConnected
  )
}, 5_000)

document.addEventListener('DOMContentLoaded', Fez.loadTemplates)

// runtime fez tag creation
//<fez-template tag="app-editor">
//  <script>
Fez('fez-template', class {
  connect(params) {
    const tagName = params.tag || console.error(`FEZ template: tag name not given`)
    const tpl = this.find('template')

    if (tpl) {
      Fez.loadTemplate(tagName, tpl.innerHTML)
    } else {
      console.error(`FEZ template: fez-template contents has to be wrapped in <template></template> tag.`)
    }
  }
})

// attach fez to a first child, do not alter the node
Fez('fez-use', class {
  connect(params) {
  }
})
