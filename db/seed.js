// Seeds the recipes table from data/recipes.json on first run.
// Also runnable standalone: `node db/seed.js`.
const fs = require('fs');
const path = require('path');

function seed(db) {
  const count = db.prepare('SELECT COUNT(*) AS c FROM recipes').get().c;
  if (count > 0) return { seeded: false, count };

  const seedPath = path.join(__dirname, '..', 'data', 'recipes.json');
  const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

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
}

if (require.main === module) {
  const { openDb } = require('./database');
  const { db } = openDb();
  const result = seed(db);
  console.log(result.seeded ? `Seeded ${result.count} recipes.` : `Already seeded (${result.count} recipes).`);
}

module.exports = { seed };
