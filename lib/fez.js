// https://github.com/fiduswriter/diffDOM
// maybe intergrate?

// vanilla styled components
// https://goober.js.org/
const gobber = (() => {
  let e={data:""},t=t=>"object"==typeof window?((t?t.querySelector("#_goober"):window._goober)||Object.assign((t||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:t||e,a=e=>{let a=t(e),r=a.data;return a.data="",r},r=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,s=/\n+/g,n=(e,t)=>{let a="",r="",l="";for(let s in e){let o=e[s];"@"==s[0]?"i"==s[1]?a=s+" "+o+";":r+="f"==s[1]?n(o,s):s+"{"+n(o,"k"==s[1]?"":t)+"}":"object"==typeof o?r+=n(o,t?t.replace(/([^,])+/g,(e=>s.replace(/(^:.*)|([^,])+/g,(t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)))):s):null!=o&&(s=/^--/.test(s)?s:s.replace(/[A-Z]/g,"-$&").toLowerCase(),l+=n.p?n.p(s,o):s+":"+o+";")}return a+(t&&l?t+"{"+l+"}":l)+r},o={},c=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+c(e[a]);return t}return e},i=(e,t,a,i,p)=>{let u=c(e),d=o[u]||(o[u]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(u));if(!o[d]){let t=u!==e?e:(e=>{let t,a,n=[{}];for(;t=r.exec(e.replace(l,""));)t[4]?n.shift():t[3]?(a=t[3].replace(s," ").trim(),n.unshift(n[0][a]=n[0][a]||{})):n[0][t[1]]=t[2].replace(s," ").trim();return n[0]})(e);o[d]=n(p?{["@keyframes "+d]:t}:t,a?"":"."+d)}let f=a&&o.g?o.g:null;return a&&(o.g=o[d]),((e,t,a,r)=>{r?t.data=t.data.replace(r,e):-1===t.data.indexOf(e)&&(t.data=a?e+t.data:t.data+e)})(o[d],t,i,f),d},p=(e,t,a)=>e.reduce(((e,r,l)=>{let s=t[l];if(s&&s.call){let e=s(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;s=t?"."+t:e&&"object"==typeof e?e.props?"":n(e,""):!1===e?"":e}return e+r+(null==s?"":s)}),"");function u(e){let a=this||{},r=e.call?e(a.p):e;return i(r.unshift?r.raw?p(r,[].slice.call(arguments,1),a.p):r.reduce(((e,t)=>Object.assign(e,t&&t.call?t(a.p):t)),{}):r,t(a.target),a.g,a.o,a.k)}let d,f,g,b=u.bind({g:1}),m=u.bind({k:1});function h(e,t,a,r){n.p=t,d=e,f=a,g=r}function y(e,t){let a=this||{};return function(){let r=arguments;function l(s,n){let o=Object.assign({},s),c=o.className||l.className;a.p=Object.assign({theme:f&&f()},o),a.o=/ *go\d+/.test(c),o.className=u.apply(a,r)+(c?" "+c:""),t&&(o.ref=n);let i=e;return e[0]&&(i=o.as||e,delete o.as),g&&i[0]&&g(o),d(i,o)}return t?t(l):l}}
  return { css:u, extractCss: a, glob: b, keyframes: m, setup: h, styled: y }
})()

// mustache.js - Logic-less {{mustache}} templates with JavaScript
// http://github.com/janl/mustache.js
!function(){var e=Object.prototype.toString,t=Array.isArray||function(t){return"[object Array]"===e.call(t)};function n(e){return"function"==typeof e}function r(e){return e.replace(/[\-\[\]{}()*+?.,\\\^$|#\s]/g,"\\$&")}function i(e,t){return null!=e&&"object"==typeof e&&t in e}var o=RegExp.prototype.test;var a=/\S/;function s(e){return!function(e,t){return o.call(e,t)}(a,e)}var c={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;","/":"&#x2F;","`":"&#x60;","=":"&#x3D;"};var p=/\s*/,u=/\s+/,h=/\s*=/,l=/\s*\}/,f=/#|\^|\/|>|\{|&|=|!/;function g(e){this.string=e,this.tail=e,this.pos=0}function v(e,t){this.view=e,this.cache={".":this.view},this.parent=t}function d(){this.templateCache={_cache:{},set:function(e,t){this._cache[e]=t},get:function(e){return this._cache[e]},clear:function(){this._cache={}}}}g.prototype.eos=function(){return""===this.tail},g.prototype.scan=function(e){var t=this.tail.match(e);if(!t||0!==t.index)return"";var n=t[0];return this.tail=this.tail.substring(n.length),this.pos+=n.length,n},g.prototype.scanUntil=function(e){var t,n=this.tail.search(e);switch(n){case-1:t=this.tail,this.tail="";break;case 0:t="";break;default:t=this.tail.substring(0,n),this.tail=this.tail.substring(n)}return this.pos+=t.length,t},v.prototype.push=function(e){return new v(e,this)},v.prototype.lookup=function(e){var t,r,o,a=this.cache;if(a.hasOwnProperty(e))t=a[e];else{for(var s,c,p,u=this,h=!1;u;){if(e.indexOf(".")>0)for(s=u.view,c=e.split("."),p=0;null!=s&&p<c.length;)p===c.length-1&&(h=i(s,c[p])||(r=s,o=c[p],null!=r&&"object"!=typeof r&&r.hasOwnProperty&&r.hasOwnProperty(o))),s=s[c[p++]];else s=u.view[e],h=i(u.view,e);if(h){t=s;break}u=u.parent}a[e]=t}return n(t)&&(t=t.call(this.view)),t},d.prototype.clearCache=function(){void 0!==this.templateCache&&this.templateCache.clear()},d.prototype.parse=function(e,n){var i=this.templateCache,o=e+":"+(n||y.tags).join(":"),a=void 0!==i,c=a?i.get(o):void 0;return null==c&&(c=function(e,n){if(!e)return[];var i,o,a,c=!1,v=[],d=[],w=[],m=!1,b=!1,C="",k=0;function x(){if(m&&!b)for(;w.length;)delete d[w.pop()];else w=[];m=!1,b=!1}function E(e){if("string"==typeof e&&(e=e.split(u,2)),!t(e)||2!==e.length)throw new Error("Invalid tags: "+e);i=new RegExp(r(e[0])+"\\s*"),o=new RegExp("\\s*"+r(e[1])),a=new RegExp("\\s*"+r("}"+e[1]))}E(n||y.tags);for(var T,U,j,S,P,V,O=new g(e);!O.eos();){if(T=O.pos,j=O.scanUntil(i))for(var A=0,I=j.length;A<I;++A)s(S=j.charAt(A))?(w.push(d.length),C+=S):(b=!0,c=!0,C+=" "),d.push(["text",S,T,T+1]),T+=1,"\n"===S&&(x(),C="",k=0,c=!1);if(!O.scan(i))break;if(m=!0,U=O.scan(f)||"name",O.scan(p),"="===U?(j=O.scanUntil(h),O.scan(h),O.scanUntil(o)):"{"===U?(j=O.scanUntil(a),O.scan(l),O.scanUntil(o),U="&"):j=O.scanUntil(o),!O.scan(o))throw new Error("Unclosed tag at "+O.pos);if(P=">"==U?[U,j,T,O.pos,C,k,c]:[U,j,T,O.pos],k++,d.push(P),"#"===U||"^"===U)v.push(P);else if("/"===U){if(!(V=v.pop()))throw new Error('Unopened section "'+j+'" at '+T);if(V[1]!==j)throw new Error('Unclosed section "'+V[1]+'" at '+T)}else"name"===U||"{"===U||"&"===U?b=!0:"="===U&&E(j)}if(x(),V=v.pop())throw new Error('Unclosed section "'+V[1]+'" at '+O.pos);return function(e){for(var t,n=[],r=n,i=[],o=0,a=e.length;o<a;++o)switch((t=e[o])[0]){case"#":case"^":r.push(t),i.push(t),r=t[4]=[];break;case"/":i.pop()[5]=t[2],r=i.length>0?i[i.length-1][4]:n;break;default:r.push(t)}return n}(function(e){for(var t,n,r=[],i=0,o=e.length;i<o;++i)(t=e[i])&&("text"===t[0]&&n&&"text"===n[0]?(n[1]+=t[1],n[3]=t[3]):(r.push(t),n=t));return r}(d))}(e,n),a&&i.set(o,c)),c},d.prototype.render=function(e,t,n,r){var i=this.getConfigTags(r),o=this.parse(e,i),a=t instanceof v?t:new v(t,void 0);return this.renderTokens(o,a,n,e,r)},d.prototype.renderTokens=function(e,t,n,r,i){for(var o,a,s,c="",p=0,u=e.length;p<u;++p)s=void 0,"#"===(a=(o=e[p])[0])?s=this.renderSection(o,t,n,r,i):"^"===a?s=this.renderInverted(o,t,n,r,i):">"===a?s=this.renderPartial(o,t,n,i):"&"===a?s=this.unescapedValue(o,t):"name"===a?s=this.escapedValue(o,t,i):"text"===a&&(s=this.rawValue(o)),void 0!==s&&(c+=s);return c},d.prototype.renderSection=function(e,r,i,o,a){var s=this,c="",p=r.lookup(e[1]);if(p){if(t(p))for(var u=0,h=p.length;u<h;++u)c+=this.renderTokens(e[4],r.push(p[u]),i,o,a);else if("object"==typeof p||"string"==typeof p||"number"==typeof p)c+=this.renderTokens(e[4],r.push(p),i,o,a);else if(n(p)){if("string"!=typeof o)throw new Error("Cannot use higher-order sections without the original template");null!=(p=p.call(r.view,o.slice(e[3],e[5]),(function(e){return s.render(e,r,i,a)})))&&(c+=p)}else c+=this.renderTokens(e[4],r,i,o,a);return c}},d.prototype.renderInverted=function(e,n,r,i,o){var a=n.lookup(e[1]);if(!a||t(a)&&0===a.length)return this.renderTokens(e[4],n,r,i,o)},d.prototype.indentPartial=function(e,t,n){for(var r=t.replace(/[^ \t]/g,""),i=e.split("\n"),o=0;o<i.length;o++)i[o].length&&(o>0||!n)&&(i[o]=r+i[o]);return i.join("\n")},d.prototype.renderPartial=function(e,t,r,i){if(r){var o=this.getConfigTags(i),a=n(r)?r(e[1]):r[e[1]];if(null!=a){var s=e[6],c=e[5],p=e[4],u=a;0==c&&p&&(u=this.indentPartial(a,p,s));var h=this.parse(u,o);return this.renderTokens(h,t,r,u,i)}}},d.prototype.unescapedValue=function(e,t){var n=t.lookup(e[1]);if(null!=n)return n},d.prototype.escapedValue=function(e,t,n){var r=this.getConfigEscape(n)||y.escape,i=t.lookup(e[1]);if(null!=i)return"number"==typeof i&&r===y.escape?String(i):r(i)},d.prototype.rawValue=function(e){return e[1]},d.prototype.getConfigTags=function(e){return t(e)?e:e&&"object"==typeof e?e.tags:void 0},d.prototype.getConfigEscape=function(e){return e&&"object"==typeof e&&!t(e)?e.escape:void 0};var y={name:"mustache.js",version:"4.2.0",tags:["{{","}}"],clearCache:void 0,escape:void 0,parse:void 0,render:void 0,Scanner:void 0,Context:void 0,Writer:void 0,set templateCache(e){w.templateCache=e},get templateCache(){return w.templateCache}},w=new d;y.clearCache=function(){return w.clearCache()},y.parse=function(e,t){return w.parse(e,t)},y.render=function(e,n,r,i){if("string"!=typeof e)throw new TypeError('Invalid template! Template should be a "string" but "'+((t(o=e)?"array":typeof o)+'" was given as the first argument for mustache#render(template, view, partials)'));var o;return w.render(e,n,r,i)},y.escape=function(e){return String(e).replace(/[&<>"'`=\/]/g,(function(e){return c[e]}))},y.Scanner=g,y.Context=v,y.Writer=d,window.Mustache=y}();

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

//     # render string via mustache and attaches html to root
//     # to return rendered string only, use parse(text, context)
//     this.html(`
//       <ul>
//         {{#list}}
//           <li>
//             <input type="text" onkeyup="$$.list[{{num}}].name = this.value" value="{{ name }}" class="i1" />
//           </li>
//         {{/list}}
//       </ul>
//       <span class="btn" onclick="$$.getData()">read</span>
//     `)
//   }
// })

class FezBase {
  static __objects = []

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
  static getProps(node) {
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

  static fastBind() {
    // return true to bind without requestAnimationFrame
    // you can do this if you are sure you are not expecting innerHTML data
    return false
  }

  // instance methods

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
      this.root = null
      return false
    }
  }

  // get single node property
  prop(name) {
    let v = this.oldRoot[name] || this.props[name]
    if (typeof v == 'function') {
      // if @prop('onclick'), we want "this" to point to this.root (dom node)
      v = v.bind(this.root)
    }
    return v
  }

  // copy attributes to root node
  copy() {
    for (const name of Array.from(arguments)) {
      let value = this.props[name]

      if (value !== undefined) {
        if (name == 'class') {
          const klass = this.root.getAttribute(name, value)

          if (klass) {
            value = [klass, value].join(' ')
          }
        }

        if (typeof value == 'string') {
          this.root.setAttribute(name, value)
        } else {
          this.root[name] = value
        }
      }
    }
  }

  // copy child nodes, natively to preserve bound events
  // if node name is SLOT insert adjacent and remove SLOT, else as a child nodes
  slot(source, target) {
    target ||= document.createElement('template')
    const isSlot = target.nodeName == 'SLOT'

    while (source.firstChild) {
      if (isSlot) {
        target.parentNode.insertBefore(source.lastChild, target.nextSibling);
      } else {
        target.appendChild(source.firstChild)
      }
    }

    if (isSlot) {
      target.parentNode.removeChild(target)
    } else {
      source.innerHTML = ''
    }

    return target
  }

  style() { console.error('call Fez static style') }

  connect() {
    console.error('Fez is missing "connect" method.', this.root)
  }

  parseHtml(text, context) {
    if (typeof text == 'object') {
      text = text[0]
    }

    text = text.replaceAll('$$.', this.fezHtmlRoot)
    text = Mustache.render(text, context || this)

    // https://jsbin.com/semacow/1/edit?html,js,output
    // text = """
    //   <ul>
    //     #{
    //       if list[1]
    //         "<li>exists</li>"
    //     }
    //     #{
    //      for el, i in list
    //        "<li>{el} - #{i}</li>"
    //     }
    //   </ul>
    // """
    // escape artefacts
    text = text.replaceAll('>,<', "><").replace(/\s*undefined\s*/g, '')

    return text
  }

  // inject htmlString as innerHTML and replace $$. with local pointer
  // $$. will point to current fez instance
  // <slot></slot> will be replaced with current root
  // this.html('...loading')
  // this.html('.images', '...loading')
  html(target, text) {
    if (!text) {
      text = target
      target = this.root
    }

    if (typeof target == 'string') {
      target = this.find(target)
    }

    if (Array.isArray(text)) {
      text = text.join('')
    }

    const newNode = document.createElement('div')
    newNode.innerHTML = this.parseHtml(text)

    const slot = newNode.querySelector('slot')
    if (slot) {
      this.slot(target, slot)
    }

    target.innerHTML = ''
    this.slot(newNode, target)

    target.querySelectorAll('*[fez-this]').forEach((n)=>{
      let value = n.getAttribute('fez-this').replace(/[^\w\.\[\]]/, '')
      eval(`this.${value} = n`)
    })

    return null
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

  find(selector) {
    return this.root.querySelector(selector)
  }

  val(selector, data) {
    const node = this.find('.time')

    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(node.nodeName)) {
      node.value = data
    } else {
      node.innerHTML = new Date()
    }
  }

  formData(node) {
    return this.class.formData(node || this.root)
  }

  attr(name, value) {
    this.root.setAttribute(name, value)
  }

  fezRegister() {
    if (this.class.css) {
      if (this.class.css.includes(':')) {
        this.class.css = Fez.css(this.class.css)
      }
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

const observer = new MutationObserver((mutationsList, _) => {
  for (const mutation of mutationsList) {
    if (mutation.type === 'attributes') {
      const fez = mutation.target.fez
      const name = mutation.attributeName
      const value = mutation.target.getAttribute(name)
      fez.props[name] = value
      fez.onPropsChange(name, value)
      // console.log(`The [${name}] attribute was modified to [${value}].`);
    }
  }
});

const Fez = (name, klass) => {
  function connect() {
    const parentNode = this.parentNode
    if (parentNode) {
      const nodeName = typeof klass.nodeName == 'function' ? klass.nodeName(this) : klass.nodeName
      const newNode = document.createElement(nodeName || 'div')

      newNode.classList.add('fez')
      newNode.classList.add(`fez-${name}`)

      parentNode.replaceChild(newNode, this);

      const object =  new klass()
      object.oldRoot = this
      object.fezName = name
      object.root = newNode
      object.props = klass.getProps(this)
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
      object.connect(object.props)
      klass.__objects.push(object)

      if (object.onPropsChange) {
        observer.observe(newNode, {attributes:true})
      }
    }
  }

  function fastBind(n) {
    return typeof klass.fastBind === 'function' ? klass.fastBind(n) : klass.fastBind
  }

  if (!name) {
    return FezBase
  }

  if (typeof klass != 'function') {
    return Fez.find(name, klass)
  }

  customElements.define(name, class extends HTMLElement {
    connectedCallback() {
      // when we render nested fez components, and under Svelte, sometimes node innerHTML is empty, but it should not be
      // in that case, we need to wait for another tick to get content
      // this solution looks like it is not efficient, because it slow renders fez components that do not have and are not intended to have body, but by testing this looks like it is not effecting render performance
      // if you want to force fast render, add static fastBind = true
      if (this.firstChild || fastBind(this)) {
        connect.bind(this)()
      } else {
        window.requestAnimationFrame(()=>{
          connect.bind(this)()
        })
      }
    }
  })
}

Fez.find = (node, name) => {
  if (typeof node == 'string') {
    node = document.body.querySelector(node)
  }

  if (typeof node.val == 'function') {
    node = node[0]
  }

  const klass = name ? `.fez-${name}` : '.fez'

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
