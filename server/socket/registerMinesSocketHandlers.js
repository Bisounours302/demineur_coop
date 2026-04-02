function registerMinesSocketHandlers({
  socket,
  io,
  getContextForSocket,
  sanitizeCoords,
  handleMinesPotentialGameOver,
  minesActionEvents,
}) {
  socket.on(minesActionEvents.revealIn, (payload = {}) => {
    const ctx = getContextForSocket(socket, 'mines');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const result = ctx.lobby.session.revealCell(socket.id, x, y);

    if (!result.ok) {
      return;
    }

    if (result.cells.length > 0) {
      io.to(ctx.lobbyId).emit(minesActionEvents.revealOut, {
        cells: result.cells,
        playerId: result.playerId,
      });
    }

    if (result.bomb) {
      io.to(ctx.lobbyId).emit(minesActionEvents.bombOut, {
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

  socket.on(minesActionEvents.flagIn, (payload = {}) => {
    const ctx = getContextForSocket(socket, 'mines');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const flagged = ctx.lobby.session.toggleFlag(socket.id, x, y);

    if (!flagged.ok) {
      return;
    }

    io.to(ctx.lobbyId).emit(minesActionEvents.flagOut, {
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
