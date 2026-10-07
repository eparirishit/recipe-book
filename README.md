# Recipe Book App

A personal recipe collection web app — converted from a Word "Recipe Book"
(16 recipes across 6 categories: Soups, Rice & Grains, Chicken & Poultry,
Chutneys & Condiments, Curries, Noodles).

## Features
- Home feed with search (titles + ingredients), category filters, favorites
- Recipe detail with ingredient checklist and numbered method
- Cooking mode: full-screen step-by-step, progress, one-tap timers
  auto-detected from step text, screen wake lock
- Favorites, personal per-recipe notes
- Grocery list aggregated from selected recipes
- Add your own recipes manually (Instagram reel import: roadmap)

## Run it
```bash
npm install
npm start
```
Then open http://localhost:3000. The SQLite database is created on first
run and seeded with the 16 recipes.

## Deploy to Vercel

Vercel's serverless filesystem is ephemeral, so the app uses Turso
(libsql) for storage in production instead of the local SQLite file.
The driver is selected automatically: when `TURSO_DATABASE_URL` is set,
the Turso driver is used; otherwise the local better-sqlite3 file DB.

1. Create a database at [turso.tech](https://turso.tech) and note its URL
   (`libsql://...`) and auth token.
2. Import this repo in Vercel (framework preset: Other).
3. Add environment variables:
   - `TURSO_DATABASE_URL` — your Turso database URL
   - `TURSO_AUTH_TOKEN` — your Turso auth token
4. Deploy. On first request the function applies the schema and seeds
   the 16 starter recipes (idempotent — a single `COUNT(*)` check per
   cold start, then skipped on warm invocations).

`vercel.json` rewrites `/api/*` to the serverless function in `api/`;
everything else is served statically from `public/`.

## Project layout
```
server.js          Express app + API routes
db/                schema.sql, seed.js
data/recipes.json  the 16 seed recipes
public/            frontend (HTML/CSS/JS, no build step)
LEDGER.md          implementation tracker (TODO / IN PROGRESS / DONE)
```

## API
- `GET /api/recipes?q=&category=&maxTime=&favoritesOnly=`
- `GET /api/recipes/:id`
- `POST /api/recipes` — manual add
- `PATCH /api/recipes/:id` — `{favorite, note}`
- `GET /api/grocery` · `POST /api/grocery {recipeId}` ·
  `PATCH /api/grocery/:itemId {checked}` · `DELETE /api/grocery/:itemId`
