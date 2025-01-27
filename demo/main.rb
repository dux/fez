def escape str
  str
    .gsub('<', '&lt;')
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
      <div class="body" id="body-#{name}" style="padding-top: 50px;">
          #{body[1]}
      </div>
      <div>
        <div style="text-align: right; position: relative; top: 20px;">
          <button onclick="applyChanges('#{name}')" style="padding: 5px 10px;">Apply changes</button>
        </div>
        <app-editor id="html-#{name}" file="#{filePath.sub(/\.\w+$/,'.html')}" language="html">
           #{escape(body[1])}
        </app-editor>

        <br />

        <app-editor id="code-ui-#{name}" file="#{filePath}">
           #{escape(File.read(filePath))}
        </app-editor>
      </div>
    </div>
  }

  out.join($/)
end
