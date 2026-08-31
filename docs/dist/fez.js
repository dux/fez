// v: 0.6.1
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // src/fez/defaults.js
  var defaults_exports = {};
  __export(defaults_exports, {
    loadDefaults: () => loadDefaults
  });
  var loadDefaults;
  var init_defaults = __esm({
    "src/fez/defaults.js"() {
      loadDefaults = () => {
        Fez(
          "fez-component",
          class {
            init(props) {
              const tag = document.createElement(props.name);
              tag.props = props.props || props["data-props"] || props;
              while (this.root.firstChild) {
                this.root.parentNode.insertBefore(
                  this.root.lastChild,
                  tag.nextSibling
                );
              }
              this.root.innerHTML = "";
              this.root.appendChild(tag);
            }
          }
        );
        Fez(
          "fez-include",
          class {
            init(props) {
              Fez.fetch(props.src, (data) => {
                const dom = Fez.domRoot(data);
                Fez.head(dom);
                this.root.innerHTML = dom.innerHTML;
              });
            }
          }
        );
        Fez(
          "fez-if",
          class {
            init(props) {
              const test = new Function(`return (${props.if || props.test})`);
              if (!test()) {
                this.root.remove();
              }
            }
          }
        );
        Fez(
          "fez-inline",
          class {
            // renders inline so it can sit inside running text
            NAME = "span";
            init(props) {
              const template = this.root.innerHTML.trim();
              this.root.innerHTML = "";
              this._fezSlotNodes = this._fezChildNodes = void 0;
              if (template) {
                this.fezHtmlFunc = Fez.createTemplate(template, {
                  name: "fez-inline"
                });
              }
              if (props.state) {
                Object.assign(this.state, props.state);
              }
            }
          }
        );
        Fez(
          "fez-demo-nav",
          class {
            init(props) {
              this.for = props.for || "";
              this.offset = Number(props.offset ?? 16);
              this.state.items = [];
              this.state.activeIndex = -1;
              this.state.markerTop = 0;
              this.state.markerHeight = 0;
              this.state.open = false;
              this.state.filter = "";
              this.state.visible = [];
            }
            // list rendered by the panel - keeps the original index so data-index,
            // the marker and activeIndex stay valid while filtered
            beforeRender() {
              const query = String(this.state.filter || "").trim().toLowerCase();
              this.state.visible = (this.state.items || []).map((name, index2) => ({ name, index: index2 })).filter((item) => !query || item.name.toLowerCase().includes(query));
            }
            onMount() {
              this.loadComponents();
              this.on("scroll", this.updateActive, { throttle: 50 });
              this.on("resize", this.updateMarker, { throttle: 100 });
              this.on("hashchange", this.syncToHash);
              this.on(this.root, "click", this.handleClick);
              this.on(document, "click", this.closeOnOutsideClick);
              if (this.for) {
                if (this.for === this.globalState.demoSelected) {
                  this.whenSectionsReady(() => this.reveal());
                }
              } else if (Fez.state.get("demoNavReveal")) {
                Fez.state.set("demoNavReveal", false);
                this.reveal();
              }
            }
            // marker tracks the active link, so re-measure after every render
            afterRender() {
              this.setTimeout(() => this.updateMarker(), 0);
            }
            // components keep registering while the demo list loads - wait until the
            // count is stable between two polls before trusting it
            loadComponents(lastCount = -1) {
              const names = Fez.index.withDemo().sort();
              if (!names.length || names.length !== lastCount) {
                this.setTimeout(() => this.loadComponents(names.length), 200);
                return;
              }
              this.state.items = names;
              this.setTimeout(() => this.syncToHash() || this.updateActive(), 0);
            }
            // sections render async, one fetch per component - poll until every demo
            // component has its anchor on the page (or give up after ~3s)
            whenSectionsReady(callback, tries = 0) {
              const names = Fez.index.withDemo();
              const ready = names.length && names.every((name) => document.getElementById(this.sectionId(name)));
              if (ready || tries > 30) {
                this.setTimeout(callback, 0);
              } else {
                this.setTimeout(() => this.whenSectionsReady(callback, tries + 1), 100);
              }
            }
            sectionId(name) {
              return `fez-demo-${String(name).replace(/[^a-z0-9_-]/gi, "-")}`;
            }
            toggle() {
              this.state.open = !this.state.open;
              this.state.filter = "";
              if (this.state.open) {
                this.setTimeout(() => this.updateMarker(), 0);
              }
            }
            closeOnOutsideClick(event) {
              if (this.state.open && !this.root.contains(event.target)) {
                this.state.open = false;
              }
            }
            onFilter(value) {
              this.state.filter = value;
              this.setTimeout(() => this.updateMarker(), 0);
            }
            onFilterKey(event) {
              if (event.key === "Escape") {
                event.preventDefault();
                if (this.state.filter) {
                  this.clearFilter();
                } else {
                  this.state.open = false;
                }
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                const first = this.state.visible[0];
                if (first) this.select(first.name);
              }
            }
            clearFilter() {
              this.state.filter = "";
              const input = this.find(".fez-demo-nav-filter");
              if (input) {
                input.value = "";
                input.focus();
              }
              this.setTimeout(() => this.updateMarker(), 0);
            }
            syncToHash() {
              const id = window.location.hash.slice(1);
              const name = id && this.state.items.find((item) => this.sectionId(item) === id);
              if (name) {
                if (this.globalState.demoSelected !== name) this.globalState.demoSelected = name;
                return true;
              }
              if (!id && this.globalState.demoSelected) this.globalState.demoSelected = "";
              return false;
            }
            handleClick(event) {
              const link = event.target?.closest?.(".fez-demo-nav-link");
              if (!link) return;
              event.preventDefault();
              const index2 = Number(link.dataset.index);
              if (Number.isFinite(index2) && this.state.items[index2]) {
                this.select(this.state.items[index2]);
              }
            }
            select(name) {
              this.state.open = false;
              this.state.filter = "";
              if (window.history?.replaceState) {
                window.history.replaceState(null, "", `#${this.sectionId(name)}`);
              }
              if (this.globalState.demoSelected === name) {
                this.revealSection(name);
              } else {
                this.globalState.demoSelected = name;
              }
            }
            clearSelection(event) {
              event?.preventDefault?.();
              event?.stopPropagation?.();
              this.state.open = false;
              if (window.history?.replaceState) {
                window.history.replaceState(null, "", window.location.pathname + window.location.search);
              }
              Fez.state.set("demoNavReveal", true);
              this.globalState.demoSelected = "";
            }
            scrollTo(node) {
              if (!node?.getBoundingClientRect) return;
              const top = node.getBoundingClientRect().top + window.scrollY - this.offset;
              window.scrollTo({ top: Math.max(top, 0), behavior: "auto" });
            }
            reveal() {
              this.scrollTo(this.root);
            }
            revealSection(name) {
              const picker = document.querySelector(`.fez-demo-nav-box[data-for="${name}"]`);
              this.scrollTo(picker || document.getElementById(this.sectionId(name)));
            }
            updateActive() {
              const items = this.state.items;
              if (!items.length) return;
              if (!this.globalState.demoSelected && !window.location.hash && window.scrollY < 20) {
                this.state.activeIndex = -1;
                this.updateMarker(-1);
                return;
              }
              const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 800;
              const focusLine = Math.min(viewportHeight * 0.35, 260);
              let nextIndex = this.state.activeIndex;
              items.forEach((name, index2) => {
                const section = document.getElementById(this.sectionId(name));
                if (!section?.getBoundingClientRect) return;
                if (section.getBoundingClientRect().top <= focusLine) {
                  nextIndex = index2;
                }
              });
              if (this.state.activeIndex !== nextIndex) {
                this.state.activeIndex = nextIndex;
              }
              this.updateMarker(nextIndex);
            }
            updateMarker(index2 = this.state.activeIndex) {
              if (index2 < 0) {
                if (this.state.markerTop !== 0) this.state.markerTop = 0;
                if (this.state.markerHeight !== 0) this.state.markerHeight = 0;
                return;
              }
              const list = this.find(".fez-demo-nav-list");
              if (!list?.getBoundingClientRect) return;
              const activeLink = this.find(`[data-index="${index2}"]`);
              if (!activeLink?.getBoundingClientRect) {
                if (this.state.markerHeight !== 0) this.state.markerHeight = 0;
                return;
              }
              const listRect = list.getBoundingClientRect();
              const activeRect = activeLink.getBoundingClientRect();
              const markerTop = Math.round(activeRect.top - listRect.top);
              const markerHeight = Math.round(activeRect.height);
              if (this.state.markerTop !== markerTop) {
                this.state.markerTop = markerTop;
              }
              if (this.state.markerHeight !== markerHeight) {
                this.state.markerHeight = markerHeight;
              }
            }
            CSS() {
              return `.fez-demo-nav-box {
    position: relative;
    z-index: 20;
    box-sizing: border-box;
    width: min(420px, 100%);
    margin: 0 auto;
    text-align: left;
  }

  .fez-demo-nav-control {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 46px;
    margin: 0 auto;
    border: 1px solid #dedede;
    border-radius: 999px;
    background: #fff;
    color: #20242c;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .fez-demo-nav-toggle {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: 1 1 auto;
    gap: 10px;
    min-width: 0;
    min-height: 44px;
    padding: 6px 10px 6px 7px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #20242c;
    font: inherit;
    line-height: 1;
    cursor: pointer;
  }

  .fez-demo-nav-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: #20242c;
    color: #fff;
    font-size: 15px;
    font-weight: 800;
  }

  .fez-demo-nav-current {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: #242424;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.2;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fez-demo-nav-current.placeholder {
    color: #9a9a9a;
    font-weight: 500;
  }

  .fez-demo-nav-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    margin-right: 7px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #8a8a8a;
    font: inherit;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .fez-demo-nav-clear:hover {
    background: #f0f0f0;
    color: #222;
  }

  .fez-demo-nav-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    box-sizing: border-box;
    max-height: min(60vh, 520px);
    overflow: auto;
    padding: 14px 16px 14px 14px;
    border: 1px solid #e3e3e3;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 16px 42px rgba(0, 0, 0, 0.16);
  }

  .fez-demo-nav-filter-wrap {
    position: sticky;
    top: -14px;
    z-index: 1;
    display: flex;
    align-items: center;
    margin: -14px -16px 12px -14px;
    padding: 14px 16px 10px 14px;
    background: #fff;
  }

  .fez-demo-nav-filter {
    box-sizing: border-box;
    width: 100%;
    padding: 9px 32px 9px 12px;
    border: 1px solid #dedede;
    border-radius: 8px;
    background: #fff;
    color: #20242c;
    font: inherit;
    font-size: 14px;
    line-height: 1.2;
    outline: none;
  }

  .fez-demo-nav-filter:focus {
    border-color: #20242c;
  }

  .fez-demo-nav-filter-clear {
    flex: 0 0 auto;
    margin-left: -30px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #8a8a8a;
    font: inherit;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
  }

  .fez-demo-nav-filter-clear:hover {
    background: #f0f0f0;
    color: #222;
  }

  .fez-demo-nav-empty {
    padding: 9px 0 9px 28px;
    color: #9a9a9a;
    font-size: 15px;
  }

  .fez-demo-nav-list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 0;
    padding: 0 0 0 3px;
    border-left: 4px solid #e7e7e7;
  }

  .fez-demo-nav-marker {
    position: absolute;
    left: -4px;
    top: 0;
    width: 4px;
    height: var(--marker-height, 40px);
    background: #222;
    transform: translateY(var(--marker-top, 0px));
    transition: transform 180ms ease, height 180ms ease;
  }

  .fez-demo-nav-link {
    display: block;
    padding: 9px 0 9px 28px;
    color: #8f8f8f;
    font-size: 15px;
    line-height: 1.35;
    text-decoration: none;
    overflow-wrap: anywhere;
    transition: color 160ms ease, font-weight 160ms ease;
  }

  .fez-demo-nav-link:hover,
  .fez-demo-nav-link.active {
    color: #242424;
  }

  .fez-demo-nav-link.active {
    font-weight: 650;
  }`;
            }
            HTML() {
              return `<nav class="fez-demo-nav-box {globalState.demoSelected ? 'is-selected' : ''}" data-for="{fez.for}" aria-label="Demo components">
        <div class="fez-demo-nav-control">
          <button
            class="fez-demo-nav-toggle"
            aria-label="Components"
            aria-expanded={state.open ? 'true' : 'false'}
            onclick="fez.toggle()"
          >
            <span class="fez-demo-nav-icon" aria-hidden="true">F</span>
            <span class="fez-demo-nav-current {globalState.demoSelected ? '' : 'placeholder'}">{globalState.demoSelected || 'quick select'}</span>
          </button>
          {#if globalState.demoSelected}
            <button class="fez-demo-nav-clear" aria-label="Clear selection" onclick="fez.clearSelection(event)">X</button>
          {/if}
        </div>
        {#if state.open}
          <div class="fez-demo-nav-panel" fez:transition="fly, from=top, distance=8, duration=160">
            <div class="fez-demo-nav-filter-wrap">
              <input
                class="fez-demo-nav-filter"
                type="text"
                placeholder="Filter components..."
                aria-label="Filter components"
                autocomplete="off"
                spellcheck="false"
                fez:use="el => el.focus()"
                value={state.filter}
                oninput="fez.onFilter(this.value)"
                onkeydown="fez.onFilterKey(event)"
              />
              {#if state.filter}
                <button class="fez-demo-nav-filter-clear" aria-label="Clear filter" onclick="fez.clearFilter()">X</button>
              {/if}
            </div>
            <div
              class="fez-demo-nav-list"
              style="--marker-top: {state.markerTop}px; --marker-height: {state.markerHeight}px;"
            >
              <span class="fez-demo-nav-marker" aria-hidden="true"></span>
              {#each state.visible as item}
                <a
                  class="fez-demo-nav-link {state.activeIndex === item.index ? 'active' : ''}"
                  href="#{fez.sectionId(item.name)}"
                  data-index={item.index}
                  aria-current={state.activeIndex === item.index && state.activeIndex >= 0 ? 'page' : 'false'}
                >{item.name}</a>
              {/each}
              {#if !state.visible.length}
                <div class="fez-demo-nav-empty">No components match.</div>
              {/if}
            </div>
          </div>
        {/if}
      </nav>`;
            }
          }
        );
        Fez(
          "fez-demo",
          class {
            init(props) {
              this.state.ready = false;
              this.state.components = [];
              this.state.undocumented = [];
              this.state.filtered = false;
              this.state.showAllUrl = "";
              this.state.allComponentsUrl = "";
              const urlParams = new URLSearchParams(window.location.search);
              const name = props.name || urlParams.get("fez");
              const allUrl = new URL(window.location.href);
              allUrl.searchParams.delete("fez");
              this.state.allComponentsUrl = allUrl.pathname + allUrl.search + allUrl.hash;
              if (urlParams.get("fez")) {
                this.state.showAllUrl = this.state.allComponentsUrl;
                this.state.filtered = true;
              }
              const notFez = (n2) => !n2.startsWith("fez-");
              let lastCount = 0;
              let stableTicks = 0;
              let nameTicks = 0;
              const checkReady = () => {
                if (name) {
                  if (Fez.index[name]?.demo) {
                    this.state.components = [name];
                    this.markReady();
                  } else if (Fez.index[name]?.class && ++nameTicks > 20) {
                    this.state.components = [];
                    this.markReady();
                  } else {
                    setTimeout(checkReady, 100);
                  }
                } else {
                  const all = Fez.index.names().filter(notFez);
                  if (all.length > 0 && all.length === lastCount) {
                    stableTicks++;
                  } else {
                    stableTicks = 0;
                  }
                  lastCount = all.length;
                  if (stableTicks >= 2) {
                    this.state.components = Fez.index.withDemo().filter(notFez).sort();
                    this.state.undocumented = all.filter((n2) => !Fez.index[n2]?.demo).sort();
                    this.markReady();
                  } else {
                    setTimeout(checkReady, 100);
                  }
                }
              };
              checkReady();
            }
            markReady() {
              this.state.ready = true;
              this.setTimeout(() => {
                const id = window.location.hash.slice(1);
                const target = id && document.getElementById(id);
                if (target) target.scrollIntoView({ block: "start" });
              }, 50);
            }
            showHtml(name) {
              const html = Fez.index[name]?.demo || "No demo HTML";
              Fez.log("Demo HTML: " + name + "\n\n" + html);
            }
            showFez(name) {
              Fez.log(
                "Fez source: " + name + "\n\n" + (Fez.index[name]?.source || "Made via raw Fez API, source not available")
              );
            }
            openSingle(name) {
              const url = new URL(window.location.href);
              url.searchParams.set("fez", name);
              window.location.href = url.toString();
            }
            openCodePen(name) {
              const demo = Fez.index[name]?.demo || "";
              const code = Fez.index[name]?.source || "";
              const body = [
                '<link rel="stylesheet" href="//cdn.simplecss.org/simple.css" />\n<script src="//dux.github.io/fez/dist/fez.js"><\/script>',
                `<!-- FEZ code start -->
<xmp fez="${name}">
${code}
</xmp>
<!-- FEZ code end -->`,
                `<!-- HTML code start -->
${demo}
<!-- HTML code end -->`
              ];
              const data = {
                title: "Fez component - " + name,
                html: body.join("\n\n"),
                css: "body { padding-top: 50px; }",
                js: "",
                editors: "100"
              };
              const form = document.createElement("form");
              form.method = "POST";
              form.action = "https://codepen.io/pen/define";
              form.target = "_blank";
              const input = document.createElement("input");
              input.type = "hidden";
              input.name = "data";
              input.value = JSON.stringify(data);
              form.appendChild(input);
              document.body.appendChild(form);
              form.submit();
              document.body.removeChild(form);
            }
            renderDemo(el) {
              const name = el.dataset.name;
              Fez.index.apply(name, el);
            }
            renderInfo(el) {
              const name = el.dataset.name;
              const data = Fez.index.get(name);
              if (data.info) {
                el.innerHTML = data.info.innerHTML;
              } else {
                el.innerHTML = "<em>No info available</em>";
              }
            }
            CSS() {
              return `:fez {
        display: block;
        font-family: system-ui, -apple-system, sans-serif;
        color: #1f2937;
        padding: 0 22px 40px;
        box-sizing: border-box;
      }
      .fez-demo-header {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 24px 0 18px;
        margin: 0 auto;
        max-width: 980px;
      }
      .fez-demo-header.is-single {
        max-width: 1560px;
      }
      .fez-demo-brand {
        display: flex;
        align-items: baseline;
        gap: 12px;
        min-width: 0;
        text-decoration: none;
        color: inherit;
      }
      .fez-demo-logo {
        font-size: 22px;
        font-weight: 750;
        line-height: 1;
      }
      .fez-demo-subtitle {
        color: #6b7280;
        font-size: 14px;
        line-height: 1.3;
        white-space: nowrap;
      }
      .fez-demo-shell {
        display: block;
        max-width: 980px;
        margin: 0 auto;
      }
      /* single component view has the whole page to itself, let it breathe */
      .fez-demo-shell.is-single {
        max-width: 1560px;
      }
      .fez-demo-shell.is-single .fez-demo-item {
        margin-bottom: 0;
      }
      .fez-demo-main {
        min-width: 0;
      }
      @media (max-width: 640px) {
        .fez-demo-header {
          padding-top: 16px;
        }
        .fez-demo-brand {
          flex-direction: column;
          gap: 4px;
        }
      }
      @media (max-width: 980px) {
        .fez-demo-shell {
          display: block;
        }
      }
      .fez-demo-item {
        margin-bottom: 40px;
        scroll-margin-top: 72px;
      }
      .fez-demo-anchor {
        display: block;
        height: 0;
        scroll-margin-top: 72px;
      }
      .fez-demo-title {
        display: flex;
        align-items: center;
        gap: 15px;
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 25px 0;
        &::before {
          content: '';
          flex: 1;
          height: 1px;
          background: #ddd;
        }
        &::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #ddd;
        }
        .fez-demo-show-all, .fez-demo-open-single {
          font-size: 14px;
          font-weight: normal;
          color: #666;
          text-decoration: none;
          cursor: pointer;
          &:hover { text-decoration: underline; }
        }
      }
      .fez-demo-cols {
        display: flex;
        gap: 40px;
        @media (max-width: 768px) {
          flex-direction: column;
          gap: 20px;
        }
      }
      .fez-demo-left, .fez-demo-right {
        flex: 1;
        min-width: 0;
        overflow: visible;
      }
      .fez-demo-content {
        min-height: 50px;
        text-align: left;
        h3, h4, h5 { margin: 16px 0 8px; }
        h3:first-child, h4:first-child, h5:first-child { margin-top: 0; }
      }
      .fez-demo-info {
        text-align: left;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 20px;
        line-height: 1.6;
        ul { margin: 0; padding-left: 20px; }
        code { background: #e8e8e8; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
      }
      .fez-demo-buttons {
        margin-top: 30px;
        display: flex;
        gap: 10px;
      }
      .fez-demo-undocumented {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        h3 { font-size: 16px; font-weight: 600; color: #6b7280; margin: 0 0 12px; }
        .fez-demo-undocumented-list { display: flex; flex-wrap: wrap; gap: 8px; }
      }
      .fez-demo-btn {
        padding: 8px 16px;
        border: 1px solid #ccc;
        background: #fff;
        color: #333;
        font: inherit;
        line-height: 1.2;
        border-radius: 4px;
        cursor: pointer;
        box-shadow: none;
        &:hover { background: #f0f0f0; color: #333; }
      }`;
            }
            HTML() {
              return `{#if state.ready}
        <header class="fez-demo-header {state.filtered ? 'is-single' : ''}">
          <a class="fez-demo-brand" href="{state.allComponentsUrl}">
            <span class="fez-demo-logo">Fez</span>
            <span class="fez-demo-subtitle">Component demos</span>
          </a>
        </header>
        <div class="fez-demo-shell {state.filtered ? 'is-single' : ''}">
          <main class="fez-demo-main">
            {#each state.components as name}
              <div class="fez-demo-item" data-demo-name={name}>
                <a class="fez-demo-anchor" id="fez-demo-{name}" name="fez-demo-{name}" aria-hidden="true"></a>
                <h2 class="fez-demo-title">{name}{#if state.filtered} <a href="{state.showAllUrl}" class="fez-demo-show-all">show all</a>{:else} <a onclick="fez.openSingle('{name}')" class="fez-demo-open-single">open</a>{/if}</h2>
                <div class="fez-demo-cols">
                  <div class="fez-demo-left">
                    <div class="fez-demo-content" data-name={name} fez-use="renderDemo"></div>
                  </div>
                  <div class="fez-demo-right">
                    <div class="fez-demo-info" data-name={name} fez-use="renderInfo"></div>
                    <div class="fez-demo-buttons">
                      <button class="fez-demo-btn" onclick="fez.showHtml('{name}')">Demo HTML</button>
                      <button class="fez-demo-btn" onclick="fez.showFez('{name}')">Fez Component</button>
                      <button class="fez-demo-btn" onclick="fez.openCodePen('{name}')">CodePen</button>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
            {#if state.undocumented.length}
              <div class="fez-demo-undocumented">
                <h3>Undocumented</h3>
                <div class="fez-demo-undocumented-list">
                  {#each state.undocumented as name}
                    <button class="fez-demo-btn" onclick="fez.showFez('{name}')">{name}</button>
                  {/each}
                </div>
              </div>
            {/if}
          </main>
        </div>
      {:else}
        <div style="text-align: center; color: #888;">Loading components...</div>
      {/if}`;
            }
          }
        );
      };
      if (typeof Fez !== "undefined" && Fez && typeof document !== "undefined" && document.head) {
        loadDefaults();
      }
    }
  });

  // src/fez/lib/n.js
  function n(name, attrs = {}, data) {
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
      const c = parts.join(" ");
      if (attrs.class) {
        attrs.class += ` ${c}`;
      } else {
        attrs.class = c;
      }
    }
    const node = document.createElement(name);
    const booleanAttrs = [
      "checked",
      "disabled",
      "selected",
      "readonly",
      "required",
      "hidden",
      "multiple",
      "autofocus"
    ];
    for (const [k, v] of Object.entries(attrs)) {
      if (typeof v === "function") {
        node[k] = v.bind(this);
      } else if (booleanAttrs.includes(k)) {
        if (v) {
          node.setAttribute(k, k);
        }
      } else {
        const value = String(v).replaceAll("fez.", this.fezHtmlRoot);
        node.setAttribute(k, value);
      }
    }
    if (data) {
      if (Array.isArray(data)) {
        for (const n2 of data) {
          node.appendChild(n2);
        }
      } else if (data instanceof Node) {
        node.appendChild(data);
      } else {
        node.innerHTML = String(data);
      }
    }
    return node;
  }

  // src/fez/lib/template-compiler-lib.js
  var JS_GLOBALS = /* @__PURE__ */ new Set([
    "console",
    "window",
    "document",
    "Math",
    "JSON",
    "Date",
    "Array",
    "Object",
    "String",
    "Number",
    "Boolean",
    "parseInt",
    "parseFloat",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "alert",
    "confirm",
    "prompt",
    "fetch",
    "event"
  ]);
  function prefixBareCalls(body) {
    return body.replace(
      /(?<![.\w])([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
      (match, funcName) => JS_GLOBALS.has(funcName) ? match : `fez.${funcName}(`
    );
  }
  function parseLoopBinding(binding) {
    const isDestructured = binding.startsWith("[");
    if (isDestructured) {
      const match = binding.match(/^\[([^\]]+)\](?:\s*,\s*(\w+))?$/);
      if (match) {
        return {
          params: match[1].split(",").map((s) => s.trim()),
          indexParam: match[2] || null,
          isDestructured: true
        };
      }
    }
    const parts = binding.split(",").map((s) => s.trim());
    if (parts.length === 2) {
      return { params: parts, indexParam: null, isDestructured: true };
    }
    return { params: parts, indexParam: null, isDestructured: false };
  }
  function getLoopVarNames(binding) {
    const parsed = parseLoopBinding(binding);
    const names = [...parsed.params];
    if (parsed.indexParam) names.push(parsed.indexParam);
    if (parsed.params.length === 1 && !names.includes("i")) names.push("i");
    return names;
  }
  function getLoopItemVars(binding) {
    const parsed = parseLoopBinding(binding);
    if (parsed.isDestructured && parsed.params.length === 2) {
      return [parsed.params[0]];
    }
    if (parsed.isDestructured) {
      return parsed.params;
    }
    if (parsed.params.length >= 3) {
      return parsed.params.slice(0, -1);
    }
    if (parsed.params.length === 2) {
      return [parsed.params[0]];
    }
    return parsed.params;
  }
  function buildCollectionExpr(collection, binding) {
    const parsed = parseLoopBinding(binding);
    if (parsed.isDestructured && parsed.params.length === 2) {
      return `Fez.toPairs(${collection})`;
    }
    if (parsed.isDestructured || parsed.params.length >= 3) {
      return `((_c)=>Array.isArray(_c)?_c:(_c&&typeof _c==="object")?Object.entries(_c):[])(${collection})`;
    }
    return `(${collection}||[])`;
  }
  function buildLoopParams(binding) {
    const parsed = parseLoopBinding(binding);
    if (parsed.isDestructured) {
      const destructure = "[" + parsed.params.join(", ") + "]";
      const indexName2 = parsed.indexParam || (parsed.params.includes("i") ? "_i" : "i");
      return destructure + ", " + indexName2;
    }
    if (parsed.params.length >= 3) {
      const params = [...parsed.params];
      const index2 = params.pop();
      return "[" + params.join(", ") + "], " + index2;
    }
    if (parsed.params.length === 2) {
      return parsed.params.join(", ");
    }
    const indexName = parsed.params[0] === "i" ? "_i" : "i";
    return parsed.params[0] + ", " + indexName;
  }
  function isArrowFunction(expr) {
    return /^\s*(\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/.test(expr);
  }
  function transformArrowToHandler(expr, loopVars = [], loopItemVars = []) {
    const arrowMatch = expr.match(
      /^\s*(?:\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>\s*(.+)$/s
    );
    if (!arrowMatch) return expr;
    let body = arrowMatch[1].trim();
    const paramMatch = expr.match(
      /^\s*\(?\s*([a-zA-Z_$][a-zA-Z0-9_$]*)?\s*(?:,\s*[^)]+)?\)?\s*=>/
    );
    const eventParam = paramMatch?.[1];
    const hasEventParam = eventParam && ["e", "event", "ev"].includes(eventParam);
    const usedItemVars = loopItemVars.filter((varName) => {
      const varRegex = new RegExp(`\\b${varName}\\b`);
      return varRegex.test(body);
    });
    if (usedItemVars.length > 0) {
      if (hasEventParam && eventParam !== "event") {
        const eventRegex = new RegExp(`\\b${eventParam}\\b`, "g");
        body = body.replace(eventRegex, "event");
      }
      body = prefixBareCalls(body);
      return `\${'Fez(' + UID + ').fezGlobals.handler(' + fez.fezGlobals.setHandler((event) => ${body}) + ')(event)'}`;
    }
    if (hasEventParam && eventParam !== "event") {
      const eventRegex = new RegExp(`\\b${eventParam}\\b`, "g");
      body = body.replace(eventRegex, "event");
    }
    for (const varName of loopVars) {
      const varRegex = new RegExp(`(?<!\\$\\{)\\b${varName}\\b(?![^{]*\\})`, "g");
      body = body.replace(varRegex, `\${${varName}}`);
    }
    body = prefixBareCalls(body);
    return body;
  }
  function extractBracedExpression(text, startIndex) {
    let depth = 0;
    let i = startIndex;
    while (i < text.length) {
      const char = text[i];
      if (char === "{") {
        depth++;
      } else if (char === "}") {
        depth--;
        if (depth === 0) {
          return { expression: text.slice(startIndex + 1, i), endIndex: i };
        }
      } else if (char === '"' || char === "'" || char === "`") {
        const quote = char;
        i++;
        while (i < text.length && text[i] !== quote) {
          if (text[i] === "\\") i++;
          i++;
        }
      }
      i++;
    }
    throw new Error(`Unmatched brace at ${startIndex}`);
  }
  function getAttributeContext(text, pos) {
    let j = pos - 1;
    while (j >= 0 && (text[j] === "{" || text[j] === " " || text[j] === "	"))
      j--;
    if (j >= 0 && text[j] === "=") {
      j--;
      while (j >= 0 && (text[j] === " " || text[j] === "	")) j--;
      let attrEnd = j + 1;
      while (j >= 0 && /[a-zA-Z0-9_:-]/.test(text[j])) j--;
      const attrName = text.slice(j + 1, attrEnd);
      if (attrName && /^[a-zA-Z]/.test(attrName) && (j < 0 || /\s/.test(text[j])) && !insideQuotedAttrValue(text, j)) {
        return attrName.toLowerCase();
      }
    }
    return null;
  }
  function insideQuotedAttrValue(text, pos) {
    const tagStart = text.lastIndexOf("<", pos);
    if (tagStart < 0) return false;
    let quote = null;
    for (let k = tagStart; k <= pos; k++) {
      const ch = text[k];
      if (quote) {
        if (ch === quote) quote = null;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === ">") {
        return false;
      }
    }
    return quote !== null;
  }
  function getEventAttributeContext(text, pos) {
    const attr = getAttributeContext(text, pos);
    if (attr && /^on[a-z]+$/.test(attr)) {
      return attr;
    }
    return null;
  }

  // src/fez/lib/template-compiler.js
  function createTemplateCompiler(text, opts = {}) {
    const componentName = opts.name || "unknown";
    const staticMode = opts.static === true;
    try {
      if (!staticMode) {
        text = text.replaceAll("&#x60;", "`").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&amp;", "&");
        text = text.replace(/\bfez:([a-z][a-z0-9-]*)=/gi, "fez-$1=");
        text = text.replace(
          /\bon([a-z]+)!=(["'])([\s\S]*?)\2/gi,
          (_, ev, q, body) => `on${ev}=${q}fez.fezBang(event) && (${body})${q}`
        );
      }
      text = text.replace(/<[a-z][a-z0-9-]*\b[^>]*>/gi, (tag) => {
        if (!/\bclass:[\w-]+=/.test(tag)) return tag;
        const directives = [];
        tag = tag.replace(
          /\s*\bclass:([\w-]+)=\{([^}]*)\}/g,
          (_, name, expr) => {
            directives.push({ name, expr });
            return "";
          }
        );
        tag = tag.replace(
          /\s*\bclass:([\w-]+)="([^"]*)"/g,
          (_, name, expr) => {
            directives.push({ name, expr });
            return "";
          }
        );
        if (!directives.length) return tag;
        const ternaries = directives.map((d) => ` {(${d.expr}) ? '${d.name}' : ''}`).join("");
        if (/\bclass="/.test(tag)) {
          tag = tag.replace(
            /class="([^"]*)"/,
            (_, val) => `class="${val}${ternaries}"`
          );
        } else {
          tag = tag.replace(/(\s*\/?>)$/, ` class="${ternaries.trim()}"$1`);
        }
        return tag;
      });
      const keepOnComponent = text.match(
        /<([a-z]+-[a-z][a-z0-9-]*)\b[^>]*\bfez-keep=/
      );
      if (keepOnComponent) {
        console.error(
          `FEZ: fez:keep must be on plain HTML elements, not on fez components. Found on <${keepOnComponent[1]}> in <${componentName}>`
        );
      }
      const blocks = {};
      text = text.replace(
        /\{@block\s+(\w+)\}([\s\S]*?)\{\/block\}/g,
        (_, name, content) => {
          blocks[name] = content;
          return "";
        }
      );
      text = text.replace(/\{@block:(\w+)\}/g, (_, name) => blocks[name] || "");
      if (!staticMode) {
        text = text.replace(/:(\w+)="([^"{}]+)"/g, (match, attr, expr) => {
          if (/^\d+$/.test(expr.trim())) return match;
          return `:${attr}={\`Fez(\${UID}).fezGlobals.value(\${fez.fezGlobals.set(${expr})})\`}`;
        });
        text = text.replace(/<!--[\s\S]*?-->/g, "");
        text = text.replace(/>\s+</g, "><").trim();
      }
      text = text.replace(
        /<([a-z][a-z0-9]*-[a-z0-9-]*)((?:=>|[^>])*)>/gi,
        (match, tag, attrs) => {
          if (attrs.trimEnd().endsWith("/")) {
            return `<${tag}${attrs.replace(/\s*\/$/, "")}></${tag}>`;
          }
          return match;
        }
      );
      text = text.replace(/<slot\s*\/>/gi, "<slot></slot>");
      if (!staticMode) {
        text = autoInjectKeys(text);
      }
      let result = "";
      let i = 0;
      const ifStack = [];
      const loopVarStack = [];
      const loopItemVarStack = [];
      const loopStack = [];
      const blockStack = [];
      const awaitStack = [];
      let awaitCounter = 0;
      while (i < text.length) {
        if (text[i] === "`") {
          result += "\\`";
          i++;
          while (i < text.length && text[i] !== "`") {
            if (text[i] === "\\") {
              result += "\\\\";
              i++;
              if (i < text.length) {
                if (text[i] === "`") {
                  result += "\\`";
                } else if (text[i] === "$") {
                  result += "\\$";
                } else {
                  result += text[i];
                }
                i++;
              }
            } else if (text[i] === "$" && text[i + 1] === "{") {
              result += "\\${";
              i += 2;
              let depth = 1;
              while (i < text.length && depth > 0) {
                if (text[i] === "{") depth++;
                else if (text[i] === "}") depth--;
                if (depth > 0 || text[i] !== "}") {
                  if (text[i] === "`") result += "\\`";
                  else if (text[i] === "\\") result += "\\\\";
                  else result += text[i];
                } else {
                  result += "}";
                }
                i++;
              }
            } else {
              if (text[i] === "$") {
                result += "\\$";
              } else {
                result += text[i];
              }
              i++;
            }
          }
          if (i < text.length) {
            result += "\\`";
            i++;
          }
          continue;
        }
        if (text[i] === "\\" && text[i + 1] === "{") {
          result += "{";
          i += 2;
          continue;
        }
        if (text[i] === "{") {
          const { expression, endIndex } = extractBracedExpression(text, i);
          const expr = expression.trim();
          if (/^(\w+|"\w+"|'\w+')\s*:/.test(expr)) {
            result += "{" + expression + "}";
            i = endIndex + 1;
            continue;
          }
          if (expr.startsWith("#if ")) {
            const cond = expr.slice(4);
            result += "${Fez.isTruthy(" + cond + ") ? `";
            ifStack.push(false);
            blockStack.push("if");
          } else if (expr.startsWith("#unless ")) {
            const cond = expr.slice(8);
            result += "${!Fez.isTruthy(" + cond + ") ? `";
            ifStack.push(false);
            blockStack.push("if");
          } else if (expr === ":else" || expr === "else") {
            const currentBlock = blockStack[blockStack.length - 1];
            if (currentBlock === "loop") {
              const loopInfo = loopStack[loopStack.length - 1];
              loopInfo.hasElse = true;
              result += '`).join("") : `';
            } else if (currentBlock === "if") {
              result += "` : `";
              ifStack[ifStack.length - 1] = true;
            } else {
              throw new Error("{:else} without matching {#if}, {#unless}, {#each}, or {#for}");
            }
          } else if (expr.startsWith(":else if ") || expr.startsWith("else if ") || expr.startsWith("elsif ") || expr.startsWith("elseif ")) {
            const cond = expr.startsWith(":else if ") ? expr.slice(9) : expr.startsWith("else if ") ? expr.slice(8) : expr.startsWith("elseif ") ? expr.slice(7) : expr.slice(6);
            result += "` : Fez.isTruthy(" + cond + ") ? `";
          } else if (expr === "/if" || expr === "/unless") {
            const hasElse = ifStack.pop();
            blockStack.pop();
            result += hasElse ? "`}" : "` : ``}";
          } else if (expr.startsWith("#each ") || expr.startsWith("#for ")) {
            const isEach = expr.startsWith("#each ");
            let collection, binding;
            if (isEach) {
              const rest = expr.slice(6);
              const asIdx = rest.indexOf(" as ");
              collection = rest.slice(0, asIdx).trim();
              binding = rest.slice(asIdx + 4).trim();
            } else {
              const rest = expr.slice(5);
              const inIdx = rest.indexOf(" in ");
              binding = rest.slice(0, inIdx).trim();
              collection = rest.slice(inIdx + 4).trim();
            }
            const collectionExpr = buildCollectionExpr(collection, binding);
            const loopParams = buildLoopParams(binding);
            loopVarStack.push(getLoopVarNames(binding));
            loopItemVarStack.push(getLoopItemVars(binding));
            loopStack.push({ collectionExpr, hasElse: false });
            blockStack.push("loop");
            result += "${((_arr) => _arr.length ? _arr.map((" + loopParams + ") => `";
          } else if (expr === "/each" || expr === "/for") {
            loopVarStack.pop();
            loopItemVarStack.pop();
            const loopInfo = loopStack.pop();
            blockStack.pop();
            if (loopInfo.hasElse) {
              result += "`)(" + loopInfo.collectionExpr + ")}";
            } else {
              result += '`).join("") : "")(' + loopInfo.collectionExpr + ")}";
            }
          } else if (expr.startsWith("#await ")) {
            const promiseExpr = expr.slice(7).trim();
            const awaitId = awaitCounter++;
            awaitStack.push({
              awaitId,
              promiseExpr,
              hasThen: false,
              hasCatch: false,
              thenVar: "_value",
              catchVar: "_error"
            });
            result += '${((_aw) => _aw.status === "pending" ? `';
          } else if (expr.startsWith(":then")) {
            const awaitInfo = awaitStack[awaitStack.length - 1];
            if (awaitInfo) {
              awaitInfo.hasThen = true;
              awaitInfo.thenVar = expr.slice(5).trim() || "_value";
              result += '` : _aw.status === "resolved" ? ((' + awaitInfo.thenVar + ") => `";
            }
          } else if (expr.startsWith(":catch")) {
            const awaitInfo = awaitStack[awaitStack.length - 1];
            if (awaitInfo) {
              awaitInfo.hasCatch = true;
              awaitInfo.catchVar = expr.slice(6).trim() || "_error";
              if (awaitInfo.hasThen) {
                result += '`)(_aw.value) : _aw.status === "rejected" ? ((' + awaitInfo.catchVar + ") => `";
              } else {
                result += '` : _aw.status === "rejected" ? ((' + awaitInfo.catchVar + ") => `";
              }
            }
          } else if (expr === "/await") {
            const awaitInfo = awaitStack.pop();
            if (awaitInfo) {
              if (awaitInfo.hasThen && awaitInfo.hasCatch) {
                result += "`)(_aw.error) : ``)(Fez.fezAwait(fez, " + awaitInfo.awaitId + ", " + awaitInfo.promiseExpr + "))}";
              } else if (awaitInfo.hasThen) {
                result += "`)(_aw.value) : ``)(Fez.fezAwait(fez, " + awaitInfo.awaitId + ", " + awaitInfo.promiseExpr + "))}";
              } else if (awaitInfo.hasCatch) {
                result += "`)(_aw.error) : ``)(Fez.fezAwait(fez, " + awaitInfo.awaitId + ", " + awaitInfo.promiseExpr + "))}";
              } else {
                result += "` : ``)(Fez.fezAwait(fez, " + awaitInfo.awaitId + ", " + awaitInfo.promiseExpr + "))}";
              }
            }
          } else if (expr.startsWith("@html ")) {
            const content = expr.slice(6);
            result += "${" + content + "}";
          } else if (expr.startsWith("@json ")) {
            const content = expr.slice(6);
            result += '${`<pre class="json">${Fez.htmlEscape(JSON.stringify(' + content + ", null, 2))}</pre>`}";
          } else if (isArrowFunction(expr)) {
            const eventAttr = getEventAttributeContext(text, i);
            if (eventAttr) {
              const allLoopVars = loopVarStack.flat();
              const allItemVars = loopItemVarStack.flat();
              let handler = transformArrowToHandler(
                expr,
                allLoopVars,
                allItemVars
              );
              handler = handler.replace(/"/g, "&quot;");
              result += '"' + handler + '"';
            } else {
              result += "${" + expr + "}";
            }
          } else {
            const attrContext = getAttributeContext(text, i);
            if (attrContext) {
              result += '"${Fez.htmlEscape(' + expr + ')}"';
            } else {
              result += "${Fez.htmlEscape(" + expr + ")}";
            }
          }
          i = endIndex + 1;
          continue;
        }
        if (text[i] === "$" && text[i + 1] === "{") {
          result += "\\$";
        } else if (text[i] === "\\") {
          result += "\\\\";
        } else {
          result += text[i];
        }
        i++;
      }
      if (!staticMode) {
        result = result.replace(
          /(<[a-z][a-z0-9-]*\s+)([^>]*?)(fez-this="([^"{}]+)")([^>]*?)>/gi,
          (match, tagStart, before, fezThisAttr, fezThisValue, after) => {
            if (/\bid=/.test(before) || /\bid=/.test(after)) {
              return match;
            }
            const sanitized = fezThisValue.replace(/[^a-zA-Z0-9]/g, "-");
            return `${tagStart}${before}${fezThisAttr}${after} id="fez-\${UID}-${sanitized}">`;
          }
        );
      }
      if (typeof Fez !== "undefined" && Fez.LOG) {
        const dynamicFezThis = result.match(/fez-this="[^"]*\{[^}]+\}[^"]*"/g);
        if (dynamicFezThis) {
          console.warn(
            `Fez <${componentName}>: Dynamic fez-this values won't get auto-ID for DOM differ matching:`,
            dynamicFezThis
          );
        }
      }
      const funcBody = `
      const fez = this;
      with (this) {
        return \`${result}\`
      }
    `;
      const tplFunc = new Function(funcBody);
      return (ctx) => {
        try {
          return tplFunc.bind(ctx)();
        } catch (e) {
          if (opts.strict) {
            throw new Error(
              `FEZ template runtime error in <${ctx.fezName || componentName}>: ${e.message}`,
              { cause: e }
            );
          }
          console.error(
            `FEZ template runtime error in <${ctx.fezName || componentName}>:`,
            e.message
          );
          console.error("Template source:", result.substring(0, 500));
          return "";
        }
      };
    } catch (e) {
      if (opts.strict) {
        throw new Error(
          `FEZ template compile error in <${componentName}>: ${e.message}`,
          {
            cause: e
          }
        );
      }
      console.error(
        `FEZ template compile error in <${componentName}>:`,
        e.message
      );
      console.error("Template:", text.substring(0, 200));
      return () => "";
    }
  }
  function getLoopIndexVar(directive) {
    if (directive.startsWith("#each ")) {
      const rest = directive.slice(6);
      const asIdx = rest.indexOf(" as ");
      if (asIdx < 0) return "i";
      const binding = rest.slice(asIdx + 4).trim();
      const parts = binding.split(",").map((s) => s.trim());
      return parts.length >= 2 ? parts[parts.length - 1] : "i";
    }
    if (directive.startsWith("#for ")) {
      const rest = directive.slice(5);
      const inIdx = rest.indexOf(" in ");
      if (inIdx < 0) return "i";
      const binding = rest.slice(0, inIdx).trim();
      const parts = binding.split(",").map((s) => s.trim());
      if (parts.length >= 3) return parts[parts.length - 1];
      return "i";
    }
    return "i";
  }
  function getLoopItemKeyVar(directive) {
    let binding = "";
    if (directive.startsWith("#each ")) {
      const rest = directive.slice(6);
      const asIdx = rest.indexOf(" as ");
      if (asIdx < 0) return "";
      binding = rest.slice(asIdx + 4).trim();
    } else if (directive.startsWith("#for ")) {
      const rest = directive.slice(5);
      const inIdx = rest.indexOf(" in ");
      if (inIdx < 0) return "";
      binding = rest.slice(0, inIdx).trim();
    }
    const first = binding.replace(/^\[/, "").replace(/\]$/, "").split(",")[0].trim();
    return /^[A-Za-z_$][\w$]*$/.test(first) ? first : "";
  }
  function autoInjectKeys(text) {
    let result = "";
    let pos = 0;
    let keyCounter = 0;
    const scopeStack = [];
    while (pos < text.length) {
      if (text[pos] === "{" && pos + 1 < text.length && /[#/:]/.test(text[pos + 1])) {
        let j = pos + 1;
        let depth = 1;
        while (j < text.length) {
          if (text[j] === "{") depth++;
          else if (text[j] === "}") {
            depth--;
            if (depth === 0) break;
          }
          j++;
        }
        const directive = text.slice(pos + 1, j).trim();
        if (directive.startsWith("#if ") || directive.startsWith("#unless ")) {
          scopeStack.push({ type: "if" });
        } else if (directive.startsWith("#each ") || directive.startsWith("#for ")) {
          scopeStack.push({
            type: "loop",
            indexVar: getLoopIndexVar(directive),
            itemKeyVar: getLoopItemKeyVar(directive),
            inElse: false
          });
        } else if (directive === "/if" || directive === "/unless") {
          if (scopeStack.length) scopeStack.pop();
        } else if (directive === "/each" || directive === "/for") {
          if (scopeStack.length) scopeStack.pop();
        } else if (directive === ":else" || directive === "else" || directive.startsWith(":else if ") || directive.startsWith("else if ")) {
          const top = scopeStack[scopeStack.length - 1];
          if (top && top.type === "loop") {
            top.inElse = true;
          }
        }
        result += text.slice(pos, j + 1);
        pos = j + 1;
        continue;
      }
      if (text[pos] === "<" && pos + 1 < text.length && /[a-zA-Z]/.test(text[pos + 1])) {
        let j = pos + 1;
        while (j < text.length) {
          if (text[j] === '"' || text[j] === "'") {
            const q = text[j++];
            while (j < text.length && text[j] !== q) j++;
          } else if (text[j] === "{") {
            let d = 1;
            j++;
            while (j < text.length && d > 0) {
              if (text[j] === "{") d++;
              else if (text[j] === "}") d--;
              j++;
            }
            continue;
          } else if (text[j] === ">") {
            break;
          }
          j++;
        }
        const tag = text.slice(pos, j + 1);
        if (text[pos + 1] === "/") {
          result += tag;
          pos = j + 1;
          continue;
        }
        if (/\bkey\s*=/.test(tag)) {
          result += tag;
          pos = j + 1;
          continue;
        }
        const n2 = keyCounter++;
        const activeLoops = scopeStack.filter(
          (s) => s.type === "loop" && !s.inElse
        );
        let keyValue;
        if (activeLoops.length > 0) {
          const indexCounts = activeLoops.reduce((counts, loop) => {
            counts[loop.indexVar] = (counts[loop.indexVar] || 0) + 1;
            return counts;
          }, {});
          const suffix = activeLoops.map((loop) => {
            const keyVar = indexCounts[loop.indexVar] > 1 && loop.itemKeyVar ? loop.itemKeyVar : loop.indexVar;
            return `-{${keyVar}}`;
          }).join("");
          keyValue = `${n2}${suffix}`;
        } else {
          keyValue = `${n2}`;
        }
        if (tag.trimEnd().endsWith("/>")) {
          const slashPos = tag.lastIndexOf("/");
          result += tag.slice(0, slashPos) + ` fez-key="${keyValue}"/>`;
        } else {
          result += tag.slice(0, -1) + ` fez-key="${keyValue}">`;
        }
        pos = j + 1;
        continue;
      }
      result += text[pos];
      pos++;
    }
    return result;
  }

  // src/fez/lib/template.js
  var cache = /* @__PURE__ */ new Map();
  function createTemplate(text, opts = {}) {
    if (cache.has(text)) {
      return cache.get(text);
    }
    const cacheKey = normalizeTemplateText(text, opts);
    if (cache.has(cacheKey)) {
      const fn2 = cache.get(cacheKey);
      cache.set(text, fn2);
      return fn2;
    }
    const fn = createTemplateCompiler(cacheKey, opts);
    cache.set(cacheKey, fn);
    if (cacheKey !== text) {
      cache.set(text, fn);
    }
    return fn;
  }
  function normalizeTemplateText(text, opts = {}) {
    if (hasLegacySyntax(text)) {
      return convertLegacySyntax(text, opts.name);
    }
    return text;
  }
  function hasLegacySyntax(text) {
    return text.includes("{{") && text.includes("}}") || text.includes("[[") && text.includes("]]");
  }
  function convertLegacySyntax(text, componentName) {
    text = text.replaceAll("[[", "{{").replaceAll("]]", "}}");
    text = text.replace(/\{\{block\s+(\w+)\s*\}\}/g, "{@block $1}");
    text = text.replace(/\{\{\/block\}\}/g, "{/block}");
    text = text.replace(/\{\{block:([\w\-]+)\s*\}\}/g, "{@block:$1}");
    text = text.replace(/\{\{#?if\s+(.*?)\}\}/g, "{#if $1}");
    text = text.replace(/\{\{\/if\}\}/g, "{/if}");
    text = text.replace(/\{\{#?unless\s+(.*?)\}\}/g, "{#unless $1}");
    text = text.replace(/\{\{\/unless\}\}/g, "{/unless}");
    text = text.replace(/\{\{:?else\s+if\s+(.*?)\}\}/g, "{:else if $1}");
    text = text.replace(/\{\{:?elsif\s+(.*?)\}\}/g, "{:else if $1}");
    text = text.replace(/\{\{:?elseif\s+(.*?)\}\}/g, "{:else if $1}");
    text = text.replace(/\{\{:?else\}\}/g, "{:else}");
    text = text.replace(/\{\{#?for\s+(.*?)\}\}/g, "{#for $1}");
    text = text.replace(/\{\{\/for\}\}/g, "{/for}");
    text = text.replace(/\{\{#?each\s+(.*?)\}\}/g, "{#each $1}");
    text = text.replace(/\{\{\/each\}\}/g, "{/each}");
    text = text.replace(/\{\{#?(?:raw|html)\s+(.*?)\}\}/g, "{@html $1}");
    text = text.replace(/\{\{json\s+(.*?)\}\}/g, "{@json $1}");
    text = text.replace(/\{\{\s*(.*?)\s*\}\}/g, "{$1}");
    if (componentName) {
      console.warn(
        `Fez component "${componentName}" uses old {{ ... }} notation, converting.`
      );
    }
    return text;
  }

  // src/fez/lib/render-slots.js
  var RenderSlots = class {
    constructor() {
      this.values = /* @__PURE__ */ new Map();
      this.handlers = /* @__PURE__ */ new Map();
      this.renderValues = [];
      this.prevValues = [];
      this.handlerCount = 0;
      this.liveHandlers = null;
    }
    beginRender() {
      this.prevValues = this.renderValues;
      this.renderValues = [];
      this.values.clear();
      this.handlerCount = 0;
      this.liveHandlers = /* @__PURE__ */ new Set();
    }
    commitRender() {
      if (!this.liveHandlers) return;
      for (const key of this.handlers.keys()) {
        if (!this.liveHandlers.has(key)) this.handlers.delete(key);
      }
      this.liveHandlers = null;
    }
    // True when any value slot holds a different reference than it did in the
    // previous render (or the count changed).
    get valuesChanged() {
      const prev = this.prevValues;
      const next = this.renderValues;
      if (prev.length !== next.length) return true;
      for (let i = 0; i < next.length; i++) {
        if (prev[i] !== next[i]) return true;
      }
      return false;
    }
    // --- values ---------------------------------------------------------------
    set(value) {
      const key = this.renderValues.length;
      this.renderValues.push(value);
      this.values.set(key, value);
      return key;
    }
    value(key) {
      return this.values.get(key);
    }
    // --- handlers -------------------------------------------------------------
    setHandler(fn) {
      const key = this.handlerCount++;
      this.handlers.set(key, fn);
      this.liveHandlers?.add(key);
      return key;
    }
    handler(key) {
      return this.handlers.get(key);
    }
    // --- lifecycle ------------------------------------------------------------
    clear() {
      this.values.clear();
      this.handlers.clear();
      this.renderValues = [];
      this.prevValues = [];
      this.liveHandlers = null;
    }
  };

  // src/fez/lib/pubsub.js
  var globalSubs = /* @__PURE__ */ new Map();
  var componentSubs = {};
  function subscribe(nodeOrSelector, channelOrCallback, callback) {
    let selector = null;
    let node = null;
    let channel;
    if (typeof channelOrCallback === "function") {
      channel = nodeOrSelector;
      callback = channelOrCallback;
    } else {
      channel = channelOrCallback;
      if (typeof nodeOrSelector === "string") {
        selector = nodeOrSelector;
      } else {
        node = nodeOrSelector;
      }
    }
    if (!globalSubs.has(channel)) {
      globalSubs.set(channel, /* @__PURE__ */ new Set());
    }
    const channelSubs = globalSubs.get(channel);
    for (const sub of channelSubs) {
      if (sub.callback === callback && sub.selector === selector && sub.node === node) {
        channelSubs.delete(sub);
      }
    }
    const subscription = { selector, node, callback };
    channelSubs.add(subscription);
    return () => channelSubs.delete(subscription);
  }
  function publish(channel, ...args) {
    const channelSubs = globalSubs.get(channel);
    if (channelSubs) {
      for (const sub of channelSubs) {
        let target = null;
        if (sub.selector) {
          target = document.querySelector(sub.selector);
          if (!target) continue;
        } else if (sub.node) {
          if (!sub.node.isConnected) {
            channelSubs.delete(sub);
            continue;
          }
          target = sub.node;
        }
        try {
          sub.callback.call(target, ...args);
        } catch (e) {
          console.error(`Fez pubsub error on "${channel}":`, e);
        }
      }
    }
    if (componentSubs[channel]) {
      componentSubs[channel].forEach(([comp, cb]) => {
        if (comp.isConnected) {
          cb.bind(comp)(...args);
        }
      });
    }
  }
  function componentSubscribe(component, channel, callback) {
    componentSubs[channel] ||= [];
    componentSubs[channel] = componentSubs[channel].filter(([comp]) => comp.isConnected);
    componentSubs[channel].push([component, callback]);
    return () => {
      componentSubs[channel] = componentSubs[channel].filter(
        ([comp, cb]) => !(comp === component && cb === callback)
      );
    };
  }
  function componentPublish(component, channel, ...args) {
    const handlePublish = (comp) => {
      if (componentSubs[channel]) {
        const sub = componentSubs[channel].find(([c]) => c === comp);
        if (sub) {
          sub[1].bind(comp)(...args);
          return true;
        }
      }
      return false;
    };
    if (handlePublish(component)) {
      return true;
    }
    let parent = component.root?.parentElement;
    while (parent) {
      if (parent.fez) {
        if (handlePublish(parent.fez)) {
          return true;
        }
      }
      parent = parent.parentElement;
    }
    return false;
  }

  // src/fez/lib/transitions.js
  var EASINGS = {
    linear: "linear",
    ease: "ease",
    easeIn: "ease-in",
    easeOut: "ease-out",
    easeInOut: "ease-in-out",
    sineIn: "cubic-bezier(0.12, 0, 0.39, 0)",
    sineOut: "cubic-bezier(0.61, 1, 0.88, 1)",
    sineInOut: "cubic-bezier(0.37, 0, 0.63, 1)",
    quadIn: "cubic-bezier(0.11, 0, 0.5, 0)",
    quadOut: "cubic-bezier(0.5, 1, 0.89, 1)",
    quadInOut: "cubic-bezier(0.45, 0, 0.55, 1)",
    cubicIn: "cubic-bezier(0.32, 0, 0.67, 0)",
    cubicOut: "cubic-bezier(0.33, 1, 0.68, 1)",
    cubicInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
    quartIn: "cubic-bezier(0.5, 0, 0.75, 0)",
    quartOut: "cubic-bezier(0.25, 1, 0.5, 1)",
    quartInOut: "cubic-bezier(0.76, 0, 0.24, 1)",
    quintIn: "cubic-bezier(0.64, 0, 0.78, 0)",
    quintOut: "cubic-bezier(0.22, 1, 0.36, 1)",
    quintInOut: "cubic-bezier(0.83, 0, 0.17, 1)",
    expoIn: "cubic-bezier(0.7, 0, 0.84, 0)",
    expoOut: "cubic-bezier(0.16, 1, 0.3, 1)",
    expoInOut: "cubic-bezier(0.87, 0, 0.13, 1)",
    circIn: "cubic-bezier(0.55, 0, 1, 0.45)",
    circOut: "cubic-bezier(0, 0.55, 0.45, 1)",
    circInOut: "cubic-bezier(0.85, 0, 0.15, 1)",
    backIn: "cubic-bezier(0.36, 0, 0.66, -0.56)",
    backOut: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    backInOut: "cubic-bezier(0.68, -0.6, 0.32, 1.6)"
  };
  function resolveEasing(name, fallback = "cubicOut") {
    const key = name == null || name === "" ? fallback : String(name);
    return EASINGS[key] || key;
  }
  var DEFAULT_DURATION = 300;
  function parseTransition(text) {
    const parts = String(text ?? "").split(/[,;](?![^(]*\))/).map((s) => s.trim()).filter(Boolean);
    const name = parts.shift() || "";
    const params = {};
    for (const part of parts) {
      const m = part.match(/^([^=:\s]+)\s*[=:]\s*(.*)$/);
      if (!m) {
        params[part] = true;
        continue;
      }
      params[m[1]] = coerce(m[2].trim());
    }
    return { name, params };
  }
  function coerce(value) {
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return Number(value);
    }
    if (value === "true") {
      return true;
    }
    if (value === "false") {
      return false;
    }
    const q = value[0];
    if ((q === '"' || q === "'") && value.endsWith(q) && value.length >= 2) {
      return value.slice(1, -1);
    }
    return value;
  }
  var num = (v, fallback) => typeof v === "number" && !Number.isNaN(v) ? v : fallback;
  var baseValue = (cs, prop) => cs[prop] && cs[prop] !== "none" ? cs[prop] : "";
  var computed = (node) => {
    const win = node.ownerDocument?.defaultView || globalThis;
    return typeof win.getComputedStyle === "function" ? win.getComputedStyle(node) : {};
  };
  var builtins = {
    fade(node, p) {
      const cs = computed(node);
      return {
        keyframes: [{ opacity: 0 }, { opacity: cs.opacity || 1 }],
        duration: num(p.duration, DEFAULT_DURATION),
        easing: resolveEasing(p.easing, "linear")
      };
    },
    fly(node, p) {
      const cs = computed(node);
      const base = baseValue(cs, "transform");
      const d = num(p.distance, 40);
      const preset = FLY_FROM[p.from] || [0, 0];
      const x = num(p.x, preset[0] * d);
      const y = num(p.y, preset[1] * d);
      const opacity = num(p.opacity, 0);
      return {
        keyframes: [
          { transform: `${base} translate(${x}px, ${y}px)`.trim(), opacity },
          { transform: base || "none", opacity: cs.opacity || 1 }
        ],
        duration: num(p.duration, 400),
        easing: resolveEasing(p.easing, "cubicOut")
      };
    },
    scale(node, p) {
      const cs = computed(node);
      const base = baseValue(cs, "transform");
      const start = num(p.start, 0);
      const opacity = num(p.opacity, 0);
      return {
        keyframes: [
          { transform: `${base} scale(${start})`.trim(), opacity },
          { transform: base || "none", opacity: cs.opacity || 1 }
        ],
        duration: num(p.duration, DEFAULT_DURATION),
        easing: resolveEasing(p.easing, "cubicOut")
      };
    },
    blur(node, p) {
      const cs = computed(node);
      const base = baseValue(cs, "filter");
      const amount = num(p.amount, 5);
      const opacity = num(p.opacity, 0);
      return {
        keyframes: [
          { filter: `${base} blur(${amount}px)`.trim(), opacity },
          { filter: base || "none", opacity: cs.opacity || 1 }
        ],
        duration: num(p.duration, DEFAULT_DURATION),
        easing: resolveEasing(p.easing, "cubicInOut")
      };
    },
    slide(node, p) {
      const cs = computed(node);
      const vertical = p.axis !== "x";
      const size = vertical ? "height" : "width";
      const from = vertical ? [
        "paddingTop",
        "paddingBottom",
        "marginTop",
        "marginBottom",
        "borderTopWidth",
        "borderBottomWidth"
      ] : [
        "paddingLeft",
        "paddingRight",
        "marginLeft",
        "marginRight",
        "borderLeftWidth",
        "borderRightWidth"
      ];
      const collapsed = { [size]: "0px" };
      const natural = { [size]: cs[size] };
      for (const prop of from) {
        collapsed[prop] = "0px";
        natural[prop] = cs[prop];
      }
      if (typeof p.opacity === "number") {
        collapsed.opacity = p.opacity;
        natural.opacity = cs.opacity || 1;
      }
      const prevOverflow = node.style.overflow;
      node.style.overflow = "hidden";
      return {
        keyframes: [collapsed, natural],
        duration: num(p.duration, 400),
        easing: resolveEasing(p.easing, "cubicOut"),
        cleanup: () => {
          node.style.overflow = prevOverflow;
        }
      };
    },
    // dialogs, popovers, toasts, dropdowns: subtle scale with overshoot + fade
    pop(node, p) {
      const cs = computed(node);
      const base = baseValue(cs, "transform");
      const start = num(p.start, 0.8);
      const opacity = num(p.opacity, 0);
      return {
        keyframes: [
          { transform: `${base} scale(${start})`.trim(), opacity },
          { transform: base || "none", opacity: cs.opacity || 1 }
        ],
        duration: num(p.duration, 250),
        easing: resolveEasing(p.easing, "backOut")
      };
    },
    // 3D card flip around the y (default) or x axis
    flip(node, p) {
      const cs = computed(node);
      const base = baseValue(cs, "transform");
      const axis = p.axis === "x" ? "X" : "Y";
      const angle = num(p.angle, 90);
      const perspective = num(p.perspective, 600);
      const opacity = num(p.opacity, 0);
      return {
        keyframes: [
          {
            transform: `${base} perspective(${perspective}px) rotate${axis}(${angle}deg)`.trim(),
            opacity
          },
          { transform: base || "none", opacity: cs.opacity || 1 }
        ],
        duration: num(p.duration, 400),
        easing: resolveEasing(p.easing, "cubicOut")
      };
    },
    // spin in: rotate from `angle` degrees (+ optional scale) to rest
    rotate(node, p) {
      const cs = computed(node);
      const base = baseValue(cs, "transform");
      const angle = num(p.angle, -90);
      const start = num(p.start, 1);
      const opacity = num(p.opacity, 0);
      return {
        keyframes: [
          { transform: `${base} rotate(${angle}deg) scale(${start})`.trim(), opacity },
          { transform: base || "none", opacity: cs.opacity || 1 }
        ],
        duration: num(p.duration, DEFAULT_DURATION),
        easing: resolveEasing(p.easing, "cubicOut")
      };
    },
    // SVG stroke drawing (<path>, <circle>, <line> ... anything with getTotalLength).
    // duration, or speed in px/ms (duration = length / speed). Non-SVG nodes just fade.
    draw(node, p) {
      if (typeof node.getTotalLength !== "function") {
        return builtins.fade(node, p);
      }
      const len = node.getTotalLength();
      const duration = typeof p.speed === "number" && p.speed > 0 ? len / p.speed : num(p.duration, 800);
      return {
        keyframes: [
          { strokeDasharray: `${len}`, strokeDashoffset: `${len}` },
          { strokeDasharray: `${len}`, strokeDashoffset: "0" }
        ],
        duration,
        easing: resolveEasing(p.easing, "cubicInOut")
      };
    }
  };
  var FLY_FROM = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };
  var transitions = { ...builtins };
  function reducedMotion() {
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function runTransition(node, spec, direction = "in") {
    if (!node || node.nodeType !== 1 || !spec?.name) {
      return Promise.resolve();
    }
    const { name, params } = spec;
    const fn = transitions[name];
    const reverse = direction === "out";
    if (reducedMotion()) {
      return Promise.resolve();
    }
    if (typeof fn === "function") {
      let def;
      try {
        def = fn(node, params) || {};
      } catch (error) {
        console.error(`Fez: transition "${name}" failed`, error);
        return Promise.resolve();
      }
      if (!def.keyframes || typeof node.animate !== "function") {
        def.cleanup?.();
        return Promise.resolve();
      }
      const anim = node.animate(def.keyframes, {
        duration: num(def.duration, num(params.duration, DEFAULT_DURATION)),
        delay: num(def.delay, num(params.delay, 0)),
        easing: resolveEasing(def.easing ?? params.easing),
        // intro: hold frame 0 during delay, then hand back to the stylesheet.
        // outro: hold the last (hidden) frame until the node is detached.
        fill: reverse ? "both" : "backwards",
        direction: reverse ? "reverse" : "normal"
      });
      return anim.finished.catch(() => {
      }).then(() => def.cleanup?.());
    }
    const duration = num(params.duration, DEFAULT_DURATION);
    const delay = num(params.delay, 0);
    const easing = resolveEasing(params.easing, "ease");
    const fill = reverse ? "both reverse" : "backwards";
    return new Promise((resolve2) => {
      let done = false;
      const finish = (event) => {
        if (done || event && event.target !== node) {
          return;
        }
        done = true;
        clearTimeout(timer);
        node.removeEventListener("animationend", finish);
        node.removeEventListener("animationcancel", finish);
        if (!reverse) {
          node.style.animation = "";
        }
        resolve2();
      };
      node.addEventListener("animationend", finish);
      node.addEventListener("animationcancel", finish);
      const timer = setTimeout(finish, duration + delay + 50);
      node.style.animation = `${name} ${duration}ms ${easing} ${delay}ms ${fill}`;
    });
  }
  function measureFlip(nodes) {
    const entries = [];
    for (const node of nodes || []) {
      if (!node?.isConnected || node._fezLeaving || !node._fezAnimate) {
        continue;
      }
      entries.push({ node, rect: node.getBoundingClientRect(), spec: node._fezAnimate });
    }
    return entries;
  }
  function playFlip(entries) {
    if (!entries?.length || reducedMotion()) {
      return;
    }
    for (const { node, rect, spec } of entries) {
      if (!node.isConnected || node._fezLeaving || typeof node.animate !== "function") {
        continue;
      }
      node._fezFlipAnim?.cancel();
      const next = node.getBoundingClientRect();
      const dx = rect.left - next.left;
      const dy = rect.top - next.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        continue;
      }
      const base = baseValue(computed(node), "transform");
      const p = spec.params || {};
      const anim = node.animate(
        [{ transform: `${base} translate(${dx}px, ${dy}px)`.trim() }, { transform: base || "none" }],
        {
          duration: num(p.duration, DEFAULT_DURATION),
          delay: num(p.delay, 0),
          easing: resolveEasing(p.easing, "cubicOut"),
          fill: "backwards"
        }
      );
      node._fezFlipAnim = anim;
      anim.finished.catch(() => {
      }).then(() => {
        if (node._fezFlipAnim === anim) {
          node._fezFlipAnim = null;
        }
      });
    }
  }
  var SIZE_AXES = { height: ["height"], width: ["width"], size: ["width", "height"] };
  function animateSize(node, spec) {
    if (typeof spec === "string") {
      spec = parseTransition(spec);
    }
    const axes = SIZE_AXES[spec?.name];
    if (!axes || !node || node.nodeType !== 1) {
      return false;
    }
    node._fezSize = { axes, params: spec.params || {} };
    if (node._fezSizeObserver || typeof ResizeObserver !== "function") {
      return true;
    }
    let last = null;
    const observer2 = new ResizeObserver(() => {
      const rect = node.getBoundingClientRect();
      const prev = last;
      last = { width: rect.width, height: rect.height };
      if (prev) {
        playSize(node, prev, last, observer2);
      }
    });
    node._fezSizeObserver = observer2;
    observer2.observe(node);
    return true;
  }
  function playSize(node, prev, next, observer2) {
    if (!node.isConnected || node._fezLeaving || reducedMotion()) {
      return;
    }
    if (typeof node.animate !== "function") {
      return;
    }
    const cs = computed(node);
    const px = (v) => parseFloat(v) || 0;
    const inset = cs.boxSizing === "border-box" ? { width: 0, height: 0 } : {
      width: px(cs.paddingLeft) + px(cs.paddingRight) + px(cs.borderLeftWidth) + px(cs.borderRightWidth),
      height: px(cs.paddingTop) + px(cs.paddingBottom) + px(cs.borderTopWidth) + px(cs.borderBottomWidth)
    };
    const { axes, params } = node._fezSize;
    const from = {};
    const to = {};
    let changed = false;
    for (const axis of axes) {
      if (Math.abs(prev[axis] - next[axis]) < 0.5) {
        continue;
      }
      from[axis] = `${Math.max(0, prev[axis] - inset[axis])}px`;
      to[axis] = `${Math.max(0, next[axis] - inset[axis])}px`;
      changed = true;
    }
    if (!changed) {
      return;
    }
    observer2.unobserve(node);
    const prevOverflow = node.style.overflow;
    node.style.overflow = "hidden";
    const anim = node.animate([from, to], {
      duration: num(params.duration, DEFAULT_DURATION),
      delay: num(params.delay, 0),
      easing: resolveEasing(params.easing, "cubicOut"),
      fill: "backwards"
    });
    node._fezSizeAnim = anim;
    anim.finished.catch(() => {
    }).then(() => {
      if (node._fezSizeAnim === anim) {
        node._fezSizeAnim = null;
      }
      node.style.overflow = prevOverflow;
      observer2.observe(node);
    });
  }

  // src/fez/instance.js
  var WINDOW_EVENTS = /* @__PURE__ */ new Set([
    "resize",
    "scroll",
    "load",
    "beforeunload",
    "unload",
    "pagehide",
    "pageshow",
    "hashchange",
    "popstate",
    "online",
    "offline",
    "message",
    "storage",
    "orientationchange",
    "error"
  ]);
  var PROPS_ATTR = "fez-props";
  var PROPS_ATTR_MAX_STRING = 60;
  function formatPropsAttr(props) {
    const parts = [];
    for (const [key, value] of Object.entries(props || {})) {
      let text;
      if (value === null) text = "null";
      else if (value === void 0) text = "undefined";
      else if (typeof value === "function") text = "()=>{}";
      else if (Array.isArray(value)) text = "[]";
      else if (typeof value === "object") text = "{}";
      else {
        text = String(value).replace(/\s+/g, " ").trim();
        if (text.length > PROPS_ATTR_MAX_STRING) {
          text = text.slice(0, PROPS_ATTR_MAX_STRING) + "\u2026";
        }
      }
      parts.push(`${key}: ${text}`);
    }
    return parts.join("; ");
  }
  var FezBase = class _FezBase {
    // ===========================================================================
    // STATIC METHODS
    // ===========================================================================
    static nodeName = "div";
    /**
     * Extract props from a DOM node's attributes
     * Handles :attr syntax for evaluated expressions and data-props JSON.
     * Every path runs through castProps() so PROPS schema coercion and defaults
     * apply on connect, keyed refresh and <fez-component> passthrough alike.
     */
    static getProps(node, newNode) {
      const tagName = node.tagName?.toLowerCase();
      if (node.props) {
        return this.castProps(node.props, tagName);
      }
      let attrs = {};
      for (const attr of node.attributes) {
        attrs[attr.name] = attr.value;
      }
      for (const [key, val] of Object.entries(attrs)) {
        if ([":"].includes(key[0])) {
          delete attrs[key];
          try {
            const newVal = new Function(`return (${val})`).bind(newNode)();
            attrs[key.replace(/^:/, "")] = newVal;
          } catch (e) {
            Fez.onError(
              "attr",
              `<${tagName}> Error evaluating ${key}="${val}": ${e.message}`
            );
          }
        }
      }
      if (attrs["data-props"]) {
        let data = attrs["data-props"];
        if (typeof data == "object") {
          attrs = data;
        } else {
          if (data[0] != "{") {
            data = decodeURIComponent(data);
          }
          try {
            attrs = JSON.parse(data);
          } catch (e) {
            Fez.onError(
              "props",
              `<${tagName}> Invalid JSON in data-props: ${e.message}`
            );
          }
        }
      } else if (attrs["data-json-template"]) {
        const data = newNode.previousSibling?.textContent;
        if (data) {
          try {
            attrs = JSON.parse(data);
            newNode.previousSibling.remove();
          } catch (e) {
            Fez.onError(
              "props",
              `<${tagName}> Invalid JSON in template: ${e.message}`
            );
          }
        }
      }
      return this.castProps(attrs, tagName);
    }
    /**
     * Normalized PROPS schema for this class: shorthand `name: String` becomes
     * `{ type: String }`. Memoized per class (own property, so subclasses with
     * their own PROPS do not inherit a parent's cache).
     */
    static propsSchema() {
      if (Object.prototype.hasOwnProperty.call(this, "_propsSchema")) {
        return this._propsSchema;
      }
      const raw = this.PROPS;
      let schema = null;
      if (raw && typeof raw === "object") {
        schema = {};
        for (const [name, spec] of Object.entries(raw)) {
          schema[name] = spec && typeof spec === "object" && !Array.isArray(spec) ? spec : { type: spec };
        }
      }
      Object.defineProperty(this, "_propsSchema", {
        value: schema,
        writable: true,
        configurable: true
      });
      return schema;
    }
    /**
     * True when a value already is what the PROPS entry declares, so coercion
     * (and the transform in castProp) has nothing left to do.
     */
    static matchesType(value, type) {
      if (value === null || value === void 0) return false;
      if (type === Array) return Array.isArray(value);
      if (type === Object) return typeof value === "object" && !Array.isArray(value);
      if (type === Number) return typeof value === "number";
      if (type === Boolean) return typeof value === "boolean";
      if (type === String) return typeof value === "string";
      if (type === Date) return value instanceof Date;
      if (type === Function) return typeof value === "function";
      return false;
    }
    /**
     * Cast a single prop through its PROPS entry. Unknown keys pass through
     * untouched. Errors are reported via Fez.onError("props", ...) and never
     * thrown - a bad attribute must not kill the page.
     */
    static castProp(name, value, tagName) {
      const spec = this.propsSchema()?.[name];
      if (!spec) return value;
      const fail = (msg) => {
        Fez.onError("props", `<${tagName || "fez"}> prop "${name}": ${msg}`);
        return void 0;
      };
      const show = (v2) => typeof v2 === "string" ? JSON.stringify(v2) : String(v2);
      let v = value;
      const type = spec.type;
      const transform = typeof spec.default === "function" && type !== Function && spec.default.length > 0 ? spec.default : null;
      if (transform && !(typeof v !== "string" && _FezBase.matchesType(v, type))) {
        try {
          v = transform(v === null ? void 0 : v, name);
        } catch (e) {
          v = fail(`default(${show(value)}) failed: ${e.message}`);
        }
      }
      if (v === null || v === void 0) {
        v = void 0;
      } else if (type === String) {
        v = String(v);
      } else if (type === Number) {
        const n2 = typeof v === "number" ? v : Number(String(v).trim());
        v = Number.isNaN(n2) || String(v).trim() === "" ? fail(`expected Number, got ${show(v)}`) : n2;
      } else if (type === Boolean) {
        v = _FezBase.toBoolean(v, name);
      } else if (type === Array || type === Object) {
        if (typeof v === "string") {
          const str = v.trim();
          try {
            v = str === "" ? void 0 : JSON.parse(str);
          } catch (e) {
            v = fail(`invalid JSON ${show(v)}: ${e.message}`);
          }
        }
        if (v !== void 0) {
          const ok = type === Array ? Array.isArray(v) : typeof v === "object" && !Array.isArray(v);
          if (!ok) v = fail(`expected ${type.name}, got ${show(value)}`);
        }
      } else if (type === Function) {
        if (typeof v !== "function") {
          v = fail(`expected Function (pass it with :${name}="..."), got ${show(v)}`);
        }
      } else if (type === Date) {
        if (!(v instanceof Date)) {
          const str = String(v).trim();
          const d = new Date(/^-?\d+(\.\d+)?$/.test(str) ? Number(str) : str);
          v = Number.isNaN(d.getTime()) ? fail(`expected Date, got ${show(v)}`) : d;
        } else if (Number.isNaN(v.getTime())) {
          v = fail(`expected Date, got Invalid Date`);
        }
      } else if (typeof type === "function") {
        try {
          v = type(v, name);
        } catch (e) {
          v = fail(e.message);
        }
      }
      if (v === void 0 && spec.required) {
        fail(`is required`);
      }
      if (v !== void 0 && Array.isArray(spec.enum) && !spec.enum.includes(v)) {
        v = fail(`expected one of ${spec.enum.map(show).join(", ")}, got ${show(v)}`);
      }
      if (v === void 0 && spec.default !== void 0 && !transform) {
        v = typeof spec.default === "function" && type !== Function ? spec.default() : spec.default;
      }
      if (v === void 0 && type === Boolean) {
        v = false;
      }
      return v;
    }
    /**
     * Cast a props object through the PROPS schema. Schema keys are walked
     * first so defaults and Boolean=false land even for absent attributes;
     * everything else is copied through as is. Returns a new object.
     */
    static castProps(props, tagName) {
      const schema = this.propsSchema();
      if (!schema) return props;
      const out = {};
      for (const name of Object.keys(schema)) {
        const v = this.castProp(name, props?.[name], tagName);
        if (v !== void 0) out[name] = v;
      }
      for (const [name, value] of Object.entries(props || {})) {
        if (!(name in schema)) out[name] = value;
      }
      return out;
    }
    /**
     * HTML-ish boolean parsing for attribute values. Presence ("") and the
     * attribute's own name (`disabled="disabled"`) are true; the usual
     * negative words are false; anything else falls back to Fez.isTrue.
     */
    static toBoolean(value, name) {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      const s = String(value).trim().toLowerCase();
      if (s === "" || s === name) return true;
      if (["false", "0", "off", "no", "null", "undefined"].includes(s)) return false;
      return Fez.isTrue ? Fez.isTrue(s) : ["1", "true", "on"].includes(s);
    }
    /**
     * Get form data from closest/child form
     */
    static formData(node) {
      const formNode = node.closest("form") || node.querySelector("form");
      if (!formNode) {
        Fez.consoleLog("No form found for formData()");
        return {};
      }
      const formData = new FormData(formNode);
      const formObject = {};
      formData.forEach((value, key) => {
        formObject[key] = value;
      });
      return formObject;
    }
    // ===========================================================================
    // CONSTRUCTOR & CORE
    // ===========================================================================
    constructor() {
    }
    n = n;
    fezBlocks = {};
    local = {};
    /**
     * Props are reactive: writing this.props.x schedules a render, exactly like
     * this.state.x. A component that owns a list can render props.items straight
     * from the template instead of copying it into state first.
     *
     * Assigning the whole object (connect, parent re-render) re-wraps it. The raw
     * object stays on _propsRaw - the proxy hands out a fresh wrapper on every
     * object read, so proxied values never compare equal by identity and prop
     * change detection has to run against the raw object.
     */
    get props() {
      return this._props;
    }
    set props(value) {
      this._propsRaw = value || {};
      this._props = this.fezReactiveStore(this._propsRaw, (_t, _k, next, prev) => {
        if (next === prev) return;
        this.fezSyncPropsAttr();
        if (this._isRendering || this._isInitializing) return;
        if (this._fezStateDisabled) return;
        this.fezNextTick(this.fezRender, "fezRender");
      }, { shallow: true });
      this.fezSyncPropsAttr();
    }
    /**
     * Mirror this.props onto the root as `fez-props` (see formatPropsAttr).
     * Runs on every props assignment and every this.props.x write, so the
     * inspector never shows stale values. Never diffed: the morph does not sync
     * root attributes, and parents treat live components as preserved.
     */
    fezSyncPropsAttr() {
      const root = this.root;
      if (!root?.setAttribute) return;
      const text = formatPropsAttr(this._propsRaw);
      if (text) {
        if (root.getAttribute(PROPS_ATTR) !== text) root.setAttribute(PROPS_ATTR, text);
      } else if (root.hasAttribute(PROPS_ATTR)) {
        root.removeAttribute(PROPS_ATTR);
      }
    }
    // Slots for passing live values (:attr props, loop handlers) through
    // rendered HTML, see lib/render-slots.js
    fezGlobals = new RenderSlots();
    /**
     * Report error with component name always included
     * @param {string} kind - Error category
     * @param {string} message - Error message
     * @param {Object} [context] - Additional context
     * @returns {string} Formatted error message
     */
    fezError(kind, message, context) {
      const name = this.fezName || this.root?.tagName?.toLowerCase() || "unknown";
      const enhancedContext = context ? { ...context, componentName: name } : { componentName: name };
      return Fez.onError(kind, `<${name}> ${message}`, enhancedContext);
    }
    /**
     * String selector for use in HTML nodes
     */
    get fezHtmlRoot() {
      return `Fez(${this.UID}).`;
    }
    /**
     * Check if node is attached to DOM
     */
    get isConnected() {
      return !!this.root?.isConnected;
    }
    /**
     * Get single node property
     */
    prop(name) {
      let v = this.oldRoot[name] || this.props[name];
      if (typeof v == "function") {
        v = v.bind(this.root);
      }
      return v;
    }
    // ===========================================================================
    // LIFECYCLE HOOKS
    // ===========================================================================
    connect() {
    }
    onMount() {
    }
    beforeRender() {
    }
    afterRender() {
    }
    onDestroy() {
    }
    onStateChange() {
    }
    onGlobalStateChange() {
    }
    onPropsChange() {
    }
    onRefresh() {
    }
    /**
     * Centralized destroy logic - called by MutationObserver when element is removed
     */
    fezOnDestroy() {
      if (this._destroyed) return;
      this._destroyed = true;
      if (this._onDestroyCallbacks) {
        this._onDestroyCallbacks.forEach((callback) => {
          try {
            callback();
          } catch (e) {
            this.fezError("destroy", "Error in cleanup callback", e);
          }
        });
        this._onDestroyCallbacks = [];
      }
      this.onDestroy();
      this.onDestroy = () => {
      };
      this.local = {};
      this.fezGlobals.clear();
      const handle = this.class?.GLOBAL;
      if (handle && window[handle] === this) delete window[handle];
      Fez.instances?.delete(this.UID);
      if (this.root) {
        this.root.fez = void 0;
      }
      this.root = void 0;
    }
    /**
     * Add a cleanup callback for destroy
     */
    addOnDestroy(callback) {
      this._onDestroyCallbacks = this._onDestroyCallbacks || [];
      this._onDestroyCallbacks.push(callback);
    }
    // ===========================================================================
    // RENDERING
    // ===========================================================================
    /**
     * Parse HTML and replace fez. references
     */
    fezParseHtml(text) {
      const base = this.fezHtmlRoot.replaceAll('"', "&quot;");
      text = text.replace(
        /\bon[a-z]+=(["'])([\s\S]*?)\1/gi,
        (attr) => attr.replace(/\bfez\.(\w)/g, `${base}$1`)
      ).replace(/>\s+</g, "><");
      return text.trim();
    }
    /**
     * Schedule work on next animation frame (debounced by name)
     */
    fezNextTick(func, name) {
      if (name) {
        this._nextTicks ||= {};
        this._nextTicks[name] ||= window.requestAnimationFrame(() => {
          func.bind(this)();
          this._nextTicks[name] = null;
        }, name);
      } else {
        window.requestAnimationFrame(func.bind(this));
      }
    }
    /**
     * Force a re-render on next frame
     */
    fezRefresh() {
      this.fezNextTick(() => this.fezRender(), "refresh");
    }
    /**
     * Alias for fezRefresh - can be overwritten
     */
    refresh() {
      this.fezRefresh();
    }
    /**
     * Render the component template to DOM
     * Uses component-aware DOM differ with hash-based skip
     */
    fezRender(template) {
      template ||= this.fezHtmlFunc || this?.class?.fezHtmlFunc;
      if (!template || !this.root) return;
      this._isRendering = true;
      this.beforeRender();
      const nodeName = typeof this.class.nodeName == "function" ? this.class.nodeName(this.root) : this.class.nodeName;
      const newNode = document.createElement(nodeName || "div");
      this.fezGlobals.beginRender();
      let renderedTpl;
      if (Array.isArray(template)) {
        if (template[0] instanceof Node) {
          template.forEach((n2) => newNode.appendChild(n2));
        } else {
          renderedTpl = template.join("");
        }
      } else if (typeof template == "string") {
        const name = this.root?.tagName?.toLowerCase();
        renderedTpl = createTemplate(template, { name })(this);
      } else if (typeof template == "function") {
        renderedTpl = template(this);
      }
      if (renderedTpl) {
        if (renderedTpl instanceof DocumentFragment || renderedTpl instanceof Node) {
          newNode.appendChild(renderedTpl);
        } else {
          renderedTpl = renderedTpl.replace(/\s\w+="undefined"/g, "");
          const parsedHtml = this.fezParseHtml(renderedTpl);
          const newHash = Fez.fnv1(parsedHtml);
          if (newHash === this._fezHash && !this.fezGlobals.valuesChanged) {
            this.fezGlobals.commitRender();
            this._isRendering = false;
            return;
          }
          this._fezHash = newHash;
          newNode.innerHTML = parsedHtml;
          this.fezPromoteInternalKeys(newNode);
        }
      }
      this.fezKeepNode(newNode);
      const savedInputValues = /* @__PURE__ */ new Map();
      this.root.querySelectorAll("input, textarea, select").forEach((el) => {
        if (el._fezThisName) {
          savedInputValues.set(el._fezThisName, {
            value: el.value,
            checked: el.checked
          });
        }
      });
      const flip = measureFlip(this._fezFlipNodes);
      Fez.morphdom(this.root, newNode);
      if (savedInputValues.size) {
        this.root.querySelectorAll("input, textarea, select").forEach((el) => {
          const saved = el._fezThisName && savedInputValues.get(el._fezThisName);
          if (saved) {
            el.value = saved.value;
            if (saved.checked !== void 0) el.checked = saved.checked;
          }
        });
      }
      this.fezRenderPostProcess();
      playFlip(flip);
      this.fezGlobals.commitRender();
      this.afterRender();
      this._isRendering = false;
    }
    /**
     * Post-render processing for fez-* attributes
     */
    fezRenderPostProcess() {
      const fetchAttr = (name, func) => {
        this.root.querySelectorAll(`*[${name}]`).forEach((n2) => {
          let value = n2.getAttribute(name);
          n2.removeAttribute(name);
          if (value) {
            func.bind(this)(value, n2);
          }
        });
      };
      fetchAttr("fez-this", (value, n2) => {
        new Function("n", `this.${value} = n`).bind(this)(n2);
        n2._fezThisName = value;
      });
      fetchAttr("fez-use", (value, n2) => {
        if (value.includes("=>")) return Fez.getFunction(value)(n2);
        if (value.includes(".")) return Fez.getFunction(value).bind(n2)();
        const target = this[value];
        if (typeof target == "function") return target(n2);
        this.fezError("fez-use", `"${value}" is not a function`);
      });
      fetchAttr("fez-class", (value, n2) => {
        let classes = value.split(/\s+/);
        let lastClass = classes.pop();
        classes.forEach((c) => n2.classList.add(c));
        if (lastClass) {
          setTimeout(() => {
            n2.classList.add(lastClass);
          }, 1);
        }
      });
      this._fezFlipNodes = [];
      fetchAttr("fez-animate", (value, n2) => {
        const spec = parseTransition(value);
        if (animateSize(n2, spec)) return;
        for (const axis of ["height", "width", "size"]) {
          if (spec.params[axis] === true) {
            animateSize(n2, { name: axis, params: spec.params });
          }
        }
        n2._fezAnimate = spec;
        this._fezFlipNodes.push(n2);
      });
      fetchAttr("fez-transition", (value, n2) => {
        const spec = parseTransition(value);
        if (!n2.hasAttribute("fez-out")) n2._fezOut = spec;
        if (n2.hasAttribute("fez-in") || n2._fezIn) return;
        n2._fezIn = true;
        runTransition(n2, spec, "in");
      });
      fetchAttr("fez-in", (value, n2) => {
        if (n2._fezIn) return;
        n2._fezIn = true;
        runTransition(n2, parseTransition(value), "in");
      });
      fetchAttr("fez-out", (value, n2) => {
        n2._fezOut = parseTransition(value);
      });
      fetchAttr("fez-bind", (text, n2) => {
        if (["INPUT", "SELECT", "TEXTAREA"].includes(n2.nodeName)) {
          const value = new Function(`return this.${text}`).bind(this)();
          const isCb = n2.type.toLowerCase() == "checkbox";
          const eventName = ["SELECT"].includes(n2.nodeName) || isCb ? "onchange" : "oninput";
          n2.setAttribute(
            eventName,
            `${this.fezHtmlRoot}${text} = this.${isCb ? "checked" : "value"}`
          );
          this.val(n2, value);
          n2._fezThisName = text;
        } else {
          this.fezError(
            "fez-bind",
            `Can't bind "${text}" to ${n2.nodeName} (needs INPUT, SELECT or TEXTAREA)`
          );
        }
      });
      this.root.querySelectorAll("*[checked], *[disabled], *[selected]").forEach((n2) => {
        for (const attr of ["checked", "disabled", "selected"]) {
          if (!n2.hasAttribute(attr)) continue;
          let value = n2.getAttribute(attr);
          if (["false", "null", "undefined"].includes(value)) {
            n2.removeAttribute(attr);
            n2[attr] = false;
          } else {
            n2.setAttribute(attr, attr);
          }
        }
      });
    }
    /**
     * Move compiler-generated key markers off the DOM attribute surface.
     */
    fezPromoteInternalKeys(node) {
      node.querySelectorAll?.("[fez-key]").forEach((el) => {
        el._fezKey = el.getAttribute("fez-key");
        el.removeAttribute("fez-key");
      });
    }
    /**
     * Handle slot initialization on first render.
     * Moves captured children from _fezSlotNodes into the .fez-slot container.
     * fez-keep matching is handled natively by the differ (morph.js).
     */
    fezKeepNode(newNode) {
      if (this._fezSlotInitialized) return;
      if (!this._fezSlotNodes) return;
      const newSlot = newNode.querySelector(".fez-slot");
      if (newSlot) {
        this._fezSlotInitialized = true;
        this._fezSlotNodes.forEach((child) => {
          newSlot.appendChild(child);
        });
        if (newSlot.hasAttribute("unwrap")) {
          const parent = newSlot.parentNode;
          while (newSlot.firstChild) {
            parent.insertBefore(newSlot.firstChild, newSlot);
          }
          newSlot.remove();
        }
      }
    }
    // ===========================================================================
    // REACTIVE STATE
    // ===========================================================================
    /**
     * Register component: setup CSS, state, and bind methods
     */
    fezRegister() {
      if (this.css) {
        Fez.globalCss(this.css, { name: this.fezName, wrap: true });
      }
      if (this.class.css) {
        Fez.globalCss(this.class.css, { name: this.fezName });
      }
      if (this.class.cssGlobal) {
        Fez.globalCss(this.class.cssGlobal);
      }
      if (this.class.fezSlotUnwrap) {
        this._fezStateDisabled = true;
        this.state = new Proxy({}, {
          set: (t, k, v) => {
            console.error(`Fez: <${this.fezName}> uses <slot unwrap />, this.state is disabled`);
            return true;
          },
          get: (t, k) => void 0
        });
      } else if (!this.state) {
        this._stateRaw = {};
        this.state = this.fezReactiveStore(this._stateRaw);
      }
      this.globalState = Fez.state.createProxy(this);
      this.fezRegisterBindMethods();
    }
    /**
     * Bind all instance methods to this, walking the prototype chain
     * so inherited FezBase methods (refresh, fezRefresh, ...) bind too
     */
    fezRegisterBindMethods() {
      const methods = /* @__PURE__ */ new Set();
      let proto = Object.getPrototypeOf(this);
      while (proto && proto !== Object.prototype) {
        for (const name of Object.getOwnPropertyNames(proto)) {
          if (name === "constructor" || methods.has(name)) continue;
          if (typeof this[name] === "function") methods.add(name);
        }
        proto = Object.getPrototypeOf(proto);
      }
      methods.forEach((name) => this[name] = this[name].bind(this));
    }
    /**
     * Seed this.state from PROPS entries flagged with `state`.
     * `state: true` uses the prop name, `state: 'other_key'` renames it.
     * Runs once before init(), so a component that owns a list can declare it
     * as a prop and mutate this.state from there - no copy line in init().
     */
    fezSeedStateProps() {
      const schema = this.class?.propsSchema?.();
      if (!schema) return;
      if (this._fezStateDisabled) return;
      for (const [name, spec] of Object.entries(schema)) {
        if (!spec.state) continue;
        let value = this._propsRaw?.[name];
        if (value === void 0) continue;
        if (Array.isArray(value)) {
          value = [...value];
        } else if (value && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
          value = { ...value };
        }
        const target = this._stateRaw || this.state;
        target[typeof spec.state === "string" ? spec.state : name] = value;
      }
    }
    /**
     * Create a reactive store that triggers re-renders on changes
     */
    fezReactiveStore(obj, handler, options = {}) {
      obj ||= {};
      handler ||= (o, k, v, oldValue) => {
        if (v != oldValue) {
          this.onStateChange(k, v, oldValue);
          if (!this._isRendering && !this._isInitializing) {
            this.fezNextTick(this.fezRender, "fezRender");
          }
        }
      };
      handler.bind(this);
      function shouldProxy(obj2) {
        if (typeof obj2 !== "object" || obj2 === null) return false;
        if (obj2.nodeType) return false;
        if (Array.isArray(obj2)) return true;
        const proto = Object.getPrototypeOf(obj2);
        return proto === Object.prototype || proto === null;
      }
      function createReactive(obj2, handler2) {
        if (!shouldProxy(obj2)) {
          return obj2;
        }
        return new Proxy(obj2, {
          set(target, property, value, receiver) {
            const currentValue = Reflect.get(target, property, receiver);
            if (currentValue !== value) {
              const result = Reflect.set(target, property, value, receiver);
              handler2(target, property, value, currentValue);
              return result;
            }
            return true;
          },
          get(target, property, receiver) {
            const value = Reflect.get(target, property, receiver);
            if (!options.shallow && shouldProxy(value)) {
              return createReactive(value, handler2);
            }
            return value;
          }
        });
      }
      return createReactive(obj, handler);
    }
    // ===========================================================================
    // DOM HELPERS
    // ===========================================================================
    /**
     * Find element by selector
     */
    find(selector) {
      return typeof selector == "string" ? this.root ? this.root.querySelector(selector) : null : selector;
    }
    /**
     * Add one or more classes (space-separated) to root or given node
     */
    addClass(names, node) {
      (node || this.root).classList.add(...names.split(/\s+/).filter(Boolean));
    }
    /**
     * Toggle a class on root or given node, with optional force boolean
     */
    toggleClass(name, force, node) {
      (node || this.root).classList.toggle(name, force);
    }
    /**
     * Get or set node value (input/textarea/select or innerHTML)
     */
    val(selector, data) {
      const node = this.find(selector);
      if (node) {
        if (["INPUT", "TEXTAREA", "SELECT"].includes(node.nodeName)) {
          if (typeof data != "undefined") {
            if (node.type == "checkbox") {
              node.checked = !!data;
            } else {
              node.value = data;
            }
          } else {
            return node.value;
          }
        } else {
          if (typeof data != "undefined") {
            node.innerHTML = data;
          } else {
            return node.innerHTML;
          }
        }
      }
    }
    /**
     * Instance form data helper
     */
    formData(node) {
      return this.class.formData(node || this.root);
    }
    /**
     * Get or set root attribute
     */
    attr(name, value) {
      if (typeof value === "undefined") {
        return this.root.getAttribute(name);
      } else {
        this.root.setAttribute(name, value);
        return value;
      }
    }
    childNodes(func) {
      let children = this._fezChildNodes || Array.from(this.root.children);
      if (func) {
        children = children.map(func);
      }
      return children;
    }
    childObjects() {
      return this.childNodes().map((node) => {
        const obj = { html: node.innerHTML, ROOT: node, NODE_NAME: node.nodeName.toLowerCase() };
        for (const attr of node.attributes) {
          obj[attr.name] = attr.value;
        }
        return obj;
      });
    }
    /**
     * Set CSS properties on root
     */
    setStyle(key, value) {
      if (key && typeof key == "object") {
        Object.entries(key).forEach(([prop, val]) => {
          this.root.style.setProperty(prop, val);
        });
      } else {
        this.root.style.setProperty(key, value);
      }
    }
    /**
     * Copy props as attributes to root
     */
    copy() {
      for (const name of Array.from(arguments)) {
        let value = this.props[name];
        if (value !== void 0) {
          if (name == "class") {
            const klass = this.root.getAttribute(name, value);
            if (klass) {
              value = [klass, value].join(" ");
            }
          }
          if (typeof value == "string") {
            this.root.setAttribute(name, value);
          } else {
            this.root[name] = value;
          }
        }
      }
    }
    /**
     * Get or set root ID
     */
    rootId() {
      this.root.id ||= `fez_${this.UID}`;
      return this.root.id;
    }
    /**
     * Dissolve component into parent
     */
    dissolve(inNode) {
      if (inNode) {
        inNode.classList.add("fez");
        inNode.classList.add(`fez-${this.fezName}`);
        inNode.fez = this;
        if (this.attr("id")) inNode.setAttribute("id", this.attr("id"));
        this.root.replaceChildren(inNode);
      }
      const node = this.root;
      const parent = node.parentNode;
      const nodes = inNode ? [inNode] : this.childNodes();
      if (parent) {
        nodes.slice().reverse().forEach((el) => parent.insertBefore(el, node.nextSibling));
      }
      node.remove();
      this.root = inNode || void 0;
      return nodes;
    }
    // ===========================================================================
    // EVENTS
    // ===========================================================================
    /**
     * Gate for the `on<event>!="..."` strict-handler sugar, which the template
     * compiler expands to `fez.fezBang(event) && (body)`. Runs the body only when
     * the element itself is the event target (no child captured the event) and
     * swallows it with stopPropagation + preventDefault.
     */
    fezBang(e) {
      if (e.target !== e.currentTarget) return false;
      e.stopPropagation();
      e.preventDefault();
      return true;
    }
    /**
     * Add an event listener on any EventTarget with auto-cleanup.
     * Handler is bound to the component and only fires while it is connected.
     *
     *   this.on('resize', () => this.recompute())                  // window (event in WINDOW_EVENTS)
     *   this.on('pjax:render', () => this.refresh())               // document (default for unknown events)
     *   this.on(window, 'keydown', e => ...)                       // explicit target
     *   this.on(this.find('.x'), 'click', e => ..., { throttle: 100 })
     *
     * Returns a disposer for early unregister.
     */
    on(target, eventName, handler, opts) {
      if (typeof target === "string") {
        [target, eventName, handler, opts] = [
          WINDOW_EVENTS.has(target) ? window : document,
          target,
          eventName,
          handler
        ];
      }
      const call = handler.bind(this);
      const guarded = (e) => {
        if (this.isConnected) call(e);
      };
      const fn = opts?.throttle ? Fez.throttle(guarded, opts.throttle) : guarded;
      target.addEventListener(eventName, fn, opts);
      const dispose = () => target.removeEventListener(eventName, fn, opts);
      this.addOnDestroy(dispose);
      return dispose;
    }
    /**
     * Window resize handler — calls fn once immediately, then on throttled resize.
     */
    onWindowResize(func, throttle = 200) {
      this.on("resize", func, { throttle });
      func.call(this);
    }
    /**
     * Window scroll handler — calls fn once immediately, then on throttled scroll.
     */
    onWindowScroll(func, throttle = 200) {
      this.on("scroll", func, { throttle });
      func.call(this);
    }
    /**
     * Element resize handler using ResizeObserver
     */
    onElementResize(el, func, delay = 200) {
      const throttledFunc = Fez.throttle(() => {
        if (this.isConnected) func.call(this, el.getBoundingClientRect(), el);
      }, delay);
      const observer2 = new ResizeObserver(throttledFunc);
      observer2.observe(el);
      func.call(this, el.getBoundingClientRect(), el);
      this.addOnDestroy(() => {
        observer2.disconnect();
      });
    }
    /**
     * Timeout with auto-cleanup
     */
    setTimeout(func, delay) {
      const timeoutID = setTimeout(() => {
        if (this.isConnected) func();
      }, delay);
      this.addOnDestroy(() => clearTimeout(timeoutID));
      return timeoutID;
    }
    /**
     * Interval with auto-cleanup
     */
    setInterval(func, tick, name) {
      if (typeof func == "number") {
        [tick, func] = [func, tick];
      }
      name ||= Fez.fnv1(String(func));
      this._setIntervalCache ||= {};
      clearInterval(this._setIntervalCache[name]);
      const intervalID = setInterval(() => {
        if (this.isConnected) func();
      }, tick);
      this._setIntervalCache[name] = intervalID;
      this.addOnDestroy(() => {
        clearInterval(intervalID);
        delete this._setIntervalCache[name];
      });
      return intervalID;
    }
    // ===========================================================================
    // PUB/SUB
    // ===========================================================================
    /**
     * Publish to parent components (bubbles up through DOM)
     * @param {string} channel - Event name
     * @param {...any} args - Arguments to pass
     * @returns {boolean} True if a parent handled the event
     */
    publish(channel, ...args) {
      return componentPublish(this, channel, ...args);
    }
    /**
     * Subscribe to a channel (auto-cleanup on destroy)
     * @param {string} channel - Event name
     * @param {Function} func - Handler function
     * @returns {Function} Unsubscribe function
     */
    subscribe(channel, func) {
      const unsubscribe = componentSubscribe(this, channel, func);
      this.addOnDestroy(unsubscribe);
      return unsubscribe;
    }
    // ===========================================================================
    // SLOTS
    // ===========================================================================
    /**
     * Copy child nodes natively to preserve bound events
     */
    fezSlot(source, target) {
      target ||= document.createElement("template");
      const isSlot = target.nodeName == "SLOT";
      while (source.firstChild) {
        if (isSlot) {
          target.parentNode.insertBefore(source.lastChild, target.nextSibling);
        } else {
          target.appendChild(source.firstChild);
        }
      }
      if (isSlot) {
        target.parentNode.removeChild(target);
      } else {
        source.innerHTML = "";
      }
      return target;
    }
  };

  // src/fez/utils/css_inject.js
  var injected = /* @__PURE__ */ new Set();
  var chunks = [];
  var sheet = null;
  var cssHash = (text) => {
    let hash = 11;
    for (let i = 0; i < text.length; i++) {
      hash = 101 * hash + text.charCodeAt(i) >>> 0;
    }
    return "fez-" + hash.toString(36);
  };
  var styleNode = () => {
    if (sheet && sheet.isConnected !== false) return sheet;
    sheet = document.getElementById("fez-css");
    if (!sheet) {
      sheet = document.createElement("style");
      sheet.id = "fez-css";
      document.head.appendChild(sheet);
    }
    return sheet;
  };
  var injectCss = (text) => {
    const key = cssHash(text);
    if (injected.has(key)) return key;
    injected.add(key);
    chunks.push(text);
    try {
      const node = styleNode();
      node.textContent = `${node.textContent || ""}${text}
`;
    } catch {
    }
    return key;
  };
  var extractCss = () => chunks.join("\n");

  // src/fez/utils/flatten_css.js
  var CONDITIONAL = /^@(media|supports|container|layer|scope|document)\b/i;
  var VERBATIM = /^@(-\w+-)?(keyframes|font-face|property|counter-style|page|namespace|font-feature-values|viewport)\b/i;
  var STATEMENT = /^@(import|charset)\b/i;
  function parse(css) {
    const root = { prelude: "", declarations: [], children: [] };
    const stack = [root];
    let buf = "";
    for (let i = 0; i < css.length; i++) {
      const ch = css[i];
      if (ch === "/" && css[i + 1] === "*") {
        const end = css.indexOf("*/", i + 2);
        i = end === -1 ? css.length : end + 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        let j = i + 1;
        while (j < css.length && css[j] !== ch) {
          if (css[j] === "\\") j++;
          j++;
        }
        buf += css.slice(i, j + 1);
        i = j;
        continue;
      }
      if (ch === "(") {
        let depth = 1;
        let j = i + 1;
        while (j < css.length && depth) {
          if (css[j] === "\\") {
            j += 2;
            continue;
          }
          if (css[j] === "(") depth++;
          else if (css[j] === ")") depth--;
          j++;
        }
        buf += css.slice(i, j);
        i = j - 1;
        continue;
      }
      if (ch === "{") {
        const node = { prelude: buf.trim(), declarations: [], children: [] };
        stack[stack.length - 1].children.push(node);
        stack.push(node);
        buf = "";
        continue;
      }
      if (ch === "}") {
        const tail2 = buf.trim();
        if (tail2) stack[stack.length - 1].declarations.push(tail2);
        buf = "";
        if (stack.length > 1) stack.pop();
        continue;
      }
      if (ch === ";") {
        const decl = buf.trim();
        if (decl) stack[stack.length - 1].declarations.push(decl);
        buf = "";
        continue;
      }
      buf += ch;
    }
    const tail = buf.trim();
    if (tail) root.declarations.push(tail);
    return root;
  }
  function splitSelectors(selector) {
    const parts = [];
    let depth = 0;
    let buf = "";
    for (const ch of selector) {
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === "," && !depth) {
        parts.push(buf.trim());
        buf = "";
      } else buf += ch;
    }
    if (buf.trim()) parts.push(buf.trim());
    return parts;
  }
  var unwrapGlobal = (sel) => sel.replace(/:global\(([^)]*)\)/g, "$1").trim();
  function resolve(parents, selector) {
    const out = [];
    for (const rawChild of splitSelectors(selector)) {
      if (/^:global\(/.test(rawChild)) {
        out.push(unwrapGlobal(rawChild));
        continue;
      }
      const child = unwrapGlobal(rawChild);
      if (!parents.length) {
        out.push(child);
        continue;
      }
      for (const parent of parents) {
        out.push(
          child.includes("&") ? child.replace(/&/g, parent) : `${parent} ${child}`
        );
      }
    }
    return out;
  }
  function serialize(node, parents, conditions, sink) {
    for (const child of node.children) {
      const prelude = child.prelude;
      if (VERBATIM.test(prelude)) {
        sink.verbatim.push(wrap(conditions, `${prelude}{${stringifyRaw(child)}}`));
        continue;
      }
      if (CONDITIONAL.test(prelude)) {
        const inner = [...conditions, prelude];
        if (child.declarations.length && parents.length) {
          sink.rules.push(wrap(inner, `${parents.join(",")}{${child.declarations.join(";")};}`));
        }
        serialize(child, parents, inner, sink);
        continue;
      }
      if (STATEMENT.test(prelude)) continue;
      const resolved = resolve(parents, prelude);
      if (child.declarations.length) {
        sink.rules.push(wrap(conditions, `${resolved.join(",")}{${child.declarations.join(";")};}`));
      }
      serialize(child, resolved, conditions, sink);
    }
  }
  function stringifyRaw(node) {
    let out = node.declarations.length ? node.declarations.join(";") + ";" : "";
    for (const child of node.children) {
      out += `${child.prelude}{${stringifyRaw(child)}}`;
    }
    return out;
  }
  var wrap = (conditions, inner) => conditions.reduceRight((acc, cond) => `${cond}{${acc}}`, inner);
  function flattenCss(css) {
    if (!css || !css.trim()) return "";
    const root = parse(css);
    const sink = { rules: [], verbatim: [] };
    const statements = root.declarations.filter((d) => STATEMENT.test(d));
    serialize(root, [], [], sink);
    return [
      ...statements.map((s) => s + ";"),
      ...sink.verbatim,
      ...sink.rules
    ].join("\n");
  }

  // src/fez/lib/morph.js
  function nodeMorph(target, newNode, opts = {}) {
    diffChildren(target, newNode, opts);
    const next = target.nextSibling;
    if (next?.nodeType === 3 && !next.textContent.trim()) {
      next.remove();
    }
  }
  function syncAttributes(oldNode, newNode) {
    const oldAttrs = oldNode.attributes;
    const newAttrs = newNode.attributes;
    const isActiveInput = oldNode === document.activeElement && isFormInput(oldNode);
    const newHasStyle = newNode.hasAttribute("style");
    const oldClass = oldNode.getAttribute("class") || "";
    const newClass = newNode.getAttribute("class") || "";
    const sameNamedClass = oldClass !== "" && oldClass === newClass;
    for (let i = oldAttrs.length - 1; i >= 0; i--) {
      const name = oldAttrs[i].name;
      if (!newNode.hasAttribute(name)) {
        if (name === "style" && !newHasStyle && sameNamedClass) continue;
        oldNode.removeAttribute(name);
      }
    }
    for (let i = 0; i < newAttrs.length; i++) {
      const attr = newAttrs[i];
      if (isActiveInput && (attr.name === "value" || attr.name === "checked")) {
        continue;
      }
      if (oldNode.getAttribute(attr.name) !== attr.value) {
        if (attr.name === "class") {
          syncClassList(oldNode, newNode);
        } else {
          try {
            oldNode.setAttribute(attr.name, attr.value);
          } catch (error) {
            console.error("Error setting attribute:", {
              node: oldNode,
              attribute: attr.name,
              error: error.message
            });
          }
        }
      }
    }
  }
  function syncInternalKeys(oldNode, newNode) {
    if (oldNode.nodeType !== 1 || newNode.nodeType !== 1) return;
    if (newNode._fezKey !== void 0) {
      oldNode._fezKey = newNode._fezKey;
    } else {
      delete oldNode._fezKey;
    }
  }
  function syncClassList(oldNode, newNode) {
    const oldClasses = new Set(
      (oldNode.getAttribute("class") || "").split(/\s+/).filter(Boolean)
    );
    const newClasses = new Set(
      (newNode.getAttribute("class") || "").split(/\s+/).filter(Boolean)
    );
    for (const cls of oldClasses) {
      if (!newClasses.has(cls)) {
        oldNode.classList.remove(cls);
      }
    }
    for (const cls of newClasses) {
      if (!oldClasses.has(cls)) {
        oldNode.classList.add(cls);
      }
    }
  }
  function isFormInput(node) {
    const tag = node.nodeName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
  }
  function builtinKey(node) {
    if (node.nodeType !== 1) return null;
    const keepKey = node.getAttribute?.("fez-keep");
    if (keepKey) return { key: "keep-" + keepKey, preserve: true };
    if (node._fezKey !== void 0) {
      return { key: "key-" + node._fezKey, preserve: false };
    }
    const fezKey = node.getAttribute?.("fez-key");
    if (fezKey) return { key: "key-" + fezKey, preserve: false };
    const key = node.getAttribute?.("key");
    if (key) return { key: "key-" + key, preserve: false };
    const id = node.id;
    if (id) return { key: "id-" + id, preserve: false };
    return null;
  }
  function describeOld(node, opts) {
    if (opts.describeOld) {
      const d = opts.describeOld(node);
      if (d) return d;
    }
    return builtinKey(node);
  }
  function describeNewKey(node, opts) {
    if (opts.describeNew) {
      const k = opts.describeNew(node);
      if (k) return k;
    }
    const b = builtinKey(node);
    return b ? b.key : null;
  }
  function diffChildren(target, newParent, opts) {
    const oldChildren = Array.from(target.childNodes).filter(isLive);
    const newChildren = Array.from(newParent.childNodes);
    if (oldChildren.length === 0 && newChildren.length === 0) return;
    if (oldChildren.length === 0) {
      for (const child of newChildren) {
        target.appendChild(child);
      }
      return;
    }
    if (newChildren.length === 0) {
      for (const child of oldChildren) {
        removeChild(target, child, opts);
      }
      return;
    }
    const oldByKey = /* @__PURE__ */ new Map();
    const oldDescriptors = /* @__PURE__ */ new Map();
    const addOldKey = (key, child) => {
      if (!oldByKey.has(key)) oldByKey.set(key, []);
      oldByKey.get(key).push(child);
    };
    for (const child of oldChildren) {
      const desc = describeOld(child, opts);
      if (!desc) continue;
      oldDescriptors.set(child, desc);
      addOldKey(desc.key, child);
      if (desc.aliases) {
        for (const alias of desc.aliases) {
          addOldKey(alias, child);
        }
      }
    }
    const matches = [];
    const usedOld = /* @__PURE__ */ new Set();
    for (let i = 0; i < newChildren.length; i++) {
      const newChild = newChildren[i];
      const key = describeNewKey(newChild, opts);
      if (key && oldByKey.has(key)) {
        const oldBucket = oldByKey.get(key);
        while (oldBucket.length && usedOld.has(oldBucket[0])) {
          oldBucket.shift();
        }
        const oldChild = oldBucket.shift();
        if (!oldChild) {
          matches.push({ old: null, new: newChild, preserve: false });
          continue;
        }
        const desc = oldDescriptors.get(oldChild);
        const preserve = !!desc?.preserve;
        matches.push({ old: oldChild, new: newChild, preserve });
        usedOld.add(oldChild);
      } else {
        matches.push({ old: null, new: newChild, preserve: false });
      }
    }
    const unmatchedOld = oldChildren.filter((c) => !usedOld.has(c));
    const candidates = [];
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].old) continue;
      const newChild = matches[i].new;
      if (newChild.nodeType === 1) {
        const b = builtinKey(newChild);
        if (b?.preserve) continue;
      }
      for (let j = 0; j < unmatchedOld.length; j++) {
        const candidate = unmatchedOld[j];
        if (candidate.nodeType === 1) {
          const desc = oldDescriptors.get(candidate);
          if (desc?.preserve) continue;
          if (desc && desc.softMatch === false) continue;
        }
        const score = scoreSoftMatch(candidate, newChild);
        if (score > 0) {
          candidates.push({ matchIdx: i, oldIdx: j, score });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const usedOldIdx = /* @__PURE__ */ new Set();
    const assignedMatch = /* @__PURE__ */ new Set();
    for (const c of candidates) {
      if (assignedMatch.has(c.matchIdx) || usedOldIdx.has(c.oldIdx)) continue;
      matches[c.matchIdx].old = unmatchedOld[c.oldIdx];
      usedOld.add(unmatchedOld[c.oldIdx]);
      usedOldIdx.add(c.oldIdx);
      assignedMatch.add(c.matchIdx);
    }
    for (const child of oldChildren) {
      if (!usedOld.has(child)) {
        removeChild(target, child, opts);
      }
    }
    let cursor = nextLive(target.firstChild);
    for (const match of matches) {
      if (match.old) {
        const oldChild = match.old;
        const newChild = match.new;
        if (match.preserve) {
          if (opts.shouldPreserve && !opts.shouldPreserve(oldChild, newChild)) {
            target.insertBefore(newChild, oldChild);
            removeChild(target, oldChild, opts);
            cursor = nextLive(newChild.nextSibling);
            continue;
          }
          if (opts.onPreserve) opts.onPreserve(oldChild, newChild);
          syncInternalKeys(oldChild, newChild);
          if (oldChild !== cursor) {
            target.insertBefore(oldChild, cursor);
          } else {
            cursor = nextLive(cursor.nextSibling);
          }
          continue;
        }
        if (oldChild.nodeType === 3 && newChild.nodeType === 3) {
          if (oldChild.textContent !== newChild.textContent) {
            oldChild.textContent = newChild.textContent;
          }
        } else if (oldChild.nodeType === 8 && newChild.nodeType === 8) {
          if (oldChild.textContent !== newChild.textContent) {
            oldChild.textContent = newChild.textContent;
          }
        } else if (oldChild.nodeType === 1 && newChild.nodeType === 1) {
          if (opts.skipNode && opts.skipNode(oldChild)) {
          } else if (oldChild.nodeName === newChild.nodeName) {
            syncAttributes(oldChild, newChild);
            syncInternalKeys(oldChild, newChild);
            diffChildren(oldChild, newChild, opts);
            syncDomProperties(oldChild, newChild);
          } else {
            const replacement = newChild;
            target.insertBefore(replacement, oldChild);
            removeChild(target, oldChild, opts);
            cursor = nextLive(replacement.nextSibling);
            continue;
          }
        } else {
          target.insertBefore(newChild, oldChild);
          removeChild(target, oldChild, opts);
          cursor = nextLive(newChild.nextSibling);
          continue;
        }
        if (oldChild !== cursor) {
          target.insertBefore(oldChild, cursor);
        } else {
          cursor = nextLive(cursor.nextSibling);
        }
      } else {
        target.insertBefore(match.new, cursor);
      }
    }
  }
  function syncDomProperties(oldNode, newNode) {
    if (oldNode.nodeType !== 1 || newNode.nodeType !== 1) return;
    const isActiveInput = oldNode === document.activeElement && isFormInput(oldNode);
    const tag = oldNode.nodeName;
    if ("disabled" in oldNode) {
      syncBooleanProperty(oldNode, newNode, "disabled");
    }
    if (tag === "INPUT") {
      const type = (oldNode.getAttribute("type") || "").toLowerCase();
      if (!isActiveInput && newNode.hasAttribute("value")) {
        oldNode.value = newNode.getAttribute("value");
      }
      if (!isActiveInput && (type === "checkbox" || type === "radio")) {
        syncBooleanProperty(oldNode, newNode, "checked");
      }
    } else if (tag === "TEXTAREA") {
      if (!isActiveInput) oldNode.value = newNode.value;
    } else if (tag === "SELECT") {
      if (!isActiveInput) oldNode.value = newNode.value;
    } else if (tag === "OPTION") {
      syncBooleanProperty(oldNode, newNode, "selected");
    }
  }
  function booleanAttrEnabled(node, attr) {
    if (!node.hasAttribute(attr)) return false;
    return !["false", "null", "undefined"].includes(node.getAttribute(attr));
  }
  function syncBooleanProperty(oldNode, newNode, attr) {
    const enabled = booleanAttrEnabled(newNode, attr);
    oldNode[attr] = enabled;
    if (!enabled) oldNode.removeAttribute(attr);
  }
  function getClassSet(node) {
    if (node._morphClassSet) return node._morphClassSet;
    const raw = node.getAttribute?.("class");
    const result = raw ? new Set(raw.split(/\s+/).filter(Boolean)) : null;
    node._morphClassSet = result;
    return result;
  }
  function scoreSoftMatch(oldNode, newNode) {
    if (oldNode.nodeType !== newNode.nodeType) return 0;
    if (oldNode.nodeType !== 1) return 1;
    if (oldNode.nodeName !== newNode.nodeName) return 0;
    let score = 1;
    const oldSet = getClassSet(oldNode);
    const newSet = getClassSet(newNode);
    if (oldSet && newSet) {
      for (const cls of newSet) {
        if (oldSet.has(cls)) score += 3;
      }
    } else if (!oldSet && !newSet) {
      score += 1;
    }
    if (oldNode.attributes && newNode.attributes && oldNode.attributes.length === newNode.attributes.length) {
      score += 2;
    }
    return score;
  }
  function callBeforeRemoveDeep(node, opts) {
    if (!opts.beforeRemove) return;
    opts.beforeRemove(node);
    if (node.querySelectorAll) {
      node.querySelectorAll(".fez").forEach((child) => {
        opts.beforeRemove(child);
      });
    }
  }
  function removeChild(target, child, opts) {
    if (child.nodeType === 1) {
      callBeforeRemoveDeep(child, opts);
    }
    if (opts.removeNode) {
      opts.removeNode(target, child);
    } else {
      target.removeChild(child);
    }
  }
  function isLive(node) {
    return !node._fezLeaving;
  }
  function nextLive(node) {
    while (node && node._fezLeaving) node = node.nextSibling;
    return node;
  }

  // src/fez/lib/fez-morph.js
  function hashText(text) {
    text = String(text || "").trim();
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }
  function signatureHash(node) {
    if (node._fezSigHash) return node._fezSigHash;
    const text = String(node?._fezSignature ?? node?.outerHTML ?? "").trim();
    const result = hashText(text);
    node._fezSigHash = result;
    return result;
  }
  function innerFromOuterHtml(html) {
    const src = String(html || "");
    const start = src.indexOf(">");
    const end = src.lastIndexOf("<");
    if (start < 0 || end <= start) return "";
    return src.slice(start + 1, end);
  }
  function shouldPreserveFezComponent(oldNode, newNode) {
    if (!oldNode?.fez || oldNode.fez._destroyed) return true;
    if (oldNode._fezSignature == null) return true;
    if (!newNode || newNode.nodeType !== 1) return true;
    return hashText(innerFromOuterHtml(oldNode._fezSignature)) === hashText(newNode.innerHTML);
  }
  function explicitFezKey(node) {
    return node._fezKey ?? node.getAttribute?.("fez-key") ?? void 0;
  }
  function fezKeyAlias(internalKey, keyAttr, base, node) {
    if (internalKey !== void 0) return "key-" + internalKey;
    if (keyAttr) return "key-" + keyAttr;
    return `${base}:sig-${signatureHash(node)}`;
  }
  function fezDescribeOld(node) {
    if (node.nodeType !== 1) return null;
    if (!node.classList?.contains("fez") || !node.fez) return null;
    const aliases = [];
    if (node.id) aliases.push("id-" + node.id);
    const internalKey = explicitFezKey(node);
    if (internalKey !== void 0) aliases.push("key-" + internalKey);
    const keyAttr = node.getAttribute?.("key");
    if (keyAttr) aliases.push("key-" + keyAttr);
    if (node.classList) {
      for (const cls of node.classList) {
        if (cls.startsWith("fez-") && cls !== "fez") {
          aliases.push(`fez-class-${cls}:sig-${signatureHash(node)}`);
          break;
        }
      }
    }
    return {
      key: "fez-uid-" + node.fez.UID,
      aliases,
      preserve: true,
      softMatch: false
    };
  }
  function refreshPreservedComponent(oldNode, newNode) {
    const fez = oldNode.fez;
    if (!fez || fez._destroyed) return;
    let nextProps = fez._propsRaw || fez.props || {};
    if (newNode && fez.class?.getProps) {
      nextProps = fez.class.getProps(newNode, oldNode);
    }
    const prevProps = fez._propsRaw || fez.props || {};
    const keys = /* @__PURE__ */ new Set([
      ...Object.keys(prevProps),
      ...Object.keys(nextProps)
    ]);
    const changedKeys = [];
    for (const key of keys) {
      if (prevProps[key] !== nextProps[key]) changedKeys.push(key);
    }
    fez.props = nextProps;
    if (changedKeys.length) {
      for (const key of changedKeys) {
        fez.onPropsChange(key, nextProps[key] ?? null);
      }
      fez.refresh();
    }
    fez.onRefresh(fez.props);
  }
  function attachMorph(Fez3) {
    function fezDescribeNew(node) {
      if (node.nodeType !== 1) return null;
      const internalKey = explicitFezKey(node);
      const keyAttr = node.getAttribute?.("key");
      if (node.classList?.contains("fez")) {
        for (const cls of node.classList) {
          if (cls.startsWith("fez-") && cls !== "fez") {
            return fezKeyAlias(internalKey, keyAttr, "fez-class-" + cls, node);
          }
        }
      }
      const tag = node.tagName?.toLowerCase();
      if (tag && Fez3.index?.[tag]) {
        return fezKeyAlias(internalKey, keyAttr, "fez-class-fez-" + tag, node);
      }
      const fezAttr = node.getAttribute?.("fez");
      if (fezAttr && Fez3.index?.[fezAttr]) {
        const attrKey = node.getAttribute?.("fez-key") ?? void 0;
        return fezKeyAlias(attrKey, keyAttr, "fez-class-fez-" + fezAttr, node);
      }
      return null;
    }
    const fezMorphOpts = {
      describeOld: fezDescribeOld,
      describeNew: fezDescribeNew,
      // Defensive: if a fez component slips past keying, still skip its subtree
      skipNode: (oldNode) => {
        if (oldNode.classList?.contains("fez") && oldNode.fez && !oldNode.fez._destroyed) {
          if (Fez3.LOG) {
            console.log(
              `Fez: preserved child component ${oldNode.fez.fezName} (UID ${oldNode.fez.UID})`
            );
          }
          return true;
        }
        return false;
      },
      // Keyed preserve is only valid when source (attrs + slot content) still matches
      shouldPreserve: shouldPreserveFezComponent,
      // Cleanup destroyed fez components
      beforeRemove: (node) => {
        if (node.classList?.contains("fez") && node.fez) {
          node.fez.fezOnDestroy?.();
        }
      },
      // fez:out - play the outro, detach when done. The node stays in the DOM
      // flagged _fezLeaving so the differ ignores it (see morph.js).
      removeNode: (parent, node) => {
        if (node.nodeType === 1 && node._fezOut && node.isConnected && !node._fezLeaving) {
          node._fezLeaving = true;
          node.style.pointerEvents = "none";
          runTransition(node, node._fezOut, "out").then(() => node.remove());
        } else {
          parent.removeChild(node);
        }
      },
      // Notify preserved fez children that their parent re-rendered
      onPreserve: (oldNode, newNode) => {
        if (oldNode.classList?.contains("fez") && oldNode.fez && !oldNode.fez._destroyed) {
          refreshPreservedComponent(oldNode, newNode);
        }
      }
    };
    Fez3.morphdom = (target, newNode) => {
      nodeMorph(target, newNode, fezMorphOpts);
    };
    Fez3.nodeMorph = (target, src, opts = {}) => {
      if (!target || target.nodeType !== 1) {
        Fez3.onError("nodeMorph", "target must be an Element");
        return;
      }
      const tagName = target.tagName;
      const tagLower = tagName.toLowerCase();
      let newNode;
      if (typeof src === "string") {
        src = src.trim();
        const wrapper = document.createElement(tagLower);
        wrapper.innerHTML = src;
        if (wrapper.children.length === 1 && wrapper.firstElementChild.tagName === tagName && Array.from(wrapper.childNodes).every(
          (node) => node.nodeType !== 3 || !node.textContent.trim()
        )) {
          newNode = wrapper.firstElementChild;
        } else {
          newNode = wrapper;
        }
      } else if (src && src.nodeType === 11) {
        newNode = document.createElement(tagLower);
        newNode.appendChild(src);
      } else if (src && src.nodeType === 1) {
        if (src.tagName === tagName) {
          newNode = src;
        } else {
          newNode = document.createElement(tagLower);
          newNode.appendChild(src);
        }
      } else {
        Fez3.onError("nodeMorph", "src must be a string, Element, or DocumentFragment");
        return;
      }
      nodeMorph(target, newNode, { ...fezMorphOpts, ...opts });
    };
  }

  // src/fez/utils/dump.js
  var log_pretty_print = (html) => {
    const parts = html.split(/(<\/?[^>]+>)/g).map((p) => p.trim()).filter((p) => p);
    let indent = 0;
    const lines = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const nextPart = parts[i + 1];
      const nextNextPart = parts[i + 2];
      if (part.startsWith("<")) {
        if (!part.startsWith("</") && !part.endsWith("/>") && nextPart && !nextPart.startsWith("<") && nextNextPart && nextNextPart.startsWith("</")) {
          const actualIndent = Math.max(0, indent);
          lines.push("  ".repeat(actualIndent) + part + nextPart + nextNextPart);
          i += 2;
        } else if (part.startsWith("</")) {
          indent--;
          const actualIndent = Math.max(0, indent);
          lines.push("  ".repeat(actualIndent) + part);
        } else if (part.endsWith("/>") || part.includes(" />")) {
          const actualIndent = Math.max(0, indent);
          lines.push("  ".repeat(actualIndent) + part);
        } else {
          const actualIndent = Math.max(0, indent);
          lines.push("  ".repeat(actualIndent) + part);
          indent++;
        }
      } else if (part) {
        const actualIndent = Math.max(0, indent);
        lines.push("  ".repeat(actualIndent) + part);
      }
    }
    return lines.join("\n");
  };
  var LOG = (() => {
    const logs = [];
    const logTypes = [];
    let currentIndex = 0;
    let renderContent = null;
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        const dialog = document.getElementById("dump-dialog");
        const button = document.getElementById("log-reopen-button");
        if (dialog) {
          dialog.remove();
          createLogButton();
        } else if (button) {
          button.remove();
          showLogDialog();
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        const dialog = document.getElementById("dump-dialog");
        if (dialog && logs.length > 0) {
          e.preventDefault();
          if (e.key === "ArrowLeft" && currentIndex > 0) {
            currentIndex--;
            localStorage.setItem("_LOG_INDEX", currentIndex);
            renderContent();
          } else if (e.key === "ArrowRight" && currentIndex < logs.length - 1) {
            currentIndex++;
            localStorage.setItem("_LOG_INDEX", currentIndex);
            renderContent();
          } else if (e.key === "ArrowUp" && currentIndex > 0) {
            currentIndex = Math.max(0, currentIndex - 5);
            localStorage.setItem("_LOG_INDEX", currentIndex);
            renderContent();
          } else if (e.key === "ArrowDown" && currentIndex < logs.length - 1) {
            currentIndex = Math.min(logs.length - 1, currentIndex + 5);
            localStorage.setItem("_LOG_INDEX", currentIndex);
            renderContent();
          }
        }
      }
    });
    const createLogButton = () => {
      let btn = document.getElementById("log-reopen-button");
      if (!btn) {
        btn = document.body.appendChild(document.createElement("button"));
        btn.id = "log-reopen-button";
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>LOG';
        btn.style.cssText = "position:fixed; top: 10px; right: 10px;padding:10px 20px;background:#ff3333;color:#fff;border:none;cursor:pointer;font:14px/1.4 monospace;z-index:2147483647;border-radius:8px;display:flex;align-items:center;opacity:1;visibility:visible;box-shadow:0 4px 12px rgba(255,51,51,0.3)";
        btn.onclick = () => {
          btn.remove();
          showLogDialog();
        };
      }
    };
    const showLogDialog = () => {
      const existingBtn = document.getElementById("log-reopen-button");
      if (existingBtn) existingBtn.remove();
      let d = document.getElementById("dump-dialog");
      if (!d) {
        d = document.body.appendChild(document.createElement("div"));
        d.id = "dump-dialog";
        d.style.cssText = "position:fixed; top:20px; left:20px; right:20px; max-height:calc(100vh - 40px);background:#fff; border:1px solid #333; box-shadow:0 0 10px rgba(0,0,0,0.5);padding:20px; overflow:auto; z-index:2147483646; font:13px/1.4 monospace;white-space:pre; display:block; opacity:1; visibility:visible";
      }
      const savedIndex = parseInt(localStorage.getItem("_LOG_INDEX"));
      if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < logs.length) {
        currentIndex = savedIndex;
      } else {
        currentIndex = logs.length - 1;
      }
      renderContent = () => {
        const buttons = logs.map((_, i) => {
          let bgColor = "#f0f0f0";
          if (i !== currentIndex) {
            if (logTypes[i] === "object") {
              bgColor = "#d6e3ef";
            } else if (logTypes[i] === "array") {
              bgColor = "#d8d5ef";
            }
          }
          return `<button style="font-size: 14px; font-weight: 400; padding:2px 6px; margin: 0 2px 2px 0;cursor:pointer;background:${i === currentIndex ? "#333" : bgColor};color:${i === currentIndex ? "#fff" : "#000"}" data-index="${i}">${i + 1}</button>`;
        }).join("");
        d.innerHTML = '<div style="display:flex;flex-direction:column;height:100%"><div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px"><div style="display:flex;flex-wrap:wrap;gap:4px;flex:1;margin-right:10px">' + buttons + '</div><div style="display:flex;gap:4px;flex-shrink:0"><button data-action="clear" style="padding:4px 8px;cursor:pointer">clear all</button><button data-action="close" style="padding:4px 8px;cursor:pointer">&times;</button></div></div><xmp style="font-family:monospace;flex:1;overflow:auto;margin:0;padding:0;color:#000;background:#fff;font-size:14px;line-height:22px">' + logs[currentIndex] + "</xmp></div>";
        d.querySelector('button[data-action="close"]').onclick = () => {
          d.remove();
          createLogButton();
        };
        d.querySelector('button[data-action="clear"]').onclick = () => {
          logs.length = 0;
          logTypes.length = 0;
          currentIndex = 0;
          localStorage.removeItem("_LOG_INDEX");
          d.remove();
          const btn = document.getElementById("log-reopen-button");
          if (btn) btn.remove();
        };
        d.querySelectorAll("button[data-index]").forEach((btn) => {
          btn.onclick = () => {
            currentIndex = parseInt(btn.dataset.index);
            localStorage.setItem("_LOG_INDEX", currentIndex);
            renderContent();
          };
        });
      };
      renderContent();
    };
    return (o) => {
      if (!document.body) {
        window.requestAnimationFrame(() => LOG(o));
        return;
      }
      let originalType = typeof o;
      if (o instanceof Node) {
        if (o.nodeType === Node.TEXT_NODE) {
          o = o.textContent || String(o);
        } else {
          o = log_pretty_print(o.outerHTML);
        }
      }
      if (o === void 0) {
        o = "undefined";
      }
      if (o === null) {
        o = "null";
      }
      if (Array.isArray(o)) {
        originalType = "array";
      } else if (typeof o === "object" && o !== null) {
        originalType = "object";
      }
      if (typeof o != "string") {
        o = JSON.stringify(
          o,
          (key, value) => {
            if (typeof value === "function") {
              return String(value);
            }
            return value;
          },
          2
        ).replaceAll("<", "&lt;");
      }
      o = o.trim();
      logs.push(o + `

type: ${originalType}`);
      logTypes.push(originalType);
      currentIndex = logs.length - 1;
      localStorage.setItem("_LOG_INDEX", currentIndex);
      if (document.getElementById("dump-dialog")) {
        if (renderContent) renderContent();
      } else {
        showLogDialog();
      }
    };
  })();
  if (typeof window !== "undefined" && !window.LOG) {
    window.LOG = LOG;
  }
  var dump_default = LOG;

  // src/fez/utils/highlight_all.js
  var highlightAll = () => {
    const port = parseInt(window.location.port) || 80;
    if (!(Fez.DEV === true || port > 2999 && Fez.DEV !== false)) return;
    const existingHighlights = document.querySelectorAll(".fez-highlight-overlay");
    if (existingHighlights.length > 0) {
      existingHighlights.forEach((el) => el.remove());
      return;
    }
    const allElements = document.querySelectorAll(".fez, .svelte");
    allElements.forEach((el) => {
      let componentName = null;
      let componentType = null;
      if (el.classList.contains("fez") && el.fez && el.fez.fezName) {
        componentName = el.fez.fezName;
        componentType = "fez";
      } else if (el.classList.contains("svelte") && el.svelte && el.svelte.svelteName) {
        componentName = el.svelte.svelteName;
        componentType = "svelte";
      }
      if (componentName) {
        const overlay = document.createElement("div");
        overlay.className = "fez-highlight-overlay";
        const rect = el.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        overlay.style.cssText = `
        position: absolute;
        top: ${rect.top + scrollTop}px;
        left: ${rect.left + scrollLeft}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        border: 1px solid ${componentType === "svelte" ? "blue" : "red"};
        pointer-events: none;
        z-index: 9999;
      `;
        const label = document.createElement("div");
        label.textContent = componentName;
        label.style.cssText = `
        position: absolute;
        top: -20px;
        left: 0;
        background: ${componentType === "svelte" ? "blue" : "red"};
        color: white;
        padding: 4px 6px 2px 6px;
        font-size: 14px;
        font-family: monospace;
        line-height: 1;
        white-space: nowrap;
        cursor: pointer;
        pointer-events: auto;
        text-transform: uppercase;
      `;
        label.addEventListener("click", (e) => {
          e.stopPropagation();
          Fez.log(el);
        });
        overlay.appendChild(label);
        document.body.appendChild(overlay);
      }
    });
  };
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "e") {
      if (!event.target.closest("form")) {
        event.preventDefault();
        highlightAll();
      }
    }
  });
  var highlight_all_default = highlightAll;

  // src/fez/lib/close-custom-tags.js
  var SELF_CLOSING_TAGS = /* @__PURE__ */ new Set([
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
  function closeCustomTags(html) {
    return html.replace(
      /<([a-z][a-z-]*)\b((?:=>|[^>])*)>/g,
      (match, tag, attrs) => {
        if (!attrs.trimEnd().endsWith("/")) return match;
        if (SELF_CLOSING_TAGS.has(tag)) return match;
        return `<${tag}${attrs.replace(/\s*\/$/, "")}></${tag}>`;
      }
    );
  }

  // src/fez/connect.js
  var attrObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        const fez = mutation.target.fez;
        if (fez) {
          const name = mutation.attributeName;
          if (name === PROPS_ATTR) continue;
          const raw = mutation.target.getAttribute(name);
          const value = fez.class?.castProp ? fez.class.castProp(name, raw, fez.fezName) : raw;
          fez.props[name] = value;
          fez.onPropsChange(name, value);
        }
      }
    }
  });
  function connect(name, klass) {
    const Fez3 = globalThis.window?.Fez || globalThis.Fez;
    if (!name.includes("-")) {
      console.error(`Fez: Invalid name "${name}". Must contain a dash.`);
      return;
    }
    klass = ensureFezBase(Fez3, name, klass);
    if (klass.html) {
      if (/<slot\s[^>]*unwrap[\s>\/]/.test(klass.html)) {
        klass.fezSlotUnwrap = true;
      }
      klass.html = klass.html.replace(
        /<slot(\s[^>]*)?>/,
        `<div class="fez-slot" fez-keep="default-slot"$1>`
      ).replace("</slot>", `</div>`);
      klass.fezHtmlFunc = createTemplate(klass.html, { name });
    }
    if (klass.css) {
      Fez3.globalCss(klass.css, { name });
    }
    if (klass.cssGlobal) {
      Fez3.globalCss(klass.cssGlobal);
    }
    Fez3.index.ensure(name).class = klass;
    if (!customElements.get(name)) {
      customElements.define(
        name,
        class extends HTMLElement {
          connectedCallback() {
            if (document.readyState === "loading") {
              requestAnimationFrame(() => connectNode(name, this));
            } else {
              connectNode(name, this);
            }
          }
        }
      );
    }
  }
  function ensureFezBase(Fez3, name, klass) {
    if (klass.prototype instanceof FezBase) {
      if (klass.html) klass.html = closeCustomTags(klass.html);
      if (klass.PROPS) Fez3.index.ensure(name).props = klass.PROPS;
      return klass;
    }
    const instance = new klass();
    const newKlass = class extends FezBase {
    };
    const props = [
      ...Object.getOwnPropertyNames(instance),
      ...Object.getOwnPropertyNames(klass.prototype)
    ].filter((p) => p !== "constructor" && p !== "prototype");
    for (const prop of props) {
      newKlass.prototype[prop] = instance[prop];
    }
    const configMap = {
      GLOBAL: "GLOBAL",
      MOUNT: "MOUNT",
      NAME: "nodeName",
      PROPS: "PROPS"
    };
    for (const [from, to] of Object.entries(configMap)) {
      const value = instance[from] || klass[from];
      if (value) newKlass[to] = value;
    }
    if (instance.CSS) {
      newKlass.css = typeof instance.CSS === "function" ? instance.CSS() : instance.CSS;
    }
    if (instance.CSS_GLOBAL) {
      newKlass.cssGlobal = typeof instance.CSS_GLOBAL === "function" ? instance.CSS_GLOBAL() : instance.CSS_GLOBAL;
    }
    if (instance.HTML) {
      const html = typeof instance.HTML === "function" ? instance.HTML() : instance.HTML;
      newKlass.html = closeCustomTags(html);
    }
    if (instance.META) {
      newKlass.META = instance.META;
      Fez3.index.ensure(name).meta = instance.META;
    }
    if (newKlass.PROPS) {
      Fez3.index.ensure(name).props = newKlass.PROPS;
    }
    if (newKlass.GLOBAL && typeof newKlass.GLOBAL !== "string") {
      Fez3.onError(
        "compile",
        `<${name}>: GLOBAL must be a window name string, use MOUNT = true to auto-mount`
      );
      delete newKlass.GLOBAL;
    }
    if (newKlass.MOUNT) {
      Fez3.onReady(() => {
        if (!document.querySelector(`${name}, .fez-${name}`)) {
          document.body.appendChild(document.createElement(name));
        }
      });
    }
    Fez3.consoleLog(`${name} compiled`);
    return newKlass;
  }
  function connectNode(name, node) {
    if (!node.isConnected) return;
    if (node.classList?.contains("fez")) return;
    const klass = Fez.index[name]?.class;
    const nodeName = typeof klass.nodeName === "function" ? klass.nodeName(node) : klass.nodeName;
    const newNode = document.createElement(nodeName || "div");
    newNode.classList.add("fez", `fez-${name}`);
    if (!node.parentNode) {
      console.warn(`Fez: ${name} has no parent, skipping`);
      return;
    }
    node.parentNode.replaceChild(newNode, node);
    const fez = new klass();
    fez.UID = ++Fez.instanceCount;
    Fez.instances.set(fez.UID, fez);
    fez.oldRoot = node;
    fez.fezName = name;
    fez.root = newNode;
    fez.props = klass.getProps(node, newNode);
    fez.class = klass;
    newNode._fezSignature = node.outerHTML;
    fez.fezSlot(node, newNode);
    newNode.fez = fez;
    if (klass.GLOBAL) {
      window[klass.GLOBAL] = fez;
    }
    if (window.$) fez.$root = $(newNode);
    if (fez.props.id) newNode.setAttribute("id", fez.props.id);
    const key = node.getAttribute("key");
    if (key) newNode.setAttribute("key", key);
    if (node._fezKey !== void 0) newNode._fezKey = node._fezKey;
    const fezKey = node.getAttribute("fez-key");
    if (fezKey) newNode.setAttribute("fez-key", fezKey);
    const fezKeep = node.getAttribute("fez-keep");
    if (fezKeep) newNode.setAttribute("fez-keep", fezKeep);
    fez.fezRegister();
    if (fez.root.childNodes.length) {
      fez._fezSlotNodes = Array.from(fez.root.childNodes);
      fez._fezChildNodes = fez._fezSlotNodes.filter((n2) => n2.nodeType === 1);
    }
    fez._isInitializing = true;
    fez.fezSeedStateProps();
    const initMethod = fez.onInit || fez.init || fez.created || fez.connect;
    initMethod.call(fez, fez.props);
    fez.fezRender();
    fez._isInitializing = false;
    fez.onMount(fez.props);
    fez.onRefresh(fez.props);
    if (fez.onSubmit) {
      const form = fez.root.nodeName === "FORM" ? fez.root : fez.find("form");
      if (form) {
        form.onsubmit = (e) => {
          e.preventDefault();
          fez.onSubmit(fez.formData());
        };
      }
    }
    if (fez.onPropsChange) {
      attrObserver.observe(newNode, { attributes: true });
      for (const [key2, value] of Object.entries(fez.props)) {
        fez.onPropsChange(key2, value);
      }
    }
  }

  // src/fez/lib/source-parser.js
  var BLOCK_TAG_RE = /(^|\n)[ \t]*<(demo|info|script|head|style)\b([^>]*)>/gi;
  var DEFINITION_TAG_RE = /<(xmp|template)\b([^>]*)>/gi;
  var GLOBAL_ATTR = /(?:^|\s)global(?:\s*=\s*(?:""|''|"global"|'global'|global))?(?=\s|$)/i;
  var FEZ_ATTR = /(?:^|\s)fez\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i;
  var GENERATED_NOTICE_RE = /^<!-- generated from src: [^\r\n|]* \| DO NOT EDIT OR READ THIS FILE -->\r?\n?/;
  function lineAt(source, index2) {
    return source.slice(0, index2).split("\n").length;
  }
  function blockContent(raw) {
    return raw.replace(/^\r?\n/, "").replace(/\r?\n[ \t]*$/, "");
  }
  function contentLine(source, index2, raw) {
    return lineAt(source, index2) + (/^\r?\n/.test(raw) ? 1 : 0);
  }
  function findClosingTag(source, tag, from) {
    const close = new RegExp(`</${tag}\\s*>`, "gi");
    close.lastIndex = from;
    return close.exec(source);
  }
  function appendBlock(result, type, content) {
    const repeatable = type === "style" || type === "styleGlobal";
    if (repeatable && result[type]) {
      result[type] += `
${content}`;
    } else {
      result[type] = content;
    }
  }
  function dedent(text) {
    const lines = text.split("\n");
    const nonEmpty = lines.filter((line) => line.trim());
    if (!nonEmpty.length) {
      return text;
    }
    const indent = Math.min(...nonEmpty.map((line) => line.match(/^(\s*)/)[1].length));
    return indent ? lines.map((line) => line.slice(indent)).join("\n") : text;
  }
  function isGlobalStyleTag(attributes) {
    return GLOBAL_ATTR.test(attributes || "");
  }
  function parseFezSource(source, { dedentDocs = false } = {}) {
    const result = {
      script: "",
      style: "",
      styleGlobal: "",
      html: "",
      head: "",
      demo: "",
      info: "",
      blocks: [],
      errors: []
    };
    const counts = /* @__PURE__ */ new Map();
    let cursor = 0;
    let match;
    BLOCK_TAG_RE.lastIndex = 0;
    while (match = BLOCK_TAG_RE.exec(source)) {
      const openStart = match.index + match[1].length;
      const tag = match[2].toLowerCase();
      const type = tag === "style" && isGlobalStyleTag(match[3]) ? "styleGlobal" : tag;
      const rawStart = BLOCK_TAG_RE.lastIndex;
      const close = findClosingTag(source, tag, rawStart);
      result.html += source.slice(cursor, openStart);
      if (!close) {
        result.errors.push({
          kind: "Source",
          message: `Unclosed <${tag}> block`,
          line: lineAt(source, openStart)
        });
        cursor = source.length;
        break;
      }
      const raw = source.slice(rawStart, close.index);
      let content = blockContent(raw);
      if (type !== "demo" && type !== "info") {
        content = content.split("\n").map((line) => line.trim()).join("\n");
      }
      if (dedentDocs && (type === "demo" || type === "info")) {
        content = dedent(content);
      }
      const count = (counts.get(type) || 0) + 1;
      counts.set(type, count);
      if (count > 1 && type !== "style" && type !== "styleGlobal") {
        result.errors.push({
          kind: "Source",
          message: `Duplicate <${tag}> block`,
          line: lineAt(source, openStart)
        });
      }
      const block = {
        type,
        tag,
        content,
        line: lineAt(source, openStart),
        contentLine: contentLine(source, rawStart, raw)
      };
      result.blocks.push(block);
      appendBlock(result, type, content);
      cursor = close.index + close[0].length;
      BLOCK_TAG_RE.lastIndex = cursor;
    }
    result.html += source.slice(cursor);
    result.html = result.html.replace(GENERATED_NOTICE_RE, "");
    return result;
  }
  function protectedRanges(source) {
    const ranges = [];
    const open = /(^|\n)[ \t]*<(demo|info)\b[^>]*>/gi;
    let match;
    while (match = open.exec(source)) {
      const close = findClosingTag(source, match[2], open.lastIndex);
      if (!close) {
        break;
      }
      ranges.push([match.index + match[1].length, close.index + close[0].length]);
      open.lastIndex = close.index + close[0].length;
    }
    return ranges;
  }
  function extractFezDefinitions(source) {
    const definitions = [];
    const errors = [];
    const protectedSections = protectedRanges(source);
    let match;
    DEFINITION_TAG_RE.lastIndex = 0;
    while (match = DEFINITION_TAG_RE.exec(source)) {
      const openStart = match.index;
      if (protectedSections.some(([start, end]) => openStart >= start && openStart < end)) {
        continue;
      }
      const fez = match[2].match(FEZ_ATTR);
      if (!fez) {
        continue;
      }
      const tag = match[1].toLowerCase();
      const name = fez[1] || fez[2] || fez[3];
      const rawStart = DEFINITION_TAG_RE.lastIndex;
      const close = findClosingTag(source, tag, rawStart);
      if (!close) {
        errors.push({
          kind: "Source",
          message: `Unclosed <${tag} fez="${name}"> definition`,
          line: lineAt(source, openStart)
        });
        break;
      }
      const raw = source.slice(rawStart, close.index);
      definitions.push({
        name,
        tag,
        source: blockContent(raw),
        line: lineAt(source, openStart),
        contentLine: contentLine(source, rawStart, raw),
        start: openStart,
        end: close.index + close[0].length
      });
      DEFINITION_TAG_RE.lastIndex = close.index + close[0].length;
    }
    return { definitions, errors };
  }
  function stripFezDefinitions(source) {
    const { definitions } = extractFezDefinitions(source);
    if (!definitions.length) {
      return source;
    }
    let outer = "";
    let cursor = 0;
    for (const definition of definitions) {
      outer += source.slice(cursor, definition.start);
      cursor = definition.end;
    }
    return outer + source.slice(cursor);
  }
  function hasFezDefinitions(source) {
    return extractFezDefinitions(source).definitions.length > 0;
  }

  // src/fez/compile.js
  var compileCache = /* @__PURE__ */ new Map();
  var STYLE_SCOPE_ERRORS = {
    body: "body { } in a scoped <style>. Move these rules to <style global>.",
    host: ":host is not supported. <style> is already scoped - use `&` for the root node.",
    fez: ":fez is no longer an author-facing selector. <style> is already scoped - use `&` for the root node.",
    globalInGlobal: ":global() inside <style global>. These rules are already global - drop the wrapper."
  };
  function withoutComments(style) {
    return style.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^([ \t]*)\/\/[^\n]*/gm, (m, indent) => indent + " ".repeat(m.length - indent.length));
  }
  function escapeTemplateLiteral(value) {
    return String(value).replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("$", "\\$");
  }
  function assertStyleScope(tagName, rawStyle, isGlobal) {
    if (!rawStyle) return;
    const style = withoutComments(rawStyle);
    const fail = (message) => {
      throw new Error(`<${tagName}> style error: ${message}`);
    };
    if (!isGlobal && /(?:^|\s)body\s*\{/.test(style)) {
      fail(STYLE_SCOPE_ERRORS.body);
    }
    if (/:host\b/.test(style)) {
      fail(STYLE_SCOPE_ERRORS.host);
    }
    if (/:fez\b/.test(style)) {
      fail(STYLE_SCOPE_ERRORS.fez);
    }
    if (isGlobal && /:global\(/.test(style)) {
      fail(STYLE_SCOPE_ERRORS.globalInGlobal);
    }
  }
  function hasTopLevelFezElements(html) {
    return !!html && hasFezDefinitions(html);
  }
  function compile(tagName, html) {
    if (arguments.length === 1) {
      return compileBulk(tagName);
    }
    if (hasTopLevelFezElements(html)) {
      if (tagName) {
        Fez.index.ensure(tagName).source = html;
        indexFileDocs(tagName, html);
      }
      return compileBulk(html);
    }
    if (tagName && !tagName.includes("-") && !tagName.includes(".") && !tagName.includes("/")) {
      console.error(
        `Fez: Invalid name "${tagName}". Must contain a dash (e.g., 'my-element').`
      );
      return;
    }
    Fez.index.ensure(tagName).source = html;
    const cached = compileCache.get(tagName);
    if (cached?.html === html && Fez.index[tagName]?.class) {
      return Fez.index[tagName].class;
    }
    const classCode = generateClassCode(tagName, compileToClass(html));
    hideCustomElement(tagName);
    executeClassCode(tagName, classCode);
    compileCache.set(tagName, { html });
    return Fez.index[tagName]?.class;
  }
  function compileBulk(data) {
    if (data instanceof Node) {
      const node = data;
      node.remove();
      const fezName = node.getAttribute("fez");
      if (fezName?.includes(".") || fezName?.includes("/")) {
        return compileFromUrl(fezName);
      }
      if (fezName && !fezName.includes("-")) {
        console.error(`Fez: Invalid name "${fezName}". Must contain a dash.`);
        return;
      }
      return compile(fezName, node.innerHTML);
    }
    const root = data ? Fez.domRoot(data) : document.body;
    root.querySelectorAll("template[fez], xmp[fez]").forEach((n2) => compileBulk(n2));
  }
  function compileFromUrl(url) {
    Fez.consoleLog(`Loading from ${url}`);
    if (url.endsWith(".txt")) {
      Fez.head({ fez: url });
      return;
    }
    Fez.fetch(url).then((content) => {
      const doc = new DOMParser().parseFromString(content, "text/html");
      const fezElements = doc.querySelectorAll("template[fez], xmp[fez]");
      if (fezElements.length > 0) {
        const fileName = url.split("/").pop().split(".")[0];
        indexFileDocs(fileName, content);
        fezElements.forEach((el) => {
          const name = el.getAttribute("fez");
          if (name && !name.includes("-") && !name.includes(".") && !name.includes("/")) {
            console.error(`Fez: Invalid name "${name}". Must contain a dash.`);
            return;
          }
          compile(name, el.innerHTML);
        });
      } else {
        const name = url.split("/").pop().split(".")[0];
        compile(name, content);
      }
    }).catch((error) => {
      Fez.onError("compile", `Load error for "${url}": ${error.message}`);
    });
  }
  function compileToClass(html) {
    const result = parseFezSource(html, { dedentDocs: true });
    if (result.errors.length) throw new Error(result.errors[0].message);
    result.html = result.html.split("\n").map((line) => line.trim()).join("\n");
    if (result.head) {
      processHeadElements(result.head);
    }
    return result;
  }
  function indexFileDocs(name, source) {
    const parts = compileToClass(stripFezDefinitions(source));
    if (parts.info?.trim()) {
      Fez.index.ensure(name).info = parts.info;
    }
    if (parts.demo?.trim()) {
      Fez.index.ensure(name).demo = parts.demo;
    }
  }
  function processHeadElements(headHtml) {
    const container = Fez.domRoot(headHtml);
    Array.from(container.children).forEach((node) => {
      if (node.tagName === "SCRIPT") {
        const script = document.createElement("script");
        Array.from(node.attributes).forEach((attr) => {
          script.setAttribute(attr.name, attr.value);
        });
        script.type ||= "text/javascript";
        if (node.src) {
          document.head.appendChild(script);
        } else if (script.type.includes("javascript") || script.type === "module") {
          script.textContent = node.textContent;
          document.head.appendChild(script);
        }
      } else {
        document.head.appendChild(node.cloneNode(true));
      }
    });
  }
  function generateClassCode(tagName, parts) {
    let klass = parts.script;
    if (!/class\s+\{/.test(klass)) {
      klass = `class {
${klass}
}`;
    }
    assertStyleScope(tagName, parts.style, false);
    assertStyleScope(tagName, parts.styleGlobal, true);
    if (String(parts.style).includes(":")) {
      const css = escapeTemplateLiteral(parts.style);
      klass = klass.replace(/\}\s*$/, `
  CSS = \`:fez {
${css}
}\`
}`);
    }
    if (String(parts.styleGlobal).includes(":")) {
      const cssGlobal = escapeTemplateLiteral(parts.styleGlobal);
      klass = klass.replace(/\}\s*$/, `
  CSS_GLOBAL = \`${cssGlobal}\`
}`);
    }
    if (/\w/.test(String(parts.html))) {
      const html = parts.html.replaceAll("`", "&#x60;").replaceAll("$", "\\$");
      klass = klass.replace(/\}\s*$/, `
  HTML = \`${html}\`
}`);
    }
    if (parts.demo?.trim()) {
      Fez.index.ensure(tagName).demo = closeCustomTags(parts.demo);
    }
    if (parts.info?.trim()) {
      Fez.index.ensure(tagName).info = closeCustomTags(parts.info);
    }
    const [before, after] = klass.split(/class\s+\{/, 2);
    return `${before};

window.Fez('${tagName}', class {
${after})`;
  }
  function executeClassCode(tagName, code) {
    if (code.includes("import ")) {
      const importmapRe = /Fez\.head\(\s*\{\s*importmap\s*:\s*(\{[\s\S]*?\})\s*\}\s*\)\s*;?/g;
      const collectedImports = {};
      let match;
      while ((match = importmapRe.exec(code)) !== null) {
        try {
          const imports = new Function(`return ${match[1]}`)();
          Object.assign(collectedImports, imports);
          const sorted = Object.entries(imports).sort(
            (a, b) => b[0].length - a[0].length
          );
          for (const [specifier, url] of sorted) {
            const escaped = specifier.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
            code = code.replace(
              new RegExp(`(from\\s+['"])${escaped}`, "g"),
              `$1${url}`
            );
          }
        } catch (e) {
          Fez.consoleError(`importmap parse error: ${e.message}`);
        }
      }
      code = code.replace(importmapRe, "");
      if (Object.keys(collectedImports).length > 0) {
        installImportmap(collectedImports);
      }
      Fez.head({ script: code }, (err) => {
        if (err) {
          Fez.consoleError(`Template "${tagName}" module load failed: ${err.message || err}`);
          return;
        }
        queueMicrotask(() => {
          if (!Fez.index[tagName]?.class) {
            Fez.consoleError(`Template "${tagName}" possible compile error.`);
          }
        });
      });
    } else {
      try {
        new Function(code)();
      } catch (e) {
        Fez.consoleError(`Template "${tagName}" compile error: ${e.message}`);
        console.log(code);
      }
    }
  }
  function installImportmap(imports) {
    if (typeof document === "undefined") return;
    if (!document.head?.appendChild) return;
    if (document.querySelector('script[type="importmap"]')) return;
    try {
      const el = document.createElement("script");
      el.type = "importmap";
      el.textContent = JSON.stringify({ imports });
      document.head.insertBefore(el, document.head.firstChild);
    } catch {
    }
  }
  var hiddenTags = /* @__PURE__ */ new Set();
  function hideCustomElement(tagName) {
    if (!tagName || hiddenTags.has(tagName)) return;
    hiddenTags.add(tagName);
    let styleEl = document.getElementById("fez-hidden-styles");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "fez-hidden-styles";
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `${[...hiddenTags].sort().join(", ")} { display: none; }
`;
  }

  // src/fez/lib/global-state.js
  var GlobalState = {
    data: {},
    subs: /* @__PURE__ */ new Map(),
    // key -> Set of { fn, fez? }
    anySubs: /* @__PURE__ */ new Set(),
    // Set of fn listening to every key
    // `writer` is the component behind a this.globalState write (internal),
    // so its own listener can tell a self-write apart from an outside one
    set(key, value, writer) {
      const oldValue = this.data[key];
      if (oldValue === value) return;
      this.data[key] = value;
      this.notify(key, value, oldValue, writer);
    },
    get(key) {
      return this.data[key];
    },
    notify(key, value, oldValue, writer) {
      Fez.consoleLog(`Global state change for ${key}: ${value} (from ${oldValue})`);
      const subs = this.subs.get(key);
      if (subs) {
        for (const sub of subs) {
          if (sub.fez && !sub.fez.isConnected) {
            subs.delete(sub);
            continue;
          }
          try {
            sub.fn(value, oldValue, key, writer);
          } catch (error) {
            console.error(`Error in subscriber for key ${key}:`, error);
          }
        }
      }
      for (const fn of this.anySubs) {
        try {
          fn(key, value, oldValue);
        } catch (error) {
          console.error("Error in global subscriber:", error);
        }
      }
    },
    addSub(key, sub) {
      if (!this.subs.has(key)) this.subs.set(key, /* @__PURE__ */ new Set());
      this.subs.get(key).add(sub);
      return () => {
        const subs = this.subs.get(key);
        if (!subs) return;
        subs.delete(sub);
        if (subs.size === 0) this.subs.delete(key);
      };
    },
    // Subscribe to state changes, returns unsubscribe function
    //   Fez.state.subscribe(func)      - listen to all changes
    //   Fez.state.subscribe(key, func) - listen to specific key changes
    subscribe(keyOrFunc, func) {
      if (typeof keyOrFunc === "function") {
        this.anySubs.add(keyOrFunc);
        return () => this.anySubs.delete(keyOrFunc);
      }
      return this.addSub(keyOrFunc, { fn: func });
    },
    // Execute function for each connected component listening to a key
    forEach(key, func) {
      const subs = this.subs.get(key);
      if (!subs) return;
      for (const sub of subs) {
        if (!sub.fez) continue;
        if (sub.fez.isConnected) {
          func(sub.fez);
        } else {
          subs.delete(sub);
        }
      }
    },
    createProxy(component) {
      const keys = /* @__PURE__ */ new Map();
      component.addOnDestroy(() => {
        keys.forEach((unsub) => unsub());
        keys.clear();
      });
      const listen = (key) => {
        if (keys.has(key)) return;
        const fn = (value, oldValue, _key, writer) => {
          component.onGlobalStateChange(key, value, oldValue);
          const selfWrite = writer === component && (component._isRendering || component._isInitializing);
          if (!selfWrite) {
            component.fezNextTick(component.fezRender, "fezRender");
          }
        };
        keys.set(key, this.addSub(key, { fn, fez: component }));
      };
      return new Proxy(
        {},
        {
          get: (_, key) => {
            if (typeof key === "symbol") return void 0;
            listen(key);
            return this.data[key];
          },
          set: (_, key, value) => {
            if (typeof key !== "symbol") this.set(key, value, component);
            return true;
          },
          has: (_, key) => typeof key !== "symbol" && key in this.data
        }
      );
    }
  };
  var global_state_default = GlobalState;

  // src/fez/lib/localstorage.js
  var storage = () => globalThis.localStorage || window.localStorage;
  function set(key, value) {
    try {
      storage().setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error(`Fez localStorage: Failed to set "${key}"`, e);
    }
  }
  function get(key, defaultValue = null) {
    try {
      const item = storage().getItem(key);
      if (item === null) return defaultValue;
      return JSON.parse(item);
    } catch (e) {
      console.error(`Fez localStorage: Failed to get "${key}"`, e);
      return defaultValue;
    }
  }
  function remove(key) {
    storage().removeItem(key);
  }
  function clear() {
    storage().clear();
  }
  var localstorage_default = { set, get, remove, clear };

  // src/fez/lib/await-helper.js
  function awaitHelper(component, awaitId, promiseOrValue) {
    component._awaitStates ||= /* @__PURE__ */ new Map();
    const existing = component._awaitStates.get(awaitId);
    if (!promiseOrValue || typeof promiseOrValue.then !== "function") {
      return { status: "resolved", value: promiseOrValue, error: null };
    }
    if (existing && existing.promise === promiseOrValue) {
      return existing;
    }
    const state = { status: "pending", value: null, error: null, promise: promiseOrValue };
    component._awaitStates.set(awaitId, state);
    promiseOrValue.then((value) => {
      const current = component._awaitStates.get(awaitId);
      if (current && current.promise === promiseOrValue) {
        current.status = "resolved";
        current.value = value;
        if (component.isConnected) {
          component.fezNextTick(component.fezRender, "fezRender");
        }
      }
    }).catch((error) => {
      const current = component._awaitStates.get(awaitId);
      if (current && current.promise === promiseOrValue) {
        current.status = "rejected";
        current.error = error;
        if (component.isConnected) {
          component.fezNextTick(component.fezRender, "fezRender");
        }
      }
    });
    return state;
  }

  // src/fez/lib/index.js
  function createDomNode(html) {
    const node = document.createElement("div");
    node.innerHTML = html;
    return node;
  }
  var index = {
    // Component entries stored directly: index['ui-btn'] = { class, meta, ... }
    /**
     * Get or create entry for component
     * @param {string} name - Component name
     * @returns {{ class: Function|null, meta: Object|null, demo: string|null, info: string|null, source: string|null }}
     */
    ensure(name) {
      if (!this[name] || typeof this[name] !== "object" || !("class" in this[name])) {
        this[name] = {
          class: null,
          meta: null,
          demo: null,
          info: null,
          source: null
        };
      }
      return this[name];
    },
    /**
     * Get component data with DOM nodes for demo/info
     * @param {string} name - Component name
     * @returns {{ class: Function|null, meta: Object|null, demo: HTMLDivElement|null, info: HTMLDivElement|null, source: string|null }}
     */
    get(name) {
      const entry = this[name];
      if (!entry || typeof entry !== "object" || !("class" in entry)) {
        return { class: null, meta: null, demo: null, info: null, source: null };
      }
      return {
        class: entry.class,
        meta: entry.meta,
        source: entry.source,
        demo: entry.demo ? createDomNode(entry.demo) : null,
        info: entry.info ? createDomNode(entry.info) : null
      };
    },
    /**
     * Apply demo to element and execute scripts
     * Scripts are executed first to define data/variables, then DOM is injected
     * @param {string} name - Component name
     * @param {HTMLElement} target - Target element to render into
     * @returns {boolean} - True if demo was found and applied
     */
    apply(name, target) {
      const entry = this[name];
      if (!entry?.demo || !target) return false;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = entry.demo;
      tempDiv.querySelectorAll(":scope > script").forEach((script) => {
        const content = script.textContent;
        if (content.trim()) {
          try {
            new Function(content)();
          } catch (e) {
            console.error(`Fez.index.apply("${name}") script error:`, e.message);
          }
        }
        script.remove();
      });
      target.innerHTML = tempDiv.innerHTML;
      return true;
    },
    /**
     * Get all registered component names
     * @returns {string[]}
     */
    names() {
      return Object.keys(this).filter(
        (k) => typeof this[k] === "object" && this[k] !== null && "class" in this[k]
      );
    },
    /**
     * Get names of components that have demos
     * @returns {string[]}
     */
    withDemo() {
      return this.names().filter((name) => this[name].demo);
    },
    /**
     * Get all components as object with DOM nodes
     * @returns {Object} Object with component names as keys
     */
    all() {
      const result = {};
      for (const name of this.names()) {
        result[name] = this.get(name);
      }
      return result;
    },
    /**
     * Print registered components to console
     */
    info() {
      console.log("Fez components:", this.names());
    }
  };
  var lib_default = index;

  // src/fez/lib/utility.js
  var utility_default = (Fez3) => {
    Fez3.head = (config, callback) => {
      if (config.nodeName) {
        if (config.nodeName == "SCRIPT") {
          Fez3.head({ script: config.innerText });
          config.remove();
        } else {
          config.querySelectorAll("script").forEach((n2) => Fez3.head(n2));
          config.querySelectorAll("template[fez], xmp[fez], script[fez]").forEach((n2) => Fez3.compile(n2));
        }
        return;
      }
      if (typeof config !== "object" || config === null) {
        throw new Error("head requires an object parameter");
      }
      let src, attributes = {}, elementType;
      if (config.fez) {
        const fezPath = config.fez;
        if (fezPath.endsWith(".txt")) {
          Fez3.fetch(fezPath).then((content) => {
            const basePath = fezPath.substring(0, fezPath.lastIndexOf("/") + 1);
            const lines = content.split("\n").map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
            let loaded = 0;
            const total = lines.length;
            lines.forEach((line) => {
              let componentPath;
              if (line.startsWith("/")) {
                componentPath = line;
              } else {
                const path = line.endsWith(".fez") ? line : line + ".fez";
                componentPath = basePath + path;
              }
              const name = componentPath.split("/").pop().split(".")[0];
              Fez3.fetch(componentPath).then((componentContent) => {
                Fez3.compile(name, componentContent);
                loaded++;
                if (loaded === total && callback) callback();
              });
            });
          });
          return;
        }
        Fez3.fetch(fezPath).then((content) => {
          const name = fezPath.split("/").pop().split(".")[0];
          Fez3.compile(name, content);
          if (callback) callback();
        });
        return;
      }
      if (config.script) {
        if (config.script.includes("import ")) {
          const script = document.createElement("script");
          script.type = "module";
          script.textContent = config.script;
          if (callback) {
            script.addEventListener("load", () => callback(null));
            script.addEventListener("error", (e) => callback(e?.error || new Error("module script error")));
          }
          document.head.appendChild(script);
          requestAnimationFrame(() => script.remove());
        } else {
          try {
            new Function(config.script)();
            if (callback) callback();
          } catch (error) {
            Fez3.consoleError("Error executing script:", error);
            console.log(config.script);
          }
        }
        return;
      } else if (config.js) {
        src = config.js;
        elementType = "script";
        for (const [key, value] of Object.entries(config)) {
          if (key !== "js" && key !== "module") {
            attributes[key] = value;
          }
        }
        if (config.module) {
          attributes.type = "module";
        }
      } else if (config.css) {
        src = config.css;
        elementType = "link";
        attributes.rel = "stylesheet";
        for (const [key, value] of Object.entries(config)) {
          if (key !== "css") {
            attributes[key] = value;
          }
        }
      } else {
        throw new Error('head requires either "script", "js" or "css" property');
      }
      const existingNode = document.querySelector(
        `${elementType}[src="${src}"], ${elementType}[href="${src}"]`
      );
      if (existingNode) {
        if (callback) callback();
        return existingNode;
      }
      const element = document.createElement(elementType);
      if (elementType === "link") {
        element.href = src;
      } else {
        element.src = src;
      }
      for (const [key, value] of Object.entries(attributes)) {
        element.setAttribute(key, value);
      }
      if (callback || config.module) {
        element.onload = () => {
          if (config.module && elementType === "script") {
            import(src).then((module) => {
              window[config.module] = module.default || module[config.module] || module;
            }).catch((error) => {
              console.error(`Error importing module ${config.module}:`, error);
            });
          }
          if (callback) callback();
        };
      }
      document.head.appendChild(element);
      return element;
    };
    const FETCH_CACHE_TTL = 5 * 60 * 1e3;
    const FETCH_CACHE_MAX_SIZE = 100;
    Fez3.fetch = function(...args) {
      Fez3._fetchCache ||= /* @__PURE__ */ new Map();
      let method = "GET";
      let url;
      let callback;
      if (typeof args[0] === "string" && /^[A-Z]+$/.test(args[0])) {
        method = args.shift();
      }
      url = args.shift();
      let opts = {};
      let data = null;
      if (typeof args[0] === "object") {
        data = args.shift();
      }
      if (typeof args[0] === "function") {
        callback = args.shift();
      }
      if (data) {
        if (method === "GET") {
          const params = new URLSearchParams(data);
          url += (url.includes("?") ? "&" : "?") + params.toString();
        } else if (method === "POST") {
          const formData = new FormData();
          for (const [key, value] of Object.entries(data)) {
            formData.append(key, value);
          }
          opts.body = formData;
        }
      }
      opts.method = method;
      opts.headers = { "x-requested-with": "XMLHttpRequest", ...opts.headers };
      const cacheKey = `${method}:${url}:${JSON.stringify(opts)}`;
      const isGet = method === "GET";
      const cached = isGet ? Fez3._fetchCache.get(cacheKey) : null;
      if (cached && Date.now() - cached.timestamp < FETCH_CACHE_TTL) {
        Fez3.consoleLog(`fetch cache hit: ${method} ${url}`);
        if (callback) {
          callback(cached.data);
          return;
        }
        return Promise.resolve(cached.data);
      }
      const processResponse = (response) => {
        if (response.headers.get("content-type")?.includes("application/json")) {
          return response.json();
        }
        return response.text();
      };
      const storeInCache = (key, data2) => {
        if (Fez3._fetchCache.size >= FETCH_CACHE_MAX_SIZE) {
          const oldestKey = Fez3._fetchCache.keys().next().value;
          Fez3._fetchCache.delete(oldestKey);
        }
        Fez3._fetchCache.set(key, { data: data2, timestamp: Date.now() });
      };
      Fez3._fetchInflight ||= /* @__PURE__ */ new Map();
      let request = isGet ? Fez3._fetchInflight.get(cacheKey) : null;
      if (request) {
        Fez3.consoleLog(`fetch inflight: ${method} ${url}`);
      } else {
        Fez3.consoleLog(`fetch live: ${method} ${url}`);
        request = fetch(url, opts).then(processResponse).then((data2) => {
          if (isGet) storeInCache(cacheKey, data2);
          return data2;
        });
        if (isGet) {
          request = request.finally(() => Fez3._fetchInflight.delete(cacheKey));
          Fez3._fetchInflight.set(cacheKey, request);
        }
      }
      if (callback) {
        request.then((data2) => callback(data2)).catch((error) => Fez3.onError("fetch", error));
        return;
      }
      return request;
    };
    Fez3.clearFetchCache = () => {
      Fez3._fetchCache?.clear();
      Fez3._fetchInflight?.clear();
    };
    Fez3.darkenColor = (color, percent = 20) => {
      const num2 = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num2 >> 16) - amt;
      const G = (num2 >> 8 & 255) - amt;
      const B = (num2 & 255) - amt;
      return "#" + (16777216 + (R < 255 ? R < 1 ? 0 : R : 255) * 65536 + (G < 255 ? G < 1 ? 0 : G : 255) * 256 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    };
    Fez3.lightenColor = (color, percent = 20) => {
      const num2 = parseInt(color.replace("#", ""), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num2 >> 16) + amt;
      const G = (num2 >> 8 & 255) + amt;
      const B = (num2 & 255) + amt;
      return "#" + (16777216 + (R < 255 ? R < 1 ? 0 : R : 255) * 65536 + (G < 255 ? G < 1 ? 0 : G : 255) * 256 + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    };
    Fez3.htmlEscape = (text) => {
      if (typeof text === "string") {
        return text.replace(/font-family\s*:\s*(?:&[^;]+;|[^;])*?;/gi, "").replaceAll("&", "&amp;").replaceAll("'", "&apos;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      }
      return text === void 0 ? "" : text;
    };
    Fez3.domRoot = (data, name = "div") => {
      if (data instanceof Node) {
        return data;
      } else {
        const root = document.createElement(name);
        root.innerHTML = data;
        return root;
      }
    };
    Fez3.activateNode = (node, klass = "active") => {
      if (!node || !node.parentElement) return;
      Array.from(node.parentElement.children).forEach((child) => {
        child.classList.remove(klass);
      });
      node.classList.add(klass);
    };
    Fez3.isTrue = (val) => {
      return ["1", "true", "on"].includes(String(val).toLowerCase());
    };
    Fez3.uid = /* @__PURE__ */ (() => {
      let seq = 111;
      return () => "fez_uid_" + (++seq).toString(32);
    })();
    Fez3.POINTER_SEQ = 0;
    Fez3.POINTER = {};
    Fez3.POINTER_CREATED = {};
    Fez3.pointer = (func, opts = {}) => {
      if (typeof func == "function") {
        const uid = ++Fez3.POINTER_SEQ;
        if (opts.persist) {
          Fez3.POINTER[uid] = func;
        } else {
          Fez3.POINTER_CREATED[uid] = Date.now();
          Fez3.POINTER[uid] = (...args) => {
            const result = func(...args);
            delete Fez3.POINTER[uid];
            delete Fez3.POINTER_CREATED[uid];
            return result;
          };
        }
        return `Fez.POINTER[${uid}]`;
      }
    };
    Fez3.sweepPointers = () => {
      const cutoff = Date.now() - 5 * 60 * 1e3;
      for (const uid of Object.keys(Fez3.POINTER_CREATED)) {
        if (Fez3.POINTER_CREATED[uid] < cutoff) {
          delete Fez3.POINTER[uid];
          delete Fez3.POINTER_CREATED[uid];
        }
      }
    };
    setInterval(Fez3.sweepPointers, 60 * 1e3);
    Fez3.getFunction = (pointer) => {
      if (!pointer) {
        return () => {
        };
      } else if (typeof pointer === "function") {
        return pointer;
      } else if (typeof pointer === "string") {
        const arrowFuncPattern = /^\s*\(?\s*\w+(\s*,\s*\w+)*\s*\)?\s*=>/;
        const functionPattern = /^\s*function\s*\(/;
        if (arrowFuncPattern.test(pointer) || functionPattern.test(pointer)) {
          return new Function("return " + pointer)();
        } else if (pointer.includes(".") && !pointer.includes("(")) {
          return new Function(`return function() { return ${pointer}(); }`);
        } else {
          return new Function(pointer);
        }
      }
    };
    Fez3.onReady = (callback) => {
      if (document.readyState === "loading") {
        document.addEventListener(
          "DOMContentLoaded",
          () => {
            callback();
          },
          { once: true }
        );
      } else {
        callback();
      }
    };
    Fez3.fnv1 = (str) => {
      let FNV_OFFSET_BASIS = 2166136261;
      let FNV_PRIME = 16777619;
      let hash = FNV_OFFSET_BASIS;
      for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash *= FNV_PRIME;
      }
      return hash.toString(36).replaceAll("-", "");
    };
    Fez3.untilTrue = (func, pingRate) => {
      pingRate ||= 200;
      if (!func()) {
        setTimeout(() => {
          Fez3.untilTrue(func, pingRate);
        }, pingRate);
      }
    };
    const DEFAULT_THROTTLE_DELAY = 200;
    Fez3.throttle = (func, delay = DEFAULT_THROTTLE_DELAY) => {
      let lastRun = 0;
      let timeout;
      return function(...args) {
        const now = Date.now();
        if (now - lastRun >= delay) {
          func.apply(this, args);
          lastRun = now;
        } else {
          clearTimeout(timeout);
          timeout = setTimeout(
            () => {
              func.apply(this, args);
              lastRun = Date.now();
            },
            delay - (now - lastRun)
          );
        }
      };
    };
    Fez3.isTruthy = (v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (v && typeof v === "object") return Object.keys(v).length > 0;
      return !!v;
    };
    Fez3.toPairs = (c) => {
      if (Array.isArray(c)) return c.map((v, i) => [v, i]);
      if (c && typeof c === "object") return Object.entries(c);
      return [];
    };
    Fez3.tag = (tag, opts = {}, html = "") => {
      const json = encodeURIComponent(JSON.stringify(opts));
      return `<${tag} data-props="${json}">${html}</${tag}>`;
    };
    Fez3.typeof = (data) => {
      if (data === null || data === void 0) return "u";
      if (Array.isArray(data)) return "a";
      const t = typeof data;
      if (t === "function") return "f";
      if (t === "string") return "s";
      if (t === "number") return Number.isInteger(data) ? "i" : "n";
      if (t === "object") return "o";
      return t[0];
    };
  };

  // src/fez/utils/css_mixin.js
  var CssMixins = {};
  var escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  var declRe = (key) => new RegExp(`(^|[\\s{;])(?::|@include\\s+)${escapeRe(key)}\\s*;`, "g");
  var css_mixin_default = (Fez3) => {
    Fez3.cssMixin = (name, content) => {
      if (content) {
        CssMixins[name] = content;
      } else {
        Object.entries(CssMixins).forEach(([key, val]) => {
          name = name.replace(declRe(key), (_, lead) => `${lead}${val.replace(/;\s*$/, "")};`);
          name = name.replaceAll(`:${key} `, `${val} `);
          name = name.replaceAll(`@include ${key} `, `${val} `);
        });
        return name;
      }
    };
    Fez3.cssMixin("mobile", "@media (max-width: 767px)");
    Fez3.cssMixin("tablet", "@media (min-width: 768px) and (max-width: 1023px)");
    Fez3.cssMixin("desktop", "@media (min-width:  1200px)");
    Fez3.cssMixin("dark", "&:where(.dark, .dark *)");
  };

  // src/fez/root.js
  var Fez2 = (name, klass) => {
    if (typeof name === "number") {
      const fez = Fez2.instances.get(name);
      if (fez) return fez;
      Fez2.onError(
        "lookup",
        `Instance with UID "${name}" not found. Component may have been destroyed or never created.`,
        { uid: name }
      );
      return;
    }
    if (!name) {
      Fez2.onError(
        "lookup",
        "Fez() called without arguments. Expected component name, UID, or DOM node."
      );
      return;
    }
    if (klass) {
      const isPureFn = typeof klass === "function" && !/^\s*class/.test(klass.toString()) && !/\b(this|new)\b/.test(klass.toString());
      if (isPureFn) {
        const list = Array.from(document.querySelectorAll(`.fez.fez-${name}`)).filter((n2) => n2.fez);
        list.forEach((el) => klass(el.fez));
        return list;
      }
      if (typeof klass !== "function") {
        return Fez2.find(klass, name);
      }
      return connect(name, klass);
    }
    const node = name.nodeName ? name.closest(".fez") : document.querySelector(name.includes("#") ? name : `.fez.fez-${name}`);
    if (!node) {
      Fez2.onError(
        "lookup",
        `Component "${name}" not found in DOM. Ensure the component is defined and rendered.`,
        { componentName: name }
      );
      return;
    }
    if (!node.fez) {
      Fez2.onError(
        "lookup",
        `DOM node "${name}" exists but has no Fez instance attached. Component may not be initialized yet.`,
        { node, tagName: name }
      );
      return;
    }
    return node.fez;
  };
  Fez2.WINDOW_EVENTS = WINDOW_EVENTS;
  Fez2.index = lib_default;
  Fez2.instanceCount = 0;
  Fez2.instances = /* @__PURE__ */ new Map();
  Fez2.find = (onode, name) => {
    let node = typeof onode === "string" ? document.body.querySelector(onode) : onode;
    if (typeof node.val === "function") node = node[0];
    const selector = name ? `.fez.fez-${name}` : ".fez";
    const closestNode = node.closest(selector);
    if (closestNode?.fez) return closestNode.fez;
    Fez2.onError("find", `Node connector not found. Selector: "${selector}", node: ${onode}`, {
      original: onode,
      resolved: node,
      selector
    });
  };
  Fez2.cssClass = (text) => {
    const name = cssHash(text);
    injectCss(flattenCss(`.${name} { ${text} }`));
    return name;
  };
  Fez2.extractCss = extractCss;
  Fez2.globalCss = (cssClass, opts = {}) => {
    if (typeof cssClass === "function") cssClass = cssClass();
    let text = cssClass.split("\n").filter((line) => !/^\s*\/\//.test(line)).join("\n");
    if (opts.wrap) text = `:fez { ${text} }`;
    text = Fez2.cssMixin(text);
    if (opts.name) text = text.replace(/:fez\b/g, `.fez.fez-${opts.name}`);
    return injectCss(flattenCss(text));
  };
  attachMorph(Fez2);
  Fez2.subscribe = subscribe;
  Fez2.publish = publish;
  Fez2.localStorage = localstorage_default;
  Fez2.transitions = transitions;
  Fez2.animateSize = animateSize;
  Fez2.fezAwait = awaitHelper;
  Fez2.consoleError = (text, show) => {
    text = `Fez: ${text}`;
    console.error(text);
    if (show) {
      return `<span style="border: 1px solid red; font-size: 14px; padding: 3px 7px; background: #fee; border-radius: 4px;">${text}</span>`;
    }
  };
  Fez2.consoleLog = (text) => {
    if (Fez2.LOG) {
      console.log(`Fez: ${String(text).substring(0, 180)}`);
    }
  };
  Fez2.onError = (kind, message, context) => {
    let componentName = context?.componentName || context?.name;
    if (!componentName && typeof message === "string") {
      const match = message.match(/<([^>]+)>/);
      if (match) componentName = match[1];
    }
    const prefix = componentName ? ` [${componentName}]` : "";
    const errorMsg = typeof message === "string" ? message : message?.message || String(message);
    const fullMessage = `Fez ${kind}:${prefix} ${errorMsg}`;
    if (context && Fez2.LOG) {
      console.error(fullMessage, context);
    } else {
      console.error(fullMessage);
    }
    if (message instanceof Error && message.stack && Fez2.LOG) {
      console.error(message.stack);
    }
    return fullMessage;
  };
  utility_default(Fez2);
  css_mixin_default(Fez2);
  Fez2.compile = compile;
  Fez2.createTemplate = createTemplate;
  Fez2.state = global_state_default;
  Fez2.log = dump_default;
  Fez2.highlightAll = highlight_all_default;
  Fez2.onReady(() => Fez2.consoleLog("Fez.LOG === true, logging enabled."));
  var root_default = Fez2;

  // src/fez/pjax/onclick.js
  function createOnClick(Pjax) {
    const PjaxOnClick = {
      main(event) {
        const node = event.target.closest(
          '*[click]:not([click=""]), *[href]:not([href=""]), *[pjax-refresh]:not([pjax-refresh=""])'
        );
        if (!node) return;
        const href = node.getAttribute("href");
        if (node.tagName === "A" && href?.startsWith("#") && !node.hasAttribute("click") && !node.hasAttribute("pjax-target") && !node.hasAttribute("pjax-refresh") && !node.hasAttribute("pjax-confirm")) {
          return;
        }
        event.stopPropagation();
        event.preventDefault();
        const ctx = {
          node,
          which: event.which,
          metaKey: event.metaKey
        };
        const proceed = () => PjaxOnClick.execute(ctx);
        const confirmMsg = node.getAttribute("pjax-confirm");
        if (confirmMsg) {
          const result = Pjax.confirm(confirmMsg, node);
          if (result && typeof result.then === "function") {
            result.then((ok) => {
              if (ok) proceed();
            }).catch((err) => Pjax.error(`confirm rejected: ${err}`));
            return;
          }
          if (!result) return;
        }
        proceed();
      },
      execute(ctx) {
        const node = ctx.node;
        const click = node.getAttribute("click");
        if (click) {
          return new Function(click).bind(node)();
        }
        const href = node.getAttribute("href");
        const replace = node.hasAttribute("pjax-replace");
        const pjaxRefresh = node.getAttribute("pjax-refresh");
        if (pjaxRefresh) {
          const targetNode = document.querySelector(pjaxRefresh);
          if (!targetNode) {
            Pjax.error(`pjax-refresh selector did not match: ${pjaxRefresh}`);
            return;
          }
          Pjax.refresh(pjaxRefresh);
          return;
        }
        const pjaxTarget = node.getAttribute("pjax-target");
        if (pjaxTarget) {
          const targetNode = document.querySelector(pjaxTarget);
          if (!targetNode) {
            Pjax.error(`pjax-target selector did not match: ${pjaxTarget}`);
            return;
          }
          Pjax.load(href, { target: targetNode, replace });
          return;
        }
        if (ctx.which === 2 || ctx.metaKey) {
          return window.open(href);
        }
        const target = node.getAttribute("target");
        const noPjaxSel = Pjax.config.no_pjax_class.map((cls) => `.${cls}`).join(", ");
        if (noPjaxSel && node.closest(noPjaxSel)) {
          return PjaxOnClick.leave(href, target);
        }
        if (/^javascript:/.test(href)) {
          return new Function(href.replace(/^javascript:/, ""))();
        }
        if (/^\w+:/.test(href) || target) {
          return PjaxOnClick.leave(href, target);
        }
        Pjax.load(href, { ajax: node, replace });
        return false;
      },
      // Leave the SPA. Open a new window only when the link declares a `target`;
      // otherwise navigate the current tab. Kept as a seam so tests can stub it -
      // DOM test environments forbid assigning window.location.
      leave(href, target) {
        if (target) window.open(href, target);
        else window.location.href = href;
      }
    };
    return PjaxOnClick;
  }

  // src/fez/pjax/pjax.js
  function createPjax() {
    class Pjax {
      static config = {
        is_silent: typeof location === "undefined" ? true : !location.port || parseInt(location.port) < 1e3,
        no_scroll_selector: [".no-scroll"],
        paths_to_skip: [],
        no_pjax_class: ["no-pjax", "direct"],
        no_ajax_class: ["ajax-skip", "skip-ajax", "no-ajax", "top"],
        ajax_selector: ".ajax",
        timeout: 1e4,
        history_max: 20
      };
      static historyData = {};
      // --- public class methods ---
      // Bind all document/window level handlers. Called by boot.js once the page
      // is known to have a pjax container; call it manually if the container is
      // injected after DOMContentLoaded.
      static start() {
        if (Pjax._booted) return;
        Pjax._booted = true;
        setTimeout(() => Pjax.sendGlobalEvent(), 0);
        Pjax.onDocumentClick();
        window.addEventListener("popstate", () => {
          window.requestAnimationFrame(() => {
            const path = Pjax.path();
            const entry = Pjax.historyData[path];
            if (entry) {
              Pjax.console(`from history: ${path}`);
              const rroot = document.createElement("div");
              rroot.innerHTML = entry.html;
              Pjax.setPageBody(rroot, path);
              if (entry.scrollY) window.scrollTo(0, entry.scrollY);
            } else {
              Pjax.load(path, { history: false });
            }
          });
        });
        document.body.addEventListener("submit", (e) => {
          const form = e.target;
          const is_pjax = form.getAttribute("data-pjax");
          if (is_pjax) {
            e.preventDefault();
            const pjax_target = is_pjax === "true" ? null : is_pjax;
            Pjax.load(form.getAttribute("action"), { form, target: pjax_target });
          }
        });
      }
      static onDocumentClick() {
        if (!Pjax._clickBound) {
          Pjax._clickBound = true;
          window.addEventListener("click", Pjax.PjaxOnClick.main);
        }
      }
      static load(href, opts) {
        return Pjax.fetch(Pjax.getOpts(href, opts));
      }
      static refresh(func, opts) {
        if (typeof func === "string" && func[0] === "#") {
          opts ||= {};
          opts.target = func;
          func = Pjax.path();
          opts.history = false;
        }
        opts = Pjax.getOpts(func, opts);
        opts.scroll ||= false;
        opts.force = true;
        return Pjax.fetch(opts);
      }
      static reload(opts) {
        opts = Pjax.getOpts(opts);
        opts.cache = false;
        opts.force = true;
        return Pjax.fetch(opts);
      }
      static refreshed() {
        if (!Pjax.pastHref) return false;
        return Pjax.pastHref === Pjax.lastHref;
      }
      static path() {
        return location.pathname + location.search;
      }
      static last() {
        return Pjax.lastHref || Pjax.path();
      }
      static node() {
        const el = document.getElementsByTagName("pjax")[0] || document.getElementsByClassName("pjax")[0];
        if (!el) {
          Pjax.error(".pjax or <pjax> not found");
          return;
        }
        if (el.nodeName === "BODY") {
          Pjax.error("You cant bind PJAX to body");
          return;
        }
        return el;
      }
      static console(msg) {
        if (Pjax.DEV || !Pjax.config.is_silent) console.log(msg);
      }
      static before() {
        return true;
      }
      static after() {
        return true;
      }
      static confirm(message, _node) {
        return window.confirm(message);
      }
      static error(msg) {
        console.error(`Pjax error: ${msg}`);
      }
      static pushState(href) {
        window.history.pushState({}, document.title, href);
      }
      static push(href) {
        return Pjax.pushState(href);
      }
      static replace(href) {
        window.history.replaceState({}, document.title, href);
      }
      static sendGlobalEvent() {
        Pjax._dispatchRender({
          from: null,
          to: Pjax.path(),
          status: 200,
          error: null,
          duration: 0,
          mode: "full",
          opts: {}
        });
      }
      static _dispatchRender(detail) {
        document.dispatchEvent(new CustomEvent("pjax:render", { bubbles: true, detail }));
      }
      static emit(name, detail) {
        const event = new CustomEvent(`pjax:${name}`, { bubbles: true, cancelable: true, detail });
        document.dispatchEvent(event);
        return !event.defaultPrevented;
      }
      // --- option normalization ---
      static getOpts(path, opts) {
        opts = Pjax._resolveArgs(path, opts);
        if (opts.ajax) Pjax._resolveAjax(opts);
        if (opts.target) Pjax._resolveTarget(opts);
        Pjax._resolvePath(opts);
        return opts;
      }
      static _resolveArgs(path, opts) {
        opts ||= {};
        if (typeof opts === "string") opts = { target: opts };
        if (typeof path === "object" && path !== null) {
          if (path.nodeName) opts.ajax = path;
          else opts = path;
        } else if (typeof path === "function") {
          opts.done = path;
        } else {
          opts.path = path;
        }
        if (opts.href) {
          opts.path = opts.href;
          delete opts.href;
        }
        opts.path ||= Pjax.path();
        if (opts.form) {
          const params = new URLSearchParams(new FormData(opts.form)).toString();
          if (params) {
            opts.path += opts.path.includes("?") ? "&" : "?";
            opts.path += params;
          }
        }
        return opts;
      }
      static _resolveAjax(opts) {
        opts.node = opts.ajax;
        if (typeof opts.node === "string") opts.node = document.querySelector(opts.node);
        if (!opts.node) {
          delete opts.ajax;
          return;
        }
        let skip = false;
        for (const el of Pjax.config.no_ajax_class) {
          if (opts.node.closest(`.${el}`)) skip = true;
        }
        if (!skip) {
          const ajax_node = opts.node.closest(Pjax.config.ajax_selector);
          if (ajax_node) {
            opts.ajax_node = ajax_node;
            opts.scroll ||= false;
          }
        }
        delete opts.ajax;
      }
      static _resolveTarget(opts) {
        if (typeof opts.target === "string") opts.target = document.querySelector(opts.target);
        opts.node = opts.target;
        opts.scroll ||= false;
      }
      static _resolvePath(opts) {
        if (opts.path[0] === "?") {
          if (opts.ajax_node) {
            const ajax_path = opts.ajax_node.getAttribute("data-path") || opts.ajax_node.getAttribute("path");
            if (ajax_path) opts.path = ajax_path.split("?")[0] + opts.path;
          }
          if (opts.path[0] === "?") opts.path = location.pathname + opts.path;
        }
        if (opts.replacePath && opts.replacePath[0] === "?") {
          opts.replacePath = location.pathname + opts.replacePath;
        }
      }
      // --- scroll management ---
      static shouldSkipScroll(node) {
        if (!node || !node.closest) return;
        for (const el of Pjax.config.no_scroll_selector) {
          if (node.closest(el)) return true;
        }
        return false;
      }
      static scrollLock() {
        const now = Date.now();
        if (Pjax._scrollLockTime && now - Pjax._scrollLockTime < 1e3) return;
        Pjax._scrollLockTime = now;
        const scrollPosition = window.scrollY;
        const body = document.body;
        body.style.height = window.getComputedStyle(body).height;
        window.scrollTo(0, scrollPosition);
        window.requestAnimationFrame(() => {
          body.style.height = "";
          window.scrollTo(0, scrollPosition);
        });
      }
      // --- page rendering ---
      static setPageBody(node, href) {
        const title = node.querySelector("title")?.innerHTML;
        document.title = title || "no page title (pjax)";
        Pjax.scrollLock();
        const pjaxNode = Pjax.node();
        if (!pjaxNode) return false;
        const new_body = Pjax.findById(node, pjaxNode.id);
        if (new_body) {
          const finish = () => {
            Pjax.runHeadScripts(node, new_body);
            Pjax.morphInto(pjaxNode, Pjax.parseScripts(new_body));
            Pjax.after(href);
          };
          if (Pjax.useViewTransition && document.startViewTransition) {
            document.startViewTransition(finish);
          } else {
            finish();
          }
          return true;
        }
        return false;
      }
      static morphInto(target, html) {
        if (typeof html === "string") {
          const range = document.createRange();
          range.selectNodeContents(target);
          root_default.nodeMorph(target, range.createContextualFragment(html));
        } else {
          root_default.nodeMorph(target, html);
        }
      }
      static parseScripts(node) {
        if (typeof node === "string") {
          const div = document.createElement("div");
          div.innerHTML = node;
          node = div;
        }
        for (const script_tag of Array.from(node.getElementsByTagName("script"))) {
          if (!script_tag) continue;
          if (script_tag.getAttribute("src")) continue;
          const type = script_tag.getAttribute("type") || "javascript";
          if (!type.includes("javascript")) continue;
          if (!script_tag.id) {
            Pjax.script_cnt ||= 0;
            script_tag.id = `app-sc-${++Pjax.script_cnt}`;
          }
          const func = new Function(script_tag.textContent);
          script_tag.text = 1;
          if (script_tag.hasAttribute("pjax-delay")) requestAnimationFrame(func);
          else func();
        }
        return node.innerHTML;
      }
      // Inline <head> scripts of a full-page response are otherwise discarded on a
      // swap (innerHTML never runs them; only the pjax region is morphed in). Run
      // those outside the pjax region so head bootstrap - e.g. window.app data and
      // flash emitted by the server - refreshes on every navigation. src= bundles
      // and the pjax region's own scripts (handled by parseScripts) are skipped.
      static runHeadScripts(root, pjaxBody) {
        for (const script_tag of Array.from(root.getElementsByTagName("script"))) {
          if (pjaxBody && pjaxBody.contains(script_tag)) continue;
          if (script_tag.getAttribute("src")) continue;
          const type = script_tag.getAttribute("type") || "javascript";
          if (!type.includes("javascript")) continue;
          const func = new Function(script_tag.textContent);
          if (script_tag.hasAttribute("pjax-delay")) requestAnimationFrame(func);
          else func();
        }
      }
      static findById(root, id) {
        if (!root || !id) return;
        if (root.getElementById) {
          return root.getElementById(id);
        }
        for (const node of root.querySelectorAll("[id]")) {
          if (node.id === id) return node;
        }
        return null;
      }
      // --- querystring helper ---
      static qs(key, value, opts = {}) {
        const parts = location.search.replace(/^\?/, "").split("&").map((el) => el.split("=", 2));
        if (typeof value === "undefined") {
          parts.forEach((el) => {
            if (el[0] === key) value = decodeURIComponent(el[1]);
          });
          return value;
        }
        const qs = {};
        parts.forEach((el) => {
          if (el[0]) qs[el[0]] = el[1];
        });
        if (value === null || value === false) {
          delete qs[key];
        } else {
          qs[key] = encodeURIComponent(value);
        }
        const remaining = Object.keys(qs);
        let href;
        if (remaining.length) {
          const data = remaining.map((k) => `${k}=${qs[k]}`).join("&");
          href = location.pathname + "?" + data;
        } else {
          href = location.pathname;
        }
        if (opts.push) return Pjax.push(href);
        if (opts.href) return href;
        return Pjax.load(href);
      }
      // --- history management ---
      static _addHistoryEntry(href, html) {
        if (html == null) {
          html = href;
          href = Pjax.path();
        }
        const keys = Object.keys(Pjax.historyData);
        const max = Pjax.config.history_max || 20;
        if (keys.length >= max) delete Pjax.historyData[keys[0]];
        Pjax.historyData[href] = { html, scrollY: 0 };
      }
      // --- internal ---
      static fetch(opts) {
        const pjax = new Pjax(opts);
        return pjax.load();
      }
      // --- instance methods ---
      constructor(opts) {
        this.opts = opts;
        this.href = opts.href || opts.path;
      }
      redirect() {
        this.href ||= location.href;
        if (this.href.slice(0, 4) === "http" && !this.href.includes(location.host)) {
          window.open(this.href);
        } else {
          location.href = this.href;
        }
        return false;
      }
      // A same-origin redirect (e.g. lux `redirect_to`) comes back as a non-200
      // with a `Location` header. Re-run it through pjax so we swap in place
      // instead of forcing a full document load. External hosts fall back to a
      // real browser navigation.
      followRedirect(url) {
        let path;
        if (url[0] === "/" && url[1] !== "/") {
          path = url;
        } else {
          const parsed = new URL(url, location.href);
          if (parsed.origin !== location.origin) {
            location.href = url;
            return false;
          }
          path = parsed.pathname + parsed.search;
        }
        this.opts.redirects = (this.opts.redirects || 0) + 1;
        if (this.opts.redirects > 5) return this.redirect();
        this.href = path;
        this.opts.replace = true;
        Pjax.lastHref = this.href;
        this.sendRequest();
        return false;
      }
      swapMode() {
        if (this.opts.target) return "target";
        if (this.opts.ajax_node) return "ajax";
        return "full";
      }
      emitDone(extra = {}) {
        const duration = this.opts.req_start_time ? Date.now() - this.opts.req_start_time : 0;
        const detail = Object.assign(
          {
            from: this.fromHref || Pjax.pastHref || null,
            to: this.eventToHref(),
            status: null,
            error: null,
            duration,
            mode: this.swapMode(),
            opts: this.opts
          },
          extra
        );
        Pjax._dispatchRender(detail);
      }
      historyHref() {
        return this.opts.replacePath || this.href;
      }
      eventToHref() {
        if (this.opts.history === false || this.opts.ajax_node && !this.opts.target) {
          return this.href;
        }
        return this.historyHref();
      }
      load() {
        if (!this.href) return false;
        const now = Date.now();
        if (!this.opts.force) {
          if (Pjax.lastHref === this.href && now - (Pjax._lastLoadTime || 0) < 2e3) return false;
        }
        Pjax._lastLoadTime = now;
        this.fromHref = Pjax.path();
        const currentEntry = Pjax.historyData[this.fromHref];
        if (currentEntry) currentEntry.scrollY = window.scrollY;
        Pjax.pastHref = Pjax.lastHref;
        Pjax.lastHref = this.href;
        const e = window.event;
        if (e && !e.key && (e.which === 2 || e.metaKey)) {
          return window.open(this.href);
        }
        if (Pjax.before(this.href, this.opts) === false) return;
        if (location.hash && location.pathname === this.href) return;
        if (this.href.startsWith("#")) {
          if (this.href === "#") return;
          const node = document.querySelector(`a[name=${this.href.replace("#", "")}]`);
          if (node) {
            node.scrollIntoView({ behavior: "smooth", block: "start" });
            return false;
          }
        }
        if (/^http/.test(this.href) || /#/.test(this.href)) return this.redirect();
        for (const el of Pjax.config.paths_to_skip) {
          switch (typeof el) {
            case "object":
              if (el.test(this.href)) return this.redirect();
              break;
            case "function":
              if (el(this.href)) return this.redirect();
              break;
            default:
              if (this.href.startsWith(el)) return this.redirect();
          }
        }
        if (Pjax.request) Pjax.request.abort();
        this.sendRequest();
        return false;
      }
      sendRequest() {
        this.opts.req_start_time = Date.now();
        this.opts.path = this.href;
        Pjax.emit("start", {
          from: this.fromHref || Pjax.pastHref || null,
          to: this.href,
          mode: this.swapMode(),
          opts: this.opts
        });
        const headers = { "x-requested-with": "XMLHttpRequest" };
        if (this.opts.cache === false) headers["cache-control"] = "no-cache";
        Pjax.request = this.req = new XMLHttpRequest();
        this.req.timeout = Pjax.config.timeout || 1e4;
        this.req.onerror = (e) => {
          if (Pjax.request === this.req) Pjax.request = null;
          Pjax.error("Net error: Server response not received (Pjax)");
          console.error(e);
          this.emitDone({ status: 0, error: "network" });
        };
        this.req.onabort = () => {
          if (Pjax.request === this.req) Pjax.request = null;
          this.emitDone({ status: 0, error: "abort" });
        };
        this.req.ontimeout = () => {
          Pjax.request = null;
          Pjax.error(`Request timeout: ${this.href}`);
          this.emitDone({ status: 0, error: "timeout" });
          this.redirect();
        };
        this.req.open("GET", this.href);
        for (const [k, v] of Object.entries(headers)) this.req.setRequestHeader(k, v);
        this.req.onload = () => this.handleResponse();
        this.req.send();
      }
      handleResponse() {
        Pjax.request = null;
        this.response = this.req.responseText;
        const time_diff = Date.now() - this.opts.req_start_time;
        let log_data = `Pjax.load ${this.href}`;
        if (this.opts.history === false) log_data += " (back trigger)";
        Pjax.console(
          `${log_data} (app ${this.req.getResponseHeader("x-lux-speed") || "n/a"}, real ${time_diff}ms, status ${this.req.status})`
        );
        if (this.req.status !== 200) {
          const redirect_to = this.req.getResponseHeader("Location");
          if (redirect_to) return this.followRedirect(redirect_to);
          this.emitDone({ status: this.req.status, error: "status" });
          return this.redirect();
        }
        const rul = this.req.responseURL;
        if (rul) {
          const parsed = new URL(rul);
          this.href = parsed.pathname + parsed.search;
        }
        this.historyAddCurrent(this.historyHref());
        let applied;
        try {
          applied = this.applyLoadedData();
        } catch (err) {
          Pjax.error(`Apply failed: ${err?.message || err}`);
          console.error(err);
          applied = false;
        }
        if (!applied) {
          this.emitDone({ status: this.req.status, error: "apply" });
          return this.redirect();
        }
        if (typeof this.opts.done === "function") this.opts.done();
        this.emitDone({ status: this.req.status });
        if (!(this.opts.scroll === false || Pjax.shouldSkipScroll(this.opts.node))) {
          window.requestAnimationFrame(() => {
            window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
          });
        } else {
          Pjax.scrollLock();
        }
      }
      applyLoadedData() {
        this.pjaxNode = Pjax.node();
        if (!this.pjaxNode) return;
        if (!this.pjaxNode.id) return Pjax.error("No ID attribute on pjax node");
        this.rroot = document.createElement("div");
        this.rroot.innerHTML = this.response;
        if (this.opts.target && this.applyTarget()) return true;
        if (this.opts.ajax_node) return this.applyAjax();
        return this.applyFullSwap();
      }
      applyTarget() {
        const id = this.opts.target.getAttribute("id");
        if (!id) {
          Pjax.error("ID attribute not found on Pjax target");
          return false;
        }
        const rtarget = Pjax.findById(this.rroot, id);
        if (!rtarget) return false;
        Pjax.scrollLock();
        Pjax.morphInto(this.opts.target, Pjax.parseScripts(rtarget.innerHTML));
        return true;
      }
      applyAjax() {
        const ajax_node = this.opts.ajax_node;
        ajax_node.setAttribute("data-path", this.href);
        ajax_node.removeAttribute("path");
        const ajax_id = ajax_node.getAttribute("id") || Pjax.error("Pjax .ajax node has no ID");
        const ajax_data = Pjax.findById(this.rroot, ajax_id)?.innerHTML || this.response;
        Pjax.morphInto(ajax_node, Pjax.parseScripts(ajax_data));
        return true;
      }
      applyFullSwap() {
        Pjax._addHistoryEntry(this.historyHref(), this.response);
        return Pjax.setPageBody(this.rroot, this.href);
      }
      historyAddCurrent(href) {
        if (this.opts.history === false || this.opts.ajax_node && !this.opts.target) return;
        if (this.history_added) return;
        this.history_added = true;
        if (this.opts.replace || Pjax._lastHrefCheck === href) {
          window.history.replaceState({}, document.title, href);
          Pjax._lastHrefCheck = href;
        } else {
          window.history.pushState({}, document.title, href);
          Pjax._lastHrefCheck = href;
        }
      }
    }
    Pjax.PjaxOnClick = createOnClick(Pjax);
    return Pjax;
  }

  // src/fez/pjax/boot.js
  function bootPjax() {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (window.Pjax) return;
    const Pjax = createPjax();
    window.Pjax = Pjax;
    const boot = () => {
      const container = document.getElementsByTagName?.("pjax")[0] || document.getElementsByClassName?.("pjax")[0];
      if (container) Pjax.start();
    };
    if (!document.readyState || document.readyState === "loading") {
      document.addEventListener?.("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }

  // src/fez.js
  var fezPrimary = typeof window !== "undefined" && !window.Fez;
  if (fezPrimary) {
    window.FezBase = FezBase;
    window.Fez = root_default;
    Promise.resolve().then(() => init_defaults());
    bootPjax();
  }
  var observer = new MutationObserver((mutations) => {
    for (const { addedNodes, removedNodes } of mutations) {
      addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.("template[fez], xmp[fez], script[fez]")) {
          root_default.compile(node);
          node.remove();
        }
        node.querySelectorAll?.("template[fez], xmp[fez], script[fez]").forEach((tpl) => {
          root_default.compile(tpl);
          tpl.remove();
        });
      });
      removedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        const cleanup = (el) => {
          if (el.fez && !el.fez._destroyed) {
            queueMicrotask(() => {
              if (!el.isConnected && el.fez && !el.fez._destroyed) {
                el.fez.fezOnDestroy();
              }
            });
          }
        };
        cleanup(node);
        node.querySelectorAll?.(".fez")?.forEach(cleanup);
      });
    }
  });
  if (fezPrimary) observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
  var fez_default = root_default;
})();
//# sourceMappingURL=fez.js.map
