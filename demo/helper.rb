require 'erb'
require 'amazing_print'

def read file
  file = file.sub('./demo/', '')
  File.read "./demo/#{file}"
end

def escape str
  str
    .gsub('<', '&lt;')
end

def erb source, arg = nil
  html = File.read('./demo/tpl/%s.erb.html' % source)
  @arg = arg
  ERB.new(html).result
end

def fileNames base
  Dir
    .glob("./demo/#{base}")
    .map {|f| f.split('/').last.split('.').first }
end

###

print erb(:index)

