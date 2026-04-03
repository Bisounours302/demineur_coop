import {
  PLAYER_COLORS,
  base64ToTypedArray,
  clamp,
  colorForPseudo,
  hashPseudo,
  loadImage,
  msToClock,
  normalizeAvatarIndex,
  normalizeColorIndex,
} from '../../core/shared.js';
import { PAINT_EVENTS } from '../../../../shared/events.js';
import { createModeBootstrap } from '../../modules/bootstrap/createModeBootstrap.js';
import { spriteDirection, getSpriteFrame } from '../../modules/player/spriteUtils.js';
import { drawPlayerLabels } from '../../modules/player/drawLabels.js';

const TILE_SIZE = 20;
const EXPORT_TILE_SIZE = 2;
const EXPORT_EMPTY_COLOR = '#f6f1e8';
const ANIM_IDLE_MS = 220;
const ANIMAL_FRAME = 32;
const ANIMAL_COLS = 4;

const DEFAULT_PALETTE = [
  '#000000', '#3a3a3a', '#7a7a7a', '#ffffff',
  '#f94144', '#f3722c', '#f8961e', '#f9c74f',
  '#90be6d', '#43aa8b', '#4d908e', '#577590',
  '#277da1', '#7b2cbf', '#f72585', '#4cc9f0',
];

const sprites = [
  loadImage('/assets/BIRDSPRITESHEET_Blue.png'),
  loadImage('/assets/BIRDSPRITESHEET_White.png'),
  loadImage('/assets/CATSPRITESHEET_Gray.png'),
  loadImage('/assets/CATSPRITESHEET_Orange.png'),
  loadImage('/assets/FOXSPRITESHEET.png'),
  loadImage('/assets/RACCOONSPRITESHEET.png'),
];

// ------------------------------------------------------------------- state
const state = {
  selectedPaletteIndex: 0,
  map: {
    width: 140,
    height: 140,
    totalCells: 140 * 140,
    emptyPixel: 255,
    palette: DEFAULT_PALETTE.slice(),
    pixels: new Uint8Array(140 * 140),
  },
};
state.map.pixels.fill(state.map.emptyPixel);

// ---------------------------------------------------------- paint-specific DOM
const paletteDockEl = document.getElementById('paintPaletteDock');
const paintPaletteGridEl = document.getElementById('paintPaletteGrid');
const selectedColorLabelEl = document.getElementById('selectedColorLabel');
const downloadPngBtnEl = document.getElementById('downloadPngBtn');

// ----------------------------------------------------------------- helpers
function idx(x, y) { return y * state.map.width + x; }
function isInBounds(x, y) { return x >= 0 && x < state.map.width && y >= 0 && y < state.map.height; }

function normalizePaletteIndex(value) {
  const index = Number(value);
  if (!Number.isInteger(index) || index < 0 || index >= state.map.palette.length) return 0;
  return index;
}

// --------------------------------------------------------- palette UI
function updatePaletteSelectionUI() {
  if (!paintPaletteGridEl) return;
  const options = Array.from(paintPaletteGridEl.querySelectorAll('.palette-option'));
  for (const option of options) {
    const i = normalizePaletteIndex(option.dataset.paletteIndex);
    option.classList.toggle('selected', i === state.selectedPaletteIndex);
    option.setAttribute('aria-checked', i === state.selectedPaletteIndex ? 'true' : 'false');
  }
  const color = state.map.palette[state.selectedPaletteIndex] || '#000000';
  if (selectedColorLabelEl) selectedColorLabelEl.textContent = color;
}

function setSelectedPaletteIndex(value, persist = true) {
  state.selectedPaletteIndex = normalizePaletteIndex(value);
  updatePaletteSelectionUI();
  if (persist) localStorage.setItem('paintPaletteIndex', String(state.selectedPaletteIndex));
}

function setupPaintPalette() {
  if (!paintPaletteGridEl) return;
  paintPaletteGridEl.innerHTML = '';
  for (let i = 0; i < state.map.palette.length; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-option';
    btn.dataset.paletteIndex = String(i);
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', 'false');
    btn.title = `Couleur ${i + 1}`;
    btn.style.setProperty('--swatch-color', state.map.palette[i]);
    btn.addEventListener('click', () => setSelectedPaletteIndex(i));
    paintPaletteGridEl.appendChild(btn);
  }
  updatePaletteSelectionUI();
}

// --------------------------------------------------------- export PNG
function downloadMapAsPng() {
  const w = Number(state.map.width) || 0;
  const h = Number(state.map.height) || 0;
  if (w <= 0 || h <= 0) return;

  const c = document.createElement('canvas');
  c.width = w * EXPORT_TILE_SIZE;
  c.height = h * EXPORT_TILE_SIZE;
  const ectx = c.getContext('2d');
  ectx.imageSmoothingEnabled = false;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pv = state.map.pixels[idx(x, y)];
      ectx.fillStyle = pv === state.map.emptyPixel
        ? EXPORT_EMPTY_COLOR
        : (state.map.palette[pv] || '#000000');
      ectx.fillRect(x * EXPORT_TILE_SIZE, y * EXPORT_TILE_SIZE, EXPORT_TILE_SIZE, EXPORT_TILE_SIZE);
    }
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const link = document.createElement('a');
  link.href = c.toDataURL('image/png');
  link.download = `paint-map-${stamp}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

downloadPngBtnEl?.addEventListener('click', downloadMapAsPng);

// --------------------------------------------------------- player helpers
function playerSheet(player) {
  if (Number.isInteger(player.avatar)) return sprites[normalizeAvatarIndex(player.avatar)];
  return sprites[hashPseudo(player.pseudo) % sprites.length];
}

function drawPlayer(ctx, player, now) {
  const px = player.x * TILE_SIZE;
  const py = player.y * TILE_SIZE;
  const sheet = playerSheet(player);

  if (sheet.loaded) {
    const frame = getSpriteFrame(player, now, { animIdleMs: ANIM_IDLE_MS, cols: ANIMAL_COLS });
    ctx.drawImage(sheet, frame.col * ANIMAL_FRAME, frame.row * ANIMAL_FRAME, ANIMAL_FRAME, ANIMAL_FRAME, px, py, TILE_SIZE, TILE_SIZE);
  } else {
    ctx.fillStyle = '#ffd86b';
    ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }

  return {
    x: px + TILE_SIZE * 0.5,
    y: py - 10,
    text: player.pseudo,
    isTyping: Boolean(player.isTyping),
    color: player.color || colorForPseudo(player.pseudo),
  };
}

// --------------------------------------------------------- apply payload
function applyPlayerPayload(payload) {
  const previous = state.players.get(payload.id);

  let avatar = (payload.avatar !== undefined && payload.avatar !== null)
    ? normalizeAvatarIndex(payload.avatar)
    : (previous && Number.isInteger(previous.avatar))
      ? previous.avatar
      : (payload.id === state.myId ? state.myAvatar : hashPseudo(payload.pseudo) % sprites.length);

  let colorIndex = (payload.colorIndex !== undefined && payload.colorIndex !== null)
    ? normalizeColorIndex(payload.colorIndex)
    : (previous && Number.isInteger(previous.colorIndex))
      ? previous.colorIndex
      : (payload.id === state.myId ? state.myColorIndex : hashPseudo(payload.pseudo) % PLAYER_COLORS.length);

  const player = {
    id: payload.id,
    pseudo: payload.pseudo,
    colorIndex,
    color: payload.color || PLAYER_COLORS[colorIndex] || colorForPseudo(payload.pseudo),
    avatar,
    x: payload.x,
    y: payload.y,
    isTyping: Boolean(payload.isTyping),
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
    game.identityModule.updateAvatarSelectionUI();
    state.myColorIndex = player.colorIndex;
    game.identityModule.updateColorSelectionUI();
    state.me.x = player.x;
    state.me.y = player.y;
  }
}

// --------------------------------------------------------- action
function emitPaintPlace() {
  if (state.phase !== 'playing' || state.chat.open) return;
  const me = state.players.get(state.myId);
  const x = me ? me.x : state.me.x;
  const y = me ? me.y : state.me.y;
  game.socket.emit(PAINT_EVENTS.place, { x, y, paletteIndex: state.selectedPaletteIndex });
}

// --------------------------------------------------------- bootstrap
const game = createModeBootstrap({
  state,
  events: PAINT_EVENTS,
  sprites,
  tileSize: TILE_SIZE,
  minScale: 0.14,
  maxScale: 2.2,
  animIdleMs: ANIM_IDLE_MS,
  animalFrame: ANIMAL_FRAME,
  animalCols: ANIMAL_COLS,
  hasPositionMove: true,
  cameraSmoothing: 0.05,
  cameraSnapThreshold: 6,

  getWorldSize: () => ({ w: state.map.width * TILE_SIZE, h: state.map.height * TILE_SIZE }),
  getFocusPosition: () => ({ x: state.me.x, y: state.me.y }),

  onApplyState(payload) {
    state.phase = 'playing';
    state.myId = payload.myId || state.myId;
    state.startTime = payload.startTime || Date.now();

    state.map.width = Number(payload.map.width) || 140;
    state.map.height = Number(payload.map.height) || 140;
    state.map.totalCells = Number(payload.map.totalCells) || (state.map.width * state.map.height);
    state.map.palette = Array.isArray(payload.map.palette) && payload.map.palette.length > 0
      ? payload.map.palette.slice() : DEFAULT_PALETTE.slice();
    state.map.emptyPixel = Number.isInteger(payload.map.emptyPixel) ? payload.map.emptyPixel : 255;
    state.map.pixels = base64ToTypedArray(payload.map.data.pixels, Uint8Array);

    if (state.map.pixels.length !== state.map.totalCells) {
      const resized = new Uint8Array(state.map.totalCells);
      resized.fill(state.map.emptyPixel);
      resized.set(state.map.pixels.slice(0, Math.min(state.map.pixels.length, resized.length)));
      state.map.pixels = resized;
    }

    state.players = new Map();
    for (const p of payload.players || []) applyPlayerPayload(p);

    game.chatModule.setMessages(payload.chatMessages || []);

    const me = state.players.get(state.myId);
    if (me) { state.me.x = me.x; state.me.y = me.y; }

    game.els.lobby.classList.add('hidden');
    game.els.joinError.textContent = '';
    game.els.reconnect.classList.add('hidden');
    game.hudModule.show();
    paletteDockEl?.classList.remove('hidden');

    setupPaintPalette();
    game.centerCameraOnMe(true);
    if (state.chat.open) game.chatModule.setTypingStatus(true);
  },

  onPlayerJoined: applyPlayerPayload,
  onPlayerLeft: (payload) => { state.players.delete(payload.id); },

  onRender(now) {
    const { ctx, canvas } = game;
    const scale = state.camera.scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);

    const worldW = state.map.width * TILE_SIZE;
    const worldH = state.map.height * TILE_SIZE;
    ctx.fillStyle = '#b8d8e8';
    ctx.fillRect(-200, -200, worldW + 400, worldH + 400);

    const viewW = canvas.width / scale;
    const viewH = canvas.height / scale;
    const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, state.map.width - 1);
    const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, state.map.width - 1);
    const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, state.map.height - 1);
    const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, state.map.height - 1);

    // Draw cells
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        const pv = state.map.pixels[idx(x, y)];
        ctx.fillStyle = pv === state.map.emptyPixel
          ? ((x + y) % 2 === 0 ? '#efe8da' : '#f6f1e8')
          : (state.map.palette[pv] || '#000000');
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }

    // Action target
    const me = state.players.get(state.myId);
    if (me) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.strokeRect(me.x * TILE_SIZE + 2, me.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }

    // Players + labels
    const labels = [];
    for (const player of state.players.values()) {
      if (player.x < minX - 1 || player.x > maxX + 1 || player.y < minY - 1 || player.y > maxY + 1) continue;
      labels.push(drawPlayer(ctx, player, now));
    }
    drawPlayerLabels(ctx, labels);
  },

  onUpdateHud() {
    const elapsed = state.startTime ? Date.now() - state.startTime : 0;
    const selectedColor = state.map.palette[state.selectedPaletteIndex] || '#000000';
    game.hudModule.setText(document.getElementById('hudPlayers'), `${state.players.size} joueurs`);
    game.hudModule.setText(document.getElementById('hudTime'), msToClock(elapsed));
    game.hudModule.setText(document.getElementById('hudColor'), `Couleur: ${selectedColor}`);
  },

  onKeydown(event) {
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) emitPaintPlace();
      return true;
    }
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      if (digit - 1 < state.map.palette.length) setSelectedPaletteIndex(digit - 1);
      return true;
    }
    return false;
  },

  onMousedown(event) {
    if (event.button === 0) { event.preventDefault(); emitPaintPlace(); }
  },

  extraSocketSetup(socket) {
    socket.on(PAINT_EVENTS.pixel, (payload = {}) => {
      const x = Number(payload.x);
      const y = Number(payload.y);
      const pi = Number(payload.paletteIndex);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !isInBounds(x, y)) return;
      if (!Number.isInteger(pi) || pi < 0 || pi >= state.map.palette.length) return;
      state.map.pixels[idx(x, y)] = pi;
    });
  },

  onInit() {
    setupPaintPalette();
    const saved = localStorage.getItem('paintPaletteIndex');
    if (saved !== null) setSelectedPaletteIndex(saved, false);
  },
});
