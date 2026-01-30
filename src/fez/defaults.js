// Wrap defaults in a function to avoid immediate execution
const loadDefaults = () => {
  // include fez component by name
  //<fez-component name="some-node" :props="fez.props"></fez-component>
  Fez(
    "fez-component",
    class {
      init(props) {
        const tag = document.createElement(props.name);
        tag.props = props.props || props["data-props"] || props;

        while (this.root.firstChild) {
          this.root.parentNode.insertBefore(
            this.root.lastChild,
            tag.nextSibling,
          );
        }

        this.root.innerHTML = "";
        this.root.appendChild(tag);
      }
    },
  );

  // include remote data from url
  // <fez-include src="./demo/fez/ui-slider.html"></fez-include>
  Fez(
    "fez-include",
    class {
      init(props) {
        Fez.fetch(props.src, (data) => {
          const dom = Fez.domRoot(data);
          Fez.head(dom); // include scripts and load fez components
          this.root.innerHTML = dom.innerHTML;
        });
      }
    },
  );

  // Show node only if test validates
  // <fez-if if="window.foo">...
  Fez(
    "fez-if",
    class {
      init(props) {
        const test = new Function(`return (${props.if || props.test})`);
        if (!test()) {
          this.root.remove();
        }
      }
    },
  );

  // Render all components with their demos
  // <fez-demo></fez-demo>
  // <fez-demo name="ui-clock"></fez-demo>
  // Also supports ?fez=NAME query string
  Fez(
    "fez-demo",
    class {
      init(props) {
        this.state.ready = false;
        this.state.components = [];
        this.state.filtered = false;
        this.state.showAllUrl = "";

        // Check for name from props or query string
        const urlParams = new URLSearchParams(window.location.search);
        const name = props.name || urlParams.get("fez");

        // If filtering, store URL without ?fez param
        if (urlParams.get("fez")) {
          const url = new URL(window.location.href);
          url.searchParams.delete("fez");
          this.state.showAllUrl = url.pathname + url.search;
          this.state.filtered = true;
        }

        // Wait for components to be loaded, then render
        const checkReady = () => {
          // If name provided, render only that component
          if (name) {
            if (Fez.demo.list[name]) {
              this.state.components = [name];
              this.state.ready = true;
            } else {
              setTimeout(checkReady, 100);
            }
          } else {
            // Render all components that have demos
            const names = Object.keys(Fez.demo.list).sort();
            if (names.length > 0) {
              this.state.components = names;
              this.state.ready = true;
            } else {
              setTimeout(checkReady, 100);
            }
          }
        };
        checkReady();
      }

      showHtml(name) {
        const html = Fez.demo.list[name] || "No demo HTML";
        Fez.log("Demo HTML: " + name + "\n\n" + html);
      }

      showFez(name) {
        Fez.log(
          "Fez source: " +
            name +
            "\n\n" +
            (Fez.demo.sourceList[name] || "Source not available"),
        );
      }

      openSingle(name) {
        const url = new URL(window.location.href);
        url.searchParams.set("fez", name);
        window.location.href = url.toString();
      }

      openCodePen(name) {
        const demo = Fez.demo.list[name] || "";
        const code = Fez.demo.sourceList[name] || "";
        const body = [
          '<link rel="stylesheet" href="//cdn.simplecss.org/simple.css" />\n<scr' +
            'ipt src="//dux.github.io/fez/dist/fez.js"></scr' +
            "ipt>",
          "<!-- FEZ code start -->\n<x" +
            `mp fez="${name}">\n${code}\n</xm` +
            "p>\n<!-- FEZ code end -->",
          `<!-- HTML code start -->\n${demo}\n<!-- HTML code end -->`,
        ];

        const data = {
          title: "Fez component - " + name,
          html: body.join("\n\n"),
          css: "body { padding-top: 50px; }",
          js: "",
          editors: "100",
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
        Fez.demo.apply(name, el);
      }

      renderInfo(el) {
        const name = el.dataset.name;
        const data = Fez.demo.get(name);
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
      }
      .fez-demo-item {
        margin-bottom: 40px;
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
        overflow: hidden;
      }
      .fez-demo-content {
        min-height: 50px;
      }
      .fez-demo-info {
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
      .fez-demo-btn {
        padding: 8px 16px;
        border: 1px solid #ccc;
        background: #fff;
        border-radius: 4px;
        cursor: pointer;
        &:hover { background: #f0f0f0; }
      }`;
      }

      HTML() {
        return `{#if state.ready}
        {#each state.components as name}
          <div class="fez-demo-item">
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
      {:else}
        <div style="padding: 40px; text-align: center; color: #888;">Loading components...</div>
      {/if}`;
      }
    },
  );
};

// Only load defaults if Fez is available and DOM exists
if (
  typeof Fez !== "undefined" &&
  Fez &&
  typeof document !== "undefined" &&
  document.head
) {
  loadDefaults();
}

// Export for use in tests
export { loadDefaults };
