const http = require('http');
const fs = require('fs');
const path = require('path');
const mime = require('mime').default;
const PORT = 8000

http.createServer((req, res) => {
  try {
    let pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
    let filePath = path.join(process.cwd(), decodeURIComponent(pathname));

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        console.log(`[404] ${req.method} ${pathname}`);
        res.end('Not found');
        return;
      }

      const contentType = mime.getType(filePath) || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      console.log(`[200] ${req.method} ${pathname} -> ${contentType}`);
      res.end(content);
    });
  } catch (e) {
    res.writeHead(500);
    console.log(`[500] ${req.method} ${req.url} - ${e.message}`);
    res.end('Internal Server Error');
  }
}).listen(PORT, () => {
  console.log('[SERVER STARTED] http://localhost:8000');
});
