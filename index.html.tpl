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
        <div class="body">
           #{body[1]}
        </div>
        <div>
          <div class="relative">
            <pre>
              <code class="language-javascript" id="fez-#{name}-js">
#{escape(File.read("./demo/fez/#{name}.js"))}
              </code>
            </pre>
          </div>

          <div class="relative">
            <pre>
              <code class="language-html" id="fez-#{name}-html">
#{escape(body[1])}
</code>
            <pre>
          </div>
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
  <link rel="icon" href="./demo/fez.png">
  <link rel="stylesheet" href="./demo/main.css" />
  <link rel="stylesheet" href="./demo/hjs-theme.css" />
  <link rel="stylesheet" href="https://unpkg.com/highlightjs-copy/dist/highlightjs-copy.min.css" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>  <script src="https://code.jquery.com/jquery-3.7.1.min.js" integrity="sha256-/JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/highlightjs-copy/dist/highlightjs-copy.min.js"></script>
  <script src="./dist/fez.js"></script>
  <script>
    hljs.highlightAll();
    hljs.addPlugin(new CopyButtonPlugin());
  </script>
  <script>
    function timeSince(date) {
        const now = new Date();
        const secondsPast = (now.getTime() - new Date(date).getTime()) / 1000;

        if (secondsPast < 60) {
            return `just now`;
        }
        if (secondsPast < 3600) { // less than 60 minutes
            const minutes = Math.floor(secondsPast / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        }
        if (secondsPast < 86400) { // less than 24 hours
            const hours = Math.floor(secondsPast / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        }
        if (secondsPast < 2592000) { // less than 30 days
            const days = Math.floor(secondsPast / 86400);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
        if (secondsPast < 31536000) { // less than 12 months
            const months = Math.floor(secondsPast / 2592000);
            return `${months} month${months > 1 ? 's' : ''} ago`;
        }
        const years = Math.floor(secondsPast / 31536000);
        return `${years} year${years > 1 ? 's' : ''} ago`;
    }

    window.L = console.log
</script>
</head>
<body>
  <img src="./demo/fez.png" style="height: 128px; float: right; margin-bottom: -100px;" />
  <h1>
    Fez demo components
    &sdot;
    <a target="playground" href="https://jsitor.com/QoResUvMc">playground</a>
    &sdot;
    <a target="repo" href="https://github.com/dux/fez">GitHub repo</a>
  </h1>

  <p>Fez was created by <a href="https://github.com/dux/">@dux</a> in 2024. Latest update was <script>document.write(timeSince('<%= `git log -1 --format=%cd`.chomp %>'))</script>.

  <%= fez('clock') %>
  <%= fez('todo') %>
  <%= fez('form') %>
  <%= fez('time') %>
  <%= fez('icon') %>
  <%= fez('pubsub') %>
  <%= fez('list') %>
  <%= fez('tabs') %>
</body>
</html>

