// base class for custom dom objects
import FezBase from './lib/fez-base'
window.FezBase = FezBase

// base class for custom dom objects
import Fez from './lib/fez-root'
window.Fez = Fez

// runtime fez tag creation
//<fez-compile tag="app-editor">
//  <script>
Fez('fez-compile', class {
  connect(params) {
    const tagName = params.tag || console.error(`FEZ template: tag name not given`)
    const tpl = this.find('template')

    if (tpl) {
      Fez.compile(tagName, tpl.innerHTML)
    } else {
      console.error(`FEZ template: fez-compile contents has to be wrapped in <template></template> tag.`)
    }
  }
})

// clear all unattached nodes
setInterval(() => {
  FezBase.__objects = FezBase.__objects.filter(
    (el) => el.isConnected
  )
}, 5_000)

document.addEventListener('DOMContentLoaded', Fez.compileAll)
