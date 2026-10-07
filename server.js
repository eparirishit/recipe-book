// Recipe Book App — Express server (scaffold).
// API routes are added in later commits; this skeleton boots the app.
const path = require('path');
const express = require('express');
const { db } = require('./db/database'); // creates data/recipebook.db + seeds on first run

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Fallback for SPA-style navigation: unknown non-API paths serve index.html
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Recipe Book app listening on http://localhost:${PORT}`);
});
