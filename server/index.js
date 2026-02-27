const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const models = require('./models');
const assetsRoute = require('./routes/assets');
const usersRoute = require('./routes/users');
const storesRoute = require('./routes/stores');
const allocationsRoute = require('./routes/allocations');
const { attachUser } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// attach user from header for simple auth
app.use(attachUser);

// initialize database and seed
models.init();
models.seedSample();

app.use('/api/assets', assetsRoute);
app.use('/api/users', usersRoute);
app.use('/api/stores', storesRoute);
app.use('/api/allocations', allocationsRoute);
const authRoute = require('./routes/auth');
app.use('/api/auth', authRoute);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));

module.exports = app;
