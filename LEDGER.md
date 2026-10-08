# Implementation Ledger — Recipe Book App

Source of truth for what is planned, in progress, and done.
Update this file in the same commit that completes each task.

Commit message template: `type(scope): short message`
Types: `feat`, `fix`, `docs`, `chore`, `refactor`. Scope is optional.

## IN PROGRESS
- UI parity fixes (2026-10-07) — match deployed app to approved prototype

## TODO (UI parity track)
- [x] 2026-10-07 — fix(web): load home data on navigation (home opens empty)
- [x] 2026-10-07 — fix(web): use prototype outline icon set everywhere
- [x] 2026-10-07 — feat(api): add servesMin filter to GET /api/recipes
- [ ] feat(web): add serves filter + favorites-only toggle on home
- [ ] fix(web): replace add FAB with labeled Add tab; rename Saved to Favorites

## TODO (Vercel deployment track)
- [x] 2026-10-07 — refactor(db): abstract database layer for dual drivers
- [x] 2026-10-07 — feat(db): add Turso (libsql) driver selected by env
- [x] 2026-10-07 — feat(deploy): add Vercel serverless entry and config
- [x] 2026-10-07 — docs(ledger): mark Vercel readiness complete
- [ ] deploy to Vercel (manual — needs Rishit's Vercel account)
- [ ] verify production (manual — needs TURSO_DATABASE_URL / TURSO_AUTH_TOKEN set in Vercel)

## TODO
- [x] 2026-10-07 — chore(app): scaffold Node.js + Express + SQLite project skeleton
- [x] 2026-10-07 — feat(db): add SQLite schema and seed script with the 16 recipes
- [x] 2026-10-07 — feat(api): recipes endpoints — list/search/filter, detail, create
- [x] 2026-10-07 — feat(api): favorites, per-recipe notes, grocery-list endpoints
- [x] 2026-10-07 — feat(web): home feed with search, category chips, filters
- [x] 2026-10-07 — feat(web): recipe detail page with ingredient checklist
- [x] 2026-10-07 — feat(web): cooking mode — step-by-step, timers, wake lock
- [x] 2026-10-07 — feat(web): grocery list tab + add-recipe form
- [x] 2026-10-07 — docs(ledger): mark backend implementation complete, note hosted app link

## DONE
- [x] 2026-10-07 — docs(ledger): created this ledger
- [x] 2026-10-07 — chore(repo): added README and .gitignore

## Notes
- Stack: Node.js + Express + better-sqlite3 (single-file DB, zero config),
  vanilla JS frontend, no build step. Runs with `npm install && npm start`.
- Seed data: the 16 recipes from the Word Recipe Book (recipes.json).
- Recipe numbers are permanent IDs (01–16); new recipes take the next number.
- Live hosted prototype: the Muse "recipe-book" web artifact (static, no
  persistence). This repo is the source of truth for the backend version.

## Completion notes (2026-10-07)
- Backend verified end to end: 20 checks passed (all API endpoints,
  filters, favorites, notes, grocery CRUD, frontend serving).
- better-sqlite3 pinned to 12.4.1: v13.0.3 ships no prebuilt binary for
  Node 24 (ABI 137), and node-gyp cannot compile in this sandbox.
- Live hosted prototype (static, no persistence) remains the Muse
  "recipe-book" web artifact; this repo is the backend source of truth.

## Vercel readiness notes (2026-10-07)
- Code is Vercel-ready: db/index.js selects the Turso driver when
  TURSO_DATABASE_URL is set, else the local better-sqlite3 file DB.
- db/turso.js verified end to end against a local file: URL
  (@libsql/client 0.18.0): 16 driver checks + server smoke test passed
  (seed idempotent, search/filter/favorites/notes/grocery CRUD).
- Gotcha fixed: schema.sql's `--` comments contain a semicolon, so the
  Turso driver strips line comments before splitting statements.
- api/index.js exports the Express app without listening (verified it
  loads and exits cleanly); vercel.json rewrites /api/* to /api.
- Remaining manual steps (need Rishit's accounts): create Turso DB,
  import repo in Vercel, set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN,
  deploy, verify production.
