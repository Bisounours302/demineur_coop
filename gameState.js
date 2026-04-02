const { STATS_DURATION_MS, createGameSession } = require('./gameSession');

const defaultSession = createGameSession();

module.exports = {
  STATS_DURATION_MS,
  createGameSession,
  ...defaultSession,
};