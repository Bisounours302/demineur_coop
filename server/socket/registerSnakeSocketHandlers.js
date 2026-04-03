function registerSnakeSocketHandlers({
  socket,
  getContextForSocket,
  snakeActionEvents,
}) {
  socket.on(snakeActionEvents.turnIn, (payload = {}) => {
    const ctx = getContextForSocket(socket, 'snake');
    if (!ctx) return;

    const direction = String(payload.direction || '').trim().toLowerCase();
    ctx.lobby.session.setDirection(socket.id, direction);
  });
}

module.exports = {
  registerSnakeSocketHandlers,
};
