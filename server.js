const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { createGameSession, STATS_DURATION_MS } = require('./gameSession');
const { createPaintSession } = require('./paintSession');
const { createSnakeSession } = require('./snakeSession');
const {
  MODE_EVENTS,
  MINES_ACTION_EVENTS,
  PAINT_ACTION_EVENTS,
  SNAKE_ACTION_EVENTS,
} = require('./server/socket/events');
const { registerMinesSocketHandlers } = require('./server/socket/registerMinesSocketHandlers');
const { registerPaintSocketHandlers } = require('./server/socket/registerPaintSocketHandlers');
const { registerSnakeSocketHandlers } = require('./server/socket/registerSnakeSocketHandlers');

const PORT = Number(process.env.PORT) || 3000;

function parseAllowedOrigins(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return [
      'https://demineur.everbloom.fr',
      'https://paint.everbloom.fr',
      'https://snake.everbloom.fr',
      'http://localhost:3000',
      `http://localhost:${PORT}`,
    ];
  }

  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const ALLOWED_ORIGIN_SET = new Set(parseAllowedOrigins(process.env.ALLOWED_ORIGINS));

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Browsers send null/undefined for same-origin or non-CORS websocket upgrades.
      if (!origin || ALLOWED_ORIGIN_SET.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin not allowed: ${origin}`));
    },
    credentials: true,
  },
});

app.get('/paint', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'paint.html'));
});

app.get('/snake', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'snake.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

function normalizeLobbyId(value, fallbackLobbyId) {
  const lobbyId = String(value || '').trim().toLowerCase();
  if (!lobbyId) return fallbackLobbyId;
  if (!/^[a-z0-9_-]{1,40}$/.test(lobbyId)) return fallbackLobbyId;
  return lobbyId;
}

const MODE_RUNTIME = {
  mines: {
    defaultLobbyId: 'global',
    lobbies: new Map(),
    hasPositionMove: true,
    createSession: () => {
      const session = createGameSession();
      session.initNewGame();
      return session;
    },
    onEmptyLobby: (lobby) => {
      if (lobby && lobby.session && typeof lobby.session.setStatsTimeout === 'function') {
        lobby.session.setStatsTimeout(null);
      }
    },
    events: MODE_EVENTS.mines,
  },
  paint: {
    defaultLobbyId: 'paint-global',
    lobbies: new Map(),
    hasPositionMove: true,
    createSession: (lobbyId) => createPaintSession({ persistKey: lobbyId }),
    onEmptyLobby: (lobby) => {
      if (lobby && lobby.session && typeof lobby.session.dispose === 'function') {
        lobby.session.dispose();
      }
    },
    events: MODE_EVENTS.paint,
  },
  snake: {
    defaultLobbyId: 'snake-global',
    lobbies: new Map(),
    hasPositionMove: false,
    createSession: (lobbyId) => createSnakeSession({
      onPlayerDied: (socketId, payload) => {
        io.to(socketId).emit(SNAKE_ACTION_EVENTS.deathOut, payload || {});
      },
      onPlayerRemoved: (socketId) => {
        const deadSocket = io.sockets.sockets.get(socketId);
        if (deadSocket) {
          deadSocket.leave(lobbyId);
          deadSocket.data.mode = null;
          deadSocket.data.lobbyId = null;
        }

        io.to(lobbyId).emit(MODE_EVENTS.snake.playerLeft, { id: socketId });
        tryRemoveLobby('snake', lobbyId);
      },
    }),
    onEmptyLobby: (lobby) => {
      if (lobby && lobby.session && typeof lobby.session.dispose === 'function') {
        lobby.session.dispose();
      }
    },
    events: MODE_EVENTS.snake,
  },
};

function getOrCreateLobby(mode, lobbyId) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime.lobbies.has(lobbyId)) {
    const session = runtime.createSession(lobbyId);
    if (session && typeof session.setBroadcast === 'function') {
      session.setBroadcast((event, payload) => {
        io.to(lobbyId).emit(event, payload);
      });
    }

    runtime.lobbies.set(lobbyId, {
      id: lobbyId,
      session,
    });
  }
  return runtime.lobbies.get(lobbyId);
}

function disposeAllSessions() {
  for (const runtime of Object.values(MODE_RUNTIME)) {
    for (const lobby of runtime.lobbies.values()) {
      if (!lobby || !lobby.session || typeof lobby.session.dispose !== 'function') {
        continue;
      }

      try {
        lobby.session.dispose();
      } catch (error) {
        console.error('Session dispose failed:', error);
      }
    }
  }
}

function tryRemoveLobby(mode, lobbyId) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime) return;
  if (lobbyId === runtime.defaultLobbyId) return;

  const lobby = runtime.lobbies.get(lobbyId);
  if (!lobby) return;
  if (lobby.session.getPlayerCount() > 0) return;

  if (typeof runtime.onEmptyLobby === 'function') {
    runtime.onEmptyLobby(lobby);
  }

  runtime.lobbies.delete(lobbyId);
}

function getContextForSocket(socket, expectedMode = null) {
  const mode = socket.data?.mode;
  const lobbyId = socket.data?.lobbyId;
  if (!mode || !lobbyId) return null;
  if (expectedMode && mode !== expectedMode) return null;

  const runtime = MODE_RUNTIME[mode];
  if (!runtime) return null;

  const lobby = runtime.lobbies.get(lobbyId);
  if (!lobby) return null;

  return { mode, lobbyId, lobby, runtime };
}

function removeSocketFromLobby(socket, mode, lobbyId) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime) return;

  const lobby = runtime.lobbies.get(lobbyId);
  if (!lobby) return;

  const removed = lobby.session.removePlayer(socket.id);
  if (removed) {
    io.to(lobbyId).emit(runtime.events.playerLeft, { id: socket.id });
  }

  socket.leave(lobbyId);
  tryRemoveLobby(mode, lobbyId);
}

function removeSocketFromCurrentSession(socket) {
  const mode = socket.data?.mode;
  const lobbyId = socket.data?.lobbyId;
  if (!mode || !lobbyId) return;

  removeSocketFromLobby(socket, mode, lobbyId);
  socket.data.mode = null;
  socket.data.lobbyId = null;
}

function scheduleMinesNextRound(lobbyId) {
  const runtime = MODE_RUNTIME.mines;
  const lobby = runtime.lobbies.get(lobbyId);
  if (!lobby) return;

  const timeout = setTimeout(() => {
    const activeLobby = runtime.lobbies.get(lobbyId);
    if (!activeLobby) return;
    io.to(lobbyId).emit(MINES_ACTION_EVENTS.gameNewOut, activeLobby.session.initNewGame());
  }, STATS_DURATION_MS);

  lobby.session.setStatsTimeout(timeout);
}

function handleMinesPotentialGameOver(lobbyId, result) {
  if (!result) return;

  const runtime = MODE_RUNTIME.mines;
  const lobby = runtime.lobbies.get(lobbyId);
  if (!lobby) return;

  const stats = lobby.session.endGame(result);
  if (!stats) return;

  io.to(lobbyId).emit(MINES_ACTION_EVENTS.gameOverOut, {
    result,
    stats,
  });

  scheduleMinesNextRound(lobbyId);
}

function sanitizeCoords(payload) {
  return {
    x: Number(payload?.x),
    y: Number(payload?.y),
  };
}

function sanitizeChatText(payload) {
  return String(payload?.text || '');
}

function handleJoin(socket, mode, payload = {}) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime) return;

  const requestedLobbyId = payload.lobbyId || runtime.defaultLobbyId;
  const nextLobbyId = normalizeLobbyId(requestedLobbyId, runtime.defaultLobbyId);
  const currentMode = socket.data?.mode || null;
  const currentLobbyId = socket.data?.lobbyId || null;

  if (currentMode && (currentMode !== mode || currentLobbyId !== nextLobbyId)) {
    removeSocketFromCurrentSession(socket);
  }

  const lobby = getOrCreateLobby(mode, nextLobbyId);
  const pseudo = String(payload.pseudo || '').trim();
  const added = lobby.session.addPlayer(socket.id, pseudo, payload.avatar, payload.colorIndex);

  if (!added.ok) {
    socket.emit(runtime.events.joinError, { message: added.error });
    return;
  }

  socket.data.mode = mode;
  socket.data.lobbyId = nextLobbyId;
  socket.join(nextLobbyId);

  socket.emit(runtime.events.state, lobby.session.getPublicState(socket.id));
  io.to(nextLobbyId).emit(runtime.events.playerJoined, added.player);
}

function registerCommonModeHandlers(socket, mode) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime) return;

  socket.on(runtime.events.join, (payload = {}) => {
    handleJoin(socket, mode, payload);
  });

  if (runtime.hasPositionMove && runtime.events.move && runtime.events.moved) {
    socket.on(runtime.events.move, (payload = {}) => {
      const ctx = getContextForSocket(socket, mode);
      if (!ctx) return;
      if (!ctx.lobby.session || typeof ctx.lobby.session.movePlayer !== 'function') return;

      const { x, y } = sanitizeCoords(payload);
      const moved = ctx.lobby.session.movePlayer(socket.id, x, y);

      if (!moved.ok) return;

      io.to(ctx.lobbyId).emit(runtime.events.moved, {
        id: moved.player.id,
        x: moved.player.x,
        y: moved.player.y,
      });
    });
  }

  socket.on(runtime.events.typingIn, (payload = {}) => {
    const ctx = getContextForSocket(socket, mode);
    if (!ctx) return;

    const typing = ctx.lobby.session.setPlayerTyping(socket.id, Boolean(payload.active));
    if (!typing.ok) return;

    io.to(ctx.lobbyId).emit(runtime.events.typingOut, {
      id: typing.player.id,
      active: Boolean(typing.player.isTyping),
    });
  });

  socket.on(runtime.events.chatIn, (payload = {}) => {
    const ctx = getContextForSocket(socket, mode);
    if (!ctx) return;

    const sent = ctx.lobby.session.addChatMessage(socket.id, sanitizeChatText(payload));
    if (!sent.ok) return;

    io.to(ctx.lobbyId).emit(runtime.events.chatOut, sent.message);
  });
}

io.on('connection', (socket) => {
  registerCommonModeHandlers(socket, 'mines');
  registerCommonModeHandlers(socket, 'paint');
  registerCommonModeHandlers(socket, 'snake');

  registerMinesSocketHandlers({
    socket,
    io,
    getContextForSocket,
    sanitizeCoords,
    handleMinesPotentialGameOver,
    minesActionEvents: MINES_ACTION_EVENTS,
  });

  registerPaintSocketHandlers({
    socket,
    io,
    getContextForSocket,
    sanitizeCoords,
    paintActionEvents: PAINT_ACTION_EVENTS,
  });

  registerSnakeSocketHandlers({
    socket,
    getContextForSocket,
    snakeActionEvents: SNAKE_ACTION_EVENTS,
  });

  socket.on('disconnect', () => {
    removeSocketFromCurrentSession(socket);
  });
});

for (const [mode, runtime] of Object.entries(MODE_RUNTIME)) {
  getOrCreateLobby(mode, runtime.defaultLobbyId);
}

server.listen(PORT, () => {
  console.log(`Minesweeper coop server listening on port ${PORT}`);
});

let shuttingDown = false;
function handleShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`Received ${signal}. Saving sessions and shutting down...`);
  disposeAllSessions();

  server.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(0);
  }, 3000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
