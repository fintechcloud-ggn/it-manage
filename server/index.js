const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const models = require('./models');
const assetsRoute = require('./routes/assets');
const usersRoute = require('./routes/users');
const storesRoute = require('./routes/stores');
const allocationsRoute = require('./routes/allocations');
const brandsRoute = require('./routes/brands');
const auditLogsRoute = require('./routes/audit-logs');
const { attachUser } = require('./middleware/auth');
const { query } = require('./db');

const app = express();
app.use(cors({ origin: true }));
app.options('*', cors({ origin: true }));
app.use(bodyParser.json());
app.use(attachUser);

app.use('/api/assets', assetsRoute);
app.use('/api/users', usersRoute);
app.use('/api/stores', storesRoute);
app.use('/api/allocations', allocationsRoute);
app.use('/api/brands', brandsRoute);
app.use('/api/audit-logs', auditLogsRoute);
const authRoute = require('./routes/auth');
app.use('/api/auth', authRoute);

app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({
      status: 'ok',
      capabilities: {
        assignedByPersistence: true
      }
    });
  } catch (err) {
    res.status(503).json({ status: 'error', error: 'Database unavailable' });
  }
});

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

if (require.main === module) {
  start();
}

module.exports = app;
