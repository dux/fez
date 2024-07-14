(()=>{function V(l,e){let i=/(\r\n|\r|\n)/g,f=/{{\s*(.+?)\s*}}/g,p=/^each\s+(.*)\s+as\s+(.*)$/,h=/^if\s+(.*)$/,c=/^else if\s+(.*)$/;function a(T){let _=j=>j.replaceAll("@","this."),L=`
      let _strings = [], _sequence = [], _values = [];

      function htmlEscape(text) {
        if (typeof text === 'string') {
          return text
            .replaceAll("'", '&apos;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
        } else {
          return text
        }
      }

      _sequence.push('${T.trim().replace(i,"\\n").replace(f,(j,y)=>{if(y=y.replace(/^[#:]/,""),y.startsWith("each")||y.startsWith("for")){let A=y.split(/\s+/);if(A.shift()==="for"){let B=A.pop();A.pop(),y=`each ${B} as ${A.join(" ")}`}let C=p.exec(y);if(C)return C[1]=_(C[1]),`');
 (!Array.isArray(${C[1]}) ? Array.from(Object.entries(${C[1]} || []), ([key, value]) => [key, value]) : ${C[1]}).forEach((${C[2]}) => { _sequence.push('`}else if(y.startsWith("if")){let A=h.exec(y);if(A)return A[1]=_(A[1]),`');
 if (${A[1]}) { _sequence.push('`}else if(y.startsWith("else if")){let A=c.exec(y);if(A)return A[1]=_(A[1]),`');
 } else if (${A[1]}) { _sequence.push('`}else{if(y==="else")return`');
 } else { _sequence.push('`;if(y==="/each"||y==="/for")return`');
 }); _sequence.push('`;if(y==="/if")return`');
 } _sequence.push('`}let z=y.split(/^\@html\s+/);return z[1]?y=_(z[1]):y=`htmlEscape(${_(y)})`,`');
 _strings.push(_sequence.join(''));
 _sequence = [];
 _values.push(${y});
 _sequence.push('`})}');
      _strings.push(_sequence.join(''));
      return [_strings, _values];
    `;return new Function("_data",L)}function m(T){let _=a(T);return()=>{let[L,j]=_.bind(e)();return L.reduce((y,z,A)=>y+j[A-1]+z)}}function g(T){let _=new Set(["area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"]);return T.replace(/<([a-z-]+)\b([^>]*)\/>/g,(L,j,y)=>_.has(j)?L:`<${j}${y}></${j}>`)}return l=g(l),m(l)().replace(/\n\s*\n/g,`
`)}var Z=function(){"use strict";let l=new Set,e={morphStyle:"outerHTML",callbacks:{beforeNodeAdded:L,afterNodeAdded:L,beforeNodeMorphed:L,afterNodeMorphed:L,beforeNodeRemoved:L,afterNodeRemoved:L,beforeAttributeUpdated:L},head:{style:"merge",shouldPreserve:function(t){return t.getAttribute("im-preserve")==="true"},shouldReAppend:function(t){return t.getAttribute("im-re-append")==="true"},shouldRemove:L,afterHeadMorphed:L}};function i(t,r,s={}){t instanceof Document&&(t=t.documentElement),typeof r=="string"&&(r=re(r));let o=se(r),u=y(t,o,s);return f(t,o,u)}function f(t,r,s){if(s.head.block){let o=t.querySelector("head"),u=r.querySelector("head");if(o&&u){let d=T(u,o,s);Promise.all(d).then(function(){f(t,r,Object.assign(s,{head:{block:!1,ignore:!0}}))});return}}if(s.morphStyle==="innerHTML")return c(r,t,s),t.children;if(s.morphStyle==="outerHTML"||s.morphStyle==null){let o=ne(r,t,s),u=o?.previousSibling,d=o?.nextSibling,b=h(t,o,s);return o?ie(u,b,d):[]}else throw"Do not understand how to morph style "+s.morphStyle}function p(t,r){return r.ignoreActiveValue&&t===document.activeElement&&t!==document.body}function h(t,r,s){if(!(s.ignoreActive&&t===document.activeElement))return r==null?s.callbacks.beforeNodeRemoved(t)===!1?t:(t.remove(),s.callbacks.afterNodeRemoved(t),null):A(t,r)?(s.callbacks.beforeNodeMorphed(t,r)===!1||(t instanceof HTMLHeadElement&&s.head.ignore||(t instanceof HTMLHeadElement&&s.head.style!=="morph"?T(r,t,s):(m(r,t,s),p(t,s)||c(r,t,s))),s.callbacks.afterNodeMorphed(t,r)),t):s.callbacks.beforeNodeRemoved(t)===!1||s.callbacks.beforeNodeAdded(r)===!1?t:(t.parentElement.replaceChild(r,t),s.callbacks.afterNodeAdded(r),s.callbacks.afterNodeRemoved(t),r)}function c(t,r,s){let o=t.firstChild,u=r.firstChild,d;for(;o;){if(d=o,o=d.nextSibling,u==null){if(s.callbacks.beforeNodeAdded(d)===!1)return;r.appendChild(d),s.callbacks.afterNodeAdded(d),I(s,d);continue}if(z(d,u,s)){h(u,d,s),u=u.nextSibling,I(s,d);continue}let b=B(t,r,d,u,s);if(b){u=C(u,b,s),h(b,d,s),I(s,d);continue}let S=te(t,r,d,u,s);if(S){u=C(u,S,s),h(S,d,s),I(s,d);continue}if(s.callbacks.beforeNodeAdded(d)===!1)return;r.insertBefore(d,u),s.callbacks.afterNodeAdded(d),I(s,d)}for(;u!==null;){let b=u;u=u.nextSibling,G(b,s)}}function a(t,r,s,o){return t==="value"&&o.ignoreActiveValue&&r===document.activeElement?!0:o.callbacks.beforeAttributeUpdated(t,r,s)===!1}function m(t,r,s){let o=t.nodeType;if(o===1){let u=t.attributes,d=r.attributes;for(let b of u)a(b.name,r,"update",s)||r.getAttribute(b.name)!==b.value&&r.setAttribute(b.name,b.value);for(let b=d.length-1;0<=b;b--){let S=d[b];a(S.name,r,"remove",s)||t.hasAttribute(S.name)||r.removeAttribute(S.name)}}(o===8||o===3)&&r.nodeValue!==t.nodeValue&&(r.nodeValue=t.nodeValue),p(r,s)||M(t,r,s)}function g(t,r,s,o){if(t[s]!==r[s]){let u=a(s,r,"update",o);u||(r[s]=t[s]),t[s]?u||r.setAttribute(s,t[s]):a(s,r,"remove",o)||r.removeAttribute(s)}}function M(t,r,s){if(t instanceof HTMLInputElement&&r instanceof HTMLInputElement&&t.type!=="file"){let o=t.value,u=r.value;g(t,r,"checked",s),g(t,r,"disabled",s),t.hasAttribute("value")?o!==u&&(a("value",r,"update",s)||(r.setAttribute("value",o),r.value=o)):a("value",r,"remove",s)||(r.value="",r.removeAttribute("value"))}else if(t instanceof HTMLOptionElement)g(t,r,"selected",s);else if(t instanceof HTMLTextAreaElement&&r instanceof HTMLTextAreaElement){let o=t.value,u=r.value;if(a("value",r,"update",s))return;o!==u&&(r.value=o),r.firstChild&&r.firstChild.nodeValue!==o&&(r.firstChild.nodeValue=o)}}function T(t,r,s){let o=[],u=[],d=[],b=[],S=s.head.style,O=new Map;for(let E of t.children)O.set(E.outerHTML,E);for(let E of r.children){let H=O.has(E.outerHTML),N=s.head.shouldReAppend(E),P=s.head.shouldPreserve(E);H||P?N?u.push(E):(O.delete(E.outerHTML),d.push(E)):S==="append"?N&&(u.push(E),b.push(E)):s.head.shouldRemove(E)!==!1&&u.push(E)}b.push(...O.values());let Y=[];for(let E of b){let H=document.createRange().createContextualFragment(E.outerHTML).firstChild;if(s.callbacks.beforeNodeAdded(H)!==!1){if(H.href||H.src){let N=null,P=new Promise(function(ue){N=ue});H.addEventListener("load",function(){N()}),Y.push(P)}r.appendChild(H),s.callbacks.afterNodeAdded(H),o.push(H)}}for(let E of u)s.callbacks.beforeNodeRemoved(E)!==!1&&(r.removeChild(E),s.callbacks.afterNodeRemoved(E));return s.head.afterHeadMorphed(r,{added:o,kept:d,removed:u}),Y}function _(){}function L(){}function j(t){let r={};return Object.assign(r,e),Object.assign(r,t),r.callbacks={},Object.assign(r.callbacks,e.callbacks),Object.assign(r.callbacks,t.callbacks),r.head={},Object.assign(r.head,e.head),Object.assign(r.head,t.head),r}function y(t,r,s){return s=j(s),{target:t,newContent:r,config:s,morphStyle:s.morphStyle,ignoreActive:s.ignoreActive,ignoreActiveValue:s.ignoreActiveValue,idMap:fe(t,r),deadIds:new Set,callbacks:s.callbacks,head:s.head}}function z(t,r,s){return t==null||r==null?!1:t.nodeType===r.nodeType&&t.tagName===r.tagName?t.id!==""&&t.id===r.id?!0:F(s,t,r)>0:!1}function A(t,r){return t==null||r==null?!1:t.nodeType===r.nodeType&&t.tagName===r.tagName}function C(t,r,s){for(;t!==r;){let o=t;t=t.nextSibling,G(o,s)}return I(s,r),r.nextSibling}function B(t,r,s,o,u){let d=F(u,s,r),b=null;if(d>0){let S=o,O=0;for(;S!=null;){if(z(s,S,u))return S;if(O+=F(u,S,t),O>d)return null;S=S.nextSibling}}return b}function te(t,r,s,o,u){let d=o,b=s.nextSibling,S=0;for(;d!=null;){if(F(u,d,t)>0)return null;if(A(s,d))return d;if(A(b,d)&&(S++,b=b.nextSibling,S>=2))return null;d=d.nextSibling}return d}function re(t){let r=new DOMParser,s=t.replace(/<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,"");if(s.match(/<\/html>/)||s.match(/<\/head>/)||s.match(/<\/body>/)){let o=r.parseFromString(t,"text/html");if(s.match(/<\/html>/))return o.generatedByIdiomorph=!0,o;{let u=o.firstChild;return u?(u.generatedByIdiomorph=!0,u):null}}else{let u=r.parseFromString("<body><template>"+t+"</template></body>","text/html").body.querySelector("template").content;return u.generatedByIdiomorph=!0,u}}function se(t){if(t==null)return document.createElement("div");if(t.generatedByIdiomorph)return t;if(t instanceof Node){let r=document.createElement("div");return r.append(t),r}else{let r=document.createElement("div");for(let s of[...t])r.append(s);return r}}function ie(t,r,s){let o=[],u=[];for(;t!=null;)o.push(t),t=t.previousSibling;for(;o.length>0;){let d=o.pop();u.push(d),r.parentElement.insertBefore(d,r)}for(u.push(r);s!=null;)o.push(s),u.push(s),s=s.nextSibling;for(;o.length>0;)r.parentElement.insertBefore(o.pop(),r.nextSibling);return u}function ne(t,r,s){let o;o=t.firstChild;let u=o,d=0;for(;o;){let b=le(o,r,s);b>d&&(u=o,d=b),o=o.nextSibling}return u}function le(t,r,s){return A(t,r)?.5+F(s,t,r):0}function G(t,r){I(r,t),r.callbacks.beforeNodeRemoved(t)!==!1&&(t.remove(),r.callbacks.afterNodeRemoved(t))}function oe(t,r){return!t.deadIds.has(r)}function ae(t,r,s){return(t.idMap.get(s)||l).has(r)}function I(t,r){let s=t.idMap.get(r)||l;for(let o of s)t.deadIds.add(o)}function F(t,r,s){let o=t.idMap.get(r)||l,u=0;for(let d of o)oe(t,d)&&ae(t,d,s)&&++u;return u}function X(t,r){let s=t.parentElement,o=t.querySelectorAll("[id]");for(let u of o){let d=u;for(;d!==s&&d!=null;){let b=r.get(d);b==null&&(b=new Set,r.set(d,b)),b.add(u.id),d=d.parentElement}}}function fe(t,r){let s=new Map;return X(t,s),X(r,s),s}return{morph:i,defaults:e}}();var ce={data:""},K=l=>typeof window=="object"?((l?l.querySelector("#_goober"):window._goober)||Object.assign((l||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:l||ce,de=l=>{let e=K(l),i=e.data;return e.data="",i},he=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,pe=/\/\*[^]*?\*\/|  +/g,J=/\n+/g,w=(l,e)=>{let i="",f="",p="";for(let h in l){let c=l[h];h[0]=="@"?h[1]=="i"?i=h+" "+c+";":f+=h[1]=="f"?w(c,h):h+"{"+w(c,h[1]=="k"?"":e)+"}":typeof c=="object"?f+=w(c,e?e.replace(/([^,])+/g,a=>h.replace(/(^:.*)|([^,])+/g,m=>/&/.test(m)?m.replace(/&/g,a):a?a+" "+m:m)):h):c!=null&&(h=/^--/.test(h)?h:h.replace(/[A-Z]/g,"-$&").toLowerCase(),p+=w.p?w.p(h,c):h+":"+c+";")}return i+(e&&p?e+"{"+p+"}":p)+f},R={},Q=l=>{if(typeof l=="object"){let e="";for(let i in l)e+=i+Q(l[i]);return e}return l},me=(l,e,i,f,p)=>{let h=Q(l),c=R[h]||(R[h]=(m=>{let g=0,M=11;for(;g<m.length;)M=101*M+m.charCodeAt(g++)>>>0;return"go"+M})(h));if(!R[c]){let m=h!==l?l:(g=>{let M,T,_=[{}];for(;M=he.exec(g.replace(pe,""));)M[4]?_.shift():M[3]?(T=M[3].replace(J," ").trim(),_.unshift(_[0][T]=_[0][T]||{})):_[0][M[1]]=M[2].replace(J," ").trim();return _[0]})(l);R[c]=w(p?{["@keyframes "+c]:m}:m,i?"":"."+c)}let a=i&&R.g?R.g:null;return i&&(R.g=R[c]),((m,g,M,T)=>{T?g.data=g.data.replace(T,m):g.data.indexOf(m)===-1&&(g.data=M?m+g.data:g.data+m)})(R[c],e,f,a),c},be=(l,e,i)=>l.reduce((f,p,h)=>{let c=e[h];if(c&&c.call){let a=c(i),m=a&&a.props&&a.props.className||/^go/.test(a)&&a;c=m?"."+m:a&&typeof a=="object"?a.props?"":w(a,""):a===!1?"":a}return f+p+(c??"")},"");function q(l){let e=this||{},i=l.call?l(e.p):l;return me(i.unshift?i.raw?be(i,[].slice.call(arguments,1),e.p):i.reduce((f,p)=>Object.assign(f,p&&p.call?p(e.p):p),{}):i,K(e.target),e.g,e.o,e.k)}var x,D,W,ge=q.bind({g:1}),ye=q.bind({k:1});function ve(l,e,i,f){w.p=e,x=l,D=i,W=f}function Ae(l,e){let i=this||{};return function(){let f=arguments;function p(h,c){let a=Object.assign({},h),m=a.className||p.className;i.p=Object.assign({theme:D&&D()},a),i.o=/ *go\d+/.test(m),a.className=q.apply(i,f)+(m?" "+m:""),e&&(a.ref=c);let g=l;return l[0]&&(g=a.as||l,delete a.as),W&&g[0]&&W(a),x(g,a)}return e?e(p):p}}var ee={css:q,extractCss:de,glob:ge,keyframes:ye,setup:ve,styled:Ae};function U(l,e={},i){if(typeof e=="string"&&([e,i]=[i,e],e||={}),e instanceof Node&&(i=e,e={}),Array.isArray(l)&&(i=l,l="div"),(typeof e!="object"||Array.isArray(e))&&(i=e,e={}),l.includes(".")){let p=l.split(".");l=p.shift()||"div";let h=p.join(" ");e.class?e.class+=` ${h}`:e.class=h}let f=document.createElement(l);for(let[p,h]of Object.entries(e))if(typeof h=="function")f[p]=h.bind(this);else{let c=String(h).replaceAll("$$.",this.fezHtmlRoot);f.setAttribute(p,c)}if(i)if(Array.isArray(i))for(let p of i)f.appendChild(p);else i instanceof Node?f.appendChild(i):f.innerHTML=String(i);return f}var k=class{static __objects=[];static find(e,i){return v.find(e,i)}static fnv1(e){var i,f,p,h,c,a;for(i=2166136261,f=16777619,p=i,h=c=0,a=e.length-1;0<=a?c<=a:c>=a;h=0<=a?++c:--c)p^=e.charCodeAt(h),p*=f;return p.toString(36).replaceAll("-","")}static getProps(e){let i={};for(let f of e.attributes)i[f.name]=f.value;return i}static formData(e){let i=new FormData(e.closest("form")),f={};return i.forEach((p,h)=>{f[h]=p}),f}static fastBind(){return!1}constructor(){this.__int={}}n=U;get fezHtmlRoot(){return`Fez.find(this, "${this.fezName}").`}get isAttached(){return this.root?.parentNode?!0:(Object.keys(this.__int).forEach(e=>{clearInterval(this.__int[e])}),this.root.fez=null,this.root=null,!1)}prop(e){let i=this.oldRoot[e]||this.props[e];return typeof i=="function"&&(i=i.bind(this.root)),i}copy(){for(let e of Array.from(arguments)){let i=this.props[e];if(i!==void 0){if(e=="class"){let f=this.root.getAttribute(e,i);f&&(i=[f,i].join(" "))}typeof i=="string"?this.root.setAttribute(e,i):this.root[e]=i}}}slot(e,i){i||=document.createElement("template");let f=i.nodeName=="SLOT";for(;e.firstChild;)f?i.parentNode.insertBefore(e.lastChild,i.nextSibling):i.appendChild(e.firstChild);return f?i.parentNode.removeChild(i):e.innerHTML="",i}style(){console.error("call Fez static style")}connect(){console.error('Fez is missing "connect" method.',this.root)}parseHtml(e,i){if(typeof e=="object"&&(e=e[0]),e=e.replaceAll("$$.",this.fezHtmlRoot.replaceAll('"',"&quot;")),e.includes("{{"))try{e=V(e,this)}catch(f){console.error(`Fez stache template error in "${this.fezName}"`,f)}return e}html(e,i){e||(e=this.class.html),typeof i>"u"&&(i=e,e=this.root),typeof e=="string"&&(e=this.find(e));let f=document.createElement("div");Array.isArray(i)?i[0]instanceof Node?i.forEach(c=>{f.appendChild(c)}):i=i.join(""):typeof i=="string"?f.innerHTML=this.parseHtml(i):f.appendChild(i);let p=f.querySelector("slot");p&&this.slot(e,p),v.morphdom(e,f);let h=(c,a)=>{e.querySelectorAll(`*[${c}]`).forEach(m=>{let g=m.getAttribute(c);m.removeAttribute(c),g&&a.bind(this)(g,m)})};h("fez-this",(c,a)=>{this[c]=a}),h("fez-use",(c,a)=>{let m=this[c];typeof m=="function"?m(a):console.error(`Fez error: "${c}" is not a function in ${this.fezName}`)}),h("fez-class",c=>{let a=c.split(/\s+/),m=a.pop();a.forEach(g=>n.classList.add(g)),m&&setTimeout(()=>{n.classList.add(m)},1e3)})}setInterval(e,i,f){return typeof e=="number"&&([i,e]=[e,i]),f||=this.class.fnv1(String(e)),clearInterval(this.__int[f]),this.__int[f]=setInterval(()=>{this.isAttached&&e()},i),this.__int[f]}css(e,i){let f=v.css(e);return i&&this.root.classList.add(f),f}find(e){return this.root.querySelector(e)}val(e,i){let f=this.find(".time");["INPUT","TEXTAREA","SELECT"].includes(f.nodeName)?f.value=i:f.innerHTML=new Date}formData(e){return this.class.formData(e||this.root)}attr(e,i){return typeof i>"u"?this.root.getAttribute(e):(this.root.setAttribute(e,i),i)}childNodes(e){let i=Array.from(this.root.querySelectorAll(":scope > *"));if(e)i.forEach(e);else return i}subscribe(e,i){v._subs||={},v._subs[e]||=[],v._subs[e]=v._subs[e].filter(f=>f[0].isAttached),v._subs[e].push([this,i])}fezRegister(){this.class.css&&(typeof this.class.css=="function"&&(this.class.css=this.class.css(this)),this.class.css.includes(":")&&(this.class.css=v.css(this.class.css)),this.root.classList.add(this.class.css)),this.fezRegisterBindMethods()}fezRegisterBindMethods(){Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(i=>i!=="constructor"&&typeof this[i]=="function").forEach(i=>this[i]=this[i].bind(this))}};setInterval(()=>{k.__objects=k.__objects.filter(l=>l.isAttached)},1e4);var Ee=new MutationObserver((l,e)=>{for(let i of l)if(i.type==="attributes"){let f=i.target.fez,p=i.attributeName,h=i.target.getAttribute(p);f.props[p]=h,f.onPropsChange(p,h)}}),v=(l,e)=>{function i(){let p=this.parentNode;if(p){let h=typeof e.nodeName=="function"?e.nodeName(this):e.nodeName,c=document.createElement(h||"div");c.classList.add("fez"),c.classList.add(`fez-${l}`),p.replaceChild(c,this);let a=new e;a.oldRoot=this,a.fezName=l,a.root=c,a.props=e.getProps(this),a.class=e,a.slot(this,c),c.fez=a,window.$&&(a.$root=$(c)),a.props.id&&c.setAttribute("id",a.props.id),a.fezRegister(),a.connect(a.props),e.__objects.push(a),e.html&&(typeof e.html=="function"&&(e.html=e.html(this)),a.html()),a.onPropsChange&&Ee.observe(c,{attributes:!0})}}function f(p){return typeof e.fastBind=="function"?e.fastBind(p):e.fastBind}if(!l)return k;if(typeof e!="function")return v.find(l,e);customElements.define(l,class extends HTMLElement{connectedCallback(){this.firstChild||f(this)?(v.info(`fast bind: ${l}`),i.bind(this)()):(v.info(`slow bind: ${l}`),window.requestAnimationFrame(()=>{i.bind(this)()}))}})};v.find=(l,e)=>{typeof l=="string"&&(l=document.body.querySelector(l)),typeof l.val=="function"&&(l=l[0]);let i=e?`.fez-${e}`:".fez";return l.closest(i).fez};v.globalCss=l=>{let e=v.css(l);return document.addEventListener("DOMContentLoaded",()=>{document.body.classList.add(e)}),e};v.css=l=>ee.css(l);v.info=l=>{window.DEBUG&&console.log(`Fez: ${l}`)};v.morphdom=(l,e,i={})=>{i.childrenOnly===void 0&&(i.childrenOnly=!0),Z.morph(l,e,{morphStyle:"innerHTML"})};v.htmlEscape=l=>l.replaceAll("'","&apos;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");v.publish=(l,...e)=>{v._subs[l]||=[],v._subs[l].forEach(i=>{i[1].bind(i[0])(...e)})};window.Fez=v;window.FezBase=k;})();
//# sourceMappingURL=fez.js.map
