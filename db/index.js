// Database driver selection.
// Turso (libsql) when TURSO_DATABASE_URL is set, otherwise the local
// better-sqlite3 file database. Both drivers expose the same async API
// (see db/local.js), so the rest of the app never branches on env.
let instance = null;

async function getDb() {
  if (!instance) {
    if (process.env.TURSO_DATABASE_URL) {
      instance = require('./turso').createTursoDb();
    } else {
      instance = require('./local').createLocalDb();
    }
  }
  return instance;
}

module.exports = { getDb };
