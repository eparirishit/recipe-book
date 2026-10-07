// Vercel serverless entry point.
//
// Requiring ../server builds the Express app but does NOT call app.listen
// (server.js only listens when it is the main module), so exporting the app
// here is safe: Vercel invokes it per request as a serverless function.
// vercel.json rewrites /api/* to this function; static files in public/
// are served by Vercel directly.
const { app } = require('../server');

module.exports = app;
