export function registerHoldMoveKey({
  holdControls,
  code,
  dx,
  dy,
  enqueueMove,
  holdDelayMs,
  moveCooldownMs,
}) {
  if (holdControls.has(code)) return;

  enqueueMove(dx, dy);
  const hold = {
    interval: null,
    timeout: setTimeout(() => {
      hold.interval = setInterval(() => enqueueMove(dx, dy), moveCooldownMs);
    }, holdDelayMs),
  };
  holdControls.set(code, hold);
}

export function clearHoldMoveKey(holdControls, code) {
  const hold = holdControls.get(code);
  if (!hold) return;

  clearTimeout(hold.timeout);
  if (hold.interval) {
    clearInterval(hold.interval);
  }
  holdControls.delete(code);
}

export function clearAllHoldMoveKeys(holdControls) {
  for (const code of holdControls.keys()) {
    clearHoldMoveKey(holdControls, code);
  }
}