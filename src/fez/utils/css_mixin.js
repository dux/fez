// define custom style macro - simple scss mixin
// :mobile { ... } -> @media (max-width:  768px) { ... }
// @include mobile { ... } -> @media (max-width:  768px) { ... }
// demo/fez/ui-style.fez

const CssMixins = {}

export default (Fez) => {
  Fez.cssMixin = (name, content) => {
    if (content) {
      CssMixins[name] = content
    } else {
      Object.entries(CssMixins).forEach(([key, val])=>{
        name = name.replaceAll(`:${key} `, `${val} `)
        name = name.replaceAll(`@include ${key} `, `${val} `)
      })

      return name
    }
  }

  Fez.cssMixin('mobile', '@media (max-width: 767px)')
  Fez.cssMixin('tablet', '@media (min-width: 768px) and (max-width: 1023px)')
  Fez.cssMixin('desktop', '@media (min-width:  1200px)')
}
