// Fez('foo-bar', class extends FezBase {
//   # set element style, set as property or method
//   static style() { .. }
//   static style = ```

//   # set element node name, set as property or method, defaults to DIV
//   static nodeName = 'span'
//   static nodeName(node) { ... }

//   connect() {
//     # internal, get unique ID for a string, poor mans MD5
//     const uid = this.klass.fnv1('some string')

//     # copy attributes from attr hash to root node
//     this.copy('href', 'onclick', 'style')

//     # internal, check if node is attached
//     this.isAttached()

//     # copy all child nodes from source to target, without target returns tm node
//     this.slot(someNode, tmpRoot)
//     const tmpRoot = this.slot(self.root)

//     # interval that runes only while node is attached
//     this.setInterval(func, tick) { ... }

//     # get closest form data as object
//     this.formData()

//     # get generated css class (uses gobber.js)
//     const localCssClass = this.css(text)
//   }
// })

// vanilla styled components
// https://goober.js.org/
const gobber = (() => {
  let e={data:""},t=t=>"object"==typeof window?((t?t.querySelector("#_goober"):window._goober)||Object.assign((t||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:t||e,a=e=>{let a=t(e),r=a.data;return a.data="",r},r=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,s=/\n+/g,n=(e,t)=>{let a="",r="",l="";for(let s in e){let o=e[s];"@"==s[0]?"i"==s[1]?a=s+" "+o+";":r+="f"==s[1]?n(o,s):s+"{"+n(o,"k"==s[1]?"":t)+"}":"object"==typeof o?r+=n(o,t?t.replace(/([^,])+/g,(e=>s.replace(/(^:.*)|([^,])+/g,(t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)))):s):null!=o&&(s=/^--/.test(s)?s:s.replace(/[A-Z]/g,"-$&").toLowerCase(),l+=n.p?n.p(s,o):s+":"+o+";")}return a+(t&&l?t+"{"+l+"}":l)+r},o={},c=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+c(e[a]);return t}return e},i=(e,t,a,i,p)=>{let u=c(e),d=o[u]||(o[u]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(u));if(!o[d]){let t=u!==e?e:(e=>{let t,a,n=[{}];for(;t=r.exec(e.replace(l,""));)t[4]?n.shift():t[3]?(a=t[3].replace(s," ").trim(),n.unshift(n[0][a]=n[0][a]||{})):n[0][t[1]]=t[2].replace(s," ").trim();return n[0]})(e);o[d]=n(p?{["@keyframes "+d]:t}:t,a?"":"."+d)}let f=a&&o.g?o.g:null;return a&&(o.g=o[d]),((e,t,a,r)=>{r?t.data=t.data.replace(r,e):-1===t.data.indexOf(e)&&(t.data=a?e+t.data:t.data+e)})(o[d],t,i,f),d},p=(e,t,a)=>e.reduce(((e,r,l)=>{let s=t[l];if(s&&s.call){let e=s(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;s=t?"."+t:e&&"object"==typeof e?e.props?"":n(e,""):!1===e?"":e}return e+r+(null==s?"":s)}),"");function u(e){let a=this||{},r=e.call?e(a.p):e;return i(r.unshift?r.raw?p(r,[].slice.call(arguments,1),a.p):r.reduce(((e,t)=>Object.assign(e,t&&t.call?t(a.p):t)),{}):r,t(a.target),a.g,a.o,a.k)}let d,f,g,b=u.bind({g:1}),m=u.bind({k:1});function h(e,t,a,r){n.p=t,d=e,f=a,g=r}function y(e,t){let a=this||{};return function(){let r=arguments;function l(s,n){let o=Object.assign({},s),c=o.className||l.className;a.p=Object.assign({theme:f&&f()},o),a.o=/ *go\d+/.test(c),o.className=u.apply(a,r)+(c?" "+c:""),t&&(o.ref=n);let i=e;return e[0]&&(i=o.as||e,delete o.as),g&&i[0]&&g(o),d(i,o)}return t?t(l):l}}
  return { css:u, extractCss: a, glob: b, keyframes: m, setup: h, styled: y }
})()

class FezBase {
  static __objects = []
  static __once = {}

  static preload() { }

  static find(node, name) {
    return Fez.find(node, name)
  }

  // get unique id from string
  static fnv1(str) {
    var FNV_OFFSET_BASIS, FNV_PRIME, hash, i, j, ref;
    FNV_OFFSET_BASIS = 2166136261;
    FNV_PRIME = 16777619;
    hash = FNV_OFFSET_BASIS;
    for (i = j = 0, ref = str.length - 1; (0 <= ref ? j <= ref : j >= ref); i = 0 <= ref ? ++j : --j) {
      hash ^= str.charCodeAt(i);
      hash *= FNV_PRIME;
    }
    return hash.toString(36).replaceAll('-', '');
  }

  // get node attributes as object
  static getAttributes(node) {
    const attrs = {}
    for (const attr of node.attributes) {
      attrs[attr.name] = attr.value
    }
    return attrs
  }

  static formData(node) {
    const formData = new FormData(node.closest('form'))
    const formObject = {}
    formData.forEach((value, key) => {
      formObject[key] = value
    });
    return formObject
  }

  constructor() {
    this.__int = {}
  }

  // string selector for use in HTML nodes
  get fezHtmlRoot() {
    return `Fez.find(this, &quot;${this.fezName}&quot;).`
  }

  // checks if node is attached and clears all if not
  get isAttached() {
    if (this.root.parentNode) {
      return true
    } else {
      Object.keys(this.__int).forEach((key)=> {
        clearInterval(this.__int[key])
      })
      this.root.fez = null
      return false
    }
  }

  // get single node propery
  prop(name) {
    return this.oldRoot[name] || this.props[name]
  }

  // copy attributes to root node
  copy() {
    for (const name of Array.from(arguments)) {
      const value = this.props[name]

      if (value) {
        this.root.setAttribute(name, value)
      } else if (this.oldRoot[name]) {
        this.root[name] = this.oldRoot[name]
      }
    }
  }

  // copy child nodes, natively to preserve bound events
  slot(source, target) {
    target ||= document.createElement('template')

    while (source.firstChild) {
      target.appendChild(source.firstChild)
    }

    source.innerHTML = ''

    return target
  }

  once() {}
  preload() { console.error('call Fez static preload') }
  style() { console.error('call Fez static style') }

  connect() {
    console.error('jQuery CDN is not connected', this.root)
  }

  // inject htmlString as innerHTML and replace $$. with local pointer
  // $$. will point to current fez instance
  // <slot></slot> will be replaced with current root
  html(text) {
    if (typeof text == 'object') {
      text = text[0]
    }

    const newNode = document.createElement('div')
    text = text.replaceAll('$$.', this.fezHtmlRoot)
    newNode.innerHTML = text

    const slot = newNode.querySelector('slot')
    if (slot) {
      while (this.root.firstChild) {
        slot.parentNode.insertBefore(this.root.lastChild, slot.nextSibling);
      }
      slot.parentNode.removeChild(slot)
    }

    this.slot(newNode, this.root)
  }

  // run only if node is attached, clear otherwise
  setInterval(func, tick, name) {
    name ||= this.class.fnv1(String(func))

    clearInterval(this.__int[name])

    this.__int[name] = setInterval(() => {
      if (this.isAttached) {
        func()
      }
    }, tick)

    return this.__int[name]
  }

  // add css class for scss styled text
  css(text, isGlobal) {
    const className = Fez.css(text)

    if (isGlobal) {
      this.root.classList.add(className)
    }

    return className
  }

  formData(node) {
    return this.class.formData(node || this.root)
  }

  fezRegister() {
    if (!FezBase.__once[this.fezName]) {
      FezBase.__once[this.fezName] = true
      this.once()
    }

    if (this.class.css) {
      this.root.classList.add(this.class.css)
    }

    this.fezRegisterBindMethods()
  }

  // bind all instance method to this, to avoid calling with .bind(this)
  fezRegisterBindMethods() {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
      .filter(method => method !== 'constructor' && typeof this[method] === 'function')

    methods.forEach(method => this[method] = this[method].bind(this))
  }
}

// clear all unnatached nodes
setInterval(() => {
  FezBase.__objects = FezBase.__objects.filter(
    (el) => el.isAttached
  )
}, 10_000)

//

const Fez = (name, klass) => {
  if (!name) {
    return FezBase
  }

  if (typeof klass != 'function') {
    let node = document.querySelector(name)
    const className = klass ? `.fez-${klass}` : '.fez'
    node = node.closest(className) || console.error(`FEZ error: parent node ${className} not found`)
    return node.fez
  }

  klass.preload()

  customElements.define(name, class extends HTMLElement {
    connectedCallback() {
      window.requestAnimationFrame(()=>{
        const parentNode = this.parentNode;
        const nodeName = typeof klass.nodeName == 'function' ? klass.nodeName(this) : klass.nodeName
        const newNode = document.createElement(nodeName || 'div')

        newNode.setAttribute('data-fez', name);
        newNode.classList.add('fez')
        newNode.classList.add(`fez-${name}`)

        parentNode.replaceChild(newNode, this);

        const object =  new klass()
        object.oldRoot = this
        object.fezName = name
        object.root = newNode
        object.props = klass.getAttributes(this)
        object.class = klass

        // copy child nodes, natively to preserve bound events
        object.slot(this, newNode)

        newNode.fez = object

        if (window.$) {
          object.$root = $(newNode)
        }

        if (object.props.id) {
          newNode.setAttribute('id', object.props.id)
        }

        object.fezRegister()
        object.connect(object.$root || object.root, object.props)
        klass.__objects.push(object)
      })
    }
  })
}

Fez.find = (node, name) => {
  if (typeof node == 'string') {
    node = document.body.querySelector(node)
  }

  const klass = name ? `[data-fez=${name}]` : '[data-fez]'

  return node.closest(klass).fez
}

Fez.globalCss = (text) => {
  const cssClass = Fez.css(text)
  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add(cssClass)
  })
  return cssClass
}

Fez.css = (text) => {
  return gobber.css(text)
}

window.Fez = Fez
window.FezBase = FezBase
