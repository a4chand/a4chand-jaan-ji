// A4CHAND Jaan ji — local runner (no source changes).
// Serves the built website from this folder and proxies /api to the API server.
// Usage:  PORT=5000 API_PORT=5001 DATABASE_URL='postgres://USER:PASS@HOST:5432/DB' SESSION_SECRET='a-random-secret' node server.mjs
// It starts the API server (api-server/index.mjs) itself on API_PORT.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = DIR; // index.html, assets, manifest, icons live here
const PORT = Number(process.env.PORT || 5000);
const API_PORT = Number(process.env.API_PORT || 5001);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain" };

if (!process.env.DATABASE_URL) { console.error("ERROR: DATABASE_URL must be set, e.g. postgres://a4chand:PASSWORD@localhost:5432/a4chand"); process.exit(1); }
if (!process.env.SESSION_SECRET) { console.error("ERROR: SESSION_SECRET must be set to a long random string"); process.exit(1); }

const api = spawn("node", ["--enable-source-maps", path.join(DIR, "api-server", "index.mjs")], {
  env: { ...process.env, PORT: String(API_PORT) }, stdio: "inherit",
});
api.on("exit", (c) => { console.error("API server exited with code", c); process.exit(c ?? 1); });

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (url.pathname.startsWith("/api/") || url.pathname === "/api") {
    const proxy = http.request({ host: "127.0.0.1", port: API_PORT, path: url.pathname + url.search, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` } }, (pres) => {
      res.writeHead(pres.statusCode, pres.headers);
      pres.pipe(res);
    });
    proxy.on("error", (e) => { res.writeHead(502); res.end("API server not reachable: " + e.message); });
    req.pipe(proxy);
    return;
  }
  let p = path.join(ROOT, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, "index.html"); // SPA fallback
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
server.listen(PORT, "0.0.0.0", () => console.log(`A4CHAND Jaan ji running at http://localhost:${PORT}  (API on ${API_PORT})`));
