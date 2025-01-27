def escape str
  str
    .gsub('<', '&lt;')
end

def fez name
  body = File.read("./demo/fez/#{name}.html")

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
    <div class="flex" style="border-top: 1px solid #ccc; margin-top: 40px;">
      <div class="body" id="body-#{name}" style="">
        <h2>ui-#{name}</h2>
        #{body}
      </div>
      <div>
        <div style="text-align: right; position: relative; top: 20px;">
          <button onclick="applyChanges('#{name}')" style="padding: 5px 10px;">Apply changes</button>
        </div>
        <app-editor id="html-#{name}" file="#{filePath.sub(/\.\w+$/,'.html')}" language="html">
           #{escape(body)}
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
