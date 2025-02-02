// base class for custom dom objects
import FezBase from './lib/base'
window.FezBase = FezBase

// base class for custom dom objects
import Fez from './lib/root'
window.Fez = Fez

// runtime fez tag creation
//<fez-compile tag="app-editor">
//  <script>
Fez('fez-compile', class {
  connect(params) {

    this.root.querySelectorAll('template[fez]').forEach(n=>{
      Fez.compile(n)
    })
  }
})

// clear all unattached nodes
setInterval(() => {
  FezBase.__objects = FezBase.__objects.filter(
    (el) => el.isConnected
  )
}, 5_000)

document.addEventListener('DOMContentLoaded', Fez.compile)
