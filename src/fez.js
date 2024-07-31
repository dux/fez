// base class for custom dom objects
import FezBase from './lib/fez-base'
window.FezBase = FezBase

// base class for custom dom objects
import Fez from './lib/fez-root'
window.Fez = Fez

// clear all unattached nodes
setInterval(() => {
  FezBase.__objects = FezBase.__objects.filter(
    (el) => el.isAttached
  )
}, 10_000)
