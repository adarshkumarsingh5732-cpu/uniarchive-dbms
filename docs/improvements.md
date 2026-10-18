# UniArchives — improvement audit

Prioritised list of what can still be made better, grouped by impact. Everything
under **Done** was implemented and measured on 2026-10-18; the rest is a
backlog, ordered by (impact ÷ effort).

Measurements below come from headless Chrome (cold cache, `Network.clearBrowserCache`),
an alternating A/B of the previous and current production bundles served locally,
and `curl -w '%{time_total}'` against production vs the local API.

---

## Done in this pass

### 1. Gradients removed
Every `bg-gradient-to-*` is gone, so the UI is flat colour only.

| Where | Before | Now |
|-------|--------|-----|
| Discover hero | `bg-gradient-to-r from-uni-neon to-uni-cyan` on the headline | solid `text-uni-neon` |
| Login modal footer | `bg-gradient-to-r … via-… to-…` strip | three flat accent blocks |
| Page grid overlay | two `linear-gradient()`s as a stripe trick | SVG line pattern (`url(data:image/svg+xml,…)`) |
| Heatmap bar texture | `radial-gradient(#fff 1px, transparent 0)` | SVG dot pattern |

Verified: `getComputedStyle(...).backgroundImage.includes('gradient')` is false for
every element on `/`, `/analytics`, `/library`, `/subject/:code`, `/resource/:id`.

### 2. Faster: fonts moved off the third party
Google Fonts is gone. The latin subsets are committed under `public/fonts` and
declared with `@font-face` + `font-display: swap`; the two faces needed above the
fold (`inter-400`, `unbounded-800`) are preloaded.

| | Before | Now |
|---|---|---|
| Third-party origins per load | 2 (`fonts.googleapis.com`, `upload.wikimedia.org`) | **0** |
| Render-blocking third-party stylesheet | yes, ~1.3 kB CSS + DNS/TLS/round trip | none |
| Favicon | 768 px PNG from Wikimedia | inline SVG data URI |
| Faces actually rendered | 3 of 7 declared; **Inter never loaded** (everything inherited `font-mono`) | only the faces the UI uses |
| Fonts on the wire (warm cache) | — | 0 (immutable) |

Local A/B, 3 cold runs each, averages:

```
OLD  FCP=220ms  FP=163ms  requests=7   transfer=99kB   fonts=0 files   third-party=2
NEW  FCP=88ms   FP=31ms   requests=10  transfer=206kB  fonts=5 files/108kB  third-party=0
```

The new build transfers more on a **cold** load because the webfonts genuinely
render now (the old build advertised Inter and never used it, so it only ever
downloaded the mono/display faces). Warm loads are the opposite: `/assets/*` and
`/fonts/*` are now `public, max-age=31536000, immutable` instead of the previous
`max-age=0, must-revalidate`, so repeat visits fetch nothing.

### 3. Faster: no request per keystroke
`GET /api/resources` returns the whole catalogue (6.8 kB raw / 1.9 kB gzip), so
loading it once and filtering in memory removes a debounced round trip per
filter click and per character typed.

- Filter click: **0 API requests** (before: 1 debounced request each time).
- Typing "k-map" in search: **0 API requests** — only the lazy `SearchOverlay`
  chunk loads (before: 1 request per debounced term).
- The client filter mirrors the repository's `LIKE` match (title, course code,
  professor, topic names), so behaviour is unchanged.

### 4. Typography reworked
- Three roles, applied consistently: **Unbounded** display/headings,
  **Inter** for text people read, **JetBrains Mono** for UI chrome (labels,
  chips, counters, timestamps).
- Reading text (`ResourceCard` descriptions, viewer description + comments, FAQ
  answers, section intros, empty states, footer copy, form hints) was mono +
  italic; it is now Inter at a 1.65 line-height. Mono at body sizes was the main
  legibility problem.
- Hero headline is fluid (`clamp(1.9rem, 5.5vw, 3.5rem)`), tight tracking,
  `line-height: 1`; section headings are balanced (`text-wrap: balance`) and
  paragraphs use `text-wrap: pretty`.
- Counters use `tabular-nums` (`QS`, upvotes/downloads/comments, views, coverage
  %, contributor counts) so digits stop shifting.
- Base layer sets `-webkit-font-smoothing`, a 1.15 heading line-height, and dark
  theme text was lifted (`--uni-text` `#e0e0e0` → `#d4d4d8`, muted `#666` →
  `#8a8a94`) for contrast on `#050505`.

### 5. Smaller surface, less to load
- Deleted `services/geminiService.ts` (dead since AI chat moved behind
  `/api/ai/ask`) and the `define` block that inlined `GEMINI_API_KEY` into the
  shipped bundle. No API key is in the browser JS any more.

### 6. Honest numbers where placeholders were
`SubjectDetail` no longer prints "120+ Contributors" / `500 - i*50 pts` /
`stat_god_99`. Contributors come from the data, the activity band is derived
from the 30-day window in `activityGrid`, and Top Contributors is grouped from
real authors.

---

## Backlog

### P0 — correctness and trust

1. **The deployment depends on this machine.** `/api` proxies to the local
   backend through an **ephemeral** `trycloudflare.com` tunnel; if it restarts,
   production's API dies until `vercel.json` is updated and redeployed. Measured
   cost of the detour: `/api/resources` **0.21–1.05 s via production** vs
   **4 ms locally** (~30–60×). Fix by moving the DB to a managed MySQL (so the
   API can run on Vercel) or by using a named tunnel with a stable hostname.
2. **No real identity.** Comments post as `You`, uploads are attributed to a
   client-supplied `author` string, and the client trusts a `localStorage` user
   object. Nothing stops impersonation. Needs a session/token (even a signed
   cookie) and `author_id` taken from the server session.
3. **No throttling on auth.** scrypt slows password guessing, but
   `/api/auth/login` and `/api/auth/signup` have no rate limit or lockout.
4. **Remaining placeholder UI.** The Analytics range buttons (7 days / 30 days /
   all time) do nothing, "B1 leads contributions. G2 highest quality." is a
   hardcoded sentence, "SORT: RELEVANCE" is static, and "+ Pin Subject" is inert.
   Either wire them up or remove them.

### P1 — performance and UX

5. **Cache the catalogue client-side** (localStorage/IndexedDB, stale-while-
   revalidate) so repeat visits paint results immediately instead of waiting on
   the tunnel; show skeletons meanwhile — the blank grid for ~1 s is the
   slowest-feeling part of the app today.
6. **Server-side pagination/search** before the catalogue grows past a few
   hundred rows (today the client holds every row; fine at 10, not at 10 000).
   Pair it with a `FULLTEXT` index on `resources.title` + `topics.topic_name`:
   `LIKE '%term%'` cannot use a B-tree index, so search is a full scan today.
7. **Stream PDF previews** instead of buffering the whole file in process memory
   (the current 64-entry/5-min cache is demo-scale), and serve
   `Cache-Control: private, max-age=…` for repeat views.
8. **Smaller entry chunk.** `index-*.js` is 239 kB (71 kB gzip) and
   `react-router-dom` (48 kB / 17 kB gzip) ships on first paint for four trivial
   routes; a tiny hash router or route-level splitting would trim it.
9. **`/api/stats` always sends the 364-point activity grid** even though only the
   subject view uses it. Measured: 6.7 kB raw / **556 B gzip** — *not* worth
   optimising yet; revisit at scale (an honest "we measured, skipped it" row).
10. **Keyboard + reduced motion.** SearchOverlay advertises arrow-key navigation
    it does not implement, `Tab` hijacks focus to toggle AI mode, and the
    `animate-in` utilities ignore `prefers-reduced-motion`.

### P2 — polish

11. **Accessibility pass.** Icon-only buttons mostly lack `aria-label`
    (only Dashboard's two and the modal close have one); clickable `<div>`s
    should be `<button>`/`<a>`; add visible `:focus-visible` rings and an
    accessible name for the theme toggle.
12. **Light theme needs a pass** after the palette + font changes (contrast of
    `--uni-muted`, the flat grid pattern, and accent-on-white readability).
13. **Error/empty states.** API failures only `console.error` — the grid silently
    stays empty. Add an error boundary + retry, and CTAs in empty states
    (the FAQ/Footer links are all `href="#"`).
14. **Social/SEO metadata.** `title`/`description` exist; add Open Graph/Twitter
    tags and a canonical URL, plus `robots.txt`/`sitemap.xml`.
15. **Theme flash on first paint** is solved by an inline `background-color`, but
    the theme itself is still applied after JS boots; read `data-theme` from a
    cookie/inline script to avoid the dark→light flicker for light-mode users.
16. **Mobile nav** hides Library as "Lib" and its login entry is commented out —
    fine today (the header keeps an icon), but worth revisiting if the bottom bar
    becomes the primary nav.

### DBMS / case-study angle

17. Document the new scrypt column width constraint (`password_hash VARCHAR(128)`)
    and the dual hash formats in `docs/case-study.md` — the schema section still
    describes SHA-256 only.
18. Add `EXPLAIN` output for the main queries (list, detail, stats) to the case
    study; it is the strongest artefact for the "normalisation paid off" claim.
19. Least-privilege DB user (still the anonymous local user) and a `CHECK`
    on `users.email` domain if the demo keeps the university-domain gate.
20. Upload validation: `POST /api/resources` trusts client JSON for
    course/slot/type instead of resolving the lookup rows server-side, which
    makes the "3NF enforced by the schema" claim weaker than it looks.
