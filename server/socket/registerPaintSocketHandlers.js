function registerPaintSocketHandlers({
  socket,
  io,
  getContextForSocket,
  sanitizeCoords,
  paintActionEvents,
}) {
  socket.on(paintActionEvents.placeIn, (payload = {}) => {
    const ctx = getContextForSocket(socket, 'paint');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const placed = ctx.lobby.session.placePixel(socket.id, x, y, payload.paletteIndex);
    if (!placed.ok) return;

    io.to(ctx.lobbyId).emit(paintActionEvents.placeOut, {
      x: placed.x,
      y: placed.y,
      paletteIndex: placed.paletteIndex,
      playerId: placed.playerId,
      pseudo: placed.pseudo,
    });
  });
}

module.exports = {
  registerPaintSocketHandlers,
};
