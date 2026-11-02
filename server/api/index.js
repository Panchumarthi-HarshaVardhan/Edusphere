let app;
let loadError;

try {
  app = require('../dist/app.js').default || require('../dist/app.js');
} catch (err) {
  loadError = err;
}

module.exports = (req, res) => {
  if (loadError) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      error: 'Failed to load app module',
      message: loadError.message,
      stack: loadError.stack,
    }));
  }
  return app(req, res);
};
