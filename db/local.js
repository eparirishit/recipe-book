// Local SQLite driver (better-sqlite3). Synchronous under the hood,
// exposed through the same async API as the Turso driver so server.js
// never cares which backend is active.
const fs = require('fs');
const path = require('path');

function safeParse(s, fallback) {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

function rowToRecipe(row) {
  if (!row) return null;
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    category: row.category,
    serves: row.serves,
    time: row.time,
    description: row.description,
    ingredients: safeParse(row.ingredients, []),
    method: safeParse(row.method, []),
    source: row.source,
    favorite: !!row.favorite,
    note: row.note || '',
  };
}

function asLines(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter(Boolean);
  return [];
}

function createLocalDb() {
  const Database = require('better-sqlite3');
  const dataDir = path.join(__dirname, '..', 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, 'recipebook.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));

  return {
    kind: 'local',

    // Idempotent and cheap: a single COUNT(*) decides whether to seed.
    async ensureSeeded() {
      const { c } = db.prepare('SELECT COUNT(*) AS c FROM recipes').get();
      if (c > 0) return { seeded: false, count: c };
      const raw = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'data', 'recipes.json'), 'utf8')
      );
      const insert = db.prepare(
        `INSERT INTO recipes
           (id, number, title, category, serves, time, description,
            ingredients, method, source, favorite, note)
         VALUES
           (@id, @number, @title, @category, @serves, @time, @description,
            @ingredients, @method, @source, 0, '')`
      );
      const txn = db.transaction((rows) => {
        for (const r of rows) {
          const number = parseInt(String(r.number), 10);
          insert.run({
            id: number,
            number,
            title: r.title || '',
            category: r.category || 'Uncategorized',
            serves: r.serves || '',
            time: r.time || '',
            description: r.description || '',
            ingredients: JSON.stringify(r.ingredients || []),
            method: JSON.stringify(r.method || []),
            source: r.source || '',
          });
        }
      });
      txn(raw);
      return { seeded: true, count: raw.length };
    },

    async categories() {
      return db
        .prepare('SELECT DISTINCT category FROM recipes ORDER BY category')
        .all()
        .map((r) => r.category);
    },

    // List / search / filter, newest first. maxTime filtering happens in
    // server.js (it needs parseMinutes on the time string).
    async allRecipes({ q, category, favoritesOnly } = {}) {
      const conds = [];
      const params = [];
      if (category) {
        conds.push('category = ?');
        params.push(category);
      }
      if (favoritesOnly) conds.push('favorite = 1');
      if (q) {
        conds.push(
          '(title LIKE ? OR description LIKE ? OR ingredients LIKE ? OR method LIKE ? OR category LIKE ?)'
        );
        const like = `%${q}%`;
        params.push(like, like, like, like, like);
      }
      const rows = db
        .prepare(
          `SELECT * FROM recipes ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY number DESC LIMIT 500`
        )
        .all(...params);
      return rows.map(rowToRecipe);
    },

    async getRecipe(id) {
      return rowToRecipe(db.prepare('SELECT * FROM recipes WHERE id = ?').get(id));
    },

    // Assigns the next permanent number (max + 1).
    async createRecipe(data) {
      const maxRow = db.prepare('SELECT MAX(number) AS m FROM recipes').get();
      const number = (maxRow.m || 0) + 1;
      const info = db
        .prepare(
          `INSERT INTO recipes
             (id, number, title, category, serves, time, description,
              ingredients, method, source, favorite, note)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')`
        )
        .run(
          number,
          number,
          String(data.title).trim(),
          (data.category && String(data.category).trim()) || 'Uncategorized',
          data.serves || '',
          data.time || '',
          data.description || '',
          JSON.stringify(asLines(data.ingredients)),
          JSON.stringify(asLines(data.method)),
          data.source || ''
        );
      return rowToRecipe(db.prepare('SELECT * FROM recipes WHERE id = ?').get(info.lastInsertRowid));
    },

    async updateRecipe(id, patch) {
      const updates = [];
      const params = [];
      if (patch.favorite !== undefined) {
        updates.push('favorite = ?');
        params.push(patch.favorite ? 1 : 0);
      }
      if (patch.note !== undefined) {
        updates.push('note = ?');
        params.push(String(patch.note));
      }
      if (!updates.length) return null;
      params.push(id);
      db.prepare(`UPDATE recipes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      return this.getRecipe(id);
    },

    // Grocery list, grouped by recipe.
    async groceryList() {
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
      return groups;
    },

    async groceryAdd(recipeId) {
      const recipe = await this.getRecipe(recipeId);
      if (!recipe) return null;
      const insert = db.prepare(
        'INSERT INTO grocery_items (recipe_id, recipe_title, label, checked) VALUES (?, ?, ?, 0)'
      );
      const txn = db.transaction((labels) => {
        for (const label of labels) insert.run(recipe.id, recipe.title, label);
      });
      txn(recipe.ingredients);
      return { added: recipe.ingredients.length, recipeId: recipe.id, recipeTitle: recipe.title };
    },

    async grocerySetChecked(itemId, checked) {
      const item = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(itemId);
      if (!item) return null;
      db.prepare('UPDATE grocery_items SET checked = ? WHERE id = ?').run(checked ? 1 : 0, itemId);
      const u = db.prepare('SELECT * FROM grocery_items WHERE id = ?').get(itemId);
      return { id: u.id, label: u.label, checked: !!u.checked };
    },

    async groceryDelete(itemId) {
      const info = db.prepare('DELETE FROM grocery_items WHERE id = ?').run(itemId);
      return info.changes > 0;
    },

    async groceryClearChecked() {
      const info = db.prepare('DELETE FROM grocery_items WHERE checked = 1').run();
      return info.changes;
    },
  };
}

module.exports = { createLocalDb };
