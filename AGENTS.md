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
docs/improvements.md    prioritised improvement audit (measured numbers + backlog)
public/fonts/           self-hosted latin-subset woff2 (no Google Fonts)
server/storage/seed/    the 11 seeded course PDFs (committed; /files/seed/…)
server/storage/uploads/ runtime PDF uploads (gitignored)
```

`Resource.id` is a **string** on the wire (matches `types.ts` and the route
param). Keep it that way — the repository casts the integer PK with `String()`.

## 3. Current status

**Done and verified** (see §8 for how to re-verify):

- MongoDB → MySQL port complete. Mongoose models (`server/src/models/`) were
  **deleted** and replaced by `server/src/repositories/`.
- `db/schema.sql` + `db/seed.sql` apply cleanly via `npm run db:reset`;
  **11 real resources** (all previewable PDFs), 24 topic links, 7 comments,
  1,456 activity rows, **7 users**: `admin123` / `scse` (admin) and six students
  (`pratikambastha5`, `aarav.sharma`, `meera.iyer`, `rohan.gupta`, `ananya.rao`,
  `kabir.menon`) who all use `student123`.
- Backend + frontend both build; `tsc --noEmit` clean.
- **42 tests; 42 pass.** (`npm test` reseeds `test_uniarchive_test` first.)
- API contract unchanged for existing endpoints; `POST /api/auth/login` and
  `POST /api/auth/signup` return the same `User` shape as `/api/auth/verify`.
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
  `/library`, `/subject/CSE2003`, JSON 404, preview `206`). **Superseded by the
  2026-10-18 entry below — the services-mode config is no longer deployed.**

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

**Signup without SMTP + mobile layout (2026-10-18, later session):**
- `POST /api/auth/signup` (`{ username, email, password }`) creates a normal
  student account that works immediately — **no OTP, no SMTP**. 201 on success
  with `{ success, message, user }`; 400 on validation (username 3–30 of
  `[A-Za-z0-9._-]`, email shape, `ALLOWED_EMAIL_DOMAIN` if set, password ≥ 8);
  409 when the username or email is taken (pre-check + `ER_DUP_ENTRY` catch).
- Passwords for new accounts are **scrypt** (`scrypt$<salt>$<hash>`, salted,
  `timingSafeEqual` compare) via `hashPassword`/`verifyPassword` in
  `authRepository.ts`. The seeded demo row keeps its unsalted SHA-256 hash and
  `verifyPassword` still accepts that legacy format — see §7.
- `LoginOverlay` is now a two-tab modal (Sign in / Create account). The flow
  was verified end-to-end in headless Chrome at 390px: signup
  closes the modal, writes `uniarchive_user`, the navbar shows the username,
  and the same credential logs back in.
- Deployed: frontend re-deployed to **https://uniarchive.vercel.app**
  (`vercel deploy --prod`). The live `/api/auth/signup` works because the
  `/api` rewrite proxies to the local backend through the Cloudflare tunnel.
- Mobile fixes (all routes now measure `scrollWidth === clientWidth` at 320 and
  360 px in headless Chrome):
  - Navbar no longer overflows — the wordmark, `LOGIN` label and `Contribute`
    label collapse to icons under `sm`, with tighter padding.
  - The mobile filter sheet was only `w-64` inside `inset-0` (256px sheet with
    the rest of the page visible behind it); it is now `w-full` and uses
    `lg:w-64` for the desktop sidebar.
  - Login/Upload overlays moved to `z-[70]` so the fixed bottom `MobileNav`
    (`z-50`, rendered later in the DOM) can no longer paint over them.
  - Viewer/Search-overlay-only affordances that were `opacity-0` until hover
    (Library unpin + unsave, comment Reply/Report, fullscreen toggle) are now
    always visible below `md`, and the ResourceViewer splits PDF/discussion
    vertically with the PDF pane at `60vh` instead of `h-1/2`.
  - `SubjectDetail`/`Analytics`/`ResourceCard` headers wrap instead of
    overflowing; `main` reserves `pb-24` for the bottom nav.

**Design + performance pass (2026-10-18, third session):**
- **Gradients are gone everywhere** (hero headline, login modal strip, page grid
  overlay, heatmap bar texture). The grid overlay and dot texture are now flat
  `url(data:image/svg+xml,…)` patterns. Verified with computed styles on all
  five routes: no element has `gradient` in `background-image`.
- **Fonts are self-hosted** (`public/fonts`, latin subset, woff2) — zero
  third-party origins per load, no render-blocking Google Fonts stylesheet, and
  the Wikimedia 768px favicon was replaced by an inline SVG data URI.
  `/assets/*` and `/fonts/*` now send `max-age=31536000, immutable` (previously
  `max-age=0, must-revalidate`). Local cold A/B (old vs new bundle, same origin):
  **FCP 220 ms → 88 ms**, first-paint 163 ms → 31 ms, third-party origins 2 → 0.
  Cold transfer went 99 kB → 206 kB because the webfonts now actually render
  (the old stack declared Inter but every element inherited `font-mono`, so only
  4 of 7 faces ever loaded).
- **Typography roles are explicit:** Unbounded = display/headings, Inter =
  reading text (`.prose-read`), JetBrains Mono = UI chrome; `.tabular` for
  numerals; fluid hero size via `clamp()`; `text-wrap: balance/pretty`.
- **Filtering is client-side:** the catalogue is fetched once and filtered in
  memory (mirrors the repository's `LIKE` match). Measured: a filter click and a
  search keystroke now cause **0 API requests** (previously one debounced
  request each).
- Deleted the dead `services/geminiService.ts` and the `define` block that
  inlined `GEMINI_API_KEY` into the browser bundle. `SubjectDetail`'s fake
  "120+ Contributors" / "500 pts" placeholders are now derived from the data.
- Measured remaining bottleneck: production `/api` goes Vercel → cloudflared
  tunnel → this machine, so `/api/resources` costs **0.21–1.05 s** vs **4 ms**
  locally. `docs/improvements.md` lists that and the rest of the backlog.

**Content, AI, search, stats and downloads (2026-10-18, fourth session):**
- **Archive populated with real course material.** 11 PDFs from the user's
  Downloads (BACSE202 SQL lab manual + function practice + indexing problems +
  PL/SQL notes; BAMAT207 z-tables, module-2 tutorial, tutorial 2, assessment 4/6
  solutions; BACSE203 lab report; BASTS101 syllabus) replaced the ten
  `dummy.pdf` rows, and the three junk uploads (`samplesample`, `sample`, the old
  case-study row) were deleted — rows **and** their Cloudinary assets. Seed and
  live DB were rebuilt together: `npm run db:reset` now yields the same clean
  archive.
- **Demo data is coherent:** 7 users (admin123 + 6 students, all students share
  `student123`), 4 real courses, 24 topic links, 7 comments, and
  `course_stats.total_resources/quality_avg/completeness` are **computed from the
  resources** instead of invented.
- **PDFs are stored locally, not on Cloudinary.** The Cloudinary account has
  PDF/ZIP delivery disabled: any URL ending in `.pdf` answers **401**, which
  silently broke every uploaded/seeded PDF. `server/src/utils/storage.ts` writes
  PDFs to `server/storage/{seed,uploads}` and serves them from `/files/…`;
  `createResource` sends only images to Cloudinary. The static mount in `app.ts`
  keeps direct `/files/...` links working.
- **Download/preview names fixed.** `GET /api/resources/:id/download/<slug>.pdf`
  sends `attachment; filename="bacse202-basic-sql-commands-lab-manual.pdf"` and
  increments the counter server-side; the preview URL now ends in the same slug
  because Chrome's PDF viewer names a saved inline file after the URL's last
  segment (that is why downloads used to be called `preview`). The ResourceCard
  download icon is a real link now.
- **AI wired to Velona** (`server/src/utils/ai.ts`): OpenAI-compatible
  `https://velona.in/v1`, model `deepseek/deepseek-v4-flash-0731`, browser-ish
  User-Agent (Cloudflare 1010 otherwise), 30 s timeout, `max_tokens` 420.
  `POST /api/ai/ask` is **grounded in the DB**: `aiRepository.buildCatalogueContext`
  extracts question terms, matches at most 6 resources, and sends a ≤1.2 kB
  context; the response includes `sources` and `{model, provider}`, and
  `/api/health` exposes the model (never the key). Legacy `NVIDIA_*` vars still
  work as a fallback. Wallet is tiny (~₹4) — keep requests light.
- **Search is ranked and instant.** `services/search.ts` scores title/course/
  slot/type/topics/professor/description, ANDs query tokens with an OR fallback,
  and breaks ties by quality/upvotes; the Discover bar is a real input (with a
  result count and clear button) and the overlay adds highlighting, counts,
  ↑/↓ + Enter navigation, and AI mode with clickable sources. The old Tab-to-AI
  hijack is gone.
- **Stats page is real.** `Analytics` derives everything from the catalogue:
  KPIs, working 7/30/all windows, slot chart, type + quality distributions,
  per-course coverage (click-through), aggregate activity grid, real top
  contributors and most downloaded/upvoted lists; the hardcoded
  "B1 leads contributions" sentence is computed.
- Tests: **42/42** (new: preview/download headers, PDF counter ownership, AI
  context shape + question validation). Root `tsc --noEmit` and `server`
  typecheck are both clean (the old `smtp.reason` union error is fixed).

**Background Effects Prototype Engine (2026-10-19 session):**
- Built an interactive, zero-dependency background effects prototype engine
  (`components/BackgroundFX/`) to test and compare lighting, dithering, ASCII,
  and parallax treatments without violating the brutalist "no gradient" rule:
  - **`LightingCanvas`**: Oscilloscope/phosphor CRT spotlight with dual-tier
    concentric reticle, cursor lerp, CRT scanline sweep, and proximity grid
    intersection illumination (`+` cross markers).
  - **`DitherCanvas`**: Authentic 8x8 Bayer ordered dithering pattern computed
    over a downsampled 1/4 buffer with bitwise 32-bit pixel operations (~0.4ms
    draw time); creates a 1-bit retro computing vignette + cursor crater.
  - **`AsciiCanvas`**: Sparse academic/engineering math & CS glyph matrix
    (`λ`, `∫`, `∂`, `∑`, `0x`, `[]`, `SELECT`, `JOIN`, `3NF`, `O(1)`) using
    JetBrains Mono; cursor proximity triggers randomized character scramble and
    decoding into course keywords.
  - **`ParallaxField`**: 3-plane architectural blueprint coordinate system
    (`[SEC 01]`, `[DATUM +0.00]`, slot tags `[A1]`, `[B2]`, corner HUD)
    reacting to scroll velocity and mouse tilt via GPU `translate3d`.
  - **`CyberdeckComposite`**: Harmonized composite layer blending dither
    vignette + phosphor lighting reticle + sparse ASCII points.
  - **`FXControls`**: Unobtrusive neo-brutalist floating prototype switcher pill
    (`[ ⚡ FX: ... ]`) in the bottom-right corner. Allows switching modes,
    tuning intensity (`subtle` / `medium` / `high`), toggling mouse reactivity,
    and switching accent color (`neon` / `cyan` / `monochrome`).
  - Settings persist in `localStorage` (`uniarchive_fx_config`), honor
    `prefers-reduced-motion`, pause on hidden tab, and adapt to Dark/Light theme.
  - Bundle impact is minimal: ~6 kB gzip added to entry chunk; `tsc --noEmit`
    and `vite build` remain completely green.


**Not done / optional** (see §9): dedicated DB user, rendered ER image,
fixing the broken SMTP key, a stable (non-ephemeral) tunnel URL.

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
  touch the seed, verify `npm run db:reset` imports **all 11 resources** (not
  0 or 1) and that `GET /api/resources` returns 11.
- **Seed author gotcha:** every `resources` row's `author_id` must reference an
  existing `users.user_id` (1..7 in the seed). A dangling author is silently
  filtered out by the RESOURCE_SELECT JOIN, so the API returns fewer rows than
the table holds — check `SELECT COUNT(*)` against `/api/resources` after editing.
- ⚠ **Do not put PDFs back on Cloudinary.** This account has PDF/ZIP delivery
  disabled, so *any* asset URL ending in `.pdf` answers `401` (a 1×1 gif). PDFs
  therefore live in `server/storage/{seed,uploads}` and are served from `/files/…`;
  `createResourceHandler` writes PDFs locally and only images go to Cloudinary.
  The preview/download endpoints sniff the `%PDF-` magic bytes, so the content
  type is right even for legacy `raw`/octet-stream assets.
- **Download filenames come from two places.** The `attachment` endpoint sets
  `filename="<course>-<title>.pdf"`, but Chrome's built-in PDF viewer ignores
  `Content-Disposition` for files it shows *inline* and names them after the
  URL's last segment — hence preview URLs must end in `/<slug>.pdf` (the slug is
  ignored by the handler, it is only there for the browser). Remove it and every
  save becomes `preview.pdf` again.
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
- **Never re-add a Google Fonts `<link>`.** Fonts live in `public/fonts` as
  latin-subset woff2 with `@font-face` rules in `index.css`; only faces the UI
  uses are shipped (Inter 400/600, JetBrains Mono 400/700, Unbounded 600/800).
  To change weights, download the new latin subset, add the `@font-face`, and
  preload it in `index.html` if it is above the fold. A weight that is declared
  but not shipped makes the browser snap to the nearest shipped weight.
- **Keep the visual system flat.** No `bg-gradient-*` / `radial-gradient` etc.;
  the grid overlay and heatmap texture are data-URI SVG patterns in
  `Dashboard.tsx` / `Heatmap.tsx`. Accent strips are flat block stacks.
- **Three type roles, don't mix them:** `font-display` (Unbounded) for headings,
  `.prose-read` (Inter) for anything a person reads, `font-mono` (JetBrains) for
  labels/counters/chips, `.tabular` on numeric counters.
- **Filtering happens in the browser.** `Dashboard` fetches the catalogue once
  and filters locally (same rules as the repository's `LIKE` match, including
  title / course code / professor / topics); `SearchOverlay` filters the
  catalogue it is passed. Re-introducing server-side filters means updating both
  sides or search silently diverges.
- **Cache headers live in `vercel.json`** (`/assets/*`, `/fonts/*` → immutable).
  An asset directory with content hashes should be added there too.
- **The demo passwords are trivial:** `admin123` / `scse` (legacy unsalted
  SHA-256) and every seeded student / `student123` (salted scrypt). Anyone with
  a demo credential can log in. Real signups use salted scrypt, but there is
  still no rate limiting, sessions or email verification — demo-grade.
- **Two password formats exist side by side** (`users.password_hash`):
  `scrypt$<16-byte salt hex>$<32-byte hash hex>` for accounts created through
  `/api/auth/signup`, and a bare 64-char SHA-256 hex for the seeded `admin123`
  row. `verifyPassword` dispatches on the `scrypt$` prefix. `password_hash` is
  `VARCHAR(128)`; the scrypt format is ~103 chars, so **pick a shorter format or
  widen the column** if you ever change the hash scheme.
- Accounts created by the OTP flow (`upsertVerifiedUser`) are inserted with an
  empty `password_hash`, so they cannot password-login — `authenticateUser`
  filters `password_hash <> ''`. Use `/api/auth/signup` for password accounts.

## 8. How to verify a change

```bash
cd server
npm run typecheck                 # must be clean
npm test                          # 42/42 (see §3); reseeds a SEPARATE test DB
npm run build                     # dist/ must compile
npm run dev &                     # then exercise the API:
curl -s localhost:5000/api/health
curl -s "localhost:5000/api/resources?search=k-map"
curl -s localhost:5000/api/stats | head -c 200
curl -s -X POST localhost:5000/api/resources/1/upvote
# PDF preview must come back inline as a PDF (not octet-stream / attachment)
curl -sI localhost:5000/api/resources/1/preview | grep -iE 'content-type|content-disposition'
# ... and the download must carry a readable filename, not "preview.pdf"
curl -sI localhost:5000/api/resources/1/download/anything.pdf | grep -i 'content-disposition'

cd .. && npm run build            # frontend must build
mariadb test_uniarchive -e "SELECT * FROM v_course_overview;"
```

When you change tests, prefer fixing the cause over weakening assertions. Do not
add suppressions to make checks pass.

## 9. Roadmap / optional work

- [x] Demo password login without SMTP (`POST /api/auth/login`, admin123/scse).
- [x] Normal account signup without SMTP (`POST /api/auth/signup`, scrypt
      hashes, signup tab in `LoginOverlay`) + mobile layout pass.
- [x] Flat design pass (no gradients), self-hosted fonts, typography rework,
      immutable asset caching, client-side filtering. See `docs/improvements.md`.
- [ ] Replace the ephemeral tunnel with a stable URL / managed MySQL, and give
      uploads + comments a server-side identity (P0 in `docs/improvements.md`).
- [x] Collapse seed to a single demo user + fix seed FK/author bugs.
- [x] Import Cloudinary/SMTP/NVIDIA keys from the downloaded copy (Cloudinary
      works; SMTP + NVIDIA keys are bad and need regeneration).
- [x] AI chat works again: **Velona** gateway + `deepseek/deepseek-v4-flash-0731`,
      grounded in the DB (see §3). SMTP is still broken and now unused — signup
      no longer needs it.
- [x] Real archive content (11 course PDFs), junk uploads deleted, seed and live
      DB in sync.
- [x] Download/preview filenames (`/download/<slug>.pdf`, slugged preview URLs).
- [x] Ranked client-side search + a stats page built from live data.
- [ ] Watch the Velona wallet (low balance) and add a per-client rate limit on
      `/api/ai/ask` before exposing the assistant widely.
- [ ] Create a dedicated MariaDB user + password instead of the anonymous user.
- [ ] Render the ER/EER diagram to an image (PlantUML / draw.io) for submission.
- [ ] Add the architecture note to the user's global `~/AGENTS.md` if desired.
- [x] Deploy (2026-10-18): static frontend on Vercel + local backend via
      outbound Cloudflare quick tunnel (see Changelog 2026-10-18). Services-mode
      `backend` service retired — no external MySQL needed.
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
| 2026-10-18 | Design + speed pass: removed every gradient (hero/login/grid overlay/heatmap texture → flat colours + SVG patterns), self-hosted the three font families as latin-subset woff2 (zero third-party origins, no render-blocking stylesheet, inline SVG favicon, preloaded above-the-fold faces), reworked typography (Unbounded display / Inter reading text / JetBrains Mono chrome, fluid hero `clamp()`, `text-wrap: balance|pretty`, `.tabular` numerals, higher-contrast dark palette), added `immutable` cache headers for `/assets` + `/fonts`, deleted dead `geminiService` + the inlined `GEMINI_API_KEY` define, replaced the debounced per-keystroke API calls with in-memory filtering/search (0 requests per filter click or keystroke), and derived `SubjectDetail`'s placeholder contributor numbers from real data. Measured cold A/B: FCP 220 → 88 ms, first paint 163 → 31 ms, third-party origins 2 → 0. Wrote `docs/improvements.md` (measured audit + prioritised backlog). |
| 2026-10-18 | Signup + mobile pass. Added `POST /api/auth/signup` (normal account, no SMTP) with scrypt password hashing (`hashPassword`/`verifyPassword`, legacy SHA-256 still accepted); 400/409 validation and duplicate handling. `LoginOverlay` became a Sign in / Create account tabbed modal with `api.signup`. Tests grew 29 → 37 (signup contract, duplicate/validation rejection, scrypt-not-plaintext, legacy demo login) and all pass. Fixed phone layouts: navbar overflow, filter sheet `w-64`→`w-full`, overlays `z-[70]` above `MobileNav`, touch-invisible hover-only controls, ResourceViewer PDF/discussion split. Verified at 320/360/390px in headless Chrome (`scrollWidth === clientWidth` everywhere) plus an end-to-end UI signup, then `vercel deploy --prod`. |
| 2026-10-18 | **Deployed: https://uniarchive.vercel.app** (project `uniarchive`, CLI-linked via `.vercel/`). Architecture changed from services-mode: root `vercel.json` is now a plain static frontend (Vite → `dist`) whose `/api/(.*)` rewrite proxies to the backend **running on the local machine** through an outbound Cloudflare quick tunnel — no inbound ports, local MariaDB never exposed (user's device-safety requirement). Tunnel: `cloudflared tunnel --url http://localhost:5001` (binary at `~/bin/cloudflared`, log `/tmp/ua_tunnel.log`); the `trycloudflare.com` URL is **ephemeral** — if it changes, update the rewrite in `vercel.json` and `vercel deploy --prod`. Backend+frontend dev processes: `/tmp/uniarchive-server.log`, `/tmp/uniarchive-frontend.log`. Services-mode `backend` service, its CORS headers and the `api.*` host rule were removed (backend is now cross-origin proxy target, same-origin to the browser). `vercel curl` warns "Deployment Protection on" but production is publicly readable (verified anon: `/`, `/library`, `/api/health`, `/api/resources`). Pushed `feature/demo-login` (036153f). |
| 2026-10-18 | Content + AI pass: replaced the ten `dummy.pdf` rows with **11 real course PDFs** (BACSE202/BAMAT207/BACSE203/BASTS101) copied from the user's Downloads into `server/storage/seed`, added six student demo users (`student123`), deleted the three junk uploads *and* their Cloudinary assets, and made `course_stats` derive from real resources. Discovered the Cloudinary account has PDF delivery disabled (`.pdf` → 401), so PDFs now live in `server/storage/` and are streamed by the app; uploads write PDFs locally and send images to Cloudinary. Added `GET /api/resources/:id/download/<slug>.pdf` (attachment + readable name + server-side counter) and slugged preview URLs so Chrome stops saving files as `preview.pdf`. Rewired the assistant to **Velona** (`deepseek/deepseek-v4-flash-0731`, tiny grounded context, sources + model in the response, `AI_*` env vars, `NVIDIA_*` fallback). Rewrote search (ranked scoring, AND/OR token matching, real Discover input, highlight + keyboard nav in the overlay) and the stats page (KPIs, working 7/30/all windows, distributions, contributors, derived headline). Tests 42/42; `docs/case-study.md` counts, `db/seed.sql` and the root `tsc` error updated. |
| 2026-10-18 | Added `start-backend.bat` for Windows local backend launching (checks `MySQL80` service status, runs `npm run dev` in `server/`, supports `Ctrl+C`). Clarified that dual-boot Arch Linux DB files are not needed since schema and seeds (`db/schema.sql`, `db/seed.sql`) are fully self-contained in the repo. |
| 2026-10-18 | Windows MySQL 8.0 setup: created database user `'uniarchive'@'localhost'` (password: `scse`) with full grants on `test_uniarchive` and seeded tables via `npm run db:reset`. Fixed MySQL 8.0 reserved keyword clash in `server/src/repositories/aiRepository.ts` (`rank` -> `match_rank`), restoring test suite to 42/42 passing. |
| 2026-10-18 | Created `start-uniarchive.bat` (unified single-click launcher that checks MySQL, starts backend on 5001 + frontend on 3000 concurrently via `npm run dev`, displays local and mobile Wi-Fi URLs, and opens browser automatically). Installed root dependencies on Windows so `vite` and `concurrently` run natively. |
| 2026-10-18 | Production deploy & automated demo sync: deployed `feature/demo-login` branch to `https://uniarchive.vercel.app` via Vercel CLI. Created `scripts/launch-demo.ps1` and wired into `start-uniarchive.bat` to automate the entire live demo workflow: checks MySQL, starts backend, opens outbound Cloudflare tunnel, auto-updates `vercel.json`, syncs to Vercel production in ~15s, and opens `https://uniarchive.vercel.app`. Verified live production endpoint serves all 11 resources from the laptop database to any phone/device globally. |
| 2026-10-18 | Audited & updated `docs/case-study.md` (updated test metrics to 42/42 passing, added salted scrypt auth, AI search endpoint, and corrected activity row count). Created `docs/teacher-review-walkthrough.md` with a complete step-by-step presentation script, MySQL app queries, constraint proofs, and teacher Q&A answers. |
| 2026-10-19 | Background FX prototypes: created zero-dependency interactive background engine (`components/BackgroundFX/`) featuring phosphor CRT spotlight (`LightingCanvas`), 8x8 Bayer ordered dithering (`DitherCanvas`), sparse academic CS/math constellation with proximity decode (`AsciiCanvas`), 3-plane blueprint HUD (`ParallaxField`), and hybrid (`CyberdeckComposite`). Added floating interactive controller HUD (`FXControls`) to test and customize prototypes live in the UI. Zero extra dependencies, fully compliant with brutalist flat-pattern rule (no CSS gradients). |






