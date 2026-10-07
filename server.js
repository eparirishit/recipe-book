// Recipe Book App — Express server + API.
const path = require('path');
const express = require('express');
const { openDb } = require('./db/database');
const { seed } = require('./db/seed');
const { db } = openDb();
seed(db); // seeds the 16 starter recipes on first run

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- helpers ----------
function rowToRecipe(row) {
  if (!row) return null;
  return {
    ...row,
    ingredients: safeParse(row.ingredients, []),
    method: safeParse(row.method, []),
    favorite: !!row.favorite,
  };
}

function safeParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

// Leading minutes from a time string, e.g. "20 min (est.)" -> 20,
// "10–12 minutes" -> 10, "1 hr" -> 60. Null when unparseable.
function parseMinutes(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).match(/(\d+(?:\.\d+)?)\s*(hr|hour|hrs|hours|min|mins|minute|minutes)/i);
  if (!m) return null;
  const value = parseFloat(m[1]);
  return /hr|hour/i.test(m[2]) ? Math.round(value * 60) : Math.round(value);
}

function asLines(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.split('\n').map(s => s.trim()).filter(Boolean);
  return [];
}

// ---------- recipe endpoints ----------
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Distinct categories, alphabetical.
app.get('/api/categories', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT category FROM recipes ORDER BY category').all();
  res.json(rows.map(r => r.category));
});

// List / search / filter. Newest first (number DESC).
// q matches title, description, ingredients, method, category.
// maxTime filters on the leading minutes of the time string.
app.get('/api/recipes', (req, res) => {
  const { q, category, maxTime, favoritesOnly } = req.query;
  const conds = [];
  const params = [];
  if (category) { conds.push('category = ?'); params.push(category); }
  if (favoritesOnly === '1' || favoritesOnly === 'true') conds.push('favorite = 1');
  if (q) {
    conds.push('(title LIKE ? OR description LIKE ? OR ingredients LIKE ? OR method LIKE ? OR category LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  const sql = `SELECT * FROM recipes ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY number DESC LIMIT 500`;
  let rows = db.prepare(sql).all(...params).map(rowToRecipe);
  if (maxTime !== undefined && maxTime !== '') {
    const max = parseInt(maxTime, 10);
    if (!Number.isNaN(max)) {
      rows = rows.filter(r => {
        const t = parseMinutes(r.time);
        return t !== null && t <= max;
      });
    }
  }
  res.json(rows);
});

// Detail.
app.get('/api/recipes/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Recipe not found' });
  res.json(rowToRecipe(row));
});

// Manual add. Assigns the next permanent number (max + 1).
app.post('/api/recipes', (req, res) => {
  const { title, category, serves, time, description, ingredients, method, source } = req.body || {};
  if (!title || !String(title).trim()) {
    return res.status(400).json({ error: 'title is required' });
  }
  const maxRow = db.prepare('SELECT MAX(number) AS m FROM recipes').get();
  const number = (maxRow.m || 0) + 1;
  const info = db.prepare(
    `INSERT INTO recipes
       (id, number, title, category, serves, time, description, ingredients, method, source, favorite, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')`
  ).run(
    number, number,
    String(title).trim(),
    (category && String(category).trim()) || 'Uncategorized',
    serves || '', time || '', description || '',
    JSON.stringify(asLines(ingredients)), JSON.stringify(asLines(method)),
    source || ''
  );
  const created = db.prepare('SELECT * FROM recipes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(rowToRecipe(created));
});

// Favorite toggle / personal note.
app.patch('/api/recipes/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Recipe not found' });
  const { favorite, note } = req.body || {};
  const updates = [];
  const params = [];
  if (favorite !== undefined) {
    updates.push('favorite = ?');
    params.push(favorite ? 1 : 0);
  }
  if (note !== undefined) {
    updates.push('note = ?');
    params.push(String(note));
  }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update (favorite, note)' });
  params.push(req.params.id);
  db.prepare(`UPDATE recipes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json(rowToRecipe(db.prepare('SELECT * FROM recipes WHERE id = ?').get(req.params.id)));
});

// ---------- grocery list ----------
// Grouped by recipe: [{ recipeId, recipeTitle, items: [{id, label, checked}] }]
app.get('/api/grocery', (req, res) => {
  const items = db.prepare('SELECT * FROM grocery_items ORDER BY recipe_title, id').all();
  const groups = [];
  const byRecipe = new Map();
  for (const it of items) {
    const key = it.recipe_id ?? `other-${it.recipe_title}`;
    if (!byRecipe.has(key)) {
      const g = { recipeId: it.recipe_id, recipeTitle: it.recipe_title, items: [] };
      byRecipe.set(key, g);
      groups.push(g);
    }
    byRecipe.get(key).items.push({ id: it.id, label: it.label, checked: !!it.checked });
  }
  res.json(groups);
});

// Add every ingredient of a recipe to the grocery list.
app.post('/api/grocery', (req, res) => {
  const { recipeId } = req.body || {};
  const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(recipeId);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  const ingredients = safeParse(recipe.ingredients, []);
  const insert = db.prepare(
    'INSERT INTO grocery_items (recipe_id, recipe_title, label, checked) VALUES (?, ?, ?, 0)'
  );
  const txn = db.transaction((labels) => {
    for (const label of labels) insert.run(recipe.id, recipe.title, label);
  });
  txn(ingredients);
  res.status(201).json({ added: ingredients.length, recipeId: recipe.id, recipeTitle: recipe.title });
});

app.patch('/api/grocery/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'Grocery item not found' });
  const { checked } = req.body || {};
  if (checked === undefined) return res.status(400).json({ error: 'checked is required' });
  db.prepare('UPDATE grocery_items SET checked = ? WHERE id = ?').run(checked ? 1 : 0, req.params.itemId);
  const updated = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(req.params.itemId);
  res.json({ id: updated.id, label: updated.label, checked: !!updated.checked });
});

app.delete('/api/grocery/:itemId', (req, res) => {
  const info = db.prepare('DELETE FROM grocery_items WHERE id = ?').run(req.params.itemId);
  if (!info.changes) return res.status(404).json({ error: 'Grocery item not found' });
  res.json({ deleted: req.params.itemId });
});

// Clear checked items (DELETE /api/grocery?checked=1).
app.delete('/api/grocery', (req, res) => {
  if (req.query.checked === '1') {
    const info = db.prepare('DELETE FROM grocery_items WHERE checked = 1').run();
    return res.json({ cleared: info.changes });
  }
  return res.status(400).json({ error: 'Use ?checked=1 to clear checked items' });
});

// ---------- frontend fallback ----------
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Recipe Book app listening on http://localhost:${PORT}`);
  });
}

module.exports = { app, db, parseMinutes };
