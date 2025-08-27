# get node attributes
getAttributes = (node) ->
  attrs = {}

  for el in node.attributes
    if el.name.startsWith('on') && el.value[0] == '('
      el.value = new Function('arg1, arg2', "(#{el.value})(arg1, arg2)")
    if el.name.startsWith(':')
      el.value = new Function("return (#{el.value})").bind(node)()
      el.name = el.name.replace(':', '')
    attrs[el.name] = el.value

  if attrs['data-props']
    attrs = JSON.parse(attrs['data-props'])

  # pass props as json template
  # <script type="text/template">{...}</script>
  # <foo-bar data-json-template="true"></foo-bar>
  if attrs['data-json-template']
    prev = node.previousSibling
    if prev?.textContent
      attrs = JSON.parse(prev.textContent)
      prev.remove()

    # data = node.previousSibling?.textContent
    # if data
    #   attrs = JSON.parse(data)

  attrs

# passes root, use `Svelte(this.root.id)` or `this.root.svelte`  to get node pointer
# export onMount(instance, list, node) if you want to do stuff on mount
# connect DOM node to Svelte class instance
connect = (node, name, klass) ->
  return unless node.isConnected

  # TODO: get node name
  # (new klass(target: document.createElement('div'))).nodeName
  exported = Object.getOwnPropertyNames(klass.prototype)
  newNode = document.createElement(if exported.includes('nodeNameSpan') then 'span' else 'div')
  newNode.classList.add('svelte')
  newNode.classList.add("svelte-#{name}")
  newNode.id = node.id || "svelte_#{++Svelte.count}"

  # get attributes
  props = getAttributes(node)
  props.root ||= newNode
  props.oldRoot ||= node
  props.html ||= node.innerHTML

  # has to come after getAttributes
  node.parentNode.replaceChild(newNode, node);

  # bind node and pass all props as single props attribute
  exported = Reflect.ownKeys klass.prototype
  svelteProps = {}
  svelteProps.fast = true if exported.includes('fast') || exported.includes('FAST')
  svelteProps.props = props if exported.includes('props')
  svelteProps.root = newNode if exported.includes('root')
  svelteProps.self = "Svelte('#{newNode.id}')" if exported.includes('self')

  instance = newNode.svelte = new klass({target: newNode, props: svelteProps})
  instance.svelteName = name

  # fill slots
  # slot has to be named sslot (not slot)
  if slot = newNode.querySelector('sslot')
    while node.firstChild
      slot.parentNode.insertBefore(node.lastChild, slot.nextSibling);
    slot.parentNode.removeChild(slot)

  # in the end, call onmount
  if instance.onMount
    list = Array.from node.querySelectorAll(':scope > *')
    instance.onMount(instance, list, node)

# # #

# passes root, use `Svelte(this.root.id)` or `this.root.svelte`  to get node pointer
# export onMount(instance, list, node) if you want to do stuff on mount
# Svelte(node || node_id).toogle()
Svelte = (name, func) ->
  if name.nodeName
    # Svelte(this).close() -> return first parent svelte node
    while name = name.parentNode
      return name.svelte if name.svelte
  else
    name = '#' + name if name[0] != '#' && name[0] != '.'
    document.querySelector(name)?.svelte

Svelte.count = 0

# Creates custom DOM element
Svelte.connect = (name, klass) ->
  customElements.define name, class extends HTMLElement
    connectedCallback: ->
      # no not optimize requestAnimationFrame (try to avoid it)
      # because events in nested components are sometimes not propagated at all
      # export let fast
      # %s-menu-vertical{ fast_connect: true }

      # connect @, name, klass

      if klass.prototype.hasOwnProperty('fast') || klass.prototype.hasOwnProperty('FAST') || @getAttribute('fast_connect') || @getAttribute('data-props') || @getAttribute('data-json-template')
        connect @, name, klass
      else
        requestAnimationFrame =>
          connect @, name, klass

      # if document.readyState == 'loading'
      #   document.addEventListener 'DOMContentLoaded',
      #     => connect(@, name, klass)
      #   , once: true
      # else
      #   connect(@, name, klass)

# Creates HTML tag
Svelte.tag = (tag, opts = {}, html = '') ->
  json = JSON.stringify(opts).replaceAll("'", '&apos;')
  "<#{tag} data-props='#{json}'>#{html}</#{tag}>"

Svelte.bind = Svelte.connect
window.Svelte = Svelte
