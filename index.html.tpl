<%
  def escape str
    str.gsub '<', '&lt;'
  end

  def fez name
    body = File.read("./demo/fez/#{name}.html").split(/\s*\n\s*/, 2)

    %{
      <script src="./demo/fez/#{name}.js"></script>
      <h2>
        ui-#{name}
        &sdot;
        <small>#{body[0]}</small>
      </h2>

      <div class="flex">
        <div>
#{body[1]}
        </div>
        <div><pre style="position: relative; top: -23px;"><code class="language-javascript">
#{escape(File.read("./demo/fez/#{name}.js"))}
</code></pre>

<pre><code class="language-html">
#{escape(body[1])}
</code></pre>
        </div>
      </div>
    }
  end
%>

<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test</title>
  <link rel="stylesheet" href="./demo/main.css" />
  <link rel="stylesheet" href="./demo/hjs-theme.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>  <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
  <script src="./dist/fez.js"></script>
  <script>hljs.highlightAll();</script>
</head>
<body>
  <h1>
    Fez demo components
    &sdot;
    <a target="playground" href="https://jsitor.com/QoResUvMc">playground</a>
  </h1>

  <%= fez('box') %>
  <%= fez('form') %>
  <%= fez('time') %>
  <%= fez('icon') %>
  <%= fez('pubsub') %>
  <%= fez('list') %>
</body>
</html>

