const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const models = require('./models');
const assetsRoute = require('./routes/assets');
const usersRoute = require('./routes/users');
const storesRoute = require('./routes/stores');
const allocationsRoute = require('./routes/allocations');
const brandsRoute = require('./routes/brands');
const { attachUser } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(attachUser);

app.use('/api/assets', assetsRoute);
app.use('/api/users', usersRoute);
app.use('/api/stores', storesRoute);
app.use('/api/allocations', allocationsRoute);
app.use('/api/brands', brandsRoute);
const authRoute = require('./routes/auth');
app.use('/api/auth', authRoute);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function start() {
  try {
    await models.init();
    await models.seedSample();
    const port = process.env.PORT || 4000;
    app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
  } catch (err) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}

start();

module.exports = app;
