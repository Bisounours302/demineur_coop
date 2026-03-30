const GRID_W = 70;
const GRID_H = 70;
const TOTAL_CELLS = GRID_W * GRID_H;

const ISO_TILE_W = 96;
const ISO_TILE_H = 48;
const TILE_TIGHTEN_PX = 5;
const ISO_STEP_W = ISO_TILE_W - TILE_TIGHTEN_PX;
const ISO_STEP_H = ISO_TILE_H - TILE_TIGHTEN_PX;
const ISO_STEP_HALF_W = ISO_STEP_W * 0.5;
const ISO_STEP_HALF_H = ISO_STEP_H * 0.5;
const TILE_DRAW_W = 92;
const TILE_DRAW_H = 92;
const OVERLAY_LIFT_Y = ISO_TILE_H * 0.5;
const TILE_TOP_FACE_W = TILE_DRAW_W * 0.84;
const TILE_TOP_FACE_H = TILE_DRAW_H * 0.48;

const ISO_ORIGIN_X = GRID_H * ISO_STEP_HALF_W + 80;
const ISO_ORIGIN_Y = 50;

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.0;
const MOVE_COOLDOWN_MS = 120;
const HOLD_DELAY_MS = 300;
const WALK_WINDOW_MS = 220;

const PLAYER_FRAME_W = 48;
const PLAYER_FRAME_H = 64;
const PLAYER_DRAW_W = 88;
const PLAYER_DRAW_H = 116;
const PLAYER_FEET_OFFSET = 4;
const PLAYER_IDLE_FEET_Y = 42;
const PLAYER_WALK_FEET_Y = 43;
const PLAYER_DIG_FEET_Y = 44;

const IDLE_FRAME_MS = 140;
const WALK_FRAME_MS = 90;
const DIG_FRAME_MS = 90;

const EXPLOSION_FRAME_W = 64;
const EXPLOSION_FRAME_H = 64;
const EXPLOSION_FRAME_MS = 75;
const EXPLOSION_FRAMES = 5;
const EXPLOSION_DRAW_SIZE = 72;

const BOMB_SRC_X = 136;
const BOMB_SRC_Y = 82;
const BOMB_SRC_W = 326;
const BOMB_SRC_H = 406;
const BOMB_DRAW_W = 26;
const BOMB_DRAW_H = 32;

const NUMBER_COLORS = {
  1: '#4488ff',
  2: '#44ff88',
  3: '#ff4444',
  4: '#8844ff',
  5: '#ff8844',
  6: '#44ffff',
  7: '#ffffff',
  8: '#ff44ff',
};

const PLAYER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
];

const DIRECTION_ROW = {
  down: 0,
  left: 1,
  topLeft: 2,
  top: 3,
  topRight: 4,
  right: 5,
};

const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const lobbyEl = document.getElementById('lobby');
const joinFormEl = document.getElementById('joinForm');
const pseudoInputEl = document.getElementById('pseudoInput');
const joinErrorEl = document.getElementById('joinError');

const reconnectEl = document.getElementById('reconnect');
const hudEl = document.getElementById('hud');
const hudBombsEl = document.getElementById('hudBombs');
const hudTimeEl = document.getElementById('hudTime');
const hudPlayersEl = document.getElementById('hudPlayers');
const hudFlagsEl = document.getElementById('hudFlags');
const hudRevealedEl = document.getElementById('hudRevealed');

const statsOverlayEl = document.getElementById('statsOverlay');
const statsTitleEl = document.getElementById('statsTitle');
const statsDurationEl = document.getElementById('statsDuration');
const statsMiniMapEl = document.getElementById('statsMiniMap');
const statsTableBodyEl = document.getElementById('statsTableBody');
const explosionListEl = document.getElementById('explosionList');
const statsCountdownEl = document.getElementById('statsCountdown');

function loadImage(src) {
  const image = new Image();
  image.loaded = false;
  image.onload = () => {
    image.loaded = true;
  };
  image.src = src;
  return image;
}

const assets = {
  tiles: {
    hidden: loadImage('/assets/isometric_0.png'),
    dug: loadImage('/assets/isometric_1.png'),
  },
  player: {
    idle: {
      image: loadImage('/assets/idle.png'),
      frameWidth: PLAYER_FRAME_W,
      frameHeight: PLAYER_FRAME_H,
      frameCount: 8,
      rows: 6,
    },
    walk: {
      image: loadImage('/assets/walk.png'),
      frameWidth: PLAYER_FRAME_W,
      frameHeight: PLAYER_FRAME_H,
      frameCount: 8,
      rows: 6,
    },
    dig: {
      image: loadImage('/assets/death_normal_down.png'),
      frameWidth: PLAYER_FRAME_W,
      frameHeight: PLAYER_FRAME_H,
      frameCount: 5,
      rows: 1,
    },
  },
  fx: {
    bomb: {
      image: loadImage('/assets/bomb.png'),
    },
    explosion: {
      image: loadImage('/assets/explosion.png'),
      frameWidth: EXPLOSION_FRAME_W,
      frameHeight: EXPLOSION_FRAME_H,
      frameCount: EXPLOSION_FRAMES,
    },
  },
};

const state = {
  phase: 'lobby',
  myId: null,
  myPseudo: null,
  map: {
    width: GRID_W,
    height: GRID_H,
    totalCells: TOTAL_CELLS,
    bombCount: 0,
    zoneCenters: [],
    bombs: new Uint8Array(TOTAL_CELLS),
    numbers: new Int8Array(TOTAL_CELLS),
    startZone: new Uint8Array(TOTAL_CELLS),
    safeZone: new Uint8Array(TOTAL_CELLS),
  },
  grid: new Int8Array(TOTAL_CELLS),
  revealedSafeCount: 0,
  flags: new Map(),
  players: new Map(),
  me: {
    x: 0,
    y: 0,
    stunnedUntil: 0,
  },
  explosions: 0,
  maxExplosions: 10,
  startTime: null,
  endTime: null,
  camera: {
    x: 0,
    y: 0,
    scale: 1,
    isManual: false,
    dragging: false,
    dragLastX: 0,
    dragLastY: 0,
  },
  mapBounds: null,
  cursorCell: null,
  moveQueue: [],
  lastMoveAt: 0,
  holdControls: new Map(),
  statsCountdown: 60,
  statsCountdownTimer: null,
  explodedCells: new Set(),
  activeExplosions: [],
  hasJoinedOnce: false,
  loopStarted: false,
};

state.grid.fill(-2);

function hashPseudo(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

function colorForPseudo(pseudo) {
  return PLAYER_COLORS[hashPseudo(pseudo) % PLAYER_COLORS.length];
}

function idx(x, y) {
  return y * GRID_W + x;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function base64ToTypedArray(b64, TypedArray) {
  const bin = atob(b64);
  const buffer = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < bin.length; i++) {
    view[i] = bin.charCodeAt(i);
  }
  return new TypedArray(buffer);
}

function msToClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function isInBounds(x, y) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

function isStunned(playerLike) {
  return playerLike && playerLike.stunnedUntil && Date.now() < playerLike.stunnedUntil;
}

function directionFromDelta(dx, dy, currentRow = DIRECTION_ROW.down) {
  if (dy > 0) return DIRECTION_ROW.down;
  if (dy < 0 && dx < 0) return DIRECTION_ROW.topLeft;
  if (dy < 0 && dx > 0) return DIRECTION_ROW.topRight;
  if (dy < 0) return DIRECTION_ROW.top;
  if (dx < 0) return DIRECTION_ROW.topLeft;
  if (dx > 0) return DIRECTION_ROW.right;
  return currentRow;
}

function gridToIso(x, y) {
  return {
    x: (x - y) * ISO_STEP_HALF_W + ISO_ORIGIN_X,
    y: (x + y) * ISO_STEP_HALF_H + ISO_ORIGIN_Y,
  };
}

function isoToGrid(worldX, worldY) {
  const rx = worldX - ISO_ORIGIN_X;
  const ry = worldY - ISO_ORIGIN_Y;

  const gx = (ry / ISO_STEP_HALF_H + rx / ISO_STEP_HALF_W) * 0.5;
  const gy = (ry / ISO_STEP_HALF_H - rx / ISO_STEP_HALF_W) * 0.5;

  return {
    x: Math.round(gx),
    y: Math.round(gy),
  };
}

function computeMapBounds() {
  const leftAnchor = gridToIso(0, GRID_H - 1).x;
  const rightAnchor = gridToIso(GRID_W - 1, 0).x;
  const topAnchor = gridToIso(0, 0).y;
  const bottomAnchor = gridToIso(GRID_W - 1, GRID_H - 1).y;

  return {
    left: leftAnchor - TILE_DRAW_W * 0.5 - 80,
    right: rightAnchor + TILE_DRAW_W * 0.5 + 80,
    top: topAnchor - TILE_DRAW_H + ISO_TILE_H - 30,
    bottom: bottomAnchor + ISO_TILE_H + 120,
  };
}

state.mapBounds = computeMapBounds();

function centerCameraOnMe(immediate = false) {
  const viewportW = canvas.width / state.camera.scale;
  const viewportH = canvas.height / state.camera.scale;
  const meIso = gridToIso(state.me.x, state.me.y);

  const targetX = meIso.x - viewportW * 0.5;
  const targetY = meIso.y - viewportH * 0.55;

  if (immediate) {
    state.camera.x = targetX;
    state.camera.y = targetY;
  } else {
    state.camera.x += (targetX - state.camera.x) * 0.05;
    state.camera.y += (targetY - state.camera.y) * 0.05;
  }

  clampCamera();
}

function clampCamera() {
  const viewW = canvas.width / state.camera.scale;
  const viewH = canvas.height / state.camera.scale;
  const bounds = state.mapBounds;

  const maxX = Math.max(bounds.left, bounds.right - viewW);
  const maxY = Math.max(bounds.top, bounds.bottom - viewH);

  state.camera.x = clamp(state.camera.x, bounds.left, maxX);
  state.camera.y = clamp(state.camera.y, bounds.top, maxY);
}

function worldFromMouse(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  return {
    x: state.camera.x + sx / state.camera.scale,
    y: state.camera.y + sy / state.camera.scale,
  };
}

function updateCursorCell(clientX, clientY) {
  const world = worldFromMouse(clientX, clientY);
  // Hit-test against the tile top face (same vertical lift used by highlights/overlays).
  const grid = isoToGrid(world.x, world.y + OVERLAY_LIFT_Y);
  state.cursorCell = isInBounds(grid.x, grid.y) ? grid : null;
}

function clearStatsCountdownTimer() {
  if (state.statsCountdownTimer) {
    clearInterval(state.statsCountdownTimer);
    state.statsCountdownTimer = null;
  }
}

function clearAllHoldMoves() {
  for (const code of state.holdControls.keys()) {
    clearHoldMove(code);
  }
}

function resizeCanvas() {
  const w = Math.floor(window.innerWidth);
  const h = Math.floor(window.innerHeight);

  canvas.width = w;
  canvas.height = h;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  centerCameraOnMe(true);
}

function hideLobby() {
  lobbyEl.classList.add('hidden');
  joinErrorEl.textContent = '';
}

function showLobby(message = '') {
  lobbyEl.classList.remove('hidden');
  joinErrorEl.textContent = message;
}

function showHud() {
  hudEl.classList.remove('hidden');
}

function hideStatsOverlay() {
  clearStatsCountdownTimer();
  statsOverlayEl.classList.add('hidden');
}

function createPlayerAnimState(previous) {
  return {
    lastMoveAt: previous ? previous.lastMoveAt : 0,
    action: previous ? previous.action : 'idle',
    actionStart: previous ? previous.actionStart : 0,
    actionUntil: previous ? previous.actionUntil : 0,
    dirRow: previous ? previous.dirRow : DIRECTION_ROW.down,
  };
}

function applyPlayerPayload(playerPayload) {
  const previous = state.players.get(playerPayload.id);
  const color = playerPayload.color || colorForPseudo(playerPayload.pseudo);

  const normalized = {
    id: playerPayload.id,
    pseudo: playerPayload.pseudo,
    x: playerPayload.x,
    y: playerPayload.y,
    color,
    stunnedUntil: playerPayload.stunEndTime || 0,
    stunned: Boolean(playerPayload.stunned),
    ...createPlayerAnimState(previous),
  };

  if (previous && (previous.x !== normalized.x || previous.y !== normalized.y)) {
    const dx = Math.sign(normalized.x - previous.x);
    const dy = Math.sign(normalized.y - previous.y);
    normalized.lastMoveAt = Date.now();
    normalized.dirRow = directionFromDelta(dx, dy, normalized.dirRow);
  }

  state.players.set(normalized.id, normalized);

  if (normalized.id === state.myId) {
    state.me.x = normalized.x;
    state.me.y = normalized.y;
    state.me.stunnedUntil = normalized.stunnedUntil;
  }
}

function applySnapshot(payload) {
  state.phase = payload.phase === 'stats' ? 'stats' : 'playing';
  state.myId = payload.myId || state.myId;
  state.explosions = payload.explosions || 0;
  state.maxExplosions = payload.maxExplosions || 10;
  state.startTime = payload.startTime || Date.now();
  state.endTime = payload.endTime || null;

  state.map.width = payload.map.width;
  state.map.height = payload.map.height;
  state.map.totalCells = payload.map.totalCells;
  state.map.bombCount = payload.map.bombCount;
  state.map.zoneCenters = payload.map.zoneCenters || [];

  state.map.bombs = base64ToTypedArray(payload.map.data.bombs, Uint8Array);
  state.map.numbers = base64ToTypedArray(payload.map.data.numbers, Int8Array);
  state.map.startZone = base64ToTypedArray(payload.map.data.startZone, Uint8Array);
  state.map.safeZone = base64ToTypedArray(payload.map.data.safeZone, Uint8Array);

  state.grid = new Int8Array(TOTAL_CELLS);
  state.grid.fill(-2);
  state.revealedSafeCount = 0;
  state.flags = new Map();
  state.players = new Map();
  state.explodedCells = new Set();
  state.activeExplosions = [];

  for (const cell of payload.revealed || []) {
    const i = idx(cell.x, cell.y);
    state.grid[i] = cell.value;
    if (cell.value >= 0) {
      state.revealedSafeCount += 1;
    }
    if (cell.value === -1) {
      state.explodedCells.add(i);
    }
  }

  for (const flag of payload.flags || []) {
    state.flags.set(idx(flag.x, flag.y), flag.pseudo);
  }

  for (const player of payload.players || []) {
    applyPlayerPayload(player);
  }

  const me = state.players.get(state.myId);
  if (me) {
    state.me.x = me.x;
    state.me.y = me.y;
    state.me.stunnedUntil = me.stunnedUntil || 0;
  }

  hideLobby();
  showHud();
  hideStatsOverlay();
  centerCameraOnMe(true);
}

function getActionTargetCell() {
  const me = state.players.get(state.myId);
  if (!me) {
    return { x: state.me.x, y: state.me.y };
  }

  if (state.cursorCell) {
    const dx = Math.abs(state.cursorCell.x - me.x);
    const dy = Math.abs(state.cursorCell.y - me.y);
    if (dx <= 1 && dy <= 1) {
      return state.cursorCell;
    }
  }

  return { x: me.x, y: me.y };
}

function enqueueMove(dx, dy) {
  state.moveQueue.push({ type: 'move', dx, dy });
}

function markPlayerMoved(player, dx, dy, now) {
  player.lastMoveAt = now;
  if (player.action !== 'dig') {
    player.action = 'walk';
  }
  player.dirRow = directionFromDelta(dx, dy, player.dirRow);
}

function processInputQueue() {
  if (state.phase !== 'playing') return;
  if (!state.moveQueue.length) return;

  const now = Date.now();
  if (now - state.lastMoveAt < MOVE_COOLDOWN_MS) return;

  const action = state.moveQueue.shift();
  if (!action || action.type !== 'move') return;

  if (isStunned(state.me)) return;

  const nx = state.me.x + action.dx;
  const ny = state.me.y + action.dy;
  if (!isInBounds(nx, ny)) return;

  state.me.x = nx;
  state.me.y = ny;

  const me = state.players.get(state.myId);
  if (me) {
    me.x = nx;
    me.y = ny;
    markPlayerMoved(me, action.dx, action.dy, now);
  }

  state.lastMoveAt = now;

  socket.emit('player:move', {
    x: nx,
    y: ny,
  });
}

function drawDiamondFill(cx, cy, w, h, fillStyle, strokeStyle = null) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h * 0.5);
  ctx.lineTo(cx + w * 0.5, cy);
  ctx.lineTo(cx, cy + h * 0.5);
  ctx.lineTo(cx - w * 0.5, cy);
  ctx.closePath();

  ctx.fillStyle = fillStyle;
  ctx.fill();

  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawFlagOnIso(cx, cy) {
  const poleTopY = cy - ISO_TILE_H * 0.72;
  const poleBottomY = cy - ISO_TILE_H * 0.1;

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 1, poleTopY);
  ctx.lineTo(cx - 1, poleBottomY);
  ctx.stroke();

  ctx.fillStyle = '#ff4b4b';
  ctx.beginPath();
  ctx.moveTo(cx - 1, poleTopY + 2);
  ctx.lineTo(cx + ISO_TILE_W * 0.22, poleTopY + ISO_TILE_H * 0.16);
  ctx.lineTo(cx - 1, poleTopY + ISO_TILE_H * 0.3);
  ctx.closePath();
  ctx.fill();
}

function drawPlayerSheetFrame(sheet, row, frame, dx, dy, dw, dh) {
  if (!sheet.image.loaded) return false;

  const safeRow = clamp(row, 0, sheet.rows - 1);
  const safeFrame = ((frame % sheet.frameCount) + sheet.frameCount) % sheet.frameCount;

  const sx = safeFrame * sheet.frameWidth;
  const sy = safeRow * sheet.frameHeight;

  ctx.drawImage(
    sheet.image,
    sx,
    sy,
    sheet.frameWidth,
    sheet.frameHeight,
    dx,
    dy,
    dw,
    dh,
  );

  return true;
}

function drawTile(x, y) {
  const i = idx(x, y);
  const point = gridToIso(x, y);
  const liftedY = point.y - OVERLAY_LIFT_Y;

  const tileImage = state.grid[i] !== -2 ? assets.tiles.dug : assets.tiles.hidden;
  const drawX = point.x - TILE_DRAW_W * 0.5;
  const drawY = point.y - TILE_DRAW_H + ISO_TILE_H;

  if (tileImage.loaded) {
    ctx.drawImage(tileImage, drawX, drawY, TILE_DRAW_W, TILE_DRAW_H);
  } else {
    const color = state.grid[i] !== -2 ? '#26354a' : '#334c66';
    drawDiamondFill(point.x, point.y, ISO_TILE_W, ISO_TILE_H, color, 'rgba(255,255,255,0.12)');
  }

  const hasFlag = state.flags.has(i);
  const isRevealed = state.grid[i] !== -2;
  const isStart = state.map.startZone[i] === 1;

  if (!isRevealed && isStart) {
    drawDiamondFill(point.x, liftedY, ISO_TILE_W * 0.92, ISO_TILE_H * 0.9, 'rgba(180, 0, 0, 0.35)', '#ff4444');
  }

  const value = state.grid[i];
  if (isRevealed && value > 0) {
    ctx.fillStyle = NUMBER_COLORS[value] || '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(value), point.x, liftedY - 2);
  }

  if (hasFlag && !isRevealed) {
    drawFlagOnIso(point.x, liftedY);
  }

  const isBomb = state.map.bombs[i] === 1;
  const inStats = state.phase === 'stats';
  if ((inStats && isBomb) || (isRevealed && value === -1)) {
    const exploded = state.explodedCells.has(i);
    if (assets.fx.bomb.image.loaded) {
      if (exploded) {
        ctx.fillStyle = 'rgba(255, 80, 80, 0.35)';
        ctx.beginPath();
        ctx.ellipse(point.x, liftedY + 3, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const bombX = point.x - BOMB_DRAW_W * 0.5;
      const bombY = liftedY + 9 - BOMB_DRAW_H;
      ctx.drawImage(
        assets.fx.bomb.image,
        BOMB_SRC_X,
        BOMB_SRC_Y,
        BOMB_SRC_W,
        BOMB_SRC_H,
        bombX,
        bombY,
        BOMB_DRAW_W,
        BOMB_DRAW_H,
      );
    } else {
      ctx.fillStyle = exploded ? 'rgba(255, 80, 80, 0.9)' : 'rgba(70, 70, 70, 0.8)';
      ctx.beginPath();
      ctx.arc(point.x, liftedY + 2, 7, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(point.x, liftedY + 2, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPlayer(player, now) {
  const point = gridToIso(player.x, player.y);

  const stunned = player.stunnedUntil && now < player.stunnedUntil;
  const blinkLow = stunned && Math.floor(now / 250) % 2 === 0;

  let sheet = assets.player.idle;
  let frameMs = IDLE_FRAME_MS;
  let frameBase = now;

  if (player.action === 'dig' && now < player.actionUntil) {
    sheet = assets.player.dig;
    frameMs = DIG_FRAME_MS;
    frameBase = now - player.actionStart;
  } else if (now - player.lastMoveAt <= WALK_WINDOW_MS) {
    sheet = assets.player.walk;
    frameMs = WALK_FRAME_MS;
  }

  const frame = Math.floor(frameBase / frameMs) % sheet.frameCount;
  const row = sheet.rows === 1 ? 0 : player.dirRow;

  let sourceFeetY = PLAYER_IDLE_FEET_Y;
  if (sheet === assets.player.walk) sourceFeetY = PLAYER_WALK_FEET_Y;
  if (sheet === assets.player.dig) sourceFeetY = PLAYER_DIG_FEET_Y;

  const feetY = point.y + PLAYER_FEET_OFFSET - OVERLAY_LIFT_Y;
  const drawX = point.x - PLAYER_DRAW_W * 0.5;
  const drawY = feetY - (sourceFeetY / sheet.frameHeight) * PLAYER_DRAW_H;

  ctx.globalAlpha = blinkLow ? 0.35 : 1;

  const rendered = drawPlayerSheetFrame(sheet, row, frame, drawX, drawY, PLAYER_DRAW_W, PLAYER_DRAW_H);
  if (!rendered) {
    ctx.beginPath();
    ctx.arc(point.x, point.y - 8, 10, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
  }

  ctx.globalAlpha = 1;

  return {
    x: point.x,
    y: drawY - 13,
    text: player.pseudo,
  };
}

function bucketActiveExplosions(now) {
  const buckets = new Map();
  const survivors = [];

  for (const explosion of state.activeExplosions) {
    const elapsed = now - explosion.startedAt;
    const frame = Math.floor(elapsed / EXPLOSION_FRAME_MS);

    if (frame >= EXPLOSION_FRAMES) {
      continue;
    }

    const key = idx(explosion.x, explosion.y);
    if (!buckets.has(key)) {
      buckets.set(key, []);
    }
    buckets.get(key).push(frame);
    survivors.push(explosion);
  }

  state.activeExplosions = survivors;
  return buckets;
}

function drawExplosionAtCell(x, y, frame) {
  const sheet = assets.fx.explosion;
  if (!sheet.image.loaded) {
    return;
  }

  const point = gridToIso(x, y);
  const liftedY = point.y - OVERLAY_LIFT_Y;
  const drawX = point.x - EXPLOSION_DRAW_SIZE * 0.5;
  const drawY = liftedY - EXPLOSION_DRAW_SIZE + 8;

  const sx = frame * sheet.frameWidth;
  ctx.drawImage(
    sheet.image,
    sx,
    0,
    sheet.frameWidth,
    sheet.frameHeight,
    drawX,
    drawY,
    EXPLOSION_DRAW_SIZE,
    EXPLOSION_DRAW_SIZE,
  );
}

function drawCursorHighlight() {
  if (!state.cursorCell) return;

  const point = gridToIso(state.cursorCell.x, state.cursorCell.y);
  drawDiamondFill(
    point.x,
    point.y - OVERLAY_LIFT_Y + 1,
    TILE_TOP_FACE_W,
    TILE_TOP_FACE_H,
    'rgba(90, 180, 255, 0.12)',
    'rgba(120, 220, 255, 0.85)',
  );
}

function renderFrame() {
  const scale = state.camera.scale;
  const now = Date.now();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);

  ctx.fillStyle = '#090b15';
  ctx.fillRect(
    state.mapBounds.left - 200,
    state.mapBounds.top - 200,
    (state.mapBounds.right - state.mapBounds.left) + 400,
    (state.mapBounds.bottom - state.mapBounds.top) + 400,
  );

  const playersByCell = new Map();
  for (const player of state.players.values()) {
    const key = idx(player.x, player.y);
    if (!playersByCell.has(key)) {
      playersByCell.set(key, []);
    }
    playersByCell.get(key).push(player);
  }

  const explosionsByCell = bucketActiveExplosions(now);
  const labels = [];

  for (let depth = 0; depth <= GRID_W + GRID_H - 2; depth++) {
    const minX = Math.max(0, depth - (GRID_H - 1));
    const maxX = Math.min(GRID_W - 1, depth);

    for (let x = minX; x <= maxX; x++) {
      const y = depth - x;
      drawTile(x, y);

      const key = idx(x, y);
      const players = playersByCell.get(key);
      if (players) {
        for (const player of players) {
          const label = drawPlayer(player, now);
          labels.push(label);
        }
      }

      const explosions = explosionsByCell.get(key);
      if (explosions) {
        for (const frame of explosions) {
          drawExplosionAtCell(x, y, frame);
        }
      }
    }
  }

  drawCursorHighlight();

  for (const label of labels) {
    ctx.font = '10px monospace';
    const textWidth = ctx.measureText(label.text).width;
    const pad = 2;
    const w = textWidth + pad * 2;
    const h = 14;

    const x = label.x - w * 0.5;
    const y = label.y;

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(label.text, x + w * 0.5, y + h * 0.53);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label.text, x + w * 0.5, y + h * 0.53);
  }
}

function updateCamera() {
  if (state.phase === 'lobby') return;
  if (state.camera.dragging) {
    clampCamera();
    return;
  }

  const viewW = canvas.width / state.camera.scale;
  const viewH = canvas.height / state.camera.scale;
  const meIso = gridToIso(state.me.x, state.me.y);

  const targetX = meIso.x - viewW * 0.5;
  const targetY = meIso.y - viewH * 0.55;

  if (!state.camera.isManual) {
    state.camera.x = targetX;
    state.camera.y = targetY;
    clampCamera();
    return;
  }

  const centerX = state.camera.x + viewW * 0.5;
  const centerY = state.camera.y + viewH * 0.5;
  const distanceIso = Math.max(
    Math.abs(centerX - meIso.x) / ISO_STEP_W,
    Math.abs(centerY - meIso.y) / ISO_STEP_H,
  );

  if (distanceIso > 5) {
    state.camera.x = targetX;
    state.camera.y = targetY;
  } else {
    state.camera.x += (targetX - state.camera.x) * 0.05;
    state.camera.y += (targetY - state.camera.y) * 0.05;
  }

  clampCamera();
}

function updateHud() {
  const playerCount = state.players.size;
  const flags = state.flags.size;
  const now = Date.now();
  const elapsed = state.startTime ? now - state.startTime : 0;
  const safeTotal = Math.max(0, state.map.totalCells - state.map.bombCount);

  hudBombsEl.textContent = `Bombes: ${state.explosions}/${state.maxExplosions}`;
  hudBombsEl.classList.toggle('bombs-danger', state.explosions >= 7);

  hudTimeEl.textContent = msToClock(elapsed);
  hudPlayersEl.textContent = `${playerCount} joueurs`;
  hudFlagsEl.textContent = `Drapeaux: ${flags}`;
  hudRevealedEl.textContent = `Cases revelees: ${state.revealedSafeCount}/${safeTotal}`;
}

function drawStatsMiniMap() {
  const mapCtx = statsMiniMapEl.getContext('2d');
  const cw = statsMiniMapEl.width;
  const ch = statsMiniMapEl.height;

  mapCtx.clearRect(0, 0, cw, ch);
  mapCtx.fillStyle = '#0b0f1c';
  mapCtx.fillRect(0, 0, cw, ch);

  const cell = Math.max(1, Math.floor(Math.min(cw / GRID_W, ch / GRID_H)));
  const offsetX = Math.floor((cw - GRID_W * cell) / 2);
  const offsetY = Math.floor((ch - GRID_H * cell) / 2);

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = idx(x, y);
      const px = offsetX + x * cell;
      const py = offsetY + y * cell;

      if (state.map.bombs[i]) {
        const exploded = state.explodedCells.has(i);
        mapCtx.fillStyle = exploded ? '#ff0000' : '#666666';
        mapCtx.fillRect(px, py, cell, cell);
        mapCtx.fillStyle = '#111111';
        const r = Math.max(1, Math.floor(cell * 0.25));
        mapCtx.beginPath();
        mapCtx.arc(px + cell * 0.5, py + cell * 0.5, r, 0, Math.PI * 2);
        mapCtx.fill();
      } else {
        mapCtx.fillStyle = '#141727';
        mapCtx.fillRect(px, py, cell, cell);

        const n = state.map.numbers[i];
        if (n > 0 && cell >= 4) {
          mapCtx.fillStyle = NUMBER_COLORS[n] || '#ffffff';
          mapCtx.font = `${Math.max(4, Math.floor(cell * 0.8))}px monospace`;
          mapCtx.textAlign = 'center';
          mapCtx.textBaseline = 'middle';
          mapCtx.fillText(String(n), px + cell * 0.5, py + cell * 0.58);
        }
      }
    }
  }
}

function showStatsOverlay(result, stats) {
  state.phase = 'stats';

  statsOverlayEl.classList.remove('hidden');

  if (result === 'win') {
    statsTitleEl.textContent = 'VICTOIRE';
    statsTitleEl.style.color = '#5cff8d';
  } else {
    statsTitleEl.textContent = 'DEFAITE';
    statsTitleEl.style.color = '#ff5c5c';
  }

  statsDurationEl.textContent = `Duree de partie: ${msToClock(stats.durationMs || 0)}`;

  statsTableBodyEl.innerHTML = '';
  (stats.players || []).forEach((player, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${index + 1}</td>
      <td style="color:${player.color};font-weight:bold;">${player.pseudo}</td>
      <td>${player.cellsRevealed}</td>
      <td>${player.bombsTriggered}</td>
      <td>${player.flagsCorrect}/${player.flagsIncorrect}</td>
    `;
    statsTableBodyEl.appendChild(row);
  });

  explosionListEl.innerHTML = '';
  if (!stats.explodedBy || stats.explodedBy.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Aucune explosion.';
    explosionListEl.appendChild(li);
  } else {
    for (const e of stats.explodedBy) {
      const li = document.createElement('li');
      li.textContent = `Bombe: ${e.pseudo} en (${e.x}, ${e.y})`;
      explosionListEl.appendChild(li);
    }
  }

  drawStatsMiniMap();

  clearStatsCountdownTimer();
  state.statsCountdown = 60;
  statsCountdownEl.textContent = `Nouvelle partie dans: ${state.statsCountdown}s`;

  state.statsCountdownTimer = setInterval(() => {
    state.statsCountdown = Math.max(0, state.statsCountdown - 1);
    statsCountdownEl.textContent = `Nouvelle partie dans: ${state.statsCountdown}s`;
  }, 1000);
}

function updateLocalPlayerFromServerMove(id, x, y) {
  const player = state.players.get(id);
  if (!player) return;

  if (player.x !== x || player.y !== y) {
    const dx = Math.sign(x - player.x);
    const dy = Math.sign(y - player.y);
    markPlayerMoved(player, dx, dy, Date.now());
  }

  player.x = x;
  player.y = y;

  if (id === state.myId) {
    state.me.x = x;
    state.me.y = y;
  }
}

function startGameLoop() {
  if (state.loopStarted) return;
  state.loopStarted = true;

  function tick() {
    updateCamera();
    processInputQueue();
    renderFrame();
    updateHud();
    requestAnimationFrame(tick);
  }

  requestAnimationFrame(tick);
}

function findPlayerByPseudo(pseudo) {
  for (const player of state.players.values()) {
    if (player.pseudo === pseudo) {
      return player;
    }
  }
  return null;
}

function startDigAnimationForPseudo(pseudo) {
  if (!pseudo) return;

  const player = findPlayerByPseudo(pseudo);
  if (!player) return;

  const now = Date.now();
  player.action = 'dig';
  player.actionStart = now;
  player.actionUntil = now + assets.player.dig.frameCount * DIG_FRAME_MS;
}

function pushExplosionFx(x, y) {
  state.activeExplosions.push({
    x,
    y,
    startedAt: Date.now(),
  });
}

function tryRevealAction() {
  if (state.phase !== 'playing') return;
  if (isStunned(state.me)) return;

  const target = getActionTargetCell();
  socket.emit('cell:reveal', target);
}

function tryFlagAction() {
  if (state.phase !== 'playing') return;
  if (isStunned(state.me)) return;

  const target = getActionTargetCell();
  socket.emit('cell:flag', target);
}

function registerHoldMove(code, dx, dy) {
  if (state.holdControls.has(code)) return;

  enqueueMove(dx, dy);

  const hold = {
    interval: null,
    timeout: setTimeout(() => {
      hold.interval = setInterval(() => {
        enqueueMove(dx, dy);
      }, MOVE_COOLDOWN_MS);
    }, HOLD_DELAY_MS),
  };

  state.holdControls.set(code, hold);
}

function clearHoldMove(code) {
  const hold = state.holdControls.get(code);
  if (!hold) return;

  clearTimeout(hold.timeout);
  if (hold.interval) {
    clearInterval(hold.interval);
  }

  state.holdControls.delete(code);
}

function handleDirectionalKeyDown(code) {
  if (code === 'ArrowUp' || code === 'KeyZ' || code === 'KeyW') return registerHoldMove(code, 0, -1);
  if (code === 'ArrowDown' || code === 'KeyS') return registerHoldMove(code, 0, 1);
  if (code === 'ArrowLeft' || code === 'KeyQ' || code === 'KeyA') return registerHoldMove(code, -1, 0);
  if (code === 'ArrowRight' || code === 'KeyD') return registerHoldMove(code, 1, 0);
}

function handleDirectionalKeyUp(code) {
  if (
    code === 'ArrowUp' || code === 'KeyZ' || code === 'KeyW' ||
    code === 'ArrowDown' || code === 'KeyS' ||
    code === 'ArrowLeft' || code === 'KeyQ' || code === 'KeyA' ||
    code === 'ArrowRight' || code === 'KeyD'
  ) {
    clearHoldMove(code);
  }
}

joinFormEl.addEventListener('submit', (event) => {
  event.preventDefault();
  const pseudo = String(pseudoInputEl.value || '').trim();

  if (!pseudo) {
    joinErrorEl.textContent = 'Entre un pseudo.';
    return;
  }

  state.myPseudo = pseudo;
  state.hasJoinedOnce = true;
  localStorage.setItem('pseudo', pseudo);
  joinErrorEl.textContent = '';

  socket.emit('player:join', { pseudo });
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('blur', clearAllHoldMoves);

canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 0) return;
  state.camera.dragging = true;
  state.camera.isManual = true;
  state.camera.dragLastX = event.clientX;
  state.camera.dragLastY = event.clientY;
});

window.addEventListener('mouseup', () => {
  state.camera.dragging = false;
});

window.addEventListener('mousemove', (event) => {
  updateCursorCell(event.clientX, event.clientY);

  if (!state.camera.dragging) return;

  const dx = event.clientX - state.camera.dragLastX;
  const dy = event.clientY - state.camera.dragLastY;

  state.camera.dragLastX = event.clientX;
  state.camera.dragLastY = event.clientY;

  state.camera.x -= dx / state.camera.scale;
  state.camera.y -= dy / state.camera.scale;
  clampCamera();
});

canvas.addEventListener('wheel', (event) => {
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;

  const worldXBefore = state.camera.x + sx / state.camera.scale;
  const worldYBefore = state.camera.y + sy / state.camera.scale;

  const delta = event.deltaY < 0 ? 1.12 : 0.88;
  const nextScale = clamp(state.camera.scale * delta, MIN_SCALE, MAX_SCALE);

  state.camera.scale = nextScale;
  state.camera.x = worldXBefore - sx / nextScale;
  state.camera.y = worldYBefore - sy / nextScale;
  state.camera.isManual = true;
  clampCamera();
}, { passive: false });

window.addEventListener('keydown', (event) => {
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) tryRevealAction();
    return;
  }

  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    event.preventDefault();
    if (!event.repeat) tryFlagAction();
    return;
  }

  handleDirectionalKeyDown(event.code);
});

window.addEventListener('keyup', (event) => {
  handleDirectionalKeyUp(event.code);
});

socket.on('connect', () => {
  state.myId = socket.id;
  reconnectEl.classList.add('hidden');

  if (state.hasJoinedOnce && state.myPseudo) {
    socket.emit('player:join', { pseudo: state.myPseudo });
  }
});

socket.on('disconnect', () => {
  clearAllHoldMoves();
  if (state.hasJoinedOnce) {
    reconnectEl.classList.remove('hidden');
  }
});

socket.on('error:join', (payload = {}) => {
  state.phase = 'lobby';
  showLobby(payload.message || 'Impossible de rejoindre.');
});

socket.on('game:state', (payload) => {
  applySnapshot(payload);
});

socket.on('game:new', (payload) => {
  applySnapshot(payload);
});

socket.on('player:joined', (payload) => {
  applyPlayerPayload(payload);
});

socket.on('player:left', (payload) => {
  state.players.delete(payload.id);
});

socket.on('player:moved', (payload) => {
  updateLocalPlayerFromServerMove(payload.id, payload.x, payload.y);
});

socket.on('cells:revealed', (payload) => {
  for (const cell of payload.cells || []) {
    const i = idx(cell.x, cell.y);

    if (state.grid[i] === -2 && cell.value >= 0) {
      state.revealedSafeCount += 1;
    }

    state.grid[i] = cell.value;
    state.flags.delete(i);

    if (cell.value === -1) {
      state.explodedCells.add(i);
    }
  }

  if ((payload.cells || []).length > 0) {
    startDigAnimationForPseudo(payload.triggeredBy);
  }
});

socket.on('cell:flagged', (payload) => {
  const i = idx(payload.x, payload.y);
  if (payload.active) {
    state.flags.set(i, payload.pseudo);
  } else {
    state.flags.delete(i);
  }
});

socket.on('bomb:exploded', (payload) => {
  state.explosions = payload.count;
  const i = idx(payload.x, payload.y);
  state.explodedCells.add(i);

  pushExplosionFx(payload.x, payload.y);

  const player = state.players.get(payload.id);
  if (player) {
    player.stunnedUntil = payload.stunEndTime || Date.now() + 2000;
    startDigAnimationForPseudo(player.pseudo);
  }

  if (payload.id === state.myId) {
    state.me.stunnedUntil = payload.stunEndTime || Date.now() + 2000;
  }
});

socket.on('game:over', (payload) => {
  showStatsOverlay(payload.result, payload.stats || {});
});

const rememberedPseudo = localStorage.getItem('pseudo');
if (rememberedPseudo) {
  pseudoInputEl.value = rememberedPseudo;
}

resizeCanvas();
startGameLoop();
