const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const { createGameSession, STATS_DURATION_MS } = require('./gameSession');
const { createPaintSession } = require('./paintSession');

const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.get('/paint', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'paint.html'));
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
    events: {
      join: 'player:join',
      joinError: 'error:join',
      state: 'game:state',
      playerJoined: 'player:joined',
      playerLeft: 'player:left',
      move: 'player:move',
      moved: 'player:moved',
      typingIn: 'chat:typing',
      typingOut: 'chat:typing',
      chatIn: 'chat:send',
      chatOut: 'chat:message',
    },
  },
  paint: {
    defaultLobbyId: 'paint-global',
    lobbies: new Map(),
    createSession: (lobbyId) => createPaintSession({ persistKey: lobbyId }),
    onEmptyLobby: (lobby) => {
      if (lobby && lobby.session && typeof lobby.session.dispose === 'function') {
        lobby.session.dispose();
      }
    },
    events: {
      join: 'paint:join',
      joinError: 'paint:error:join',
      state: 'paint:state',
      playerJoined: 'paint:player:joined',
      playerLeft: 'paint:player:left',
      move: 'paint:move',
      moved: 'paint:player:moved',
      typingIn: 'paint:chat:typing',
      typingOut: 'paint:chat:typing',
      chatIn: 'paint:chat:send',
      chatOut: 'paint:chat:message',
    },
  },
};

function getOrCreateLobby(mode, lobbyId) {
  const runtime = MODE_RUNTIME[mode];
  if (!runtime.lobbies.has(lobbyId)) {
    runtime.lobbies.set(lobbyId, {
      id: lobbyId,
      session: runtime.createSession(lobbyId),
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
    io.to(lobbyId).emit('game:new', activeLobby.session.initNewGame());
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

  io.to(lobbyId).emit('game:over', {
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

  socket.on(runtime.events.move, (payload = {}) => {
    const ctx = getContextForSocket(socket, mode);
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const moved = ctx.lobby.session.movePlayer(socket.id, x, y);

    if (!moved.ok) return;

    io.to(ctx.lobbyId).emit(runtime.events.moved, {
      id: moved.player.id,
      x: moved.player.x,
      y: moved.player.y,
    });
  });

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

  socket.on('cell:reveal', (payload = {}) => {
    const ctx = getContextForSocket(socket, 'mines');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const result = ctx.lobby.session.revealCell(socket.id, x, y);

    if (!result.ok) {
      return;
    }

    if (result.cells.length > 0) {
      io.to(ctx.lobbyId).emit('cells:revealed', {
        cells: result.cells,
        playerId: result.playerId,
      });
    }

    if (result.bomb) {
      io.to(ctx.lobbyId).emit('bomb:exploded', {
        id: result.playerId,
        x,
        y,
        pseudo: result.triggeredBy,
        count: result.explosionCount,
        stunEndTime: result.stunEndTime,
      });
    }

    handleMinesPotentialGameOver(ctx.lobbyId, result.gameOver);
  });

  socket.on('cell:flag', (payload = {}) => {
    const ctx = getContextForSocket(socket, 'mines');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const flagged = ctx.lobby.session.toggleFlag(socket.id, x, y);

    if (!flagged.ok) {
      return;
    }

    io.to(ctx.lobbyId).emit('cell:flagged', {
      x: flagged.x,
      y: flagged.y,
      pseudo: flagged.pseudo,
      active: flagged.active,
    });
  });

  socket.on('paint:place', (payload = {}) => {
    const ctx = getContextForSocket(socket, 'paint');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const placed = ctx.lobby.session.placePixel(socket.id, x, y, payload.paletteIndex);
    if (!placed.ok) return;

    io.to(ctx.lobbyId).emit('paint:pixel', {
      x: placed.x,
      y: placed.y,
      paletteIndex: placed.paletteIndex,
      playerId: placed.playerId,
      pseudo: placed.pseudo,
      pixelsPlaced: placed.pixelsPlaced,
    });
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
