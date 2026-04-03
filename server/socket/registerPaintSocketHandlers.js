function registerPaintSocketHandlers({
  socket,
  io,
  getContextForSocket,
  sanitizeCoords,
  paintEvents,
}) {
  socket.on(paintEvents.place, (payload = {}) => {
    const ctx = getContextForSocket(socket, 'paint');
    if (!ctx) return;

    const { x, y } = sanitizeCoords(payload);
    const placed = ctx.lobby.session.placePixel(socket.id, x, y, payload.paletteIndex);
    if (!placed.ok) return;

    io.to(ctx.lobbyId).emit(paintEvents.pixel, {
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
