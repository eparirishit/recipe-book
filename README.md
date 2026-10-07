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
