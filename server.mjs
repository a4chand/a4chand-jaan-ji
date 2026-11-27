// A4CHAND Jaan ji — local runner (no source changes).
// Serves the built website from this folder and proxies /api to the API server.
// Also proxies the CHAND Graph + Load Generator app (analytics-tracking-dashboard.vercel.app)
// under /slots-app/ on this same origin, so it can open inside the A4CHAND panel
// (the upstream site sends X-Frame-Options: SAMEORIGIN, so a direct iframe would be blank).
// Usage:  PORT=5000 API_PORT=5001 DATABASE_URL='postgres://USER:PASS@HOST:5432/DB' SESSION_SECRET='a-random-secret' node server.mjs
// It starts the API server (api-server/index.mjs) itself on API_PORT.
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = DIR; // index.html, assets, manifest, icons live here
const PORT = Number(process.env.PORT || 5000);
const API_PORT = Number(process.env.API_PORT || 5001);
const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

if (!process.env.DATABASE_URL) { console.error("ERROR: DATABASE_URL must be set, e.g. postgres://a4chand:PASSWORD@localhost:5432/a4chand"); process.exit(1); }
if (!process.env.SESSION_SECRET) { console.error("ERROR: SESSION_SECRET must be set to a long random string"); process.exit(1); }

const api = spawn("node", ["--enable-source-maps", path.join(DIR, "api-server", "index.mjs")], {
  env: { ...process.env, PORT: String(API_PORT) }, stdio: "inherit",
});
api.on("exit", (c) => { console.error("API server exited with code", c); process.exit(c ?? 1); });

// --- CHAND app proxy (same origin, so the iframe is allowed) ---
const SLOTS_HOST = "analytics-tracking-dashboard.vercel.app";

function rewriteLocation(value) {
  if (!value) return value;
  // Absolute upstream URL -> same-origin /slots-app/... path
  const abs = value.match(/^https?:\/\/analytics-tracking-dashboard\.vercel\.app(\/.*)?$/i);
  if (abs) return "/slots-app" + (abs[1] || "/");
  // Absolute path on the upstream site -> under /slots-app/, except the
  // asset/auth paths we also proxy at their absolute paths.
  if (value.startsWith("/") && !value.startsWith("/slots-app") && !value.startsWith("/_next/")) {
    return "/slots-app" + value;
  }
  return value;
}

function rewriteSetCookie(values) {
  if (!values) return undefined;
  const list = Array.isArray(values) ? values : [values];
  return list.map((c) => {
    let out = String(c).replace(/;\s*Domain=[^;]*/gi, "");
    if (/;\s*Path=\//i.test(out)) {
      out = out.replace(/;\s*Path=\//i, "; Path=/slots-app/");
    } else {
      out += "; Path=/slots-app/";
    }
    return out;
  });
}

function proxySlots(req, res, upstreamPath) {
  const headers = { ...req.headers };
  delete headers.connection;
  headers.host = SLOTS_HOST;
  const preq = https.request(
    { host: SLOTS_HOST, port: 443, path: upstreamPath, method: req.method, headers },
    (pres) => {
      const outHeaders = { ...pres.headers };
      // Allow this site to be framed by the A4CHAND panel (same origin).
      delete outHeaders["x-frame-options"];
      delete outHeaders["content-security-policy"];
      delete outHeaders["content-security-policy-report-only"];
      if (outHeaders.location) outHeaders.location = rewriteLocation(outHeaders.location);
      if (outHeaders["set-cookie"]) outHeaders["set-cookie"] = rewriteSetCookie(outHeaders["set-cookie"]);
      res.writeHead(pres.statusCode, outHeaders);
      pres.pipe(res);
    }
  );
  preq.on("error", (e) => { res.writeHead(502); res.end("CHAND app not reachable: " + e.message); });
  req.pipe(preq);
}

// Upstream paths for the CHAND app: /slots-app/* maps to upstream /*,
// and the absolute asset/auth paths its HTML references are proxied at
// the same absolute paths (A4CHAND has no routes there).
// Also proxied: /sign-up (the "Create an account" link), /_vercel/*
// (Vercel Insights script — served as JS, so an SPA-fallback HTML reply
// would throw "Unexpected token '<'"), and RSC prefetches / navigation
// that originate from inside the iframe (query ?_rsc= or a Referer under
// /slots-app/) for "/" — A4CHAND's own homepage is "/" without those.
function slotsUpstreamPath(req, pathname, search) {
  if (pathname === "/slots-app" || pathname === "/slots-app/") return "/" + search;
  if (pathname.startsWith("/slots-app/")) return pathname.slice("/slots-app".length) + search;
  if (pathname.startsWith("/_next/") || pathname.startsWith("/_vercel/") || pathname === "/sign-in" || pathname === "/sign-up" || pathname === "/manifest.webmanifest" || pathname === "/icon.svg" || pathname === "/apple-icon.png" || pathname === "/favicon.ico") {
    return pathname + search;
  }
  if (pathname === "/") {
    const url = new URL(req.url, "http://localhost");
    const referer = req.headers.referer || "";
    if (url.searchParams.has("_rsc") || referer.includes("/slots-app")) {
      return "/" + search;
    }
  }
  return null;
}

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
  const upstreamPath = slotsUpstreamPath(req, url.pathname, url.search);
  if (upstreamPath !== null) {
    proxySlots(req, res, upstreamPath);
    return;
  }
  let p = path.join(ROOT, url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname));
  if (!p.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  if (!fs.existsSync(p) || fs.statSync(p).isDirectory()) p = path.join(ROOT, "index.html"); // SPA fallback
  res.writeHead(200, { "content-type": MIME[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
});
server.listen(PORT, "0.0.0.0", () => console.log(`A4CHAND Jaan ji running at http://localhost:${PORT}  (API on ${API_PORT})`));
