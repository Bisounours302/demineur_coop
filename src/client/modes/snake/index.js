import {
  PLAYER_COLORS,
  clamp,
  colorForPseudo,
  loadImage,
  msToClock,
  normalizeAvatarIndex,
  normalizeColorIndex,
} from '../../core/shared.js';
import { SNAKE_EVENTS } from '../../../../shared/events.js';
import { createModeBootstrap } from '../../modules/bootstrap/createModeBootstrap.js';
import { drawAvatarFrame } from '../../modules/characters/drawAvatarFrame.js';
import { drawCheckerTiles } from '../../modules/tiles/drawCheckerTiles.js';
import { drawPlayerLabels } from '../../modules/player/drawLabels.js';

const TILE_SIZE = 18;
const ANIM_IDLE_MS = 220;
const ANIMAL_FRAME = 32;
const ANIMAL_COLS = 4;
const HUD_UPDATE_INTERVAL_MS = 120;
const LEADERBOARD_UPDATE_INTERVAL_MS = 220;

const DIRECTION_BY_KEY = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
};

const OPPOSITE_DIRECTION = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const sprites = [
  loadImage('/assets/BIRDSPRITESHEET_Blue.png'),
  loadImage('/assets/BIRDSPRITESHEET_White.png'),
  loadImage('/assets/CATSPRITESHEET_Gray.png'),
  loadImage('/assets/CATSPRITESHEET_Orange.png'),
  loadImage('/assets/FOXSPRITESHEET.png'),
  loadImage('/assets/RACCOONSPRITESHEET.png'),
];
const appleImage = loadImage('/assets/apple.png');

// ------------------------------------------------------------------- state
const state = {
  apples: [],
  map: { width: 70, height: 70, totalCells: 70 * 70, tickMs: 180, appleCount: 1 },
  input: {
    pendingDirection: null,
    pendingUntil: 0,
  },
  ui: {
    lastHudUpdateAt: 0,
    lastLeaderboardUpdateAt: 0,
    leaderboardListSignature: '',
    leaderboardStatusSignature: '',
  },
};

// ------------------------------------------------------ snake-specific DOM
const hudScoreEl = document.getElementById('hudScore');
const hudPlayersEl = document.getElementById('hudPlayers');
const hudTimeEl = document.getElementById('hudTime');
const leaderboardDockEl = document.getElementById('leaderboardDock');
const leaderboardListEl = document.getElementById('leaderboardList');
const leaderboardStatusEl = document.getElementById('leaderboardStatus');
const previousScoreEl = document.getElementById('previousScore');

function setPreviousScore(score) {
  if (!previousScoreEl) return;
  if (!Number.isFinite(score)) {
    previousScoreEl.textContent = '';
    previousScoreEl.classList.add('hidden');
    return;
  }
  previousScoreEl.textContent = `Ton score avant mort: ${Math.max(0, Math.floor(score))}`;
  previousScoreEl.classList.remove('hidden');
}

// ----------------------------------------------------------------- helpers
function colorForPlayer(player) {
  return player.color || colorForPseudo(player.pseudo);
}

function applyPlayerPayload(payload) {
  const player = state.players.get(payload.id) || { id: payload.id };

  player.pseudo = payload.pseudo;
  player.avatar = normalizeAvatarIndex(payload.avatar);
  player.colorIndex = normalizeColorIndex(payload.colorIndex);
  player.color = payload.color || colorForPseudo(payload.pseudo);
  player.x = Number(payload.x) || 0;
  player.y = Number(payload.y) || 0;
  player.direction = String(payload.direction || 'right');
  player.score = Math.max(0, Number(payload.score) || 0);
  player.isTyping = Boolean(payload.isTyping);
  player.segments = Array.isArray(payload.segments)
    ? payload.segments.map((s) => ({ x: Number(s.x) || 0, y: Number(s.y) || 0 }))
    : [];

  state.players.set(payload.id, player);

  if (payload.id === state.myId && state.input.pendingDirection === player.direction) {
    state.input.pendingDirection = null;
    state.input.pendingUntil = 0;
  }
}

function updatePlayersFromPayload(playersPayload = []) {
  const seenIds = new Set();
  for (const p of playersPayload) {
    applyPlayerPayload(p);
    seenIds.add(p.id);
  }

  for (const id of state.players.keys()) {
    if (!seenIds.has(id)) {
      state.players.delete(id);
    }
  }
}

function parseApples(payload) {
  const raw = Array.isArray(payload.apples) ? payload.apples : (payload.apple ? [payload.apple] : []);
  return raw.map((a) => ({ x: Number(a?.x) || 0, y: Number(a?.y) || 0 }));
}

// --------------------------------------------------------- rendering
function drawApples(ctx) {
  for (const apple of state.apples) {
    const px = apple.x * TILE_SIZE, py = apple.y * TILE_SIZE;
    if (appleImage.loaded) {
      ctx.drawImage(appleImage, px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    } else {
      ctx.fillStyle = '#ff4d4d'; ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = '#63b45c'; ctx.fillRect(px + Math.floor(TILE_SIZE * 0.45), py + 1, 3, 5);
    }
  }
}

function drawSnake(ctx, player, now, directionOverride = null) {
  const baseColor = colorForPlayer(player);

  for (let i = 1; i < player.segments.length; i++) {
    const s = player.segments[i];
    ctx.fillStyle = baseColor;
    ctx.fillRect(s.x * TILE_SIZE + 1, s.y * TILE_SIZE + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }

  const head = player.segments[0] || { x: player.x, y: player.y };
  const hpx = head.x * TILE_SIZE, hpy = head.y * TILE_SIZE;
  const headSheet = sprites[normalizeAvatarIndex(player.avatar)];
  const renderDirection = String(directionOverride || player.direction || 'right');
  const rowByDir = { down: 0, right: 1, left: 2, up: 3 };
  const headCol = Math.floor(now / ANIM_IDLE_MS) % ANIMAL_COLS;

  if (!drawAvatarFrame({
    ctx, image: headSheet,
    frameCol: headCol, frameRow: rowByDir[renderDirection] ?? 0, frameSize: ANIMAL_FRAME,
    dx: hpx, dy: hpy, dw: TILE_SIZE, dh: TILE_SIZE,
  })) {
    ctx.fillStyle = '#f9f9f9'; ctx.fillRect(hpx + 1, hpy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 1;
    ctx.strokeRect(hpx + 1.5, hpy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
  }

  return {
    x: head.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: head.y * TILE_SIZE - 8,
    text: `${player.pseudo} (${player.score})`,
    color: baseColor,
    isTyping: Boolean(player.isTyping),
  };
}

function updateLeaderboard(force = false) {
  if (!leaderboardListEl || !leaderboardDockEl) return;

  const now = Date.now();
  if (!force && now - state.ui.lastLeaderboardUpdateAt < LEADERBOARD_UPDATE_INTERVAL_MS) {
    return;
  }
  state.ui.lastLeaderboardUpdateAt = now;

  const rows = Array.from(state.players.values())
    .sort((a, b) => b.score !== a.score ? b.score - a.score : a.pseudo.localeCompare(b.pseudo, 'fr'));

  const myRank = rows.findIndex((r) => r.id === state.myId) + 1;
  const topScore = rows.length > 0 ? rows[0].score : 0;
  const me = state.players.get(state.myId);
  const myScore = Math.max(0, Number(me?.score) || 0);

  const listSignature = rows
    .slice(0, 10)
    .map((player) => `${player.id}:${player.score}`)
    .join('|');
  const statusSignature = `${myRank}|${topScore}|${myScore}|${rows.length}`;

  if (!force
      && listSignature === state.ui.leaderboardListSignature
      && statusSignature === state.ui.leaderboardStatusSignature) {
    return;
  }

  state.ui.leaderboardListSignature = listSignature;
  state.ui.leaderboardStatusSignature = statusSignature;

  leaderboardListEl.innerHTML = '';
  rows.slice(0, 10).forEach((player, i) => {
    const li = document.createElement('li');
    const isMe = player.id === state.myId;
    li.innerHTML = `<strong style="color:${colorForPlayer(player)};">${i + 1}. ${player.pseudo}${isMe ? ' (toi)' : ''}</strong> - ${player.score}`;
    leaderboardListEl.appendChild(li);
  });

  leaderboardDockEl.classList.toggle('hidden-behind', myRank > 1 && myScore < topScore);
  leaderboardStatusEl.textContent = myRank <= 0 ? 'En attente' : myRank === 1 ? 'En tete' : `Derriere (#${myRank})`;
}

function getMyHead() {
  const me = state.players.get(state.myId);
  if (!me || !Array.isArray(me.segments) || me.segments.length === 0) {
    return { x: Math.floor(state.map.width / 2), y: Math.floor(state.map.height / 2) };
  }
  return me.segments[0];
}

// --------------------------------------------------------- bootstrap
const game = createModeBootstrap({
  state,
  events: SNAKE_EVENTS,
  sprites,
  tileSize: TILE_SIZE,
  minScale: 0.25,
  maxScale: 2.2,
  animIdleMs: ANIM_IDLE_MS,
  animalFrame: ANIMAL_FRAME,
  animalCols: ANIMAL_COLS,
  hasPositionMove: false,
  cameraSmoothing: 0.08,

  getWorldSize: () => ({ w: state.map.width * TILE_SIZE, h: state.map.height * TILE_SIZE }),
  getFocusPosition: () => getMyHead(),

  onApplyState(payload) {
    state.phase = 'playing';
    state.hasJoinedOnce = true;
    state.myId = payload.myId || state.myId;
    state.startTime = Number(payload.startTime) || Date.now();

    state.map.width = Number(payload.map?.width) || 70;
    state.map.height = Number(payload.map?.height) || 70;
    state.map.totalCells = Number(payload.map?.totalCells) || (state.map.width * state.map.height);
    state.map.tickMs = Number(payload.map?.tickMs) || 180;
    state.map.appleCount = Number(payload.map?.appleCount) || 1;
    state.input.pendingDirection = null;
    state.input.pendingUntil = 0;

    state.apples = parseApples(payload);
    updatePlayersFromPayload(payload.players || []);
    game.chatModule.setMessages(payload.chatMessages || []);
    setPreviousScore(null);

    game.els.lobby.classList.add('hidden');
    game.els.reconnect.classList.add('hidden');
    game.els.joinError.textContent = '';
    game.hudModule.show();
    leaderboardDockEl.classList.remove('hidden');
    game.centerCameraOnMe(true);
    updateLeaderboard(true);
  },

  onPlayerJoined(payload) {
    applyPlayerPayload(payload);
    updateLeaderboard(true);
  },
  onPlayerLeft(payload) {
    state.players.delete(payload.id);
    updateLeaderboard(true);
  },
  onJoinError() {
    leaderboardDockEl.classList.add('hidden');
  },

  onRender(now) {
    const { ctx, canvas } = game;
    const scale = state.camera.scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);

    const worldW = state.map.width * TILE_SIZE, worldH = state.map.height * TILE_SIZE;
    ctx.fillStyle = '#07140e';
    ctx.fillRect(-200, -200, worldW + 400, worldH + 400);

    const viewW = canvas.width / scale, viewH = canvas.height / scale;
    const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, state.map.width - 1);
    const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, state.map.width - 1);
    const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, state.map.height - 1);
    const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, state.map.height - 1);

    drawCheckerTiles({
      ctx, minX, maxX, minY, maxY, tileSize: TILE_SIZE,
      primaryColor: '#0f271c', secondaryColor: '#143023',
      strokeStyle: 'rgba(255,255,255,0.04)',
    });

    drawApples(ctx);

    const labels = [];
    if (state.input.pendingDirection && now > state.input.pendingUntil) {
      state.input.pendingDirection = null;
      state.input.pendingUntil = 0;
    }

    for (const player of state.players.values()) {
      if (player.segments.length === 0) continue;
      let renderDirection = player.direction;
      if (player.id === state.myId && state.input.pendingDirection) {
        renderDirection = state.input.pendingDirection;
      }
      labels.push(drawSnake(ctx, player, now, renderDirection));
    }
    drawPlayerLabels(ctx, labels);
  },

  onUpdateHud() {
    const now = Date.now();
    if (now - state.ui.lastHudUpdateAt >= HUD_UPDATE_INTERVAL_MS) {
      const elapsed = state.startTime ? now - state.startTime : 0;
      const me = state.players.get(state.myId);
      game.hudModule.setText(hudPlayersEl, `${state.players.size} joueurs`);
      game.hudModule.setText(hudScoreEl, `Score: ${Math.max(0, Number(me?.score) || 0)}`);
      game.hudModule.setText(hudTimeEl, msToClock(elapsed));
      state.ui.lastHudUpdateAt = now;
    }
    updateLeaderboard(false);
  },

  onKeydown(event) {
    const dir = DIRECTION_BY_KEY[event.code];
    if (!dir) return false;
    event.preventDefault();
    if (event.repeat) return true;

    if (state.phase === 'playing') {
      const me = state.players.get(state.myId);
      const currentDirection = String(state.input.pendingDirection || me?.direction || 'right');
      if (dir === currentDirection) return true;
      if (OPPOSITE_DIRECTION[currentDirection] === dir) return true;

      const tickMs = Math.max(90, Number(state.map.tickMs) || 180);
      state.input.pendingDirection = dir;
      state.input.pendingUntil = Date.now() + Math.max(180, Math.round(tickMs * 1.5));

      game.socket.emit(SNAKE_EVENTS.turn, { direction: dir });
    }
    return true;
  },

  extraSocketSetup(socket) {
    socket.on(SNAKE_EVENTS.tick, (payload = {}) => {
      if (state.phase !== 'playing') return;
      if (Array.isArray(payload.players)) updatePlayersFromPayload(payload.players);
      state.apples = parseApples(payload);
    });

    socket.on(SNAKE_EVENTS.playerDied, (payload = {}) => {
      state.phase = 'lobby';
      state.hasJoinedOnce = false;
      state.players = new Map();
      state.apples = [];
      state.chat.typingSent = false;
      state.input.pendingDirection = null;
      state.input.pendingUntil = 0;

      game.chatModule.setOpen(false, false);
      game.els.lobby.classList.remove('hidden');
      game.els.reconnect.classList.add('hidden');
      game.hudModule.hide();
      leaderboardDockEl.classList.add('hidden');
      game.els.joinError.textContent = '';

      if (state.myPseudo) game.els.pseudoInput.value = state.myPseudo;
      setPreviousScore(Number(payload.score));
      updateLeaderboard(true);
    });
  },

  onInit() {
    setPreviousScore(null);
  },
});
