# Implementation Ledger — Recipe Book App

Source of truth for what is planned, in progress, and done.
Update this file in the same commit that completes each task.

Commit message template: `type(scope): short message`
Types: `feat`, `fix`, `docs`, `chore`, `refactor`. Scope is optional.

## IN PROGRESS
- (nothing right now)

## TODO
- [x] 2026-10-07 — chore(app): scaffold Node.js + Express + SQLite project skeleton
- [x] 2026-10-07 — feat(db): add SQLite schema and seed script with the 16 recipes
- [x] 2026-10-07 — feat(api): recipes endpoints — list/search/filter, detail, create
- [x] 2026-10-07 — feat(api): favorites, per-recipe notes, grocery-list endpoints
- [x] 2026-10-07 — feat(web): home feed with search, category chips, filters
- [x] 2026-10-07 — feat(web): recipe detail page with ingredient checklist
- [ ] feat(web): cooking mode — step-by-step, timers, wake lock
- [ ] feat(web): grocery list tab + add-recipe form
- [ ] docs(ledger): mark backend implementation complete, note hosted app link

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
