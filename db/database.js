// Opens (creating if needed) the SQLite database at data/recipebook.db
// and applies the schema. Seeding is done explicitly via seed.js.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');

function openDb() {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'recipebook.db');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  return { db, dbPath };
}

module.exports = { openDb };
