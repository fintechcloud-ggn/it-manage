const models = require('../server/models');
const app = require('../server/index');

let initPromise;
const shouldAutoInit = process.env.AUTO_INIT_DB === 'true';

function ensureInit() {
  if (!initPromise) {
    initPromise = (async () => {
      await models.init();
      await models.seedSample();
    })();
  }
  return initPromise;
}

module.exports = async (req, res) => {
  try {
    if (shouldAutoInit) {
      await ensureInit();
    }
    return app(req, res);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server failed to initialize' });
  }
};
