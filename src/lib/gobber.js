/**
 * Skipped minification because the original files appears to be already minified.
 * Original file: /npm/goober@2.1.14/dist/goober.modern.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
let e={data:""},t=t=>"object"==typeof window?((t?t.querySelector("#_goober"):window._goober)||Object.assign((t||document.head).appendChild(document.createElement("style")),{innerHTML:" ",id:"_goober"})).firstChild:t||e,a=e=>{let a=t(e),r=a.data;return a.data="",r},r=/(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g,l=/\/\*[^]*?\*\/|  +/g,s=/\n+/g,n=(e,t)=>{let a="",r="",l="";for(let s in e){let o=e[s];"@"==s[0]?"i"==s[1]?a=s+" "+o+";":r+="f"==s[1]?n(o,s):s+"{"+n(o,"k"==s[1]?"":t)+"}":"object"==typeof o?r+=n(o,t?t.replace(/([^,])+/g,(e=>s.replace(/(^:.*)|([^,])+/g,(t=>/&/.test(t)?t.replace(/&/g,e):e?e+" "+t:t)))):s):null!=o&&(s=/^--/.test(s)?s:s.replace(/[A-Z]/g,"-$&").toLowerCase(),l+=n.p?n.p(s,o):s+":"+o+";")}return a+(t&&l?t+"{"+l+"}":l)+r},o={},c=e=>{if("object"==typeof e){let t="";for(let a in e)t+=a+c(e[a]);return t}return e},i=(e,t,a,i,p)=>{let u=c(e),d=o[u]||(o[u]=(e=>{let t=0,a=11;for(;t<e.length;)a=101*a+e.charCodeAt(t++)>>>0;return"go"+a})(u));if(!o[d]){let t=u!==e?e:(e=>{let t,a,n=[{}];for(;t=r.exec(e.replace(l,""));)t[4]?n.shift():t[3]?(a=t[3].replace(s," ").trim(),n.unshift(n[0][a]=n[0][a]||{})):n[0][t[1]]=t[2].replace(s," ").trim();return n[0]})(e);o[d]=n(p?{["@keyframes "+d]:t}:t,a?"":"."+d)}let f=a&&o.g?o.g:null;return a&&(o.g=o[d]),((e,t,a,r)=>{r?t.data=t.data.replace(r,e):-1===t.data.indexOf(e)&&(t.data=a?e+t.data:t.data+e)})(o[d],t,i,f),d},p=(e,t,a)=>e.reduce(((e,r,l)=>{let s=t[l];if(s&&s.call){let e=s(a),t=e&&e.props&&e.props.className||/^go/.test(e)&&e;s=t?"."+t:e&&"object"==typeof e?e.props?"":n(e,""):!1===e?"":e}return e+r+(null==s?"":s)}),"");function u(e){let a=this||{},r=e.call?e(a.p):e;return i(r.unshift?r.raw?p(r,[].slice.call(arguments,1),a.p):r.reduce(((e,t)=>Object.assign(e,t&&t.call?t(a.p):t)),{}):r,t(a.target),a.g,a.o,a.k)}let d,f,g,b=u.bind({g:1}),m=u.bind({k:1});function h(e,t,a,r){n.p=t,d=e,f=a,g=r}function y(e,t){let a=this||{};return function(){let r=arguments;function l(s,n){let o=Object.assign({},s),c=o.className||l.className;a.p=Object.assign({theme:f&&f()},o),a.o=/ *go\d+/.test(c),o.className=u.apply(a,r)+(c?" "+c:""),t&&(o.ref=n);let i=e;return e[0]&&(i=o.as||e,delete o.as),g&&i[0]&&g(o),d(i,o)}return t?t(l):l}}
export default { css:u, extractCss: a, glob: b, keyframes: m, setup: h, styled: y }