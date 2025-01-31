def escape str
  str
    .gsub('<', '&lt;')
end

def fez name
  body = File.read("./demo/fez/#{name}.html").split(/\n\s*\n/, 2)
  unless body[1]
    body[1] = body[0]
    body[0] = ''
  end


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
      <div class="body">
        <h2 style="margin-top: 0;">Demo: ui-#{name}</h2>
        #{body[0]}

        <div id="body-#{name}" style="padding-bottom: 20px;">
          #{body[1]}
        </div>

        <ui-editor name="#{name}" id="html-#{name}" file="#{filePath.sub(/\.\w+$/,'.html')}" language="html" :action="applyChanges">
           #{escape(body[1])}
        </ui-editor>
      </div>
      <div>
        <ui-editor id="code-ui-#{name}" file="#{filePath}" name="#{name}" :action="applyChanges">
           #{escape(File.read(filePath))}
        </ui-editor>
      </div>
    </div>
  }

  out.join($/)
end
