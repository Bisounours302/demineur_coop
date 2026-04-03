const IDLE_ROWS = { down: 0, right: 1, left: 2, up: 3 };
const RUN_ROWS = {
  down: [5, 6],
  left: [7, 8],
  right: [9, 10],
  up: [11, 12],
};

export function spriteDirection(dx, dy, previous = 'down') {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  if (dy < 0) return 'up';
  if (dy > 0) return 'down';
  return previous;
}

export function getSpriteFrame(player, now, opts = {}) {
  const {
    animIdleMs = 220,
    animRunMs = 85,
    cols = 4,
    walkWindowMs = 240,
  } = opts;

  const moving = now - player.lastMoveAt <= walkWindowMs;

  if (!moving) {
    return {
      row: IDLE_ROWS[player.dir] ?? 0,
      col: Math.floor(now / animIdleMs) % cols,
    };
  }

  const rows = RUN_ROWS[player.dir] || RUN_ROWS.down;
  const frame = Math.floor(now / animRunMs) % 8;
  return {
    row: rows[Math.floor(frame / 4)],
    col: frame % 4,
  };
}
