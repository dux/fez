(()=>{function q(l,e){let i=/(\r\n|\r|\n)/g,a=/{{\s*(.+?)\s*}}/g,p=/^each\s+(.*)\s+as\s+(.*)$/,d=/^if\s+(.*)$/,u=/^else if\s+(.*)$/;function o(A){let E=T=>T.replaceAll("@","this."),R=`
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

      _sequence.push('${A.trim().replace(i,"\\n").replace(a,(T,y)=>{if(y=y.replace(/^[#:]/,""),y.startsWith("each")||y.startsWith("for")){let S=y.split(/\s+/);if(S.shift()==="for"){let N=S.pop();S.pop(),y=`each ${N} as ${S.join(" ")}`}let z=p.exec(y);if(z)return z[1]=E(z[1]),`');
 (!Array.isArray(${z[1]}) ? Array.from(Object.entries(${z[1]} || []), ([key, value]) => [key, value]) : ${z[1]}).forEach((${z[2]}) => { _sequence.push('`}else if(y.startsWith("if")){let S=d.exec(y);if(S)return S[1]=E(S[1]),`');
 if (${S[1]}) { _sequence.push('`}else if(y.startsWith("else if")){let S=u.exec(y);if(S)return S[1]=E(S[1]),`');
 } else if (${S[1]}) { _sequence.push('`}else{if(y==="else")return`');
 } else { _sequence.push('`;if(y==="/each"||y==="/for")return`');
 }); _sequence.push('`;if(y==="/if")return`');
 } _sequence.push('`}let k=y.split(/^\@html\s+/);return k[1]?y=E(k[1]):y=`htmlEscape(${E(y)})`,`');
 _strings.push(_sequence.join(''));
 _sequence = [];
 _values.push(${y});
 _sequence.push('`})}');
      _strings.push(_sequence.join(''));
      return [_strings, _values];
    `;return new Function("_data",R)}function m(A){let E=o(A);return()=>{let[R,T]=E.bind(e)();return R.reduce((y,k,S)=>y+T[S-1]+k)}}function g(A){let E=new Set(["area","base","br","col","embed","hr","img","input","link","meta","source","track","wbr"]);return A.replace(/<([a-z-]+)\b([^>]*)\/>/g,(R,T,y)=>E.has(T)?R:`<${T}${y}></${T}>`)}return l=g(l),m(l)}var Y=function(){"use strict";let l=new Set,e={morphStyle:"outerHTML",callbacks:{beforeNodeAdded:T,afterNodeAdded:T,beforeNodeMorphed:T,afterNodeMorphed:T,beforeNodeRemoved:T,afterNodeRemoved:T,beforeAttributeUpdated:T},head:{style:"merge",shouldPreserve:function(t){return t.getAttribute("im-preserve")==="true"},shouldReAppend:function(t){return t.getAttribute("im-re-append")==="true"},shouldRemove:T,afterHeadMorphed:T}};function i(t,r,s={}){t instanceof Document&&(t=t.documentElement),typeof r=="string"&&(r=re(r));let f=ne(r),c=k(t,f,s);return a(t,f,c)}function a(t,r,s){if(s.head.block){let f=t.querySelector("head"),c=r.querySelector("head");if(f&&c){let h=E(c,f,s);Promise.all(h).then(function(){a(t,r,Object.assign(s,{head:{block:!1,ignore:!0}}))});return}}if(s.morphStyle==="innerHTML")return u(r,t,s),t.children;if(s.morphStyle==="outerHTML"||s.morphStyle==null){let f=se(r,t,s),c=f?.previousSibling,h=f?.nextSibling,b=d(t,f,s);return f?ie(c,b,h):[]}else throw"Do not understand how to morph style "+s.morphStyle}function p(t,r){return r.ignoreActiveValue&&t===document.activeElement&&t!==document.body}function d(t,r,s){if(!(s.ignoreActive&&t===document.activeElement))return r==null?s.callbacks.beforeNodeRemoved(t)===!1?t:(t.remove(),s.callbacks.afterNodeRemoved(t),null):z(t,r)?(s.callbacks.beforeNodeMorphed(t,r)===!1||(t instanceof HTMLHeadElement&&s.head.ignore||(t instanceof HTMLHeadElement&&s.head.style!=="morph"?E(r,t,s):(m(r,t,s),p(t,s)||u(r,t,s))),s.callbacks.afterNodeMorphed(t,r)),t):s.callbacks.beforeNodeRemoved(t)===!1||s.callbacks.beforeNodeAdded(r)===!1?t:(t.parentElement.replaceChild(r,t),s.callbacks.afterNodeAdded(r),s.callbacks.afterNodeRemoved(t),r)}function u(t,r,s){let f=t.firstChild,c=r.firstChild,h;for(;f;){if(h=f,f=h.nextSibling,c==null){if(s.callbacks.beforeNodeAdded(h)===!1)return;r.appendChild(h),s.callbacks.afterNodeAdded(h),j(s,h);continue}if(S(h,c,s)){d(c,h,s),c=c.nextSibling,j(s,h);continue}let b=ee(t,r,h,c,s);if(b){c=N(c,b,s),d(b,h,s),j(s,h);continue}let M=te(t,r,h,c,s);if(M){c=N(c,M,s),d(M,h,s),j(s,h);continue}if(s.callbacks.beforeNodeAdded(h)===!1)return;r.insertBefore(h,c),s.callbacks.afterNodeAdded(h),j(s,h)}for(;c!==null;){let b=c;c=c.nextSibling,U(b,s)}}function o(t,r,s,f){return t==="value"&&f.ignoreActiveValue&&r===document.activeElement?!0:f.callbacks.beforeAttributeUpdated(t,r,s)===!1}function m(t,r,s){let f=t.nodeType;if(f===1){let c=t.attributes,h=r.attributes;for(let b of c)o(b.name,r,"update",s)||r.getAttribute(b.name)!==b.value&&r.setAttribute(b.name,b.value);for(let b=h.length-1;0<=b;b--){let M=h[b];o(M.name,r,"remove",s)||t.hasAttribute(M.name)||r.removeAttribute(M.name)}}(f===8||f===3)&&r.nodeValue!==t.nodeValue&&(r.nodeValue=t.nodeValue),p(r,s)||A(t,r,s)}function g(t,r,s,f){if(t[s]!==r[s]){let c=o(s,r,"update",f);c||(r[s]=t[s]),t[s]?c||r.setAttribute(s,t[s]):o(s,r,"remove",f)||r.removeAttribute(s)}}function A(t,r,s){if(t instanceof HTMLInputElement&&r instanceof HTMLInputElement&&t.type!=="file"){let f=t.value,c=r.value;g(t,r,"checked",s),g(t,r,"disabled",s),t.hasAttribute("value")?f!==c&&(o("value",r,"update",s)||(r.setAttribute("value",f),r.value=f)):o("value",r,"remove",s)||(r.value="",r.removeAttribute("value"))}else if(t instanceof HTMLOptionElement)g(t,r,"selected",s);else if(t instanceof HTMLTextAreaElement&&r instanceof HTMLTextAreaElement){let f=t.value,c=r.value;if(o("value",r,"update",s))return;f!==c&&(r.value=f),r.firstChild&&r.firstChild.nodeValue!==f&&(r.firstChild.nodeValue=f)}}function E(t,r,s){let f=[],c=[],h=[],b=[],M=s.head.style,H=new Map;for(let _ of t.children)H.set(_.outerHTML,_);for(let _ of r.children){let L=H.has(_.outerHTML),F=s.head.shouldReAppend(_),B=s.head.shouldPreserve(_);L||B?F?c.push(_):(H.delete(_.outerHTML),h.push(_)):M==="append"?F&&(c.push(_),b.push(_)):s.head.shouldRemove(_)!==!1&&c.push(_)}b.push(...H.values());let X=[];for(let _ of b){let L=document.createRange().createContextualFragment(_.outerHTML).firstChild;if(s.callbacks.beforeNodeAdded(L)!==!1){if(L.href||L.src){let F=null,B=new Promise(function(ue){F=ue});L.addEventListener("load",function(){F()}),X.push(B)}r.appendChild(L),s.callbacks.afterNodeAdded(L),f.push(L)}}for(let _ of c)s.callbacks.beforeNodeRemoved(_)!==!1&&(r.removeChild(_),s.callbacks.afterNodeRemoved(_));return s.head.afterHeadMorphed(r,{added:f,kept:h,removed:c}),X}function R(){}function T(){}function y(t){let r={};return Object.assign(r,e),Object.assign(r,t),r.callbacks={},Object.assign(r.callbacks,e.callbacks),Object.assign(r.callbacks,t.callbacks),r.head={},Object.assign(r.head,e.head),Object.assign(r.head,t.head),r}function k(t,r,s){return s=y(s),{target:t,newContent:r,config:s,morphStyle:s.morphStyle,ignoreActive:s.ignoreActive,ignoreActiveValue:s.ignoreActiveValue,idMap:fe(t,r),deadIds:new Set,callbacks:s.callbacks,head:s.head}}function S(t,r,s){return t==null||r==null?!1:t.nodeType===r.nodeType&&t.tagName===r.tagName?t.id!==""&&t.id===r.id?!0:O(s,t,r)>0:!1}function z(t,r){return t==null||r==null?!1:t.nodeType===r.nodeType&&t.tagName===r.tagName}function N(t,r,s){for(;t!==r;){let f=t;t=t.nextSibling,U(f,s)}return j(s,r),r.nextSibling}function ee(t,r,s,f,c){let h=O(c,s,r),b=null;if(h>0){let M=f,H=0;for(;M!=null;){if(S(s,M,c))return M;if(H+=O(c,M,t),H>h)return null;M=M.nextSibling}}return b}function te(t,r,s,f,c){let h=f,b=s.nextSibling,M=0;for(;h!=null;){if(O(c,h,t)>0)return null;if(z(s,h))return h;if(z(b,h)&&(M++,b=b.nextSibling,M>=2))return null;h=h.nextSibling}return h}function re(t){let r=new DOMParser,s=t.replace(/<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,"");if(s.match(/<\/html>/)||s.match(/<\/head>/)||s.match(/<\/body>/)){let f=r.parseFromString(t,"text/html");if(s.match(/<\/html>/))return f.generatedByIdiomorph=!0,f;{let c=f.firstChild;return c?(c.generatedByIdiomorph=!0,c):null}}else{let c=r.parseFromString("<body><template>"+t+"</template></body>","text/html").body.querySelector("template").content;return c.generatedByIdiomorph=!0,c}}function ne(t){if(t==null)return document.createElement("div");if(t.generatedByIdiomorph)return t;if(t instanceof Node){let r=document.createElement("div");return r.append(t),r}else{let r=document.createElement("div");for(let s of[...t])r.append(s);return r}}function ie(t,r,s){let f=[],c=[];for(;t!=null;)f.push(t),t=t.previousSibling;for(;f.length>0;){let h=f.pop();c.push(h),r.parentElement.insertBefore(h,r)}for(c.push(r);s!=null;)f.push(s),c.push(s),s=s.nextSibling;for(;f.length>0;)r.parentElement.insertBefore(f.pop(),r.nextSibling);return c}function se(t,r,s){let f;f=t.firstChild;let c=f,h=0;for(;f;){let b=le(f,r,s);b>h&&(c=f,h=b),f=f.nextSibling}return c}function le(t,r,s){return z(t,r)?.5+O(s,t,r):0}function U(t,r){j(r,t),r.callbacks.beforeNodeRemoved(t)!==!1&&(t.remove(),r.callbacks.afterNodeRemoved(t))}function oe(t,r){return!t.deadIds.has(r)}function ae(t,r,s){return(t.idMap.get(s)||l).has(r)}function j(t,r){let s=t.idMap.get(r)||l;for(let f of s)t.deadIds.add(f)}function O(t,r,s){let f=t.idMap.get(r)||l,c=0;for(let h of f)oe(t,h)&&ae(t,h,s)&&++c;return c}function G(t,r){let s=t.parentElement,f=t.querySelectorAll("[id]");for(let c of f){let h=c;for(;h!==s&&h!=null;){let b=r.get(h);b==null&&(b=new Set,r.set(h,b)),b.add(c.id),h=h.parentElement}}}function fe(t,r){let s=new Map;return G(t,s),G(r,s),s}return{morph:i,defaults:e}}();var ce={data:""},J=l=>typeof window=="object"?((l?l.querySelector("#_goober"):window._goober)||Object.assign((l||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:l||ce,de=l=>{let e=J(l),i=e.data;return e.data="",i},he=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,pe=/\/\*[^]*?\*\/|  +/g,Z=/\n+/g,C=(l,e)=>{let i="",a="",p="";for(let d in l){let u=l[d];d[0]=="@"?d[1]=="i"?i=d+" "+u+";":a+=d[1]=="f"?C(u,d):d+"{"+C(u,d[1]=="k"?"":e)+"}":typeof u=="object"?a+=C(u,e?e.replace(/([^,])+/g,o=>d.replace(/(^:.*)|([^,])+/g,m=>/&/.test(m)?m.replace(/&/g,o):o?o+" "+m:m)):d):u!=null&&(d=/^--/.test(d)?d:d.replace(/[A-Z]/g,"-$&").toLowerCase(),p+=C.p?C.p(d,u):d+":"+u+";")}return i+(e&&p?e+"{"+p+"}":p)+a},w={},K=l=>{if(typeof l=="object"){let e="";for(let i in l)e+=i+K(l[i]);return e}return l},me=(l,e,i,a,p)=>{let d=K(l),u=w[d]||(w[d]=(m=>{let g=0,A=11;for(;g<m.length;)A=101*A+m.charCodeAt(g++)>>>0;return"go"+A})(d));if(!w[u]){let m=d!==l?l:(g=>{let A,E,R=[{}];for(;A=he.exec(g.replace(pe,""));)A[4]?R.shift():A[3]?(E=A[3].replace(Z," ").trim(),R.unshift(R[0][E]=R[0][E]||{})):R[0][A[1]]=A[2].replace(Z," ").trim();return R[0]})(l);w[u]=C(p?{["@keyframes "+u]:m}:m,i?"":"."+u)}let o=i&&w.g?w.g:null;return i&&(w.g=w[u]),((m,g,A,E)=>{E?g.data=g.data.replace(E,m):g.data.indexOf(m)===-1&&(g.data=A?m+g.data:g.data+m)})(w[u],e,a,o),u},be=(l,e,i)=>l.reduce((a,p,d)=>{let u=e[d];if(u&&u.call){let o=u(i),m=o&&o.props&&o.props.className||/^go/.test(o)&&o;u=m?"."+m:o&&typeof o=="object"?o.props?"":C(o,""):o===!1?"":o}return a+p+(u??"")},"");function P(l){let e=this||{},i=l.call?l(e.p):l;return me(i.unshift?i.raw?be(i,[].slice.call(arguments,1),e.p):i.reduce((a,p)=>Object.assign(a,p&&p.call?p(e.p):p),{}):i,J(e.target),e.g,e.o,e.k)}var Q,V,D,ge=P.bind({g:1}),ye=P.bind({k:1});function ve(l,e,i,a){C.p=e,Q=l,V=i,D=a}function Ae(l,e){let i=this||{};return function(){let a=arguments;function p(d,u){let o=Object.assign({},d),m=o.className||p.className;i.p=Object.assign({theme:V&&V()},o),i.o=/ *go\d+/.test(m),o.className=P.apply(i,a)+(m?" "+m:""),e&&(o.ref=u);let g=l;return l[0]&&(g=o.as||l,delete o.as),D&&g[0]&&D(o),Q(g,o)}return e?e(p):p}}var x={css:P,extractCss:de,glob:ge,keyframes:ye,setup:ve,styled:Ae};function W(l,e={},i){if(typeof e=="string"&&([e,i]=[i,e],e||={}),e instanceof Node&&(i=e,e={}),Array.isArray(l)&&(i=l,l="div"),(typeof e!="object"||Array.isArray(e))&&(i=e,e={}),l.includes(".")){let p=l.split(".");l=p.shift()||"div";let d=p.join(" ");e.class?e.class+=` ${d}`:e.class=d}let a=document.createElement(l);for(let[p,d]of Object.entries(e))if(typeof d=="function")a[p]=d.bind(this);else{let u=String(d).replaceAll("$$.",this.fezHtmlRoot);a.setAttribute(p,u)}if(i)if(Array.isArray(i))for(let p of i)a.appendChild(p);else i instanceof Node?a.appendChild(i):a.innerHTML=String(i);return a}var I=class{static __objects=[];static find(e,i){return v.find(e,i)}static fnv1(e){var i,a,p,d,u,o;for(i=2166136261,a=16777619,p=i,d=u=0,o=e.length-1;0<=o?u<=o:u>=o;d=0<=o?++u:--u)p^=e.charCodeAt(d),p*=a;return p.toString(36).replaceAll("-","")}static getProps(e){let i={};for(let a of e.attributes)i[a.name]=a.value;return i}static formData(e){let i=new FormData(e.closest("form")),a={};return i.forEach((p,d)=>{a[d]=p}),a}static fastBind(){return!1}constructor(){this.__int={}}n=W;get fezHtmlRoot(){return`Fez.find(this, "${this.fezName}").`}get isAttached(){return this.root?.parentNode?!0:(Object.keys(this.__int).forEach(e=>{clearInterval(this.__int[e])}),this.root.fez=null,this.root=null,!1)}prop(e){let i=this.oldRoot[e]||this.props[e];return typeof i=="function"&&(i=i.bind(this.root)),i}copy(){for(let e of Array.from(arguments)){let i=this.props[e];if(i!==void 0){if(e=="class"){let a=this.root.getAttribute(e,i);a&&(i=[a,i].join(" "))}typeof i=="string"?this.root.setAttribute(e,i):this.root[e]=i}}}slot(e,i){i||=document.createElement("template");let a=i.nodeName=="SLOT";for(;e.firstChild;)a?i.parentNode.insertBefore(e.lastChild,i.nextSibling):i.appendChild(e.firstChild);return a?i.parentNode.removeChild(i):e.innerHTML="",i}style(){console.error("call Fez static style")}connect(){console.error('Fez is missing "connect" method.',this.root)}parseHtml(e,i){if(typeof e=="object"&&(e=e[0]),e=e.replaceAll("$$.",this.fezHtmlRoot.replaceAll('"',"&quot;")),e.includes("{{"))try{e=q(e,this)()}catch(a){console.error(`Fez stache template error in "${this.fezName}"`,a)}return e}html(e,i){e||(e=this._fez_html_func||console.error(`Fez error ${this.fezName}: class template not defined (static html = '...')`)),typeof i>"u"&&(i=e,e=this.root),typeof e=="string"&&(e=this.find(e));let a=document.createElement("div");typeof i=="function"&&(i=i()),Array.isArray(i)?i[0]instanceof Node?i.forEach(u=>{a.appendChild(u)}):i=i.join(""):typeof i=="string"?a.innerHTML=this.parseHtml(i):i&&a.appendChild(i);let p=a.querySelector("slot");p&&this.slot(e,p),v.morphdom(e,a);let d=(u,o)=>{e.querySelectorAll(`*[${u}]`).forEach(m=>{let g=m.getAttribute(u);m.removeAttribute(u),g&&o.bind(this)(g,m)})};d("fez-this",(u,o)=>{this[u]=o}),d("fez-use",(u,o)=>{let m=this[u];typeof m=="function"?m(o):console.error(`Fez error: "${u}" is not a function in ${this.fezName}`)}),d("fez-class",u=>{let o=u.split(/\s+/),m=o.pop();o.forEach(g=>n.classList.add(g)),m&&setTimeout(()=>{n.classList.add(m)},1e3)})}setInterval(e,i,a){return typeof e=="number"&&([i,e]=[e,i]),a||=this.class.fnv1(String(e)),clearInterval(this.__int[a]),this.__int[a]=setInterval(()=>{this.isAttached&&e()},i),this.__int[a]}css(e,i){let a=v.css(e);return i&&this.root.classList.add(a),a}find(e){return this.root.querySelector(e)}val(e,i){let a=this.find(".time");["INPUT","TEXTAREA","SELECT"].includes(a.nodeName)?a.value=i:a.innerHTML=new Date}formData(e){return this.class.formData(e||this.root)}attr(e,i){return typeof i>"u"?this.root.getAttribute(e):(this.root.setAttribute(e,i),i)}childNodes(e){let i=Array.from(this.root.querySelectorAll(":scope > *"));if(e)i.forEach(e);else return i}subscribe(e,i){v._subs||={},v._subs[e]||=[],v._subs[e]=v._subs[e].filter(a=>a[0].isAttached),v._subs[e].push([this,i])}fezRegister(){this.class.css&&(typeof this.class.css=="function"&&(this.class.css=this.class.css(this)),this.class.css.includes(":")&&(this.class.css=v.css(this.class.css)),this.root.classList.add(this.class.css)),this.fezRegisterBindMethods()}fezRegisterBindMethods(){Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter(i=>i!=="constructor"&&typeof this[i]=="function").forEach(i=>this[i]=this[i].bind(this))}reactiveStore(e,i){e||={},i||=(p,d,u)=>{this._nextRenderTick||=window.requestAnimationFrame(()=>{v.info("reactive render"),this.html(),this._nextRenderTick=null},0)},i.bind(this);function a(p,d){return typeof p!="object"||p===null?p:new Proxy(p,{set(u,o,m,g){typeof m=="object"&&m!==null&&(m=a(m,d));let A=Reflect.set(u,o,m,g);return d(u,o,m),A},get(u,o,m){let g=Reflect.get(u,o,m);return typeof g=="object"&&g!==null?a(g,d):g}})}return a(e,i)}};setInterval(()=>{I.__objects=I.__objects.filter(l=>l.isAttached)},1e4);var _e=new MutationObserver((l,e)=>{for(let i of l)if(i.type==="attributes"){let a=i.target.fez,p=i.attributeName,d=i.target.getAttribute(p);a.props[p]=d,a.onPropsChange(p,d)}}),v=(l,e)=>{function i(){let p=this.parentNode;if(p){let d=typeof e.nodeName=="function"?e.nodeName(this):e.nodeName,u=document.createElement(d||"div");u.classList.add("fez"),u.classList.add(`fez-${l}`),p.replaceChild(u,this);let o=new e;o.oldRoot=this,o.fezName=l,o.root=u,o.props=e.getProps(this),o.class=e,o.slot(this,u),u.fez=o,window.$&&(o.$root=$(u)),o.props.id&&u.setAttribute("id",o.props.id),e.html&&(typeof e.html=="function"&&(e.html=e.html(this)),o._fez_html_func=q(e.html,o)),o.fezRegister(),o.connect(o.props),e.__objects.push(o),o._fez_html_func&&o.html(),o.onPropsChange&&_e.observe(u,{attributes:!0})}}function a(p){return typeof e.fastBind=="function"?e.fastBind(p):e.fastBind}if(!l)return I;if(typeof e!="function")return v.find(l,e);customElements.define(l,class extends HTMLElement{connectedCallback(){this.firstChild||a(this)?(v.info(`fast bind: ${l}`),i.bind(this)()):(v.info(`slow bind: ${l}`),window.requestAnimationFrame(()=>{i.bind(this)()}))}})};v.find=(l,e)=>{typeof l=="string"&&(l=document.body.querySelector(l)),typeof l.val=="function"&&(l=l[0]);let i=e?`.fez-${e}`:".fez";return l.closest(i).fez};v.globalCss=l=>{let e=v.css(l);return document.addEventListener("DOMContentLoaded",()=>{document.body.classList.add(e)}),e};v.css=l=>x.css(l);v.info=l=>{window.DEBUG&&console.log(`Fez: ${l}`)};v.morphdom=(l,e,i={})=>{i.childrenOnly===void 0&&(i.childrenOnly=!0),Y.morph(l,e,{morphStyle:"innerHTML"})};v.htmlEscape=l=>l.replaceAll("'","&apos;").replaceAll('"',"&quot;").replaceAll("<","&lt;").replaceAll(">","&gt;");v.publish=(l,...e)=>{v._subs[l]||=[],v._subs[l].forEach(i=>{i[1].bind(i[0])(...e)})};window.Fez=v;window.FezBase=I;})();
//# sourceMappingURL=fez.js.map
