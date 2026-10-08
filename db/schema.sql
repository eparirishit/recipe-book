-- Recipe Book App schema.
-- Recipe numbers are permanent IDs (01, 02, ...); new recipes take max+1.

CREATE TABLE IF NOT EXISTS recipes (
  id          INTEGER PRIMARY KEY,          -- == number, assigned explicitly
  number      INTEGER NOT NULL UNIQUE,      -- permanent display number
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,
  serves      TEXT,
  time        TEXT,
  description TEXT,
  ingredients TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  method      TEXT NOT NULL DEFAULT '[]',  -- JSON array of strings
  source      TEXT,
  source_url  TEXT,                 -- original Instagram reel/post URL
  favorite    INTEGER NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS grocery_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id    INTEGER,
  recipe_title TEXT,
  label        TEXT NOT NULL,
  checked      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);
CREATE INDEX IF NOT EXISTS idx_recipes_favorite ON recipes(favorite);
