// Highlight all Fez elements with their names
const highlightAll = () => {
  // Only work if Fez.DEV is true OR (port is above 2999 and Fez.DEV is not false)
  const port = parseInt(window.location.port) || 80;
  if (!(Fez.DEV === true || (port > 2999 && Fez.DEV !== false))) return;

  // Check if highlights already exist
  const existingHighlights = document.querySelectorAll('.fez-highlight-overlay');

  if (existingHighlights.length > 0) {
    // Remove existing highlights
    existingHighlights.forEach(el => el.remove());
    return;
  }

  // Find all Fez and Svelte elements
  const allElements = document.querySelectorAll('.fez, .svelte');

  allElements.forEach(el => {
    let componentName = null;
    let componentType = null;

    // Check for Fez component
    if (el.classList.contains('fez') && el.fez && el.fez.fezName) {
      componentName = el.fez.fezName;
      componentType = 'fez';
    }
    // Check for Svelte component
    else if (el.classList.contains('svelte') && el.svelte && el.svelte.svelteName) {
      componentName = el.svelte.svelteName;
      componentType = 'svelte';
    }

    if (componentName) {
      // Create overlay div
      const overlay = document.createElement('div');
      overlay.className = 'fez-highlight-overlay';

      // Get element position
      const rect = el.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      // Style the overlay
      overlay.style.cssText = `
        position: absolute;
        top: ${rect.top + scrollTop}px;
        left: ${rect.left + scrollLeft}px;
        width: ${rect.width}px;
        height: ${rect.height}px;
        border: 1px solid ${componentType === 'svelte' ? 'blue' : 'red'};
        pointer-events: none;
        z-index: 9999;
      `;

      // Create label for component name
      const label = document.createElement('div');
      label.textContent = componentName;
      label.style.cssText = `
        position: absolute;
        top: -20px;
        left: 0;
        background: ${componentType === 'svelte' ? 'blue' : 'red'};
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

      // Add click handler to dump the node
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        Fez.dump(el);
      });

      overlay.appendChild(label);
      document.body.appendChild(overlay);
    }
  });
}

// Bind Ctrl+E to highlightAll
document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'e') {
    // Check if target is not inside a form
    if (!event.target.closest('form')) {
      event.preventDefault();
      highlightAll();
    }
  }
});

export default highlightAll
