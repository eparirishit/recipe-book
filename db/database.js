// Opens (creating if needed) the SQLite database at data/recipebook.db,
// applies the schema, and seeds the 16 starter recipes on first run.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, 'recipebook.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

const { seed } = require('./seed');
seed(db);

module.exports = { db, dbPath };
