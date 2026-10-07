// Recipe Book App — Express server + API.
// Storage goes through db/index.js (local SQLite or Turso, selected by env).
const path = require('path');
const express = require('express');
const { getDb } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialized lazily so serverless functions can require this module
// without listening or opening connections at import time.
const ready = getDb().then(async (db) => {
  await db.ensureSeeded();
  return db;
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Wrap async handlers so rejections reach the error middleware (Express 4).
const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ---------- helpers ----------
// Leading minutes from a time string, e.g. "20 min (est.)" -> 20,
// "10–12 minutes" -> 10, "1 hr" -> 60. Null when unparseable.
function parseMinutes(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d+(?:\.\d+)?)\s*(hr|hour|hrs|hours|min|mins|minute|minutes)/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  return /hr|hour/i.test(m[2]) ? Math.round(value * 60) : Math.round(value);
}

// ---------- recipe endpoints ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Distinct categories, alphabetical.
app.get(
  '/api/categories',
  ah(async (req, res) => {
    const db = await ready;
    res.json(await db.categories());
  })
);

// List / search / filter. Newest first (number DESC).
// q matches title, description, ingredients, method, category.
// maxTime filters on the leading minutes of the time string.
app.get(
  '/api/recipes',
  ah(async (req, res) => {
    const db = await ready;
    const { q, category, maxTime, favoritesOnly } = req.query;
    let rows = await db.allRecipes({
      q: q || undefined,
      category: category || undefined,
      favoritesOnly: favoritesOnly === '1' || favoritesOnly === 'true',
    });
    if (maxTime !== undefined && maxTime !== '') {
      const max = parseInt(maxTime, 10);
      if (!Number.isNaN(max)) {
        rows = rows.filter((r) => {
          const t = parseMinutes(r.time);
          return t !== null && t <= max;
        });
      }
    }
    res.json(rows);
  })
);

// Detail.
app.get(
  '/api/recipes/:id',
  ah(async (req, res) => {
    const db = await ready;
    const recipe = await db.getRecipe(req.params.id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
    res.json(recipe);
  })
);

// Manual add. Assigns the next permanent number (max + 1).
app.post(
  '/api/recipes',
  ah(async (req, res) => {
    const db = await ready;
    const { title } = req.body || {};
    if (!title || !String(title).trim()) {
      return res.status(400).json({ error: 'title is required' });
    }
    res.status(201).json(await db.createRecipe(req.body || {}));
  })
);

// Favorite toggle / personal note.
app.patch(
  '/api/recipes/:id',
  ah(async (req, res) => {
    const db = await ready;
    const existing = await db.getRecipe(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Recipe not found' });
    const { favorite, note } = req.body || {};
    if (favorite === undefined && note === undefined) {
      return res.status(400).json({ error: 'Nothing to update (favorite, note)' });
    }
    res.json(await db.updateRecipe(req.params.id, { favorite, note }));
  })
);

// ---------- grocery list ----------
// Grouped by recipe: [{ recipeId, recipeTitle, items: [{id, label, checked}] }]
app.get(
  '/api/grocery',
  ah(async (req, res) => {
    const db = await ready;
    res.json(await db.groceryList());
  })
);

// Add every ingredient of a recipe to the grocery list.
app.post(
  '/api/grocery',
  ah(async (req, res) => {
    const db = await ready;
    const { recipeId } = req.body || {};
    const result = await db.groceryAdd(recipeId);
    if (!result) return res.status(404).json({ error: 'Recipe not found' });
    res.status(201).json(result);
  })
);

app.patch(
  '/api/grocery/:itemId',
  ah(async (req, res) => {
    const db = await ready;
    const { checked } = req.body || {};
    if (checked === undefined) return res.status(400).json({ error: 'checked is required' });
    const updated = await db.grocerySetChecked(req.params.itemId, checked);
    if (!updated) return res.status(404).json({ error: 'Grocery item not found' });
    res.json(updated);
  })
);

app.delete(
  '/api/grocery/:itemId',
  ah(async (req, res) => {
    const db = await ready;
    const deleted = await db.groceryDelete(req.params.itemId);
    if (!deleted) return res.status(404).json({ error: 'Grocery item not found' });
    res.json({ deleted: req.params.itemId });
  })
);

// Clear checked items (DELETE /api/grocery?checked=1).
app.delete(
  '/api/grocery',
  ah(async (req, res) => {
    const db = await ready;
    if (req.query.checked === '1') {
      return res.json({ cleared: await db.groceryClearChecked() });
    }
    return res.status(400).json({ error: 'Use ?checked=1 to clear checked items' });
  })
);

// ---------- frontend fallback ----------
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

if (require.main === module) {
  ready.then(() => {
    app.listen(PORT, () => {
      console.log(`Recipe Book app listening on http://localhost:${PORT}`);
    });
  });
}

module.exports = { app, parseMinutes };
