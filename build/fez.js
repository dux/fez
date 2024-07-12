(() => {
  // src/lib/stache.js
  function renderStache(tpl, context) {
    const NEW_LINES_RE = /(\r\n|\r|\n)/g;
    const TEMPLATE_RE = /{{\s*(.+?)\s*}}/g;
    const EACH_RE = /^each\s+(.*)\s+as\s+(.*)$/;
    const IF_RE = /^if\s+(.*)$/;
    const ELSE_IF_RE = /^else if\s+(.*)$/;
    function stache(source) {
      const monkey = (t3) => t3.replaceAll("@", "this.");
      let func = `
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

      _sequence.push('${source.trim().replace(NEW_LINES_RE, "\\n").replace(TEMPLATE_RE, (all, code) => {
        code = code.replace(/^[#:]/, "");
        if (code.startsWith("each") || code.startsWith("for")) {
          const parts = code.split(/\s+/);
          if (parts.shift() === "for") {
            const list = parts.pop();
            parts.pop();
            code = `each ${list} as ${parts.join(" ")}`;
          }
          let loop = EACH_RE.exec(code);
          if (loop) {
            loop[1] = monkey(loop[1]);
            return `');
 (!Array.isArray(${loop[1]}) ? Array.from(Object.entries(${loop[1]} || []), ([key, value]) => [key, value]) : ${loop[1]}).forEach((${loop[2]}) => { _sequence.push('`;
          }
        } else if (code.startsWith("if")) {
          let conditional = IF_RE.exec(code);
          if (conditional) {
            conditional[1] = monkey(conditional[1]);
            return `');
 if (${conditional[1]}) { _sequence.push('`;
          }
        } else if (code.startsWith("else if")) {
          let conditionalElse = ELSE_IF_RE.exec(code);
          if (conditionalElse) {
            conditionalElse[1] = monkey(conditionalElse[1]);
            return `');
 } else if (${conditionalElse[1]}) { _sequence.push('`;
          }
        } else if (code === "else") {
          return `');
 } else { _sequence.push('`;
        } else if (code === "/each" || code === "/for") {
          return `');
 }); _sequence.push('`;
        } else if (code === "/if") {
          return `');
 } _sequence.push('`;
        }
        const codeParts = code.split(/^\@html\s+/);
        if (codeParts[1]) {
          code = monkey(codeParts[1]);
        } else {
          code = `htmlEscape(${monkey(code)})`;
        }
        return `');
 _strings.push(_sequence.join(''));
 _sequence = [];
 _values.push(${code});
 _sequence.push('`;
      })}');
      _strings.push(_sequence.join(''));
      return [_strings, _values];
    `;
      return new Function("_data", func);
    }
    function createTemplate(source) {
      const tpl2 = stache(source);
      return () => {
        const [strings, values] = tpl2.bind(context)();
        return strings.reduce((acc, str, i3) => acc + values[i3 - 1] + str);
      };
    }
    function closeCustomTags(html) {
      const selfClosingTags = /* @__PURE__ */ new Set([
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "source",
        "track",
        "wbr"
      ]);
      return html.replace(/<([a-z-]+)\b([^>]*)\/>/g, (match, tagName, attributes) => {
        return selfClosingTags.has(tagName) ? match : `<${tagName}${attributes}></${tagName}>`;
      });
    }
    tpl = closeCustomTags(tpl);
    return createTemplate(tpl)().replace(/\n\s*\n/g, "\n");
  }

  // src/lib/morphdom.js
  var e;
  var t = "http://www.w3.org/1999/xhtml";
  var n2 = "undefined" == typeof document ? void 0 : document;
  var r = !!n2 && "content" in n2.createElement("template");
  var i = !!n2 && n2.createRange && "createContextualFragment" in n2.createRange();
  function a(t3) {
    return t3 = t3.trim(), r ? function(e3) {
      var t4 = n2.createElement("template");
      return t4.innerHTML = e3, t4.content.childNodes[0];
    }(t3) : i ? function(t4) {
      return e || (e = n2.createRange()).selectNode(n2.body), e.createContextualFragment(t4).childNodes[0];
    }(t3) : function(e3) {
      var t4 = n2.createElement("body");
      return t4.innerHTML = e3, t4.childNodes[0];
    }(t3);
  }
  function o(e3, t3) {
    var n5, r3, i3 = e3.nodeName, a3 = t3.nodeName;
    return i3 === a3 || (n5 = i3.charCodeAt(0), r3 = a3.charCodeAt(0), n5 <= 90 && r3 >= 97 ? i3 === a3.toUpperCase() : r3 <= 90 && n5 >= 97 && a3 === i3.toUpperCase());
  }
  function d(e3, t3, n5) {
    e3[n5] !== t3[n5] && (e3[n5] = t3[n5], e3[n5] ? e3.setAttribute(n5, "") : e3.removeAttribute(n5));
  }
  var l = { OPTION: function(e3, t3) {
    var n5 = e3.parentNode;
    if (n5) {
      var r3 = n5.nodeName.toUpperCase();
      "OPTGROUP" === r3 && (r3 = (n5 = n5.parentNode) && n5.nodeName.toUpperCase()), "SELECT" !== r3 || n5.hasAttribute("multiple") || (e3.hasAttribute("selected") && !t3.selected && (e3.setAttribute("selected", "selected"), e3.removeAttribute("selected")), n5.selectedIndex = -1);
    }
    d(e3, t3, "selected");
  }, INPUT: function(e3, t3) {
    d(e3, t3, "checked"), d(e3, t3, "disabled"), e3.value !== t3.value && (e3.value = t3.value), t3.hasAttribute("value") || e3.removeAttribute("value");
  }, TEXTAREA: function(e3, t3) {
    var n5 = t3.value;
    e3.value !== n5 && (e3.value = n5);
    var r3 = e3.firstChild;
    if (r3) {
      var i3 = r3.nodeValue;
      if (i3 == n5 || !n5 && i3 == e3.placeholder) return;
      r3.nodeValue = n5;
    }
  }, SELECT: function(e3, t3) {
    if (!t3.hasAttribute("multiple")) {
      for (var n5, r3, i3 = -1, a3 = 0, o3 = e3.firstChild; o3; ) if ("OPTGROUP" === (r3 = o3.nodeName && o3.nodeName.toUpperCase())) o3 = (n5 = o3).firstChild;
      else {
        if ("OPTION" === r3) {
          if (o3.hasAttribute("selected")) {
            i3 = a3;
            break;
          }
          a3++;
        }
        !(o3 = o3.nextSibling) && n5 && (o3 = n5.nextSibling, n5 = null);
      }
      e3.selectedIndex = i3;
    }
  } };
  function u() {
  }
  function f(e3) {
    if (e3) return e3.getAttribute && e3.getAttribute("id") || e3.id;
  }
  var c = /* @__PURE__ */ function(e3) {
    return function(r3, i3, d3) {
      if (d3 || (d3 = {}), "string" == typeof i3) if ("#document" === r3.nodeName || "HTML" === r3.nodeName || "BODY" === r3.nodeName) {
        var c3 = i3;
        (i3 = n2.createElement("html")).innerHTML = c3;
      } else i3 = a(i3);
      else 11 === i3.nodeType && (i3 = i3.firstElementChild);
      var s2 = d3.getNodeKey || f, v = d3.onBeforeNodeAdded || u, m2 = d3.onNodeAdded || u, p2 = d3.onBeforeElUpdated || u, h2 = d3.onElUpdated || u, N = d3.onBeforeNodeDiscarded || u, b2 = d3.onNodeDiscarded || u, A = d3.onBeforeElChildrenUpdated || u, C = d3.skipFromChildren || u, T = d3.addChild || function(e4, t3) {
        return e4.appendChild(t3);
      }, g2 = true === d3.childrenOnly, E = /* @__PURE__ */ Object.create(null), S = [];
      function x(e4) {
        S.push(e4);
      }
      function y2(e4, t3) {
        if (1 === e4.nodeType) for (var n5 = e4.firstChild; n5; ) {
          var r4 = void 0;
          t3 && (r4 = s2(n5)) ? x(r4) : (b2(n5), n5.firstChild && y2(n5, t3)), n5 = n5.nextSibling;
        }
      }
      function U(e4, t3, n5) {
        false !== N(e4) && (t3 && t3.removeChild(e4), b2(e4), y2(e4, n5));
      }
      function O(e4) {
        m2(e4);
        for (var t3 = e4.firstChild; t3; ) {
          var n5 = t3.nextSibling, r4 = s2(t3);
          if (r4) {
            var i4 = E[r4];
            i4 && o(t3, i4) ? (t3.parentNode.replaceChild(i4, t3), R(i4, t3)) : O(t3);
          } else O(t3);
          t3 = n5;
        }
      }
      function R(t3, r4, i4) {
        var a3 = s2(r4);
        if (a3 && delete E[a3], !i4) {
          var d4 = p2(t3, r4);
          if (false === d4) return;
          if (d4 instanceof HTMLElement && (t3 = d4), e3(t3, r4), h2(t3), false === A(t3, r4)) return;
        }
        "TEXTAREA" !== t3.nodeName ? function(e4, t4) {
          var r5, i5, a4, d5, u3, f3 = C(e4, t4), c4 = t4.firstChild, m3 = e4.firstChild;
          e: for (; c4; ) {
            for (d5 = c4.nextSibling, r5 = s2(c4); !f3 && m3; ) {
              if (a4 = m3.nextSibling, c4.isSameNode && c4.isSameNode(m3)) {
                c4 = d5, m3 = a4;
                continue e;
              }
              i5 = s2(m3);
              var p3 = m3.nodeType, h3 = void 0;
              if (p3 === c4.nodeType && (1 === p3 ? (r5 ? r5 !== i5 && ((u3 = E[r5]) ? a4 === u3 ? h3 = false : (e4.insertBefore(u3, m3), i5 ? x(i5) : U(m3, e4, true), i5 = s2(m3 = u3)) : h3 = false) : i5 && (h3 = false), (h3 = false !== h3 && o(m3, c4)) && R(m3, c4)) : 3 !== p3 && 8 != p3 || (h3 = true, m3.nodeValue !== c4.nodeValue && (m3.nodeValue = c4.nodeValue))), h3) {
                c4 = d5, m3 = a4;
                continue e;
              }
              i5 ? x(i5) : U(m3, e4, true), m3 = a4;
            }
            if (r5 && (u3 = E[r5]) && o(u3, c4)) f3 || T(e4, u3), R(u3, c4);
            else {
              var N2 = v(c4);
              false !== N2 && (N2 && (c4 = N2), c4.actualize && (c4 = c4.actualize(e4.ownerDocument || n2)), T(e4, c4), O(c4));
            }
            c4 = d5, m3 = a4;
          }
          !function(e5, t5, n5) {
            for (; t5; ) {
              var r6 = t5.nextSibling;
              (n5 = s2(t5)) ? x(n5) : U(t5, e5, true), t5 = r6;
            }
          }(e4, m3, i5);
          var b3 = l[e4.nodeName];
          b3 && b3(e4, t4);
        }(t3, r4) : l.TEXTAREA(t3, r4);
      }
      !function e4(t3) {
        if (1 === t3.nodeType || 11 === t3.nodeType) for (var n5 = t3.firstChild; n5; ) {
          var r4 = s2(n5);
          r4 && (E[r4] = n5), e4(n5), n5 = n5.nextSibling;
        }
      }(r3);
      var V, I, L = r3, P = L.nodeType, w = i3.nodeType;
      if (!g2) {
        if (1 === P) 1 === w ? o(r3, i3) || (b2(r3), L = function(e4, t3) {
          for (var n5 = e4.firstChild; n5; ) {
            var r4 = n5.nextSibling;
            t3.appendChild(n5), n5 = r4;
          }
          return t3;
        }(r3, (V = i3.nodeName, (I = i3.namespaceURI) && I !== t ? n2.createElementNS(I, V) : n2.createElement(V)))) : L = i3;
        else if (3 === P || 8 === P) {
          if (w === P) return L.nodeValue !== i3.nodeValue && (L.nodeValue = i3.nodeValue), L;
          L = i3;
        }
      }
      if (L === i3) b2(r3);
      else {
        if (i3.isSameNode && i3.isSameNode(L)) return;
        if (R(L, i3, g2), S) for (var B = 0, D = S.length; B < D; B++) {
          var H = E[S[B]];
          H && U(H, H.parentNode, false);
        }
      }
      return !g2 && L !== r3 && r3.parentNode && (L.actualize && (L = L.actualize(r3.ownerDocument || n2)), r3.parentNode.replaceChild(L, r3)), L;
    };
  }(function(e3, t3) {
    var n5, r3, i3, a3, o3 = t3.attributes;
    if (11 !== t3.nodeType && 11 !== e3.nodeType) {
      for (var d3 = o3.length - 1; d3 >= 0; d3--) r3 = (n5 = o3[d3]).name, i3 = n5.namespaceURI, a3 = n5.value, i3 ? (r3 = n5.localName || r3, e3.getAttributeNS(i3, r3) !== a3 && ("xmlns" === n5.prefix && (r3 = n5.name), e3.setAttributeNS(i3, r3, a3))) : e3.getAttribute(r3) !== a3 && e3.setAttribute(r3, a3);
      for (var l3 = e3.attributes, u3 = l3.length - 1; u3 >= 0; u3--) r3 = (n5 = l3[u3]).name, (i3 = n5.namespaceURI) ? (r3 = n5.localName || r3, t3.hasAttributeNS(i3, r3) || e3.removeAttributeNS(i3, r3)) : t3.hasAttribute(r3) || e3.removeAttribute(r3);
    }
  });

  // src/lib/gobber.js
  var e2 = { data: "" };
  var t2 = (t3) => "object" == typeof window ? ((t3 ? t3.querySelector("#_goober") : window._goober) || Object.assign((t3 || document.head).appendChild(document.createElement("style")), { innerHTML: " ", id: "_goober" })).firstChild : t3 || e2;
  var a2 = (e3) => {
    let a3 = t2(e3), r3 = a3.data;
    return a3.data = "", r3;
  };
  var r2 = /(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g;
  var l2 = /\/\*[^]*?\*\/|  +/g;
  var s = /\n+/g;
  var n3 = (e3, t3) => {
    let a3 = "", r3 = "", l3 = "";
    for (let s2 in e3) {
      let o3 = e3[s2];
      "@" == s2[0] ? "i" == s2[1] ? a3 = s2 + " " + o3 + ";" : r3 += "f" == s2[1] ? n3(o3, s2) : s2 + "{" + n3(o3, "k" == s2[1] ? "" : t3) + "}" : "object" == typeof o3 ? r3 += n3(o3, t3 ? t3.replace(/([^,])+/g, (e4) => s2.replace(/(^:.*)|([^,])+/g, (t4) => /&/.test(t4) ? t4.replace(/&/g, e4) : e4 ? e4 + " " + t4 : t4)) : s2) : null != o3 && (s2 = /^--/.test(s2) ? s2 : s2.replace(/[A-Z]/g, "-$&").toLowerCase(), l3 += n3.p ? n3.p(s2, o3) : s2 + ":" + o3 + ";");
    }
    return a3 + (t3 && l3 ? t3 + "{" + l3 + "}" : l3) + r3;
  };
  var o2 = {};
  var c2 = (e3) => {
    if ("object" == typeof e3) {
      let t3 = "";
      for (let a3 in e3) t3 += a3 + c2(e3[a3]);
      return t3;
    }
    return e3;
  };
  var i2 = (e3, t3, a3, i3, p2) => {
    let u3 = c2(e3), d3 = o2[u3] || (o2[u3] = ((e4) => {
      let t4 = 0, a4 = 11;
      for (; t4 < e4.length; ) a4 = 101 * a4 + e4.charCodeAt(t4++) >>> 0;
      return "go" + a4;
    })(u3));
    if (!o2[d3]) {
      let t4 = u3 !== e3 ? e3 : ((e4) => {
        let t5, a4, n5 = [{}];
        for (; t5 = r2.exec(e4.replace(l2, "")); ) t5[4] ? n5.shift() : t5[3] ? (a4 = t5[3].replace(s, " ").trim(), n5.unshift(n5[0][a4] = n5[0][a4] || {})) : n5[0][t5[1]] = t5[2].replace(s, " ").trim();
        return n5[0];
      })(e3);
      o2[d3] = n3(p2 ? { ["@keyframes " + d3]: t4 } : t4, a3 ? "" : "." + d3);
    }
    let f3 = a3 && o2.g ? o2.g : null;
    return a3 && (o2.g = o2[d3]), ((e4, t4, a4, r3) => {
      r3 ? t4.data = t4.data.replace(r3, e4) : -1 === t4.data.indexOf(e4) && (t4.data = a4 ? e4 + t4.data : t4.data + e4);
    })(o2[d3], t3, i3, f3), d3;
  };
  var p = (e3, t3, a3) => e3.reduce((e4, r3, l3) => {
    let s2 = t3[l3];
    if (s2 && s2.call) {
      let e5 = s2(a3), t4 = e5 && e5.props && e5.props.className || /^go/.test(e5) && e5;
      s2 = t4 ? "." + t4 : e5 && "object" == typeof e5 ? e5.props ? "" : n3(e5, "") : false === e5 ? "" : e5;
    }
    return e4 + r3 + (null == s2 ? "" : s2);
  }, "");
  function u2(e3) {
    let a3 = this || {}, r3 = e3.call ? e3(a3.p) : e3;
    return i2(r3.unshift ? r3.raw ? p(r3, [].slice.call(arguments, 1), a3.p) : r3.reduce((e4, t3) => Object.assign(e4, t3 && t3.call ? t3(a3.p) : t3), {}) : r3, t2(a3.target), a3.g, a3.o, a3.k);
  }
  var d2;
  var f2;
  var g;
  var b = u2.bind({ g: 1 });
  var m = u2.bind({ k: 1 });
  function h(e3, t3, a3, r3) {
    n3.p = t3, d2 = e3, f2 = a3, g = r3;
  }
  function y(e3, t3) {
    let a3 = this || {};
    return function() {
      let r3 = arguments;
      function l3(s2, n5) {
        let o3 = Object.assign({}, s2), c3 = o3.className || l3.className;
        a3.p = Object.assign({ theme: f2 && f2() }, o3), a3.o = / *go\d+/.test(c3), o3.className = u2.apply(a3, r3) + (c3 ? " " + c3 : ""), t3 && (o3.ref = n5);
        let i3 = e3;
        return e3[0] && (i3 = o3.as || e3, delete o3.as), g && i3[0] && g(o3), d2(i3, o3);
      }
      return t3 ? t3(l3) : l3;
    };
  }
  var gobber_default = { css: u2, extractCss: a2, glob: b, keyframes: m, setup: h, styled: y };

  // src/lib/n.js
  function n4(name, attrs = {}, data) {
    if (typeof attrs === "string") {
      [attrs, data] = [data, attrs];
      attrs ||= {};
    }
    if (attrs instanceof Node) {
      data = attrs;
      attrs = {};
    }
    if (Array.isArray(name)) {
      data = name;
      name = "div";
    }
    if (typeof attrs !== "object" || Array.isArray(attrs)) {
      data = attrs;
      attrs = {};
    }
    if (name.includes(".")) {
      const parts = name.split(".");
      name = parts.shift() || "div";
      const c3 = parts.join(" ");
      if (attrs.class) {
        attrs.class += ` ${c3}`;
      } else {
        attrs.class = c3;
      }
    }
    const node = document.createElement(name);
    for (const [k, v] of Object.entries(attrs)) {
      if (typeof v === "function") {
        node[k] = v.bind(this);
      } else {
        const value2 = String(v).replaceAll("$$.", this.fezHtmlRoot);
        node.setAttribute(k, value2);
      }
    }
    if (data) {
      if (Array.isArray(data)) {
        for (const n5 of data) {
          node.appendChild(n5);
        }
      } else if (data instanceof Node) {
        node.appendChild(data);
      } else {
        node.innerHTML = String(data);
      }
    }
    return node;
  }

  // src/fez.js
  var FezBase = class {
    static __objects = [];
    static find(node, name) {
      return Fez.find(node, name);
    }
    // get unique id from string
    static fnv1(str) {
      var FNV_OFFSET_BASIS, FNV_PRIME, hash, i3, j, ref;
      FNV_OFFSET_BASIS = 2166136261;
      FNV_PRIME = 16777619;
      hash = FNV_OFFSET_BASIS;
      for (i3 = j = 0, ref = str.length - 1; 0 <= ref ? j <= ref : j >= ref; i3 = 0 <= ref ? ++j : --j) {
        hash ^= str.charCodeAt(i3);
        hash *= FNV_PRIME;
      }
      return hash.toString(36).replaceAll("-", "");
    }
    // get node attributes as object
    static getProps(node) {
      const attrs = {};
      for (const attr of node.attributes) {
        attrs[attr.name] = attr.value;
      }
      return attrs;
    }
    static formData(node) {
      const formData = new FormData(node.closest("form"));
      const formObject = {};
      formData.forEach((value2, key) => {
        formObject[key] = value2;
      });
      return formObject;
    }
    static fastBind() {
      return false;
    }
    // instance methods
    constructor() {
      this.__int = {};
    }
    n = n4;
    // string selector for use in HTML nodes
    get fezHtmlRoot() {
      return `Fez.find(this, "${this.fezName}").`;
    }
    // checks if node is attached and clears all if not
    get isAttached() {
      if (this.root.parentNode) {
        return true;
      } else {
        Object.keys(this.__int).forEach((key) => {
          clearInterval(this.__int[key]);
        });
        this.root.fez = null;
        this.root = null;
        return false;
      }
    }
    // get single node property
    prop(name) {
      let v = this.oldRoot[name] || this.props[name];
      if (typeof v == "function") {
        v = v.bind(this.root);
      }
      return v;
    }
    // copy attributes to root node
    copy() {
      for (const name of Array.from(arguments)) {
        let value2 = this.props[name];
        if (value2 !== void 0) {
          if (name == "class") {
            const klass = this.root.getAttribute(name, value2);
            if (klass) {
              value2 = [klass, value2].join(" ");
            }
          }
          if (typeof value2 == "string") {
            this.root.setAttribute(name, value2);
          } else {
            this.root[name] = value2;
          }
        }
      }
    }
    // copy child nodes, natively to preserve bound events
    // if node name is SLOT insert adjacent and remove SLOT, else as a child nodes
    slot(source, target2) {
      target2 ||= document.createElement("template");
      const isSlot = target2.nodeName == "SLOT";
      while (source.firstChild) {
        if (isSlot) {
          target2.parentNode.insertBefore(source.lastChild, target2.nextSibling);
        } else {
          target2.appendChild(source.firstChild);
        }
      }
      if (isSlot) {
        target2.parentNode.removeChild(target2);
      } else {
        source.innerHTML = "";
      }
      return target2;
    }
    style() {
      console.error("call Fez static style");
    }
    connect() {
      console.error('Fez is missing "connect" method.', this.root);
    }
    parseHtml(text, context) {
      if (typeof text == "object") {
        text = text[0];
      }
      text = text.replaceAll("$$.", this.fezHtmlRoot.replaceAll('"', "&quot;"));
      if (text.includes("{{")) {
        try {
          text = renderStache(text, this);
        } catch (error) {
          console.error(`Fez stache template error in "${this.fezName}"`, error);
        }
      }
      text = text.replaceAll(">,<", "><").replace(/\s*undefined\s*/g, "");
      return text;
    }
    // inject htmlString as innerHTML and replace $$. with local pointer
    // $$. will point to current fez instance
    // <slot></slot> will be replaced with current root
    // this.html('...loading')
    // this.html('.images', '...loading')
    html(target, body) {
      if (typeof body == "undefined") {
        body = target;
        target = this.root;
      }
      if (typeof target == "string") {
        target = this.find(target);
      }
      const newNode = document.createElement("div");
      if (Array.isArray(body)) {
        if (body[0] instanceof Node) {
          body.forEach((n5) => {
            newNode.appendChild(n5);
          });
        } else {
          body = body.join("");
        }
      } else if (typeof body === "string") {
        newNode.innerHTML = this.parseHtml(body);
      } else {
        newNode.appendChild(body);
      }
      const slot = newNode.querySelector("slot");
      if (slot) {
        this.slot(target, slot);
      }
      Fez.morphdom(target, newNode);
      target.querySelectorAll("*[fez-this]").forEach((n) => {
        let value = n.getAttribute("fez-this").replace(/[^\w\.\[\]]/, "");
        eval(`this.${value} = n`);
      });
      target.querySelectorAll("*[fez-use]").forEach((n5) => {
        let value2 = n5.getAttribute("fez-use");
        this[value2](n5);
      });
    }
    // run only if node is attached, clear otherwise
    setInterval(func, tick, name) {
      if (typeof func == "number") {
        [tick, func] = [func, tick];
      }
      name ||= this.class.fnv1(String(func));
      clearInterval(this.__int[name]);
      this.__int[name] = setInterval(() => {
        if (this.isAttached) {
          func();
        }
      }, tick);
      return this.__int[name];
    }
    // add css class for scss styled text
    css(text, isGlobal) {
      const className = Fez.css(text);
      if (isGlobal) {
        this.root.classList.add(className);
      }
      return className;
    }
    find(selector) {
      return this.root.querySelector(selector);
    }
    val(selector, data) {
      const node = this.find(".time");
      if (["INPUT", "TEXTAREA", "SELECT"].includes(node.nodeName)) {
        node.value = data;
      } else {
        node.innerHTML = /* @__PURE__ */ new Date();
      }
    }
    formData(node) {
      return this.class.formData(node || this.root);
    }
    // get or set attribute
    attr(name, value2) {
      if (typeof value2 === "undefined") {
        return this.root.getAttribute(name);
      } else {
        this.root.setAttribute(name, value2);
        return value2;
      }
    }
    // get root node child nodes as array
    childNodes(func) {
      const list = Array.from(this.root.querySelectorAll(":scope > *"));
      if (func) {
        list.forEach(func);
      } else {
        return list;
      }
    }
    fezRegister() {
      if (this.class.css) {
        if (this.class.css.includes(":")) {
          this.class.css = Fez.css(this.class.css);
        }
        this.root.classList.add(this.class.css);
      }
      this.fezRegisterBindMethods();
    }
    // bind all instance method to this, to avoid calling with .bind(this)
    fezRegisterBindMethods() {
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(this)).filter((method) => method !== "constructor" && typeof this[method] === "function");
      methods.forEach((method) => this[method] = this[method].bind(this));
    }
  };
  setInterval(() => {
    FezBase.__objects = FezBase.__objects.filter(
      (el) => el.isAttached
    );
  }, 1e4);
  var observer = new MutationObserver((mutationsList, _) => {
    for (const mutation of mutationsList) {
      if (mutation.type === "attributes") {
        const fez = mutation.target.fez;
        const name = mutation.attributeName;
        const value2 = mutation.target.getAttribute(name);
        fez.props[name] = value2;
        fez.onPropsChange(name, value2);
      }
    }
  });
  var Fez = (name, klass) => {
    function connect() {
      const parentNode = this.parentNode;
      if (parentNode) {
        const nodeName = typeof klass.nodeName == "function" ? klass.nodeName(this) : klass.nodeName;
        const newNode2 = document.createElement(nodeName || "div");
        newNode2.classList.add("fez");
        newNode2.classList.add(`fez-${name}`);
        parentNode.replaceChild(newNode2, this);
        const object = new klass();
        object.oldRoot = this;
        object.fezName = name;
        object.root = newNode2;
        object.props = klass.getProps(this);
        object.class = klass;
        object.slot(this, newNode2);
        newNode2.fez = object;
        if (window.$) {
          object.$root = $(newNode2);
        }
        if (object.props.id) {
          newNode2.setAttribute("id", object.props.id);
        }
        object.fezRegister();
        object.connect(object.props);
        klass.__objects.push(object);
        if (object.onPropsChange) {
          observer.observe(newNode2, { attributes: true });
        }
      }
    }
    function fastBind(n5) {
      return typeof klass.fastBind === "function" ? klass.fastBind(n5) : klass.fastBind;
    }
    if (!name) {
      return FezBase;
    }
    if (typeof klass != "function") {
      return Fez.find(name, klass);
    }
    customElements.define(name, class extends HTMLElement {
      connectedCallback() {
        if (this.firstChild || fastBind(this)) {
          Fez.info(`fast bind: ${name}`);
          connect.bind(this)();
        } else {
          Fez.info(`slow bind: ${name}`);
          window.requestAnimationFrame(() => {
            connect.bind(this)();
          });
        }
      }
    });
  };
  Fez.find = (node, name) => {
    if (typeof node == "string") {
      node = document.body.querySelector(node);
    }
    if (typeof node.val == "function") {
      node = node[0];
    }
    const klass = name ? `.fez-${name}` : ".fez";
    return node.closest(klass).fez;
  };
  Fez.globalCss = (text) => {
    const cssClass = Fez.css(text);
    document.addEventListener("DOMContentLoaded", () => {
      document.body.classList.add(cssClass);
    });
    return cssClass;
  };
  Fez.css = (text) => {
    return gobber_default.css(text);
  };
  Fez.info = (text) => {
    if (window.DEBUG) {
      console.log(`Fez: ${text}`);
    }
  };
  Fez.morphdom = (target2, newNode2, opts = {}) => {
    if (opts.childrenOnly === void 0) {
      opts.childrenOnly = true;
    }
    c(target2, newNode2, opts);
  };
  Fez.htmlEscape = (text) => {
    return text.replaceAll("'", "&apos;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  };
  window.Fez = Fez;
  window.FezBase = FezBase;
})();
