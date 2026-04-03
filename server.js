const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { createGameSession, STATS_DURATION_MS } = require('./server/games/minesweeperSession');
const { createPaintSession } = require('./server/games/paintSession');
const { createSnakeSession } = require('./server/games/snakeSession');
const {
  MINES_EVENTS,
  PAINT_EVENTS,
  SNAKE_EVENTS,
} = require('./shared/events');
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

app.get(['/skeleton', '/skeleton/', '/skeleton.html', '/skeleton-client.js'], (req, res) => {
  res.status(404).send('Not found');
});

app.use(express.static(path.join(__dirname, 'public')));

function normalizeLobbyId(value, fallbackLobbyId) {
  const lobbyId = String(value || '').trim().toLowerCase();
  if (!lobbyId) return fallbackLobbyId;
  if (!/^[a-z0-9_-]{1,40}$/.test(lobbyId)) return fallbackLobbyId;
  return lobbyId;
}

// --------------------------------------------------------- mode runtime

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
      if (lobby?.session?.setStatsTimeout) lobby.session.setStatsTimeout(null);
    },
    events: {
      join: MINES_EVENTS.join,
      joinError: MINES_EVENTS.joinError,
      state: MINES_EVENTS.state,
      playerJoined: MINES_EVENTS.playerJoined,
      playerLeft: MINES_EVENTS.playerLeft,
      move: MINES_EVENTS.move,
      playerMoved: MINES_EVENTS.playerMoved,
      chatTyping: MINES_EVENTS.chatTyping,
      chatSend: MINES_EVENTS.chatSend,
      chatMessage: MINES_EVENTS.chatMessage,
    },
  },
  paint: {
    defaultLobbyId: 'paint-global',
    lobbies: new Map(),
    hasPositionMove: true,
    createSession: (lobbyId) => createPaintSession({ persistKey: lobbyId }),
    onEmptyLobby: (lobby) => {
      if (lobby?.session?.dispose) lobby.session.dispose();
    },
    events: {
      join: PAINT_EVENTS.join,
      joinError: PAINT_EVENTS.joinError,
      state: PAINT_EVENTS.state,
      playerJoined: PAINT_EVENTS.playerJoined,
      playerLeft: PAINT_EVENTS.playerLeft,
      move: PAINT_EVENTS.move,
      playerMoved: PAINT_EVENTS.playerMoved,
      chatTyping: PAINT_EVENTS.chatTyping,
      chatSend: PAINT_EVENTS.chatSend,
      chatMessage: PAINT_EVENTS.chatMessage,
    },
  },
  snake: {
    defaultLobbyId: 'snake-global',
    lobbies: new Map(),
    hasPositionMove: false,
    createSession: (lobbyId) => createSnakeSession({
      onPlayerDied: (socketId, payload) => {
        io.to(socketId).emit(SNAKE_EVENTS.playerDied, payload || {});
      },
      onPlayerRemoved: (socketId) => {
        const deadSocket = io.sockets.sockets.get(socketId);
        if (deadSocket) {
          deadSocket.leave(lobbyId);
          deadSocket.data.mode = null;
          deadSocket.data.lobbyId = null;
        }
        io.to(lobbyId).emit(SNAKE_EVENTS.playerLeft, { id: socketId });
        tryRemoveLobby('snake', lobbyId);
      },
    }),
    onEmptyLobby: (lobby) => {
      if (lobby?.session?.dispose) lobby.session.dispose();
    },
    events: {
      join: SNAKE_EVENTS.join,
      joinError: SNAKE_EVENTS.joinError,
      state: SNAKE_EVENTS.state,
      playerJoined: SNAKE_EVENTS.playerJoined,
      playerLeft: SNAKE_EVENTS.playerLeft,
      chatTyping: SNAKE_EVENTS.chatTyping,
      chatSend: SNAKE_EVENTS.chatSend,
      chatMessage: SNAKE_EVENTS.chatMessage,
    },
  },
};

// --------------------------------------------------------- lobby management

function getOrCreateLobby(mode, lobbyId) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime.lobbies.has(lobbyId)) {
    const session = runtime.createSession(lobbyId);
    if (session && typeof session.setBroadcast === 'function') {
      session.setBroadcast((event, payload) => {
        io.to(lobbyId).emit(event, payload);
      });
    }
    runtime.lobbies.set(lobbyId, { id: lobbyId, session });
  }
  return runtime.lobbies.get(lobbyId);
}

function disposeAllSessions() {
  for (const runtime of Object.values(MODE_RUNTIME)) {
    for (const lobby of runtime.lobbies.values()) {
      if (!lobby?.session?.dispose) continue;
      try { lobby.session.dispose(); } catch (e) { console.error('Session dispose failed:', e); }
    }
  }
}

function tryRemoveLobby(mode, lobbyId) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime) return;
  if (lobbyId === runtime.defaultLobbyId) return;
  const lobby = runtime.lobbies.get(lobbyId);
  if (!lobby || lobby.session.getPlayerCount() > 0) return;
  if (typeof runtime.onEmptyLobby === 'function') runtime.onEmptyLobby(lobby);
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
  if (removed) io.to(lobbyId).emit(runtime.events.playerLeft, { id: socket.id });
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

// --------------------------------------------------------- common handlers

function sanitizeCoords(payload) {
  return { x: Number(payload?.x), y: Number(payload?.y) };
}

function sanitizeChatText(payload) {
  return String(payload?.text || '');
}

function handleJoin(socket, mode, payload = {}) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime) return;
  const nextLobbyId = normalizeLobbyId(payload.lobbyId || runtime.defaultLobbyId, runtime.defaultLobbyId);
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

  socket.on(runtime.events.join, (payload = {}) => handleJoin(socket, mode, payload));

  if (runtime.hasPositionMove && runtime.events.move && runtime.events.playerMoved) {
    socket.on(runtime.events.move, (payload = {}) => {
      const ctx = getContextForSocket(socket, mode);
      if (!ctx?.lobby.session?.movePlayer) return;
      const { x, y } = sanitizeCoords(payload);
      const moved = ctx.lobby.session.movePlayer(socket.id, x, y);
      if (!moved.ok) return;
      io.to(ctx.lobbyId).emit(runtime.events.playerMoved, {
        id: moved.player.id, x: moved.player.x, y: moved.player.y,
      });
    });
  }

  socket.on(runtime.events.chatTyping, (payload = {}) => {
    const ctx = getContextForSocket(socket, mode);
    if (!ctx) return;
    const typing = ctx.lobby.session.setPlayerTyping(socket.id, Boolean(payload.active));
    if (!typing.ok) return;
    io.to(ctx.lobbyId).emit(runtime.events.chatTyping, {
      id: typing.player.id, active: Boolean(typing.player.isTyping),
    });
  });

  socket.on(runtime.events.chatSend, (payload = {}) => {
    const ctx = getContextForSocket(socket, mode);
    if (!ctx) return;
    const sent = ctx.lobby.session.addChatMessage(socket.id, sanitizeChatText(payload));
    if (!sent.ok) return;
    io.to(ctx.lobbyId).emit(runtime.events.chatMessage, sent.message);
  });
}

// --------------------------------------------------------- connection

io.on('connection', (socket) => {
  registerCommonModeHandlers(socket, 'mines');
  registerCommonModeHandlers(socket, 'paint');
  registerCommonModeHandlers(socket, 'snake');

  registerMinesSocketHandlers({
    socket, io, getContextForSocket, sanitizeCoords,
    minesEvents: MINES_EVENTS,
    getMinesLobby: (lobbyId) => MODE_RUNTIME.mines.lobbies.get(lobbyId),
    scheduleMinesNextRound: (lobbyId) => {
      const lobby = MODE_RUNTIME.mines.lobbies.get(lobbyId);
      if (!lobby) return;
      const timeout = setTimeout(() => {
        const activeLobby = MODE_RUNTIME.mines.lobbies.get(lobbyId);
        if (!activeLobby) return;
        io.to(lobbyId).emit(MINES_EVENTS.gameNew, activeLobby.session.initNewGame());
      }, STATS_DURATION_MS);
      lobby.session.setStatsTimeout(timeout);
    },
  });

  registerPaintSocketHandlers({
    socket, io, getContextForSocket, sanitizeCoords,
    paintEvents: PAINT_EVENTS,
  });

  registerSnakeSocketHandlers({
    socket, getContextForSocket,
    snakeEvents: SNAKE_EVENTS,
  });

  socket.on('disconnect', () => removeSocketFromCurrentSession(socket));
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
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
