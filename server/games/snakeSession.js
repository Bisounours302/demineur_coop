const { createSessionCore } = require('../core/createSessionCore');

const GRID_W = 70;
const GRID_H = 70;
const TOTAL_CELLS = GRID_W * GRID_H;
const MAX_PLAYERS = 30;
const TICK_MS = 180;
const START_LENGTH = 4;
const APPLE_COUNT = 1;

const DIRECTIONS = ['up', 'down', 'left', 'right'];
const DIRECTION_VECTORS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};
const OPPOSITE_DIRECTION = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function cellKey(x, y) {
  return `${x}:${y}`;
}

function createSnakeSession(options = {}) {
  const onPlayerDied = typeof options.onPlayerDied === 'function'
    ? options.onPlayerDied
    : () => {};

  const core = createSessionCore({
    maxPlayers: MAX_PLAYERS,
    isInBounds: (_, x, y) => x >= 0 && x < GRID_W && y >= 0 && y < GRID_H,
    isAdjacentToPlayer: () => true,
    getSpawn: (state) => findFreeSpawn(state.players, null),
    buildPlayerExtras: (_, state, __, ___, spawn) => {
      const direction = DIRECTIONS.includes(spawn?.direction) ? spawn.direction : 'right';
      const segments = createSegmentsFromSpawn(spawn, direction);
      return {
        x: segments[0].x,
        y: segments[0].y,
        direction,
        pendingDirection: direction,
        segments,
        score: 0,
        deaths: 0,
        alive: true,
      };
    },
    toPublicPlayer: (player) => ({
      direction: player.direction,
      alive: Boolean(player.alive),
      score: Math.max(0, Number(player.score) || 0),
      deaths: Math.max(0, Number(player.deaths) || 0),
      segments: Array.isArray(player.segments)
        ? player.segments.map((segment) => ({ x: segment.x, y: segment.y }))
        : [],
    }),
    getProgressSnapshot: (player) => ({
      avatar: player.avatar,
      colorIndex: player.colorIndex,
    }),
    onBeforeRemovePlayer: (player) => {
      player.isTyping = false;
    },
  });

  const state = core.state;
  Object.assign(state, {
    phase: 'playing',
    startTime: Date.now(),
    map: {
      width: GRID_W,
      height: GRID_H,
      totalCells: TOTAL_CELLS,
      tickMs: TICK_MS,
      appleCount: APPLE_COUNT,
    },
    apples: [],
  });

  let broadcast = () => {};
  let loopTimer = null;

  function createSegmentsFromSpawn(spawn, direction) {
    const headX = Number(spawn?.x) || 3;
    const headY = Number(spawn?.y) || 3;
    const vector = DIRECTION_VECTORS[direction] || DIRECTION_VECTORS.right;

    const segments = [{ x: headX, y: headY }];
    for (let i = 1; i < START_LENGTH; i++) {
      segments.push({ x: headX - vector.dx * i, y: headY - vector.dy * i });
    }

    return segments;
  }

  function getOccupiedCells(players, excludedId = null) {
    const occupied = new Set();
    for (const player of players.values()) {
      if (!player || player.id === excludedId) continue;
      for (const segment of player.segments || []) {
        occupied.add(cellKey(segment.x, segment.y));
      }
    }
    return occupied;
  }

  function findFreeSpawn(players, excludedId = null) {
    const occupied = getOccupiedCells(players, excludedId);

    for (let attempt = 0; attempt < 320; attempt++) {
      const direction = DIRECTIONS[randomInt(0, DIRECTIONS.length - 1)];
      const vector = DIRECTION_VECTORS[direction];

      let minX = 0;
      let maxX = GRID_W - 1;
      let minY = 0;
      let maxY = GRID_H - 1;

      if (vector.dx === 1) minX = START_LENGTH - 1;
      if (vector.dx === -1) maxX = GRID_W - START_LENGTH;
      if (vector.dy === 1) minY = START_LENGTH - 1;
      if (vector.dy === -1) maxY = GRID_H - START_LENGTH;

      const x = randomInt(minX, maxX);
      const y = randomInt(minY, maxY);
      const segments = createSegmentsFromSpawn({ x, y }, direction);

      let collides = false;
      for (const segment of segments) {
        if (occupied.has(cellKey(segment.x, segment.y))) {
          collides = true;
          break;
        }
      }

      if (!collides) {
        return { x, y, direction };
      }
    }

    return { x: Math.max(START_LENGTH - 1, Math.floor(GRID_W / 2)), y: Math.floor(GRID_H / 2), direction: 'right' };
  }

  function spawnSingleApple(occupied, appleKeys) {
    for (let attempt = 0; attempt < 1500; attempt++) {
      const x = randomInt(0, GRID_W - 1);
      const y = randomInt(0, GRID_H - 1);
      const key = cellKey(x, y);
      if (occupied.has(key) || appleKeys.has(key)) {
        continue;
      }

      return { x, y };
    }

    return null;
  }

  function ensureAppleCount() {
    const occupied = getOccupiedCells(state.players, null);
    const appleKeys = new Set(state.apples.map((apple) => cellKey(apple.x, apple.y)));
    const targetAppleCount = Math.max(1, Number(APPLE_COUNT) || 1);

    while (state.apples.length < targetAppleCount) {
      const nextApple = spawnSingleApple(occupied, appleKeys);
      if (!nextApple) break;

      state.apples.push(nextApple);
      appleKeys.add(cellKey(nextApple.x, nextApple.y));
    }
  }

  function normalizeDirection(nextDirection) {
    if (!DIRECTIONS.includes(nextDirection)) {
      return null;
    }
    return nextDirection;
  }

  function broadcastTick() {
    broadcast('snake:tick', {
      at: Date.now(),
      players: core.getPublicPlayers(),
      apples: state.apples,
    });
  }

  function step() {
    const players = Array.from(state.players.values());
    if (players.length === 0) return;

    ensureAppleCount();

    const nextById = new Map();
    for (const player of players) {
      const pending = normalizeDirection(player.pendingDirection) || player.direction;
      const nextDirection = OPPOSITE_DIRECTION[player.direction] === pending
        ? player.direction
        : pending;
      const vector = DIRECTION_VECTORS[nextDirection];
      const nextHead = {
        x: player.segments[0].x + vector.dx,
        y: player.segments[0].y + vector.dy,
      };
      nextById.set(player.id, {
        direction: nextDirection,
        head: nextHead,
      });
    }

    const eatenAppleKeys = new Set();
    const eaterCountById = new Map();
    const applesByKey = new Set(state.apples.map((apple) => cellKey(apple.x, apple.y)));
    for (const player of players) {
      const next = nextById.get(player.id);
      if (!next) continue;

      const nextKey = cellKey(next.head.x, next.head.y);
      if (!applesByKey.has(nextKey)) continue;

      eatenAppleKeys.add(nextKey);
      eaterCountById.set(player.id, (eaterCountById.get(player.id) || 0) + 1);
    }

    const tailBlocked = new Set();
    for (const player of players) {
      const segments = player.segments || [];
      const lastIndex = segments.length - 1;
      const willGrow = (eaterCountById.get(player.id) || 0) > 0;
      const end = willGrow ? lastIndex : lastIndex - 1;

      for (let i = 1; i <= end; i++) {
        const segment = segments[i];
        if (!segment) continue;
        tailBlocked.add(cellKey(segment.x, segment.y));
      }
    }

    const deadIds = new Set();
    for (const player of players) {
      const next = nextById.get(player.id);
      if (!next) continue;

      const outOfBounds = next.head.x < 0 || next.head.x >= GRID_W || next.head.y < 0 || next.head.y >= GRID_H;
      if (outOfBounds || tailBlocked.has(cellKey(next.head.x, next.head.y))) {
        deadIds.add(player.id);
      }
    }

    for (const player of players) {
      const next = nextById.get(player.id);
      if (!next) continue;

      if (deadIds.has(player.id)) {
        continue;
      }

      player.direction = next.direction;
      player.pendingDirection = next.direction;
      player.segments.unshift(next.head);

      const eatenCount = eaterCountById.get(player.id) || 0;
      if (eatenCount > 0) {
        player.score = Math.max(0, Number(player.score) || 0) + eatenCount;
      } else {
        player.segments.pop();
      }

      player.x = player.segments[0].x;
      player.y = player.segments[0].y;
    }

    if (eatenAppleKeys.size > 0) {
      state.apples = state.apples.filter((apple) => !eatenAppleKeys.has(cellKey(apple.x, apple.y)));
    }

    for (const deadId of deadIds) {
      const deadPlayer = state.players.get(deadId);
      if (!deadPlayer) continue;

      const previousScore = Math.max(0, Number(deadPlayer.score) || 0);
      onPlayerDied(deadId, {
        score: previousScore,
        pseudo: deadPlayer.pseudo,
      });

      core.removePlayer(deadId);
    }

    ensureAppleCount();

    broadcastTick();
  }

  function startLoop() {
    if (loopTimer) return;

    loopTimer = setInterval(step, TICK_MS);
    if (typeof loopTimer.unref === 'function') {
      loopTimer.unref();
    }
  }

  function stopLoop() {
    if (!loopTimer) return;
    clearInterval(loopTimer);
    loopTimer = null;
  }

  function setDirection(socketId, direction) {
    const player = state.players.get(socketId);
    if (!player) return { ok: false, error: 'Joueur introuvable.' };

    const nextDirection = normalizeDirection(direction);
    if (!nextDirection) return { ok: false, error: 'Direction invalide.' };
    if (OPPOSITE_DIRECTION[player.direction] === nextDirection) {
      return { ok: false, error: 'Demi-tour impossible.' };
    }

    player.pendingDirection = nextDirection;
    return { ok: true };
  }

  function addPlayer(socketId, pseudo, avatar, colorIndex) {
    const added = core.addPlayer(socketId, pseudo, avatar, colorIndex);
    if (!added.ok) return added;

    ensureAppleCount();

    broadcastTick();
    return added;
  }

  function removePlayer(socketId) {
    const removed = core.removePlayer(socketId);
    if (removed) {
      broadcastTick();
    }
    return removed;
  }

  function getPublicState(forSocketId = null) {
    return {
      phase: state.phase,
      myId: forSocketId,
      startTime: state.startTime,
      map: {
        width: GRID_W,
        height: GRID_H,
        totalCells: TOTAL_CELLS,
        tickMs: TICK_MS,
        appleCount: APPLE_COUNT,
      },
      apples: state.apples,
      players: core.getPublicPlayers(),
      chatMessages: core.getChatMessages(),
    };
  }

  function setBroadcast(nextBroadcast) {
    broadcast = typeof nextBroadcast === 'function' ? nextBroadcast : () => {};
    broadcastTick();
  }

  function dispose() {
    stopLoop();
  }

  ensureAppleCount();
  startLoop();

  return {
    addPlayer,
    removePlayer,
    setPlayerTyping: core.setPlayerTyping,
    addChatMessage: core.addChatMessage,
    getPublicState,
    getPlayerCount: core.getPlayerCount,
    setDirection,
    setBroadcast,
    dispose,
  };
}

module.exports = {
  createSnakeSession,
};
