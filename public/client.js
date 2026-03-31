const GRID_W = 70;
const GRID_H = 70;
const TOTAL_CELLS = GRID_W * GRID_H;
const TILE_SIZE = 32;

const MIN_SCALE = 0.3;
const MAX_SCALE = 2.0;
const MOVE_COOLDOWN_MS = 120;
const HOLD_DELAY_MS = 300;
const WALK_WINDOW_MS = 240;

const ANIM_IDLE_MS = 220;
const ANIM_RUN_MS = 85;
const AVATAR_COUNT = 6;
const CHAT_MAX_MESSAGES = 100;
const CHAT_CLOSED_VISIBLE_MESSAGES = 3;

const PLAYER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#FF8A80',
  '#80D8FF',
  '#B9F6CA',
  '#FFD180',
  '#EA80FC',
  '#A7FFEB',
  '#FF9E80',
  '#82B1FF',
  '#CCFF90',
  '#FFAB91',
  '#B388FF',
  '#84FFFF',
];

const ANIMAL_FRAME = 32;
const ANIMAL_COLS = 4;
const DIG_FRAME_MS = 60;
const DIG_FRAMES = 4;
const DIG_LOOPS = 2;

const EXPLOSION_FRAME_W = 64;
const EXPLOSION_FRAME_H = 64;
const EXPLOSION_FRAME_MS = 75;
const EXPLOSION_FRAMES = 5;
const EXPLOSION_DRAW_SIZE = 40;

const BOMB_SRC_X = 136;
const BOMB_SRC_Y = 82;
const BOMB_SRC_W = 326;
const BOMB_SRC_H = 406;
const BOMB_DRAW_W = 20;
const BOMB_DRAW_H = 24;

const TRANSITION_EDGE_HALF = 6;
const TRANSITION_CORNER_QUAD = 12;
const TRANSITION_CORNER_DRAW = 12;
const TRANSITION_CORNER_SHIFT = 6;

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

const MOVE_KEY_DELTAS = {
  ArrowUp: [0, -1],
  KeyZ: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyQ: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const lobbyEl = document.getElementById('lobby');
const joinFormEl = document.getElementById('joinForm');
const pseudoInputEl = document.getElementById('pseudoInput');
const joinErrorEl = document.getElementById('joinError');
const avatarPickerEl = document.getElementById('avatarPicker');
const avatarOptionEls = Array.from(document.querySelectorAll('.avatar-option'));

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

const chatDockEl = document.getElementById('chatDock');
const chatToggleBtnEl = document.getElementById('chatToggleBtn');
const chatMessagesEl = document.getElementById('chatMessages');
const chatFormEl = document.getElementById('chatForm');
const chatInputEl = document.getElementById('chatInput');
const colorPickerEl = document.getElementById('colorPicker');

function loadImage(src) {
  const image = new Image();
  image.loaded = false;
  image.onload = () => {
    image.loaded = true;
  };
  image.src = src;
  return image;
}

function hashPseudo(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

function colorForPseudo(pseudo) {
  return PLAYER_COLORS[hashPseudo(String(pseudo || '')) % PLAYER_COLORS.length];
}

function normalizeColorIndex(value) {
  const index = Number(value);
  if (!Number.isInteger(index)) return 0;
  if (index < 0 || index >= PLAYER_COLORS.length) return 0;
  return index;
}

function idx(x, y) {
  return y * GRID_W + x;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function isInBounds(x, y) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

function msToClock(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = (totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
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

function normalizeAvatarIndex(value) {
  const avatar = Number(value);
  if (!Number.isInteger(avatar)) return 0;
  if (avatar < 0 || avatar >= AVATAR_COUNT) return 0;
  return avatar;
}

function updateAvatarSelectionUI() {
  for (const option of avatarOptionEls) {
    const avatar = normalizeAvatarIndex(option.dataset.avatar);
    const selected = avatar === state.myAvatar;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-checked', selected ? 'true' : 'false');
  }
}

function setMyAvatar(value, persist = true) {
  state.myAvatar = normalizeAvatarIndex(value);
  updateAvatarSelectionUI();
  if (persist) {
    localStorage.setItem('avatar', String(state.myAvatar));
  }
}

function updateColorSelectionUI() {
  if (!colorPickerEl) return;
  const options = Array.from(colorPickerEl.querySelectorAll('.color-option'));
  for (const option of options) {
    const idxValue = normalizeColorIndex(option.dataset.colorIndex);
    const selected = idxValue === state.myColorIndex;
    option.classList.toggle('selected', selected);
    option.setAttribute('aria-checked', selected ? 'true' : 'false');
  }
}

function setMyColorIndex(value, persist = true) {
  state.myColorIndex = normalizeColorIndex(value);
  updateColorSelectionUI();
  if (persist) {
    localStorage.setItem('colorIndex', String(state.myColorIndex));
  }
}

function setupColorPicker() {
  if (!colorPickerEl) return;

  colorPickerEl.innerHTML = '';
  for (let i = 0; i < PLAYER_COLORS.length; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'color-option';
    btn.dataset.colorIndex = String(i);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.title = `Couleur ${i + 1}`;
    btn.style.setProperty('--swatch-color', PLAYER_COLORS[i]);
    btn.addEventListener('click', () => setMyColorIndex(i));
    colorPickerEl.appendChild(btn);
  }

  updateColorSelectionUI();
}

function setupAvatarPicker() {
  if (!avatarPickerEl) return;

  for (const option of avatarOptionEls) {
    option.addEventListener('click', () => {
      setMyAvatar(option.dataset.avatar);
    });
  }

  updateAvatarSelectionUI();
}

function drawAvatarPickerPreview(now) {
  if (!avatarPickerEl) return;

  const idleCol = Math.floor(now / ANIM_IDLE_MS) % ANIMAL_COLS;

  for (const option of avatarOptionEls) {
    const canvasEl = option.querySelector('.avatar-preview');
    if (!canvasEl) continue;

    const avatar = normalizeAvatarIndex(option.dataset.avatar);
    const image = assets.sprites[avatar];
    const pctx = canvasEl.getContext('2d');

    pctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    pctx.imageSmoothingEnabled = false;

    if (image && image.loaded) {
      pctx.drawImage(
        image,
        idleCol * ANIMAL_FRAME,
        0,
        ANIMAL_FRAME,
        ANIMAL_FRAME,
        0,
        0,
        canvasEl.width,
        canvasEl.height,
      );
      continue;
    }

    pctx.fillStyle = '#d7e3ff';
    pctx.fillRect(10, 10, canvasEl.width - 20, canvasEl.height - 20);
  }
}

function normalizeChatEntry(entry) {
  return {
    id: String(entry?.id || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
    pseudo: String(entry?.pseudo || 'System'),
    color: String(entry?.color || colorForPseudo(entry?.pseudo || 'System')),
    text: String(entry?.text || '').trim(),
    at: Number(entry?.at || Date.now()),
  };
}

function renderChatMessages() {
  if (!chatMessagesEl) return;

  const messagesToRender = state.chat.open
    ? state.chat.messages
    : state.chat.messages.slice(-CHAT_CLOSED_VISIBLE_MESSAGES);

  chatMessagesEl.innerHTML = '';
  for (const entry of messagesToRender) {
    const li = document.createElement('li');
    li.className = 'chat-item';
    li.innerHTML = `<strong style="color:${entry.color};">${entry.pseudo}</strong>: ${entry.text}`;
    chatMessagesEl.appendChild(li);
  }

  if (state.chat.open) {
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }
}

function setChatMessages(messages) {
  state.chat.messages = (messages || [])
    .map(normalizeChatEntry)
    .filter((m) => m.text.length > 0)
    .slice(-CHAT_MAX_MESSAGES);
  renderChatMessages();
}

function appendChatMessage(entry) {
  const normalized = normalizeChatEntry(entry);
  if (!normalized.text) return;

  state.chat.messages.push(normalized);
  if (state.chat.messages.length > CHAT_MAX_MESSAGES) {
    state.chat.messages = state.chat.messages.slice(-CHAT_MAX_MESSAGES);
  }
  renderChatMessages();
}

function setTypingStatus(active) {
  if (!state.myId || state.chat.typingSent === active) return;

  const me = state.players.get(state.myId);
  if (me) {
    me.isTyping = active;
  }

  state.chat.typingSent = active;
  socket.emit('chat:typing', { active });
}

function setChatOpen(open, focusInput = true) {
  const next = Boolean(open);
  if (state.chat.open === next) return;

  state.chat.open = next;
  if (chatDockEl) {
    chatDockEl.classList.toggle('open', next);
  }
  if (chatFormEl) {
    chatFormEl.classList.toggle('hidden', !next);
  }
  renderChatMessages();

  if (next) {
    clearAllHoldMoves();
    state.moveQueue = [];
    state.camera.dragging = false;
    setTypingStatus(true);
    if (focusInput && chatInputEl) {
      chatInputEl.focus();
    }
  } else {
    setTypingStatus(false);
    if (chatInputEl) {
      chatInputEl.blur();
    }
  }
}

function toggleChat() {
  setChatOpen(!state.chat.open);
}

const assets = {
  tiles: {
    grass: loadImage('/assets/herbe.png'),
    dirt: loadImage('/assets/terre.png'),
  },
  transitions: {
    edge: {
      herbe_droite_terre_gauche: loadImage('/assets/herbe_droite_terre_gauche.png'),
      herbe_gauche_terre_droite: loadImage('/assets/herbe_gauche_terre_droite.png'),
      herbe_haut_terre_bas: loadImage('/assets/herbe_haut_terre_bas.png'),
      herbe_bas_terre_haut: loadImage('/assets/herbe_bas_terre_haut.png'),
    },
    corner: {
      herbe_coin_haut_gauche: loadImage('/assets/herbe_coin_haut_gauche.png'),
      herbe_coin_haut_droite: loadImage('/assets/herbe_coin_haut_droite.png'),
      herbe_coin_bas_gauche: loadImage('/assets/herbe_coin_bas_gauche.png'),
      herbe_coin_bas_droite: loadImage('/assets/herbe_coin_bas_droite.png'),
      terre_coin_haut_gauche: loadImage('/assets/terre_coin_haut_gauche.png'),
      terre_coin_haut_droite: loadImage('/assets/terre_coin_haut_droite.png'),
      terre_coin_bas_gauche: loadImage('/assets/terre_coin_bas_gauche.png'),
      terre_coin_bas_droite: loadImage('/assets/terre_coin_bas_droite.png'),
    },
  },
  sprites: [
    loadImage('/assets/BIRDSPRITESHEET_Blue.png'),
    loadImage('/assets/BIRDSPRITESHEET_White.png'),
    loadImage('/assets/CATSPRITESHEET_Gray.png'),
    loadImage('/assets/CATSPRITESHEET_Orange.png'),
    loadImage('/assets/FOXSPRITESHEET.png'),
    loadImage('/assets/RACCOONSPRITESHEET.png'),
  ],
  shovels: [
    loadImage('/assets/shovel_bird_blue.png'),
    loadImage('/assets/shovel_bird_white.png'),
    loadImage('/assets/shovel_cat_gray.png'),
    loadImage('/assets/shovel_cat_orange.png'),
    loadImage('/assets/shovel_fox.png'),
    loadImage('/assets/shovel_racoon.png'),
  ],
  fx: {
    bomb: loadImage('/assets/bomb.png'),
    explosion: loadImage('/assets/explosion.png'),
  },
};

const state = {
  phase: 'lobby',
  myId: null,
  myPseudo: null,
  myAvatar: 0,
  myColorIndex: 0,
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
  flags: new Map(),
  players: new Map(),
  revealedSafeCount: 0,
  explosions: 0,
  maxExplosions: 10,
  startTime: null,
  camera: {
    x: 0,
    y: 0,
    scale: 1,
    isManual: false,
    dragging: false,
    dragLastX: 0,
    dragLastY: 0,
  },
  me: {
    x: 0,
    y: 0,
  },
  moveQueue: [],
  lastMoveAt: 0,
  holdControls: new Map(),
  activeExplosions: [],
  activeDigs: new Map(),
  explodedCells: new Set(),
  hasJoinedOnce: false,
  loopStarted: false,
  statsCountdown: 60,
  statsCountdownTimer: null,
  chat: {
    open: false,
    typingSent: false,
    messages: [],
  },
};

state.grid.fill(-2);

function tileSheetInfo(image) {
  const cols = image.loaded ? Math.max(1, Math.floor(image.width / TILE_SIZE)) : 3;
  const rows = image.loaded ? Math.max(1, Math.floor(image.height / TILE_SIZE)) : 3;
  return { cols, rows };
}

function drawSheetTile(image, col, row, dx, dy) {
  if (!image.loaded) {
    return false;
  }

  ctx.drawImage(
    image,
    col * TILE_SIZE,
    row * TILE_SIZE,
    TILE_SIZE,
    TILE_SIZE,
    dx,
    dy,
    TILE_SIZE,
    TILE_SIZE,
  );

  return true;
}

function getBorderTile(variantCols, x, y) {
  const last = variantCols - 1;
  const middleA = variantCols > 3 ? 1 : Math.min(1, last);
  const middleB = variantCols > 3 ? last - 1 : Math.max(0, last - 1);

  const onLeft = x === 0;
  const onRight = x === GRID_W - 1;
  const onTop = y === 0;
  const onBottom = y === GRID_H - 1;

  if (onTop && onLeft) return { col: 0, row: 0 };
  if (onTop && onRight) return { col: last, row: 0 };
  if (onBottom && onLeft) return { col: 0, row: last };
  if (onBottom && onRight) return { col: last, row: last };

  if (onTop) return { col: (x % 2 === 0 ? middleA : middleB), row: 0 };
  if (onBottom) return { col: (x % 2 === 0 ? middleA : middleB), row: last };
  if (onLeft) return { col: 0, row: (y % 2 === 0 ? middleA : middleB) };
  if (onRight) return { col: last, row: (y % 2 === 0 ? middleA : middleB) };

  return { col: middleA, row: middleA };
}

function drawCell(x, y) {
  const i = idx(x, y);
  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  const value = state.grid[i];
  const hidden = value === -2;

  if (hidden) {
    const { cols } = tileSheetInfo(assets.tiles.grass);
    const t = getBorderTile(cols, x, y);
    const painted = drawSheetTile(assets.tiles.grass, t.col, t.row, px, py);
    if (!painted) {
      ctx.fillStyle = '#7db24f';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  } else {
    const { cols } = tileSheetInfo(assets.tiles.dirt);
    const t = getBorderTile(cols, x, y);
    const painted = drawSheetTile(assets.tiles.dirt, t.col, t.row, px, py);
    if (!painted) {
      ctx.fillStyle = '#8b5a34';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  if (state.map.startZone[i] === 1 && hidden) {
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }
}

function drawFlags(minX, maxX, minY, maxY) {
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = idx(x, y);
      if (!state.flags.has(i) || state.grid[i] !== -2) continue;

      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      ctx.beginPath();
      ctx.moveTo(px + 12, py + 7);
      ctx.lineTo(px + 12, py + 24);
      ctx.stroke();

      ctx.fillStyle = '#ff4b4b';
      ctx.beginPath();
      ctx.moveTo(px + 12, py + 8);
      ctx.lineTo(px + 22, py + 12);
      ctx.lineTo(px + 12, py + 16);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function cellIsGrass(x, y) {
  return state.grid[idx(x, y)] === -2;
}

function isBorderCell(x, y) {
  return x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
}

function drawVerticalTransitionShared(x, y, leftGrass) {
  const image = leftGrass
    ? assets.transitions.edge.herbe_gauche_terre_droite
    : assets.transitions.edge.herbe_droite_terre_gauche;
  if (!image.loaded) return;

  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  ctx.drawImage(
    image,
    0,
    0,
    TRANSITION_EDGE_HALF,
    TILE_SIZE,
    px + TILE_SIZE - TRANSITION_EDGE_HALF,
    py,
    TRANSITION_EDGE_HALF,
    TILE_SIZE,
  );

  ctx.drawImage(
    image,
    TRANSITION_EDGE_HALF,
    0,
    TRANSITION_EDGE_HALF,
    TILE_SIZE,
    px + TILE_SIZE,
    py,
    TRANSITION_EDGE_HALF,
    TILE_SIZE,
  );
}

function drawHorizontalTransitionShared(x, y, topGrass) {
  const image = topGrass
    ? assets.transitions.edge.herbe_haut_terre_bas
    : assets.transitions.edge.herbe_bas_terre_haut;
  if (!image.loaded) return;

  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;

  ctx.drawImage(
    image,
    0,
    0,
    TILE_SIZE,
    TRANSITION_EDGE_HALF,
    px,
    py + TILE_SIZE - TRANSITION_EDGE_HALF,
    TILE_SIZE,
    TRANSITION_EDGE_HALF,
  );

  ctx.drawImage(
    image,
    0,
    TRANSITION_EDGE_HALF,
    TILE_SIZE,
    TRANSITION_EDGE_HALF,
    px,
    py + TILE_SIZE,
    TILE_SIZE,
    TRANSITION_EDGE_HALF,
  );
}

function drawCornerTransitionShared(image, x, y, shiftX, shiftY) {
  if (!image || !image.loaded) return;

  const px = x * TILE_SIZE;
  const py = y * TILE_SIZE;
  const src = TRANSITION_CORNER_QUAD;
  const draw = TRANSITION_CORNER_DRAW;
  const ox = px + TILE_SIZE - draw + shiftX;
  const oy = py + TILE_SIZE - draw + shiftY;

  ctx.drawImage(image, 0, 0, src, src, ox, oy, draw, draw);
  ctx.drawImage(image, src, 0, src, src, ox + draw, oy, draw, draw);
  ctx.drawImage(image, 0, src, src, src, ox, oy + draw, draw, draw);
  ctx.drawImage(image, src, src, src, src, ox + draw, oy + draw, draw, draw);
}

function pickCornerTransition(tl, tr, bl, br) {
  const grassCount = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
  if (grassCount !== 1 && grassCount !== 3) return null;

  const s = TRANSITION_CORNER_SHIFT;
  if (grassCount === 1) {
    if (tl) return { image: assets.transitions.corner.herbe_coin_haut_gauche, shiftX: -s, shiftY: -s };
    if (tr) return { image: assets.transitions.corner.herbe_coin_haut_droite, shiftX: s, shiftY: -s };
    if (bl) return { image: assets.transitions.corner.herbe_coin_bas_gauche, shiftX: -s, shiftY: s };
    return { image: assets.transitions.corner.herbe_coin_bas_droite, shiftX: s, shiftY: s };
  }

  if (!tl) return { image: assets.transitions.corner.terre_coin_haut_gauche, shiftX: -s, shiftY: -s };
  if (!tr) return { image: assets.transitions.corner.terre_coin_haut_droite, shiftX: s, shiftY: -s };
  if (!bl) return { image: assets.transitions.corner.terre_coin_bas_gauche, shiftX: -s, shiftY: s };
  return { image: assets.transitions.corner.terre_coin_bas_droite, shiftX: s, shiftY: s };
}

function drawTransitions(minX, maxX, minY, maxY) {
  // Pass 1: edge transitions shared between 2 tiles.
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      if (isBorderCell(x, y) || isBorderCell(x + 1, y)) continue;

      const leftGrass = cellIsGrass(x, y);
      const rightGrass = cellIsGrass(x + 1, y);
      if (leftGrass !== rightGrass) {
        drawVerticalTransitionShared(x, y, leftGrass);
      }
    }
  }

  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isBorderCell(x, y) || isBorderCell(x, y + 1)) continue;

      const topGrass = cellIsGrass(x, y);
      const bottomGrass = cellIsGrass(x, y + 1);
      if (topGrass !== bottomGrass) {
        drawHorizontalTransitionShared(x, y, topGrass);
      }
    }
  }

  // Pass 2: corner transitions shared between 4 tiles (drawn above edges).
  for (let y = minY; y < maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      if (
        isBorderCell(x, y) ||
        isBorderCell(x + 1, y) ||
        isBorderCell(x, y + 1) ||
        isBorderCell(x + 1, y + 1)
      ) {
        continue;
      }

      const tl = cellIsGrass(x, y);
      const tr = cellIsGrass(x + 1, y);
      const bl = cellIsGrass(x, y + 1);
      const br = cellIsGrass(x + 1, y + 1);

      const corner = pickCornerTransition(tl, tr, bl, br);
      if (!corner) continue;
      drawCornerTransitionShared(corner.image, x, y, corner.shiftX, corner.shiftY);
    }
  }
}

function drawNumbers(minX, maxX, minY, maxY) {
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const value = state.grid[idx(x, y)];
      if (value <= 0) continue;

      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      ctx.fillStyle = NUMBER_COLORS[value] || '#ffffff';
      ctx.fillText(String(value), px + TILE_SIZE * 0.5, py + TILE_SIZE * 0.52);
    }
  }
}

function drawBombs(minX, maxX, minY, maxY) {
  const inStats = state.phase === 'stats';

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = idx(x, y);
      const hidden = state.grid[i] === -2;
      const shouldDraw = (inStats && state.map.bombs[i] === 1) || (!hidden && state.grid[i] === -1);
      if (!shouldDraw) continue;

      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      if (assets.fx.bomb.loaded) {
        const bx = px + (TILE_SIZE - BOMB_DRAW_W) * 0.5;
        const by = py + (TILE_SIZE - BOMB_DRAW_H) * 0.5;
        ctx.drawImage(
          assets.fx.bomb,
          BOMB_SRC_X,
          BOMB_SRC_Y,
          BOMB_SRC_W,
          BOMB_SRC_H,
          bx,
          by,
          BOMB_DRAW_W,
          BOMB_DRAW_H,
        );
      } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.beginPath();
        ctx.arc(px + 16, py + 16, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function spriteDirection(dx, dy, previous = 'down') {
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx < 0 ? 'left' : 'right';
  }
  if (dy < 0) return 'up';
  if (dy > 0) return 'down';
  return previous;
}

function playerSheetForPlayer(player) {
  if (Number.isInteger(player.avatar)) {
    return assets.sprites[normalizeAvatarIndex(player.avatar)];
  }

  const fallback = hashPseudo(player.pseudo) % assets.sprites.length;
  return assets.sprites[fallback];
}

function shovelSheetForPlayer(player) {
  if (Number.isInteger(player.avatar)) {
    return assets.shovels[normalizeAvatarIndex(player.avatar)] || null;
  }

  const fallback = hashPseudo(player.pseudo) % assets.shovels.length;
  return assets.shovels[fallback] || null;
}

function playerHasLoadedDigAnimation(player) {
  const sheet = shovelSheetForPlayer(player);
  return Boolean(sheet && sheet.loaded);
}

function getDigFrame(playerId, now) {
  const startedAt = state.activeDigs.get(playerId);
  if (!startedAt) return null;

  const elapsed = now - startedAt;
  const totalFrames = DIG_FRAMES * DIG_LOOPS;
  const frameIndex = Math.floor(elapsed / DIG_FRAME_MS);

  if (frameIndex >= totalFrames) {
    state.activeDigs.delete(playerId);
    return null;
  }

  return frameIndex % DIG_FRAMES;
}

function applyRevealedCells(cells) {
  for (const cell of cells || []) {
    const i = idx(cell.x, cell.y);
    if (state.grid[i] === -2 && cell.value >= 0) {
      state.revealedSafeCount += 1;
    }
    state.grid[i] = cell.value;
    state.flags.delete(i);
    if (cell.value === -1) state.explodedCells.add(i);
  }
}

function getSpriteFrame(player, now) {
  const moving = now - player.lastMoveAt <= WALK_WINDOW_MS;

  if (!moving) {
    const rowByDir = { down: 0, right: 1, left: 2, up: 3 };
    return {
      row: rowByDir[player.dir] ?? 0,
      col: Math.floor(now / ANIM_IDLE_MS) % ANIMAL_COLS,
    };
  }

  const runRowsByDir = {
    down: [5, 6],
    left: [7, 8],
    right: [9, 10],
    up: [11, 12],
  };

  const rows = runRowsByDir[player.dir] || runRowsByDir.down;
  const frame = Math.floor(now / ANIM_RUN_MS) % 8;
  return {
    row: rows[Math.floor(frame / 4)],
    col: frame % 4,
  };
}

function drawPlayer(player, now) {
  const px = player.x * TILE_SIZE;
  const py = player.y * TILE_SIZE;

  const stunned = player.stunnedUntil && now < player.stunnedUntil;
  const blinkLow = stunned && Math.floor(now / 250) % 2 === 0;

  ctx.globalAlpha = blinkLow ? 0.35 : 1;

  const sheet = playerSheetForPlayer(player);
  const digFrame = getDigFrame(player.id, now);
  const shovelSheet = digFrame !== null ? shovelSheetForPlayer(player) : null;
  const canDrawDig = shovelSheet && shovelSheet.loaded;

  if (canDrawDig) {
    ctx.drawImage(
      shovelSheet,
      digFrame * ANIMAL_FRAME,
      0,
      ANIMAL_FRAME,
      ANIMAL_FRAME,
      px,
      py,
      TILE_SIZE,
      TILE_SIZE,
    );
  } else if (sheet.loaded) {
    const frame = getSpriteFrame(player, now);
    ctx.drawImage(
      sheet,
      frame.col * ANIMAL_FRAME,
      frame.row * ANIMAL_FRAME,
      ANIMAL_FRAME,
      ANIMAL_FRAME,
      px,
      py,
      TILE_SIZE,
      TILE_SIZE,
    );
  } else {
    ctx.fillStyle = '#ffd86b';
    ctx.fillRect(px + 8, py + 8, 16, 16);
  }

  ctx.globalAlpha = 1;

  return {
    x: px + TILE_SIZE * 0.5,
    y: py - 12,
    text: player.pseudo,
    isTyping: Boolean(player.isTyping),
    color: player.color || colorForPseudo(player.pseudo),
  };
}

function drawExplosionAtCell(x, y, frame) {
  if (!assets.fx.explosion.loaded) return;

  const px = x * TILE_SIZE + (TILE_SIZE - EXPLOSION_DRAW_SIZE) * 0.5;
  const py = y * TILE_SIZE + (TILE_SIZE - EXPLOSION_DRAW_SIZE) * 0.5;

  ctx.drawImage(
    assets.fx.explosion,
    frame * EXPLOSION_FRAME_W,
    0,
    EXPLOSION_FRAME_W,
    EXPLOSION_FRAME_H,
    px,
    py,
    EXPLOSION_DRAW_SIZE,
    EXPLOSION_DRAW_SIZE,
  );
}

function bucketExplosions(now) {
  const byCell = new Map();
  const alive = [];

  for (const fx of state.activeExplosions) {
    const elapsed = now - fx.startedAt;
    const frame = Math.floor(elapsed / EXPLOSION_FRAME_MS);
    if (frame >= EXPLOSION_FRAMES) continue;

    const key = idx(fx.x, fx.y);
    if (!byCell.has(key)) byCell.set(key, []);
    byCell.get(key).push(frame);
    alive.push(fx);
  }

  state.activeExplosions = alive;
  return byCell;
}

function renderFrame() {
  const scale = state.camera.scale;
  const now = Date.now();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);

  const worldW = GRID_W * TILE_SIZE;
  const worldH = GRID_H * TILE_SIZE;
  ctx.fillStyle = '#00d9ff';
  ctx.fillRect(-200, -200, worldW + 400, worldH + 400);

  const viewW = canvas.width / scale;
  const viewH = canvas.height / scale;
  const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, GRID_W - 1);
  const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, GRID_W - 1);
  const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, GRID_H - 1);
  const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, GRID_H - 1);

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      drawCell(x, y);
    }
  }

  drawTransitions(minX, maxX, minY, maxY);
  drawBombs(minX, maxX, minY, maxY);
  drawNumbers(minX, maxX, minY, maxY);
  drawFlags(minX, maxX, minY, maxY);

  const labels = [];
  for (const player of state.players.values()) {
    if (player.x < minX - 1 || player.x > maxX + 1 || player.y < minY - 1 || player.y > maxY + 1) {
      continue;
    }
    labels.push(drawPlayer(player, now));
  }

  const explosionsByCell = bucketExplosions(now);
  for (const [key, frames] of explosionsByCell.entries()) {
    const x = key % GRID_W;
    const y = Math.floor(key / GRID_W);
    for (const frame of frames) {
      drawExplosionAtCell(x, y, frame);
    }
  }

  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const label of labels) {
    if (label.isTyping) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.strokeText('ecrit...', label.x, label.y - 12);
      ctx.fillStyle = '#ffd28f';
      ctx.fillText('ecrit...', label.x, label.y - 12);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(label.text, label.x, label.y);
    ctx.fillStyle = label.color || '#ffffff';
    ctx.fillText(label.text, label.x, label.y);
  }

  drawAvatarPickerPreview(now);
}

function centerCameraOnMe(immediate = false) {
  const viewW = canvas.width / state.camera.scale;
  const viewH = canvas.height / state.camera.scale;

  const targetX = state.me.x * TILE_SIZE + TILE_SIZE * 0.5 - viewW * 0.5;
  const targetY = state.me.y * TILE_SIZE + TILE_SIZE * 0.5 - viewH * 0.5;

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
  const worldW = GRID_W * TILE_SIZE;
  const worldH = GRID_H * TILE_SIZE;
  const viewW = canvas.width / state.camera.scale;
  const viewH = canvas.height / state.camera.scale;

  state.camera.x = clamp(state.camera.x, 0, Math.max(0, worldW - viewW));
  state.camera.y = clamp(state.camera.y, 0, Math.max(0, worldH - viewH));
}

function updateCamera() {
  if (state.phase === 'lobby') return;
  if (state.camera.dragging) {
    clampCamera();
    return;
  }

  const viewW = canvas.width / state.camera.scale;
  const viewH = canvas.height / state.camera.scale;
  const px = state.me.x * TILE_SIZE + TILE_SIZE * 0.5;
  const py = state.me.y * TILE_SIZE + TILE_SIZE * 0.5;

  const targetX = px - viewW * 0.5;
  const targetY = py - viewH * 0.5;

  if (!state.camera.isManual) {
    state.camera.x = targetX;
    state.camera.y = targetY;
  } else {
    const centerX = state.camera.x + viewW * 0.5;
    const centerY = state.camera.y + viewH * 0.5;
    const maxCellDelta = Math.max(
      Math.abs(centerX - px) / TILE_SIZE,
      Math.abs(centerY - py) / TILE_SIZE,
    );

    if (maxCellDelta > 5) {
      state.camera.x = targetX;
      state.camera.y = targetY;
    } else {
      state.camera.x += (targetX - state.camera.x) * 0.05;
      state.camera.y += (targetY - state.camera.y) * 0.05;
    }
  }

  clampCamera();
}

function updateHud() {
  const playerCount = state.players.size;
  const flagsCount = state.flags.size;
  const elapsed = state.startTime ? Date.now() - state.startTime : 0;
  const safeTotal = Math.max(0, state.map.totalCells - state.map.bombCount);
  const nearTop = state.me.y <= 3;

  hudBombsEl.textContent = `Bombes: ${state.explosions}/${state.maxExplosions}`;
  hudBombsEl.classList.toggle('bombs-danger', state.explosions >= 7);
  hudTimeEl.textContent = msToClock(elapsed);
  hudPlayersEl.textContent = `${playerCount} joueurs`;
  hudFlagsEl.textContent = `Drapeaux: ${flagsCount}`;
  hudRevealedEl.textContent = `Cases revelees: ${state.revealedSafeCount}/${safeTotal}`;
  hudEl.classList.toggle('near-top', nearTop);
}

function clearStatsCountdownTimer() {
  if (!state.statsCountdownTimer) return;
  clearInterval(state.statsCountdownTimer);
  state.statsCountdownTimer = null;
}

function hideStatsOverlay() {
  clearStatsCountdownTimer();
  statsOverlayEl.classList.add('hidden');
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
  for (let i = 0; i < (stats.players || []).length; i++) {
    const p = stats.players[i];
    const row = document.createElement('tr');
    const pseudoColor = p.color || colorForPseudo(p.pseudo);
    row.innerHTML = `
      <td>${i + 1}</td>
      <td style="font-weight:bold;color:${pseudoColor};">${p.pseudo}</td>
      <td>${p.cellsRevealed}</td>
      <td>${p.bombsTriggered}</td>
      <td>${p.flagsCorrect}/${p.flagsIncorrect}</td>
    `;
    statsTableBodyEl.appendChild(row);
  }

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

function applyPlayerPayload(payload) {
  const previous = state.players.get(payload.id);
  let avatar = null;
  let colorIndex = null;

  if (payload.avatar !== undefined && payload.avatar !== null) {
    avatar = normalizeAvatarIndex(payload.avatar);
  } else if (previous && Number.isInteger(previous.avatar)) {
    avatar = previous.avatar;
  } else if (payload.id === state.myId) {
    avatar = state.myAvatar;
  } else {
    avatar = hashPseudo(payload.pseudo) % assets.sprites.length;
  }

  if (payload.colorIndex !== undefined && payload.colorIndex !== null) {
    colorIndex = normalizeColorIndex(payload.colorIndex);
  } else if (previous && Number.isInteger(previous.colorIndex)) {
    colorIndex = previous.colorIndex;
  } else if (payload.id === state.myId) {
    colorIndex = state.myColorIndex;
  } else {
    colorIndex = hashPseudo(payload.pseudo) % PLAYER_COLORS.length;
  }

  const player = {
    id: payload.id,
    pseudo: payload.pseudo,
    colorIndex,
    color: payload.color || PLAYER_COLORS[colorIndex] || colorForPseudo(payload.pseudo),
    avatar,
    x: payload.x,
    y: payload.y,
    isTyping: Boolean(payload.isTyping),
    stunnedUntil: payload.stunEndTime || 0,
    dir: previous ? previous.dir : 'down',
    lastMoveAt: previous ? previous.lastMoveAt : 0,
  };

  if (previous && (previous.x !== player.x || previous.y !== player.y)) {
    player.dir = spriteDirection(player.x - previous.x, player.y - previous.y, previous.dir);
    player.lastMoveAt = Date.now();
  }

  state.players.set(player.id, player);

  if (player.id === state.myId) {
    state.myAvatar = player.avatar;
    updateAvatarSelectionUI();
    state.myColorIndex = player.colorIndex;
    updateColorSelectionUI();
    state.me.x = player.x;
    state.me.y = player.y;
  }
}

function applySnapshot(payload) {
  state.phase = payload.phase === 'stats' ? 'stats' : 'playing';
  state.myId = payload.myId || state.myId;
  state.explosions = payload.explosions || 0;
  state.maxExplosions = payload.maxExplosions || 10;
  state.startTime = payload.startTime || Date.now();

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
  state.flags = new Map();
  state.players = new Map();
  state.revealedSafeCount = 0;
  state.explodedCells = new Set();
  state.activeExplosions = [];
  state.activeDigs = new Map();

  for (const cell of payload.revealed || []) {
    const i = idx(cell.x, cell.y);
    state.grid[i] = cell.value;
    if (cell.value >= 0) state.revealedSafeCount += 1;
    if (cell.value === -1) state.explodedCells.add(i);
  }

  for (const flag of payload.flags || []) {
    state.flags.set(idx(flag.x, flag.y), flag.pseudo);
  }

  for (const player of payload.players || []) {
    applyPlayerPayload(player);
  }

  setChatMessages(payload.chatMessages || []);

  const me = state.players.get(state.myId);
  if (me) {
    state.me.x = me.x;
    state.me.y = me.y;
  }

  lobbyEl.classList.add('hidden');
  joinErrorEl.textContent = '';
  reconnectEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  hideStatsOverlay();
  centerCameraOnMe(true);

  if (state.chat.open) {
    setTypingStatus(true);
  }
}

function getActionTargetCell() {
  const me = state.players.get(state.myId);
  if (!me) return { x: state.me.x, y: state.me.y };

  return { x: me.x, y: me.y };
}

function emitCellAction(eventName, target = null) {
  if (state.phase !== 'playing' || state.chat.open) return;
  const actionTarget = target || getActionTargetCell();
  if (!actionTarget) return;
  socket.emit(eventName, actionTarget);
}

function processInputQueue() {
  if (state.phase !== 'playing') return;
  if (state.chat.open) return;
  if (state.moveQueue.length === 0) return;

  const now = Date.now();
  if (now - state.lastMoveAt < MOVE_COOLDOWN_MS) return;

  const action = state.moveQueue.shift();
  if (!action) return;

  const nx = state.me.x + action.dx;
  const ny = state.me.y + action.dy;
  if (!isInBounds(nx, ny)) return;

  state.me.x = nx;
  state.me.y = ny;

  const me = state.players.get(state.myId);
  if (me) {
    me.dir = spriteDirection(action.dx, action.dy, me.dir);
    me.lastMoveAt = now;
    me.x = nx;
    me.y = ny;
  }

  state.lastMoveAt = now;
  socket.emit('player:move', { x: nx, y: ny });
}

function enqueueMove(dx, dy) {
  state.moveQueue.push({ dx, dy });
}

function registerHoldMove(code, dx, dy) {
  if (state.holdControls.has(code)) return;

  enqueueMove(dx, dy);
  const hold = {
    interval: null,
    timeout: setTimeout(() => {
      hold.interval = setInterval(() => enqueueMove(dx, dy), MOVE_COOLDOWN_MS);
    }, HOLD_DELAY_MS),
  };
  state.holdControls.set(code, hold);
}

function clearHoldMove(code) {
  const hold = state.holdControls.get(code);
  if (!hold) return;
  clearTimeout(hold.timeout);
  if (hold.interval) clearInterval(hold.interval);
  state.holdControls.delete(code);
}

function clearAllHoldMoves() {
  for (const code of state.holdControls.keys()) {
    clearHoldMove(code);
  }
}

function updateLocalPlayerFromServerMove(id, x, y) {
  const player = state.players.get(id);
  if (!player) return;

  if (player.x !== x || player.y !== y) {
    player.dir = spriteDirection(x - player.x, y - player.y, player.dir);
    player.lastMoveAt = Date.now();
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
  socket.emit('player:join', {
    pseudo,
    avatar: state.myAvatar,
    colorIndex: state.myColorIndex,
  });
});

chatToggleBtnEl?.addEventListener('click', () => {
  toggleChat();
});

chatFormEl?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.myId) return;

  const text = String(chatInputEl?.value || '').replace(/\s+/g, ' ').trim();
  if (!text) return;

  socket.emit('chat:send', { text });
  if (chatInputEl) {
    chatInputEl.value = '';
    chatInputEl.focus();
  }
  if (state.chat.open) {
    setTypingStatus(true);
  }
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('blur', clearAllHoldMoves);

canvas.addEventListener('mousedown', (event) => {
  if (state.chat.open) return;

  if (event.button === 0) {
    event.preventDefault();
    emitCellAction('cell:reveal');
    return;
  }

  if (event.button === 2) {
    event.preventDefault();
    emitCellAction('cell:flag');
    return;
  }

  if (event.button !== 1) return;
  state.camera.dragging = true;
  state.camera.isManual = true;
  state.camera.dragLastX = event.clientX;
  state.camera.dragLastY = event.clientY;
});

canvas.addEventListener('contextmenu', (event) => {
  event.preventDefault();
});

window.addEventListener('mouseup', () => {
  state.camera.dragging = false;
});

window.addEventListener('mousemove', (event) => {
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
  if (state.chat.open) return;
  event.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;

  const worldX = state.camera.x + sx / state.camera.scale;
  const worldY = state.camera.y + sy / state.camera.scale;

  const delta = event.deltaY < 0 ? 1.12 : 0.88;
  const nextScale = clamp(state.camera.scale * delta, MIN_SCALE, MAX_SCALE);

  state.camera.scale = nextScale;
  state.camera.x = worldX - sx / nextScale;
  state.camera.y = worldY - sy / nextScale;
  state.camera.isManual = true;
  clampCamera();
}, { passive: false });

window.addEventListener('keydown', (event) => {
  if (event.code === 'Tab') {
    event.preventDefault();
    toggleChat();
    return;
  }

  if (state.chat.open) {
    if (event.code === 'Escape') {
      event.preventDefault();
      setChatOpen(false, false);
      return;
    }

    if (event.code === 'Enter' && document.activeElement !== chatInputEl) {
      event.preventDefault();
      chatInputEl?.focus();
    }

    return;
  }

  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) emitCellAction('cell:reveal');
    return;
  }

  if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
    event.preventDefault();
    if (!event.repeat) emitCellAction('cell:flag');
    return;
  }

  const delta = MOVE_KEY_DELTAS[event.code];
  if (!delta) return;
  registerHoldMove(event.code, delta[0], delta[1]);
});

window.addEventListener('keyup', (event) => {
  clearHoldMove(event.code);
});

socket.on('connect', () => {
  state.myId = socket.id;
  state.chat.typingSent = false;
  reconnectEl.classList.add('hidden');

  if (state.hasJoinedOnce && state.myPseudo) {
    socket.emit('player:join', {
      pseudo: state.myPseudo,
      avatar: state.myAvatar,
      colorIndex: state.myColorIndex,
    });
  }
});

socket.on('disconnect', () => {
  clearAllHoldMoves();
  state.chat.typingSent = false;
  if (state.hasJoinedOnce) {
    reconnectEl.classList.remove('hidden');
  }
});

socket.on('error:join', (payload = {}) => {
  state.phase = 'lobby';
  lobbyEl.classList.remove('hidden');
  joinErrorEl.textContent = payload.message || 'Impossible de rejoindre.';
});

socket.on('game:state', applySnapshot);
socket.on('game:new', applySnapshot);

socket.on('player:joined', (payload) => {
  applyPlayerPayload(payload);
});

socket.on('player:left', (payload) => {
  state.activeDigs.delete(payload.id);
  state.players.delete(payload.id);
});

socket.on('chat:message', (payload) => {
  appendChatMessage(payload);
});

socket.on('chat:typing', (payload = {}) => {
  const player = state.players.get(payload.id);
  if (!player) return;
  player.isTyping = Boolean(payload.active);
});

socket.on('player:moved', (payload) => {
  updateLocalPlayerFromServerMove(payload.id, payload.x, payload.y);
});

socket.on('cells:revealed', (payload) => {
  const playerId = payload?.playerId;
  const player = playerId ? state.players.get(playerId) : null;
  const hasDigAnimation = Boolean(player && playerHasLoadedDigAnimation(player));

  if (playerId && hasDigAnimation) {
    state.activeDigs.set(playerId, Date.now());
  }

  applyRevealedCells(payload.cells || []);
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
  state.explodedCells.add(idx(payload.x, payload.y));
  state.activeExplosions.push({ x: payload.x, y: payload.y, startedAt: Date.now() });

  const player = state.players.get(payload.id);
  if (player) player.stunnedUntil = payload.stunEndTime || Date.now() + 2000;
});

socket.on('game:over', (payload) => {
  showStatsOverlay(payload.result, payload.stats || {});
});

const rememberedPseudo = localStorage.getItem('pseudo');
if (rememberedPseudo) {
  pseudoInputEl.value = rememberedPseudo;
}

setupAvatarPicker();
setupColorPicker();

const rememberedAvatar = localStorage.getItem('avatar');
if (rememberedAvatar !== null) {
  setMyAvatar(rememberedAvatar, false);
}

const rememberedColorIndex = localStorage.getItem('colorIndex');
if (rememberedColorIndex !== null) {
  setMyColorIndex(rememberedColorIndex, false);
}

setChatMessages([]);
setChatOpen(false, false);

resizeCanvas();
startGameLoop();
