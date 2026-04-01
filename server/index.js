const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

const pairRouter = require('./pair');
const qrRouter  = require('./qr');

const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Increase max event listeners
require('events').EventEmitter.defaultMaxListeners = 500;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.use('/pair', pairRouter);
app.use('/qr',   qrRouter);

app.listen(PORT, () => {
    console.log(`🌐 Session server running on http://localhost:${PORT}`);
});

module.exports = app;
