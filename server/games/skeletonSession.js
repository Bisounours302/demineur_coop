const { createSessionCore } = require('../core/createSessionCore');

const GRID_W = 80;
const GRID_H = 80;
const TOTAL_CELLS = GRID_W * GRID_H;

const MAX_PLAYERS = 30;

function createSkeletonSession() {
  const core = createSessionCore({
    maxPlayers: MAX_PLAYERS,
    isInBounds: (_, x, y) => x >= 0 && x < GRID_W && y >= 0 && y < GRID_H,
    getSpawn: () => ({
      x: Math.floor(Math.random() * GRID_W),
      y: Math.floor(Math.random() * GRID_H),
    }),
    buildPlayerExtras: (_, __, ___, savedProgress) => ({
      score: Math.max(0, Number(savedProgress?.score) || 0),
      energy: 100,
    }),
    toPublicPlayer: (player) => ({
      score: Math.max(0, Number(player.score) || 0),
      energy: Math.max(0, Number(player.energy) || 0),
    }),
    getProgressSnapshot: (player) => ({
      x: player.x,
      y: player.y,
      avatar: player.avatar,
      colorIndex: player.colorIndex,
      score: Math.max(0, Number(player.score) || 0),
    }),
  });

  const state = core.state;
  Object.assign(state, {
    phase: 'playing',
    startTime: Date.now(),
    map: {
      width: GRID_W,
      height: GRID_H,
      totalCells: TOTAL_CELLS,
    },
    customEvents: [],
  });

  function getPublicState(forSocketId = null) {
    return {
      phase: state.phase,
      myId: forSocketId,
      startTime: state.startTime,
      map: state.map,
      players: core.getPublicPlayers(),
      chatMessages: core.getChatMessages(),
      // TODO: Ajouter ici l etat specifique du jeu.
      customEvents: state.customEvents.slice(-100),
    };
  }

  function performPrimaryAction(socketId, x, y) {
    const validated = core.validateAction(socketId, x, y, 'Action hors portee.');
    if (!validated.ok) return validated;

    const { player } = validated;

    // TODO: Remplacer par la vraie logique metier du nouveau jeu.
    player.score += 1;
    player.energy = Math.max(0, player.energy - 1);

    const event = {
      at: Date.now(),
      playerId: player.id,
      pseudo: player.pseudo,
      x,
      y,
      score: player.score,
    };
    state.customEvents.push(event);
    if (state.customEvents.length > 1000) {
      state.customEvents = state.customEvents.slice(-1000);
    }

    return {
      ok: true,
      event,
      playerId: player.id,
      score: player.score,
      energy: player.energy,
    };
  }

  return {
    addPlayer: core.addPlayer,
    removePlayer: core.removePlayer,
    movePlayer: core.movePlayer,
    setPlayerTyping: core.setPlayerTyping,
    addChatMessage: core.addChatMessage,
    getPublicState,
    performPrimaryAction,
    getPlayerCount: core.getPlayerCount,
  };
}

module.exports = {
  createSkeletonSession,
};
