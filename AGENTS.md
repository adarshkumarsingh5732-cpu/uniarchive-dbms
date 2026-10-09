# AGENTS.md — UniArchive (DBMS edition)

> **This is a living handoff document.** If you (an AI agent) change the project,
> **update this file in the same session** — especially the *Current status*,
> *Gotchas* and *Changelog* sections — so the next agent can continue without
> re-deriving everything. Keep it accurate; delete stale claims.

Machine-level rules (shell, paths, package managers, hardware) live in the
user's global `~/AGENTS.md`. Read that too. This file is only about this repo.

---

## 1. What this is

A course-resource sharing platform for university students (browse / filter /
search / upload / download study material, comment, analytics). It began as a
hackathon prototype on **MongoDB** and has been ported to a **normalized
relational database (MySQL / MariaDB)** so it can be presented as a DBMS case
study. The relational design is the point of the project now, not just the app.

## 2. Stack & layout

| Layer | Technology |
|-------|------------|
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS v4 (compiled via `@tailwindcss/vite`) |
| Backend | Node + Express 4 + `mysql2` (connection pool) |
| Database | MySQL 8 / MariaDB — 14 relations in 3NF |

```
db/                     DDL + DML (the relational design)
  schema.sql            creates DB + 14 tables, FKs, CHECKs, view
  seed.sql              sample data (set-based SQL for the activity grid)
  README.md             schema reference
server/
  src/config/db.ts      mysql2 pool + query/queryOne/execute/withTransaction
  src/repositories/     ALL SQL lives here (resources, stats, auth)
  src/controllers/      thin request handlers / business rules
  src/routes/           REST routes
  src/seed/seed.ts      applies db/schema.sql then db/seed.sql
  src/middleware/       multer upload filter
  src/utils/            cloudinary, email
  test/                 node:test suites (schema + API)
components/             React UI
  Analytics.tsx         lazily loaded; the only importer of recharts
index.css               Tailwind entry + @theme tokens + runtime palette
services/api.ts         the ONLY place the frontend talks to the API
types.ts                shared frontend types == API contract
docs/case-study.md      the DBMS case study (all 11 required stages)
```

`Resource.id` is a **string** on the wire (matches `types.ts` and the route
param). Keep it that way — the repository casts the integer PK with `String()`.

## 3. Current status

**Done and verified** (see §8 for how to re-verify):

- MongoDB → MySQL port complete. Mongoose models (`server/src/models/`) were
  **deleted** and replaced by `server/src/repositories/`.
- `db/schema.sql` + `db/seed.sql` apply cleanly via `npm run db:reset`;
  10 resources, 34 topic links, 3 comments, 2,912 activity rows, **1 user**
  (admin123 / admin123@uniarchive.local, role=admin, is_verified=1).
- Backend + frontend both build; `tsc --noEmit` clean.
- **29 tests; 28 pass.** `UNIQUE constraints prevent duplicate keys`
  (`server/test/schema.test.ts`) fails on every clean run: it asserts that
  inserting `stat_god_99` is rejected, but the seed was collapsed to a single
  user (`f71895e`), so nothing is there to collide with. The test's own INSERT
  then creates the row, which is why a *second* run in the same database passes.
  Re-add the user to `db/seed.sql` or change the assertion to fix it properly.
- API contract unchanged for existing endpoints; a new
  `POST /api/auth/login` was added (returns the same `User` shape as
  `/api/auth/verify`).
- Published: **github.com/amorfati3735/uniarchive-dbms** (public).
  `origin` = that repo, `upstream` = the original `amorfati3735/uniarchive`.
  New work is on branch **feature/demo-login** (commit `f71895e`).
- Performance pass done: Tailwind CDN replaced with a compiled v4 build, entry
  bundle code-split (recharts + overlays deferred), mock data removed from the
  bundle, and API responses gzipped. Initial JS+CSS ~198 kB → ~95 kB gzip; the
  first paint fetches only `index.js`, `index.css` and `react.js`.
- Correctness/cleanup pass: the deployment entry (`api/index.ts` → `server/src`)
  was broken on Vercel because the root `package.json` still shipped `mongoose`
  and had no `mysql2`/`compression` — root deps now mirror the server. Also:
  OTP verification now creates a verified `users` row and throttles resends,
  uploads are attributed to the signed-in user, theme/library persist across
  reloads, the fake dashboard numbers were replaced with real data, the API has
  a JSON 404 + error handler, and the app calls `/api` relatively (Vite proxy).

**PDF preview + local dev fixes (2026-10-09 session):**
- Added `GET /api/resources/:id/preview` (`resourceController.previewResourceHandler`):
  fetches the stored `pdf_url` server-side and re-serves the bytes with
  `Content-Disposition: inline`, a sniffed `Content-Type`, and
  `Cache-Control: no-store`. `ResourceViewer.tsx` embeds this endpoint instead
  of the raw `pdf_url`. See §7 for why both the disposition *and* the type
  matter.
- `server/src/app.ts`: `PORT` is parsed with `Number(...)`, and `shutdown()`
  now calls `server.closeIdleConnections()` plus a 2s `unref`'d backstop. Without
  this, `tsx watch` hung on SIGTERM (browsers and the Vite proxy hold keep-alive
  sockets open, so `server.close()`'s callback never fired), force-killed the
  child every 5s, and respawned in a loop.
- `LoginOverlay.tsx` now logs in with the **username** (`admin123`), not the
  email — `/api/auth/login` matches `username`.
- Local `.env` sets `PORT=5001`, so `vite.config.ts` proxies `/api` to 5001.
  The committed default remains 5000; override with `VITE_API_PROXY` if you
  change the port back.

**Auth (this session):**
- Added `POST /api/auth/login` (username + password). Demo credential:
  **admin123 / scse**. Password stored as `SHA-256(password)` in
  `users.password_hash` — **demo-only, not production-grade**; do not reuse
  this scheme for a real deployment.
- Frontend `LoginOverlay` is now a single email+password form pre-filled with
  the demo credential; it calls `api.login()` and writes the returned user to
  localStorage exactly as the old OTP path did.
- OTP endpoints (`POST /api/auth/otp`, `/api/auth/verify`) still exist but are
  fenced behind `smtpReady()` — they return **503** with a pointer to
  `/api/auth/login` when SMTP is absent, so the demo deploy does not crash.
- Uploads (`POST /api/resources`) now work when Cloudinary is configured:
  `multer` (memoryStorage, PDF/image/doc filter, 25 MB) → Cloudinary →
  `createResource`. The frontend `UploadOverlay` sends `FormData { file, data }`.

**Vercel services-mode deploy config (2026-10-09):**
- Root `vercel.json` moved from the single-function setup to Vercel **Services**
  (Beta): `frontend` (Vite, root `.`, output `dist`) + `backend` (Express, root
  `server/`, entrypoint `dist/app.js`, `buildCommand: npm run build`).
  Top-level rewrites, specific → catch-all: host `api.*` → `backend`,
  `/api/(.*)` → `backend`, everything else → `frontend`; CORS headers kept
  top-level. The `frontend` service carries a service-scoped
  `/(.*) → /index.html` so SPA deep links (`/library`, `/subject/:code`) work.
  The `api.*` host rule only fires where a custom `api.<domain>` is attached in
  the Vercel dashboard — preview URLs are single-host, where `/api/*` still
  serves the same API.
- Services receive the **original path**, so Express's `/api/*` mounts match the
  rewrite unchanged — no client edits (`services/api.ts` already calls `/api`
  relatively).
- **No bindings**: nothing calls another service. The browser uses the public
  `/api` rewrite; the API's outbound calls (Cloudinary, NVIDIA, SMTP) are
  external SaaS, not Vercel services.
- Removed the legacy `api/index.ts` + `api/ping.ts` (superseded — `/api` is now
  owned entirely by the `backend` service; use `GET /api/health` as the smoke
  test).
- Verified: config schema-valid, both service builds green, and 7/7 route
  checks pass under `npx vercel dev -L --port 4999` (health, search, `/`,
  `/library`, `/subject/CSE2003`, JSON 404, preview `206`). **Not deployed** —
  see §7/§9: an external MySQL + Vercel env vars are still required.

**Credentials imported this session:**
- `server/.env` (gitignored, NOT committed) now holds Cloudinary/SMTP/NVIDIA
  keys copied from `downloads/random shi/uniarchive/server/.env`. The local DB
  stays the anonymous user (`DB_USER=` / `DB_PASSWORD=` empty) for the local
  MariaDB that only allows `root` via Unix socket.
- **Cloudinary key verified working** (listed the cloud's resources).
- **SMTP key does NOT work** with these credentials: `535 5.7.8 Username and
  Password not accepted`. The imported `SMTP_PASS` is 19 chars with spaces
  (`fdoa guoo jicg jbsx`); real Gmail app passwords are 16 chars with no spaces.
  OTP email will fail until this is fixed.
- **NVIDIA key does NOT work** with these credentials: the API returned a JSON
  parse error on the Bearer token. AI chat will fail until this is fixed.
- **Result:** browsing / search / detail / comments / counters / stats / upload
  (via Cloudinary) all work; OTP-email and AI-chat do not (bad keys, not a
  code bug).

**Not done / optional** (see §9): dedicated DB user, rendered ER image,
fixing the broken SMTP/NVIDIA keys, any deployment.

## 4. Run it

```bash
# --- database ---
cd server && npm install
npm run db:reset          # applies db/schema.sql + db/seed.sql (WIPES the DB)
# or raw:
#   mariadb < db/schema.sql
#   mariadb test_uniarchive < db/seed.sql

# --- backend ---
npm run dev               # http://localhost:5000  (tsx watch)
npm test                  # 29 checks; reseeds a SEPARATE test DB (see below)
npm run build && npm start
npm run typecheck

# --- frontend (repo root) ---
npm install && npm run dev   # Vite, port 3000
```

## 5. Environment specifics

- **Database:** MariaDB on `127.0.0.1:3306`, database **`test_uniarchive`**.
- This name is deliberate: the local MariaDB grants `PUBLIC` privileges only on
  `test` and `test_%` databases, and `root` is `unix_socket`-only (no
  passwordless `sudo`), so the app connects as the **anonymous user** with empty
  `DB_USER` / `DB_PASSWORD`. If you create a real user, update `server/.env`.
- Config: `server/.env` (gitignored) with template `server/.env.example`.
- Node is v26; MariaDB 12.3. `mysql2` pool has `decimalNumbers: true`, so
  `DECIMAL` columns arrive as JS numbers (repositories still `Number()`-cast
  defensively).

## 6. Conventions — follow these

1. **All SQL lives in `server/src/repositories/`.** Controllers call repository
   functions; they never build queries. Keep it that way.
2. **Always use bound parameters** (`?`) — never string-concatenate values.
3. **Multi-table writes go in `withTransaction`** (see `createResource`).
4. **ESM `.js` specifiers.** Internal imports are written as `'./x.js'` even
   though the files are `.ts`. Do not "fix" these to extensionless imports.
5. **`tsx`, not `ts-node`.** `ts-node` cannot resolve the `.js` ESM specifiers
   used across `server/src`; `npm run dev` / `seed` use `tsx`.
6. **The API contract is frozen** to match `types.ts` / `services/api.ts`
   (camelCase fields, `id` not `resource_id`, ISO date strings, `topics` as a
   string array). If you change a response shape you **must** update the
   frontend types and `services/api.ts` in the same change.
   The client calls `/api` **relatively** — Vite proxies it in dev
   (`vite.config.ts`, both `server` and `preview`) and `vercel.json` rewrites it
   in prod. Never hard-code `http://localhost:5000` in the frontend.
7. **Schema changes** go in `db/schema.sql` (and `db/seed.sql`), and the
   repositories/tests must be updated to match.
8. **Never commit `.env`** or real credentials. `.env.example` is tracked and
   must stay placeholder-only.
9. **Tailwind is compiled, not a CDN.** The theme lives in `index.css` under
   `@theme inline`; add new design tokens there, never re-add
   `<script src="https://cdn.tailwindcss.com">`. The runtime palette is the
   `--uni-*` custom properties (`:root` = dark, `[data-theme=light]` = light).
10. **Heavy UI must stay lazy.** `recharts` and the overlays are loaded via
    `React.lazy`; keep new heavy deps out of the entry chunk (add a
    `manualChunks` entry in `vite.config.ts` if needed).
11. Commits keep the original hackathon history; new commits are added on top.
   **Do not backdate commits or fabricate history.**
12. **Do NOT add a code agent / AI assistant as a co-author or contributor.**
   This repo is a personal college submission. Commit messages must not contain
   `Co-Authored-By: <agent>` trailers or `Generated with <agent>` lines, and no
   agent account may be added under *Settings → Collaborators*. Agents working
   in this repo should commit plainly, with no such footer. (11 older commits in
   this history do carry the trailer — they are historical, not a precedent, and
   rewriting them would require a force-push.)

## 7. Gotchas / failure modes

- ⚠ **`db/schema.sql` starts with `DROP DATABASE IF EXISTS test_uniarchive`.**
  Running it (or `npm run db:reset`) destroys all data — including uploaded
  rows (the files survive on Cloudinary, but the DB rows do not).
- **`npm test` no longer touches the dev database.** `pretest`/`test` run with
  `DB_NAME=test_uniarchive_test`, and `seed.ts` rewrites the hard-coded
  `` `test_uniarchive` `` identifier in `schema.sql`/`seed.sql` to `DB_NAME`.
  So the suite drops/recreates `test_uniarchive_test` and leaves
  `test_uniarchive` (and your uploads) alone. `dotenv` does not override an
  already-set env var, which is what makes the override stick. Use
  `npm run db:reset` when you *do* want the dev DB rebuilt.
- Tests use `--test-force-exit` because the mysql pool / undici keep-alive hold
  the event loop open.
- `server/src/app.ts` binds port 5000 **unless `process.env.VERCEL` is set**
  (tests set it to `1` and bind an ephemeral port themselves). Don't reintroduce
  an `argv`-based listen guard.
- **Vercel is services-mode** (root `vercel.json`): host `api.*` and `/api/*`
  → `backend` service, everything else → `frontend`. Vercel preserves the
  original path (no stripping), so Express's `/api/*` mounts must keep that
  prefix. The `frontend` service's service-scoped `/(.*) → /index.html` is
  load-bearing — remove it and deep links 404. Routing into a service is final:
  unmatched `/api/...` paths are answered by Express's JSON 404, never by the
  SPA fallback.
- **A Vercel deployment needs an external MySQL**: the local MariaDB is
  unreachable from Vercel, so set `DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME`
  (plus Cloudinary/SMTP/NVIDIA keys) in the Vercel project env. `server/.env` is
  gitignored and NOT deployed; bindings and env vars do not resolve at build
  time.
- **Seed FK gotcha (real, not theoretical):** `db/seed.sql` must keep
  `SET FOREIGN_KEY_CHECKS = 0` active through the whole data load. Putting
  `SET FOREIGN_KEY_CHECKS = 1` between the TRUNCATEs and the INSERTs made the
  batch fail at the `resources` INSERT with `fk_resources_author` even though
  `users(user_id=1)` existed — standalone INSERT worked, batch did not. If you
  touch the seed, verify `npm run db:reset` imports **all 10 resources** (not
  0 or 1) and that `GET /api/resources` returns 10.
- **Seed author gotcha:** every `resources` row's `author_id` must reference an
  existing `users.user_id`. With a single demo user (user_id=1), all 10
  resources must use `author_id=1`; otherwise the RESOURCE_SELECT JOIN filters
  them out and the API returns fewer than 10 resources even though the table has
  10 rows.
- ⚠ **Cloudinary `raw` assets break browser preview unless re-labelled.** PDFs
  are uploaded with `resource_type: 'raw'`, and Cloudinary then serves them as
  `content-type: application/octet-stream` **and**
  `content-disposition: attachment`, with no file extension in the URL. Embedded
  directly, the browser downloads the file instead of previewing it. That is why
  the seeded rows (real `application/pdf` from w3.org) previewed while every
  upload did not. `GET /api/resources/:id/preview` fixes both: it forces
  `Content-Disposition: inline` and sniffs the `%PDF-` magic bytes to set
  `Content-Type: application/pdf` regardless of what the host claims.
- The preview endpoint caches bytes in-process (64 entries, 5-min TTL) and
  honours single byte ranges (`206` + `Content-Range`, `416` when unsatisfiable,
  `Accept-Ranges: bytes`), so the browser's PDF viewer can stream/seek. It still
  buffers the whole file in memory, so it is a demo-scale design, not a CDN.
- Cloudinary, SMTP and the AI endpoint need real keys. With empty keys only the
  **upload, OTP-email and AI-chat** features fail — listing, search, detail,
  comments, counters and stats all work without them (seeded data).
- **Imported keys are not all valid:** the Cloudinary key works; the imported
  SMTP and NVIDIA keys do not (see §3). Do not assume importing a `.env` from
  another copy makes those services work.
- The `pkill` footgun: `pkill -f "dist/app.js"` matches the shell command that
  contains that string and kills itself. Use `pgrep`/kill by PID, or a bracket
  pattern that the command line doesn't contain.
- The Vite **dev server is on port 3000** (not 5173) and binds `0.0.0.0`.
- **Root `package.json` still mirrors the backend deps** (express, mysql2, …)
  from the old `api/index.ts` deploy path, which no longer exists. The Vercel
  `backend` service installs from `server/package.json` only, so **new backend
  deps go in `server/package.json`**. The root mirror is now dead weight (it can
  be pruned, but that regenerates the root lockfile).
- Run the API detached so it survives across tool sessions:
  `setsid nohup node dist/app.js > /tmp/ua_api.log 2>&1 < /dev/null &`
- If a resource route renders the Discover page instead of the viewer, the API
  is returning numeric ids again — `Resource.id` must be a string.
- `resources.upvotes/downloads/views` are **intentional** denormalized counters
  (documented in `docs/case-study.md`). Don't "normalize" them away without
  updating the case study.
- **The demo password is trivial** (`scse`, SHA-256 only). Anyone with the demo
  credential can log in. This is fine for a local demo, not for anything public.

## 8. How to verify a change

```bash
cd server
npm run typecheck                 # must be clean
npm test                          # 28/29 (see §3); ⚠ reseeds → WIPES uploads
npm run build                     # dist/ must compile
npm run dev &                     # then exercise the API:
curl -s localhost:5000/api/health
curl -s "localhost:5000/api/resources?search=k-map"
curl -s localhost:5000/api/stats | head -c 200
curl -s -X POST localhost:5000/api/resources/1/upvote
# PDF preview must come back inline as a PDF (not octet-stream / attachment)
curl -sI localhost:5000/api/resources/1/preview | grep -iE 'content-type|content-disposition'

cd .. && npm run build            # frontend must build
mariadb test_uniarchive -e "SELECT * FROM v_course_overview;"
```

When you change tests, prefer fixing the cause over weakening assertions. Do not
add suppressions to make checks pass.

## 9. Roadmap / optional work

- [x] Demo password login without SMTP (`POST /api/auth/login`, admin123/scse).
- [x] Collapse seed to a single demo user + fix seed FK/author bugs.
- [x] Import Cloudinary/SMTP/NVIDIA keys from the downloaded copy (Cloudinary
      works; SMTP + NVIDIA keys are bad and need regeneration).
- [ ] Fix the bad SMTP + NVIDIA keys (regenerate Gmail app password / NVIDIA
      key) so OTP email + AI chat work.
- [ ] Create a dedicated MariaDB user + password instead of the anonymous user.
- [ ] Render the ER/EER diagram to an image (PlantUML / draw.io) for submission.
- [ ] Add the architecture note to the user's global `~/AGENTS.md` if desired.
- [ ] Deploy (services-mode `vercel.json` verified end-to-end with
      `npx vercel dev -L`; legacy `api/` entries removed. Blocked on an external
      MySQL + Vercel env vars).
- [ ] Server-side pagination for `/api/resources` (currently returns everything).
- [ ] Self-host the Google Fonts (3 families are still render-blocking).
- [ ] Real sessions: OTP proves identity but issues no token, so the client
      trusts a localStorage user object. Fine for the case study, not for prod.
- [ ] Accessibility: several clickable `<div>`s should be `<button>`/links.
- [ ] `/api/stats` always ships the 364-point activity grid even though only the
      subject-detail view needs it.

## 10. Maintenance protocol (for agents)

1. Read this file and `~/AGENTS.md` before starting.
2. After any change: update **§3 Current status**, **§7 Gotchas** if you hit a new
   one, and add an entry to **§11 Changelog**.
3. Keep the file short enough to scan — link out to `docs/case-study.md` and
   `db/README.md` rather than duplicating them.
4. If something here is no longer true, **delete it**; a stale handoff doc is
   worse than none.

## 11. Changelog

| Date | Change |
|------|--------|
| 2026-10-06 | Initial `AGENTS.md`. Recorded the MongoDB → MySQL port, 3NF schema (14 relations), repository layer, 24-test suite, docs, and publication to `amorfati3735/uniarchive-dbms`. |
| 2026-10-06 | Performance pass: Tailwind v4 compiled build (CDN removed), code splitting (`Analytics`/overlays lazy, `manualChunks`), mock data dropped from the client, API gzip, native PDF viewer. Fixed `Resource.id` to be a string (was breaking `/resource/:id`). |
| 2026-10-06 | Correctness/cleanup pass: fixed the broken Vercel deps (root now mirrors the server, no more mongoose), OTP creates a verified user + throttles resends, uploads attributed to the logged-in user, theme/library persisted, real dashboard stats (removed hardcoded numbers), configurable CORS + optional email-domain gate, JSON 404/error handler, graceful shutdown, relative `/api` + Vite proxy, `tw-animate-css` (the `animate-in` classes were no-ops), dead `uploads/` dir removed, auth tests added (29 total). |
| 2026-10-09 | Added §6.12: do not credit a code agent as a co-author/contributor, and do not add such trailers to commit messages (college submission). |
| 2026-10-09 | Hardening pass: `npm test` now seeds/drops `test_uniarchive_test` (via `DB_NAME` substitution in `seed.ts`) instead of the dev DB, so running tests no longer destroys uploads. Fixed the flaky `schema.test.ts` UNIQUE test to create its own colliding row (it had assumed a seed user removed in `f71895e`) — suite is now 29/29. Preview endpoint gained `Accept-Ranges`/`206`/`416` byte-range support and a bounded in-process cache. `vite.config.ts` default proxy reverted to the documented `localhost:5000`, with the local override moved to a gitignored root `.env` (`VITE_API_PROXY`). `.gitignore` hardened (`.env.*` with `!.env.example`, `*.pem`, `*.key`). |
| 2026-10-09 | PDF preview + dev-server fixes: added `GET /api/resources/:id/preview` (inline disposition + magic-byte content sniffing + `no-store`) and pointed `ResourceViewer` at it — uploads were downloading instead of rendering because Cloudinary serves `raw` PDFs as `attachment`/`octet-stream`. Fixed the `tsx watch` SIGTERM respawn loop in `server/src/app.ts` and parsed `PORT` as a number. `LoginOverlay` now authenticates with the username (`admin123`), not the email. Vite's `/api` proxy targets 5001 to match the local `.env`. Superseded the `.env` work below. |
| 2026-10-07 | Demo password login (branch `feature/demo-login`, commit `f71895e`): added `POST /api/auth/login` (admin123/scse, SHA-256 password, demo-only), rewrote `LoginOverlay` to a single email+password form, fenced OTP endpoints behind `smtpReady()` (503 when SMTP absent), added `password_hash` to `users`, collapsed seed to one user, and fixed two seed bugs that made `db:reset` import 0–1 resources (FK-checks-off-through-data-load + all resources use author_id=1). Imported Cloudinary/SMTP/NVIDIA keys from `downloads/random shi/uniarchive/server/.env` into `server/.env` (gitignored). Verified Cloudinary works; SMTP (535 5.7.8) and NVIDIA (JSON parse error on Bearer) keys are bad and need regeneration. |
| 2026-10-09 | Vercel **services-mode** config (confirmed with user): root `vercel.json` defines `frontend` (Vite, root `.`, output `dist`) + `backend` (Express, root `server/`, entrypoint `dist/app.js`), top-level rewrites host `api.*`→`backend`, then `/api/(.*)`→`backend`, then catch-all→`frontend`, plus a service-scoped `/(.*)→/index.html` SPA fallback; CORS headers kept top-level. Removed legacy `api/index.ts` + `api/ping.ts`. No bindings (browser→API is same-origin public; API→Cloudinary/AI/SMTP are external). Verified: schema-valid against openapi.vercel.sh, both service builds green, route checks under `npx vercel dev -L`. |
