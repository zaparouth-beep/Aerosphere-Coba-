// Minimal static server for the exported app in out/ (used by the e2e tests).
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "out");
const port = Number(process.argv[3] ?? 3400);
const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json", ".txt": "text/plain", ".woff2": "font/woff2", ".ico": "image/x-icon" };

http
  .createServer((req, res) => {
    const p = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const file = path.join(root, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const hit = [file, `${file}.html`, path.join(file, "index.html")].find((f) => f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile());
    if (!hit) {
      res.writeHead(404, { "content-type": "text/html" });
      return res.end(fs.readFileSync(path.join(root, "404.html")));
    }
    res.writeHead(200, { "content-type": types[path.extname(hit)] ?? "application/octet-stream" });
    fs.createReadStream(hit).pipe(res);
  })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
