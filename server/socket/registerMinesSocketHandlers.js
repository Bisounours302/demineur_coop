function registerMinesSocketHandlers({
  socket,
  io,
  getContextForSocket,
  sanitizeCoords,
  minesEvents,
  getMinesLobby,
  scheduleMinesNextRound,
}) {
  socket.on(minesEvents.reveal, (payload = {}) => {
    const ctx = getContextForSocket(socket, 'mines');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const result = ctx.lobby.session.revealCell(socket.id, x, y);

    if (!result.ok) return;

    if (result.cells.length > 0) {
      io.to(ctx.lobbyId).emit(minesEvents.cellsRevealed, {
        cells: result.cells,
        playerId: result.playerId,
      });
    }

    if (result.bomb) {
      io.to(ctx.lobbyId).emit(minesEvents.bombExploded, {
        id: result.playerId,
        x,
        y,
        pseudo: result.triggeredBy,
        count: result.explosionCount,
        stunEndTime: result.stunEndTime,
      });
    }

    if (result.gameOver) {
      const lobby = getMinesLobby(ctx.lobbyId);
      if (lobby) {
        io.to(ctx.lobbyId).emit(minesEvents.gameOver, lobby.session.getStats());
        scheduleMinesNextRound(ctx.lobbyId);
      }
    }
  });

  socket.on(minesEvents.flag, (payload = {}) => {
    const ctx = getContextForSocket(socket, 'mines');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const flagged = ctx.lobby.session.toggleFlag(socket.id, x, y);

    if (!flagged.ok) return;

    io.to(ctx.lobbyId).emit(minesEvents.cellFlagged, {
      x: flagged.x,
      y: flagged.y,
      pseudo: flagged.pseudo,
      active: flagged.active,
    });
  });
}

module.exports = {
  registerMinesSocketHandlers,
};
