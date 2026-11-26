# A4CHAND Jaan ji — built website (same-to-same, no changes)

This folder is the **built** version of your app from the RAR you sent
(React frontend + Express API server). Nothing in the app itself was changed:
same name, same icon/logo (`icon-512.png`, `icon-192.png`, `dp.jpg`),
same login and pages.

## What is inside

- `index.html`, `assets/`, `manifest.json`, `icon-*.png`, `dp.jpg`, `sw.js`
  — the built website (frontend).
- `api-server/` — the rebuilt API server (`index.mjs` + pino workers).
  The old prebuilt server in the archive did not run outside Replit
  (it looked for files under a Replit path), so it was rebuilt from the
  same source with `pnpm --filter @workspace/api-server run build`.
- `server.mjs` — serves this website and proxies `/api` to the API server.
- `run.sh` — starts everything on one port.

## What you need (the app is full-stack, not a static page)

Login, dashboard, orders and panels need the API server **and** a
PostgreSQL database. A website link alone cannot do login without them.

1. **Node.js 24+** and **PostgreSQL 16** installed.
2. Create a database, e.g.:
   ```
   CREATE USER a4chand WITH PASSWORD 'choose-a-password';
   CREATE DATABASE a4chand OWNER a4chand;
   ```
3. Push the database tables (one time, from the original project folder):
   ```
   DATABASE_URL='postgres://a4chand:choose-a-password@localhost:5432/a4chand' \
     pnpm --filter @workspace/db run push
   ```
   (12 tables are created: users, panels, campaigns, history, orders slots, etc.)
4. Run:
   ```
   DATABASE_URL='postgres://a4chand:choose-a-password@localhost:5432/a4chand' \
   SESSION_SECRET='a-long-random-secret-you-make-up' \
   ./run.sh
   ```
   Then open http://localhost:5000 in any browser — PC or mobile.

## Verified on 2026-11-26 (this machine)

- Frontend build succeeded (`vite build`, 2806 modules).
- Website served on port 5000: index page HTTP 200, manifest + icon HTTP 200.
- API `GET /api/healthz` → `{"status":"ok"}`.
- Register + login via the website's API worked; `/api/auth/me` and
  `/api/stats/dashboard` returned data for the test user.
- New users start as `approved: false` and need an admin to approve them —
  that is how the app was built.

## Notes

- The admin account is created automatically by the server on first start
  from the email/password already hard-coded in the original source
  (a credential is hard-coded in source — change it in the source if you
  want a different admin login; it is not written in this README).
- `SESSION_SECRET` was **not** in your archive (it was a Replit secret),
  so you must set your own when hosting.
- For a public link (Vercel / Replit / a VPS), host this folder + a
  Postgres database there, set the same two environment variables
  (`DATABASE_URL`, `SESSION_SECRET`), and run `node server.mjs`.
  The APK needs the same hosted backend URL to log in — see the APK notes
  given with the APK file.
