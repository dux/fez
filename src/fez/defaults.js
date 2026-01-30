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
};

// Only load defaults if Fez is available
if (typeof Fez !== "undefined" && Fez) {
  loadDefaults();
}

// Export for use in tests
export { loadDefaults };
