const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const game = require('./gameState');

const PORT = Number(process.env.PORT) || 3000;

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

app.use(express.static(path.join(__dirname, 'public')));

function startNewRoundAndBroadcast() {
  const snapshot = game.initNewGame();
  io.emit('game:new', snapshot);
}

function scheduleNextRound() {
  const timeout = setTimeout(() => {
    startNewRoundAndBroadcast();
  }, game.STATS_DURATION_MS);

  game.setStatsTimeout(timeout);
}

function handlePotentialGameOver(result) {
  if (!result) return;

  const stats = game.endGame(result);
  if (!stats) return;

  io.emit('game:over', {
    result,
    stats,
  });

  scheduleNextRound();
}

function sanitizeCoords(payload) {
  return {
    x: Number(payload?.x),
    y: Number(payload?.y),
  };
}

io.on('connection', (socket) => {
  socket.on('player:join', (payload = {}) => {
    const pseudo = String(payload.pseudo || '').trim();
    const added = game.addPlayer(socket.id, pseudo);

    if (!added.ok) {
      socket.emit('error:join', { message: added.error });
      return;
    }

    socket.emit('game:state', game.getPublicState(socket.id));
    io.emit('player:joined', added.player);
  });

  socket.on('player:move', (payload = {}) => {
    const { x, y } = sanitizeCoords(payload);
    const moved = game.movePlayer(socket.id, x, y);

    if (!moved.ok) {
      return;
    }

    io.emit('player:moved', {
      id: moved.player.id,
      x: moved.player.x,
      y: moved.player.y,
    });
  });

  socket.on('cell:reveal', (payload = {}) => {
    const { x, y } = sanitizeCoords(payload);
    const result = game.revealCell(socket.id, x, y);

    if (!result.ok) {
      return;
    }

    if (result.cells.length > 0) {
      io.emit('cells:revealed', {
        cells: result.cells,
        triggeredBy: result.triggeredBy,
      });
    }

    if (result.bomb) {
      io.emit('bomb:exploded', {
        id: result.playerId,
        x,
        y,
        pseudo: result.triggeredBy,
        count: result.explosionCount,
        stunEndTime: result.stunEndTime,
      });
    }

    handlePotentialGameOver(result.gameOver);
  });

  socket.on('cell:flag', (payload = {}) => {
    const { x, y } = sanitizeCoords(payload);
    const flagged = game.toggleFlag(socket.id, x, y);

    if (!flagged.ok) {
      return;
    }

    io.emit('cell:flagged', {
      x: flagged.x,
      y: flagged.y,
      pseudo: flagged.pseudo,
      active: flagged.active,
    });
  });

  socket.on('disconnect', () => {
    const removed = game.removePlayer(socket.id);
    if (!removed) return;

    io.emit('player:left', {
      id: socket.id,
    });
  });
});

game.initNewGame();

server.listen(PORT, () => {
  console.log(`Minesweeper coop server listening on port ${PORT}`);
});
