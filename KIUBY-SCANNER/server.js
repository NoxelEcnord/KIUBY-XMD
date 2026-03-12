const express = require('express');
const path = require('path');
const pair = require('./api/pair');
const qr = require('./api/qr');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/pair', pair);
app.get('/api/qr', qr);

app.listen(PORT, () => {
    console.log(`[KIUBY-SCANNER] Server running at http://localhost:${PORT}`);
    console.log(`[KIUBY-SCANNER] Press Ctrl+C to stop.`);
});
