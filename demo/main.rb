def escape str
  str.gsub '<', '&lt;'
end

def fez name
  body = File.read("./demo/fez/#{name}.html").split(/\s*\n\s*/, 2)

  base = "./demo/fez/#{name}"
  filePath = File.exist?("#{base}.js") ? "#{base}.js" : "#{base}.fez"

  out = []

  if filePath.include?('.fez')
    data = File.read filePath
    out.push %[<template fez="ui-#{name}">#{data}</template>]
  else
    out.push %[<script src="#{filePath}"></script>]
  end

  out.push %{
    <h2>
      ui-#{name}
      &sdot;
      <small>#{body[0]}</small>
    </h2>

    <div class="flex">
      <div class="body">
          #{body[1]}
      </div>
      <div>
        <div class="relative">
          <pre>
            <div style="margin-bottom: -30px;">#{filePath.sub(/\.\w+$/,'.html')}</div>
            <code class="language-html" id="fez-#{name}-html">
#{escape(body[1])}
</code>
          <pre>
        </div>

        <div class="relative">
          <pre>
            <div style="margin-bottom: -30px;">#{filePath}</div>
            <code class="language-javascript" id="fez-#{name}-js">
#{escape(File.read(filePath))}
            </code>
          </pre>
        </div>

      </div>
    </div>
  }

  out.join($/)
end
