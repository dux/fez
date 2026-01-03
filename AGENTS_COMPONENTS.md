If you are instructed to write fez component then ALLWAYS write it in
demo/fez/[name].fez

and write short html demo in
demo/fez/[name].html

in html write info block and usage data, no styles and html wrapper needed

<div class="info">
  <ul>
    <li>features ... <code>...</code></li>
  </ul>
</div>
<h4>Section info</h4> <!-- use h4 and only h4 for title -->
<div>more example data<div>

## FAST Rendering Guidelines

When creating Fez components, consider using the FAST property to control rendering timing:

* Set `FAST = true` for components that don't work with **slots**:
   * Components that generate their own content entirely
   * Components that don't need to preserve original child elements
   * Any component where slot content would be ignored anyway

