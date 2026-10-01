/* Minimal dev server for the test fixtures (no dependencies).
 *
 *   node test/serve.mjs
 *     -> http://localhost:8787/test/harness.html   (assertion harness)
 *     -> http://localhost:8787/admin/machines/     (mock, extension active)
 *     -> http://localhost:8787/admin/machines/?bare (mock, extension off)
 *
 * Everything else is served as a static file from the repo root.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8787);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const isMachines = (path) => path === "/admin/machines" || path.startsWith("/admin/machines/");

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const rel = url.pathname.replace(/^\/+/, "").replace(/\.\.(\/|\\|$)/g, "");
  const file = isMachines(url.pathname)
    ? join(ROOT, "test/mock.html")
    : join(ROOT, rel || "test/harness.html");

  let body;
  try {
    body = await readFile(file);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    return;
  }

  if (file.endsWith("mock.html") && url.searchParams.has("bare")) {
    body = Buffer.from(
      String(body)
        .replace('<link rel="stylesheet" href="/firefox/styles.css">', "")
        .replace('<script src="/firefox/content.js"></script>', "")
    );
  }

  res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
  res.end(body);
}).listen(PORT, () => {
  console.log(`test harness: http://localhost:${PORT}/test/harness.html`);
  console.log(`machines mock: http://localhost:${PORT}/admin/machines/`);
});
