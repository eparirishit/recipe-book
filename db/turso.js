// Turso (libsql) driver. Selected when TURSO_DATABASE_URL is set.
// Same async API as db/local.js. Schema is applied with
// CREATE TABLE/INDEX IF NOT EXISTS on first use (cheap per cold start),
// and seeding is a single COUNT(*) check plus one batch insert.
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
    id: Number(row.id),
    number: Number(row.number),
    title: row.title,
    category: row.category,
    serves: row.serves,
    time: row.time,
    description: row.description,
    ingredients: safeParse(row.ingredients, []),
    method: safeParse(row.method, []),
    source: row.source,
    sourceUrl: row.source_url || '',
    favorite: !!row.favorite,
    note: row.note || '',
  };
}

function asLines(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') return v.split('\n').map((s) => s.trim()).filter(Boolean);
  return [];
}

function createTursoDb() {
  const { createClient } = require('@libsql/client');
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // Apply schema once per process (IF NOT EXISTS => cheap on warm starts).
  const schemaReady = (async () => {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    // Strip -- line comments first: they may contain semicolons, which
    // would otherwise corrupt the naive statement split below.
    const withoutComments = schema
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('--'))
      .join('\n');
    const statements = withoutComments
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const sql of statements) {
      await client.execute(sql);
    }
    // Migrate older DBs that predate the source_url column.
    try {
      await client.execute('ALTER TABLE recipes ADD COLUMN source_url TEXT');
    } catch (e) {
      if (!/duplicate column/i.test(e.message || '')) throw e;
    }
  })();

  // Backfill reel URLs for seeded recipes (idempotent; runs on every boot).
  const backfillSourceUrls = async () => {
    const raw = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'data', 'recipes.json'), 'utf8')
    );
    await client.batch(
      raw
        .filter((r) => r.sourceUrl)
        .map((r) => ({
          sql: 'UPDATE recipes SET source_url = ? WHERE number = ?',
          args: [r.sourceUrl, parseInt(String(r.number), 10)],
        }))
    );
  };

  return {
    kind: 'turso',

    async ensureSeeded() {
      await schemaReady;
      const rs = await client.execute('SELECT COUNT(*) AS c FROM recipes');
      const c = Number(rs.rows[0].c);
      let result;
      if (c > 0) {
        result = { seeded: false, count: c };
      } else {
        const raw = JSON.parse(
          fs.readFileSync(path.join(__dirname, '..', 'data', 'recipes.json'), 'utf8')
        );
        await client.batch(
          raw.map((r) => {
            const number = parseInt(String(r.number), 10);
            return {
              sql: `INSERT INTO recipes
                      (id, number, title, category, serves, time, description,
                       ingredients, method, source, source_url, favorite, note)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')`,
              args: [
                number,
                number,
                r.title || '',
                r.category || 'Uncategorized',
                r.serves || '',
                r.time || '',
                r.description || '',
                JSON.stringify(r.ingredients || []),
                JSON.stringify(r.method || []),
                r.source || '',
                r.sourceUrl || '',
              ],
            };
          })
        );
        result = { seeded: true, count: raw.length };
      }
      await backfillSourceUrls();
      return result;
    },

    async categories() {
      await schemaReady;
      const rs = await client.execute('SELECT DISTINCT category FROM recipes ORDER BY category');
      return rs.rows.map((r) => r.category);
    },

    async allRecipes({ q, category, favoritesOnly } = {}) {
      await schemaReady;
      const conds = [];
      const args = [];
      if (category) {
        conds.push('category = ?');
        args.push(category);
      }
      if (favoritesOnly) conds.push('favorite = 1');
      if (q) {
        conds.push(
          '(title LIKE ? OR description LIKE ? OR ingredients LIKE ? OR method LIKE ? OR category LIKE ?)'
        );
        const like = `%${q}%`;
        args.push(like, like, like, like, like);
      }
      const rs = await client.execute({
        sql: `SELECT * FROM recipes ${conds.length ? 'WHERE ' + conds.join(' AND ') : ''} ORDER BY number DESC LIMIT 500`,
        args,
      });
      return rs.rows.map(rowToRecipe);
    },

    async getRecipe(id) {
      await schemaReady;
      const rs = await client.execute({ sql: 'SELECT * FROM recipes WHERE id = ?', args: [id] });
      return rowToRecipe(rs.rows[0]);
    },

    async createRecipe(data) {
      await schemaReady;
      const rs = await client.execute('SELECT MAX(number) AS m FROM recipes');
      const number = (Number(rs.rows[0].m) || 0) + 1;
      await client.execute({
        sql: `INSERT INTO recipes
                (id, number, title, category, serves, time, description,
                 ingredients, method, source, source_url, favorite, note)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '')`,
        args: [
          number,
          number,
          String(data.title).trim(),
          (data.category && String(data.category).trim()) || 'Uncategorized',
          data.serves || '',
          data.time || '',
          data.description || '',
          JSON.stringify(asLines(data.ingredients)),
          JSON.stringify(asLines(data.method)),
          data.source || '',
          data.sourceUrl || '',
        ],
      });
      return this.getRecipe(number); // id == number for new recipes
    },

    async updateRecipe(id, patch) {
      await schemaReady;
      const updates = [];
      const args = [];
      if (patch.favorite !== undefined) {
        updates.push('favorite = ?');
        args.push(patch.favorite ? 1 : 0);
      }
      if (patch.note !== undefined) {
        updates.push('note = ?');
        args.push(String(patch.note));
      }
      if (!updates.length) return null;
      args.push(id);
      await client.execute({ sql: `UPDATE recipes SET ${updates.join(', ')} WHERE id = ?`, args });
      return this.getRecipe(id);
    },

    async groceryList() {
      await schemaReady;
      const rs = await client.execute(
        `SELECT g.*, r.number AS recipe_number
         FROM grocery_items g
         LEFT JOIN recipes r ON r.id = g.recipe_id
         ORDER BY recipe_title, id`
      );
      const groups = [];
      const byRecipe = new Map();
      for (const it of rs.rows) {
        const key = it.recipe_id ?? `other-${it.recipe_title}`;
        if (!byRecipe.has(key)) {
          const g = {
            recipeId: it.recipe_id == null ? null : Number(it.recipe_id),
            recipeTitle: it.recipe_title,
            recipeNumber: it.recipe_number == null ? null : Number(it.recipe_number),
            items: [],
          };
          byRecipe.set(key, g);
          groups.push(g);
        }
        byRecipe
          .get(key)
          .items.push({ id: Number(it.id), label: it.label, checked: !!it.checked });
      }
      return groups;
    },

    async groceryAdd(recipeId) {
      await schemaReady;
      const recipe = await this.getRecipe(recipeId);
      if (!recipe) return null;
      if (recipe.ingredients.length) {
        await client.batch(
          recipe.ingredients.map((label) => ({
            sql: 'INSERT INTO grocery_items (recipe_id, recipe_title, label, checked) VALUES (?, ?, ?, 0)',
            args: [recipe.id, recipe.title, label],
          }))
        );
      }
      return { added: recipe.ingredients.length, recipeId: recipe.id, recipeTitle: recipe.title };
    },

    async grocerySetChecked(itemId, checked) {
      await schemaReady;
      const rs = await client.execute({
        sql: 'SELECT * FROM grocery_items WHERE id = ?',
        args: [itemId],
      });
      if (!rs.rows[0]) return null;
      await client.execute({
        sql: 'UPDATE grocery_items SET checked = ? WHERE id = ?',
        args: [checked ? 1 : 0, itemId],
      });
      const u = await client.execute({
        sql: 'SELECT * FROM grocery_items WHERE id = ?',
        args: [itemId],
      });
      const row = u.rows[0];
      return { id: Number(row.id), label: row.label, checked: !!row.checked };
    },

    async groceryDelete(itemId) {
      await schemaReady;
      const rs = await client.execute({
        sql: 'DELETE FROM grocery_items WHERE id = ?',
        args: [itemId],
      });
      return (rs.rowsAffected ?? 0) > 0;
    },

    async groceryClearChecked() {
      await schemaReady;
      const rs = await client.execute('DELETE FROM grocery_items WHERE checked = 1');
      return rs.rowsAffected ?? 0;
    },

    async groceryClearRecipe(recipeId) {
      await schemaReady;
      const rs = await client.execute({
        sql: 'DELETE FROM grocery_items WHERE recipe_id = ?',
        args: [recipeId],
      });
      return rs.rowsAffected ?? 0;
    },

    async groceryClearAll() {
      await schemaReady;
      const rs = await client.execute('DELETE FROM grocery_items');
      return rs.rowsAffected ?? 0;
    },
  };
}

module.exports = { createTursoDb };
