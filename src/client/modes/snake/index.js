import {
  CHAT_CLOSED_VISIBLE_MESSAGES,
  CHAT_MAX_MESSAGES,
  PLAYER_COLORS,
  clamp,
  colorForPseudo,
  loadImage,
  msToClock,
  normalizeAvatarIndex,
  normalizeColorIndex,
} from '../../core/shared.js';
import { SNAKE_EVENTS } from '../../core/events.js';
import { createChatModule } from '../../modules/chat/createChatModule.js';
import { createIdentityModule } from '../../modules/lobby/createIdentityModule.js';
import { createHudModule } from '../../modules/hud/createHudModule.js';
import { drawCheckerTiles } from '../../modules/tiles/drawCheckerTiles.js';
import { drawAvatarFrame } from '../../modules/characters/drawAvatarFrame.js';
import { registerCommonSocketLifecycle } from '../../modules/network/registerCommonSocketLifecycle.js';
import {
  clampCameraToWorld,
  centerCameraOnFocus,
} from '../../modules/camera/followCamera.js';

const TILE_SIZE = 18;
const MIN_SCALE = 0.25;
const MAX_SCALE = 2.2;

const ANIM_IDLE_MS = 220;
const ANIMAL_FRAME = 32;
const ANIMAL_COLS = 4;

const DIRECTION_BY_KEY = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

const socket = io();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const lobbyEl = document.getElementById('lobby');
const joinFormEl = document.getElementById('joinForm');
const pseudoInputEl = document.getElementById('pseudoInput');
const joinErrorEl = document.getElementById('joinError');
const previousScoreEl = document.getElementById('previousScore');
const avatarPickerEl = document.getElementById('avatarPicker');
const avatarOptionEls = Array.from(document.querySelectorAll('.avatar-option'));
const colorPickerEl = document.getElementById('colorPicker');

const reconnectEl = document.getElementById('reconnect');
const hudEl = document.getElementById('hud');
const hudPlayersEl = document.getElementById('hudPlayers');
const hudScoreEl = document.getElementById('hudScore');
const hudTimeEl = document.getElementById('hudTime');

const leaderboardDockEl = document.getElementById('leaderboardDock');
const leaderboardListEl = document.getElementById('leaderboardList');
const leaderboardStatusEl = document.getElementById('leaderboardStatus');

const chatDockEl = document.getElementById('chatDock');
const chatToggleBtnEl = document.getElementById('chatToggleBtn');
const chatMessagesEl = document.getElementById('chatMessages');
const chatFormEl = document.getElementById('chatForm');
const chatInputEl = document.getElementById('chatInput');

const assets = {
  sprites: [
    loadImage('/assets/BIRDSPRITESHEET_Blue.png'),
    loadImage('/assets/BIRDSPRITESHEET_White.png'),
    loadImage('/assets/CATSPRITESHEET_Gray.png'),
    loadImage('/assets/CATSPRITESHEET_Orange.png'),
    loadImage('/assets/FOXSPRITESHEET.png'),
    loadImage('/assets/RACCOONSPRITESHEET.png'),
  ],
  apple: loadImage('/assets/apple.png'),
};

const lobbyIdFromQuery = (() => {
  const raw = new URLSearchParams(window.location.search).get('lobby');
  const value = String(raw || '').trim().toLowerCase();
  return value || null;
})();

const state = {
  phase: 'lobby',
  myId: null,
  myPseudo: null,
  myAvatar: 0,
  myColorIndex: 0,
  hasJoinedOnce: false,
  startTime: null,
  map: {
    width: 70,
    height: 70,
    totalCells: 70 * 70,
    tickMs: 180,
    appleCount: 1,
  },
  apples: [],
  players: new Map(),
  loopStarted: false,
  camera: {
    x: 0,
    y: 0,
    scale: 1,
    dragging: false,
    dragLastX: 0,
    dragLastY: 0,
  },
  chat: {
    open: false,
    typingSent: false,
    messages: [],
  },
};

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

const identityModule = createIdentityModule({
  state,
  avatarOptionEls,
  colorPickerEl,
  normalizeAvatarIndex,
  normalizeColorIndex,
  playerColors: PLAYER_COLORS,
  avatarStorageKey: 'avatar',
  colorStorageKey: 'colorIndex',
});

const chatModule = createChatModule({
  state,
  chatDockEl,
  chatFormEl,
  chatMessagesEl,
  chatInputEl,
  resolveColorForPseudo: colorForPseudo,
  emitTyping: (active) => {
    socket.emit(SNAKE_EVENTS.chatTyping, { active });
  },
  maxMessages: CHAT_MAX_MESSAGES,
  closedVisibleMessages: CHAT_CLOSED_VISIBLE_MESSAGES,
  getMyId: () => state.myId,
});

const hudModule = createHudModule({ rootEl: hudEl });

function setChatMessages(messages) {
  chatModule.setMessages(messages);
}

function appendChatMessage(entry) {
  chatModule.appendMessage(entry);
}

function setTypingStatus(active) {
  chatModule.setTypingStatus(active);
}

function setChatOpen(open, focusInput = true) {
  chatModule.setOpen(open, focusInput);
}

function toggleChat() {
  chatModule.toggleOpen();
}

function updateAvatarSelectionUI() {
  identityModule.updateAvatarSelectionUI();
}

function setMyAvatar(value, persist = true) {
  identityModule.setMyAvatar(value, persist);
}

function updateColorSelectionUI() {
  identityModule.updateColorSelectionUI();
}

function setMyColorIndex(value, persist = true) {
  identityModule.setMyColorIndex(value, persist);
}

function setupColorPicker() {
  identityModule.setupColorPicker();
}

function setupAvatarPicker() {
  identityModule.setupAvatarPicker();
}

function drawAvatarPickerPreview(now) {
  if (lobbyEl.classList.contains('hidden')) return;
  identityModule.drawAvatarPickerPreview({
    now,
    sprites: assets.sprites,
    animIdleMs: ANIM_IDLE_MS,
    frameSize: ANIMAL_FRAME,
    frameCols: ANIMAL_COLS,
  });
}

function colorForPlayer(player) {
  return player.color || colorForPseudo(player.pseudo);
}

function applyPlayerPayload(payload) {
  state.players.set(payload.id, {
    id: payload.id,
    pseudo: payload.pseudo,
    avatar: normalizeAvatarIndex(payload.avatar),
    colorIndex: normalizeColorIndex(payload.colorIndex),
    color: payload.color || colorForPseudo(payload.pseudo),
    x: Number(payload.x) || 0,
    y: Number(payload.y) || 0,
    direction: String(payload.direction || 'right'),
    score: Math.max(0, Number(payload.score) || 0),
    isTyping: Boolean(payload.isTyping),
    segments: Array.isArray(payload.segments)
      ? payload.segments.map((segment) => ({ x: Number(segment.x) || 0, y: Number(segment.y) || 0 }))
      : [],
  });
}

function updatePlayersFromPayload(playersPayload = []) {
  state.players = new Map();
  for (const payload of playersPayload) {
    applyPlayerPayload(payload);
  }
}

function applySnapshot(payload) {
  state.phase = 'playing';
  state.hasJoinedOnce = true;
  state.myId = payload.myId || state.myId;
  state.startTime = Number(payload.startTime) || Date.now();

  state.map.width = Number(payload.map?.width) || 70;
  state.map.height = Number(payload.map?.height) || 70;
  state.map.totalCells = Number(payload.map?.totalCells) || (state.map.width * state.map.height);
  state.map.tickMs = Number(payload.map?.tickMs) || 180;
  state.map.appleCount = Number(payload.map?.appleCount) || 1;

  const applesPayload = Array.isArray(payload.apples)
    ? payload.apples
    : (payload.apple ? [payload.apple] : []);
  state.apples = applesPayload.map((apple) => ({
    x: Number(apple?.x) || 0,
    y: Number(apple?.y) || 0,
  }));

  updatePlayersFromPayload(payload.players || []);
  setChatMessages(payload.chatMessages || []);
  setPreviousScore(null);

  lobbyEl.classList.add('hidden');
  reconnectEl.classList.add('hidden');
  joinErrorEl.textContent = '';
  hudModule.show();
  leaderboardDockEl.classList.remove('hidden');

  centerCameraOnMe(true);
}

function applyTick(payload = {}) {
  if (state.phase !== 'playing') return;

  if (Array.isArray(payload.players)) {
    updatePlayersFromPayload(payload.players);
  }

  const applesPayload = Array.isArray(payload.apples)
    ? payload.apples
    : (payload.apple ? [payload.apple] : []);
  state.apples = applesPayload.map((apple) => ({
    x: Number(apple?.x) || 0,
    y: Number(apple?.y) || 0,
  }));
}

function updateHud() {
  const elapsed = state.startTime ? Date.now() - state.startTime : 0;
  const me = state.players.get(state.myId);

  hudModule.setText(hudPlayersEl, `${state.players.size} joueurs`);
  hudModule.setText(hudScoreEl, `Score: ${Math.max(0, Number(me?.score) || 0)}`);
  hudModule.setText(hudTimeEl, msToClock(elapsed));
}

function updateLeaderboard() {
  if (!leaderboardListEl || !leaderboardDockEl) return;

  const rows = Array.from(state.players.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.pseudo.localeCompare(b.pseudo, 'fr');
    });

  leaderboardListEl.innerHTML = '';
  rows.slice(0, 10).forEach((player, idx) => {
    const li = document.createElement('li');
    const isMe = player.id === state.myId;
    li.innerHTML = `<strong style="color:${colorForPlayer(player)};">${idx + 1}. ${player.pseudo}${isMe ? ' (toi)' : ''}</strong> - ${player.score}`;
    leaderboardListEl.appendChild(li);
  });

  const myRank = rows.findIndex((row) => row.id === state.myId) + 1;
  const topScore = rows.length > 0 ? rows[0].score : 0;
  const me = state.players.get(state.myId);
  const myScore = Math.max(0, Number(me?.score) || 0);
  const isBehind = myRank > 1 && myScore < topScore;

  leaderboardDockEl.classList.toggle('hidden-behind', isBehind);
  if (myRank <= 0) {
    leaderboardStatusEl.textContent = 'En attente';
  } else if (myRank === 1) {
    leaderboardStatusEl.textContent = 'En tete';
  } else {
    leaderboardStatusEl.textContent = `Derriere (#${myRank})`;
  }
}

function drawBoard(minX, maxX, minY, maxY) {
  drawCheckerTiles({
    ctx,
    minX,
    maxX,
    minY,
    maxY,
    tileSize: TILE_SIZE,
    primaryColor: '#0f271c',
    secondaryColor: '#143023',
    strokeStyle: 'rgba(255,255,255,0.04)',
  });
}

function drawApples() {
  for (const apple of state.apples) {
    const px = apple.x * TILE_SIZE;
    const py = apple.y * TILE_SIZE;

    if (assets.apple && assets.apple.loaded) {
      ctx.drawImage(assets.apple, px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      continue;
    }

    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    ctx.fillStyle = '#63b45c';
    ctx.fillRect(px + Math.floor(TILE_SIZE * 0.45), py + 1, 3, 5);
  }
}

function drawSnake(player, now) {
  const baseColor = colorForPlayer(player);

  for (let i = 1; i < player.segments.length; i++) {
    const segment = player.segments[i];
    const px = segment.x * TILE_SIZE;
    const py = segment.y * TILE_SIZE;

    ctx.fillStyle = baseColor;
    ctx.fillRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }

  const head = player.segments[0] || { x: player.x, y: player.y };
  const headPx = head.x * TILE_SIZE;
  const headPy = head.y * TILE_SIZE;
  const headSheet = assets.sprites[normalizeAvatarIndex(player.avatar)];
  const rowByDirection = { down: 0, right: 1, left: 2, up: 3 };
  const headRow = rowByDirection[player.direction] ?? 0;
  const headCol = Math.floor(now / ANIM_IDLE_MS) % ANIMAL_COLS;

  if (!drawAvatarFrame({
    ctx,
    image: headSheet,
    frameCol: headCol,
    frameRow: headRow,
    frameSize: ANIMAL_FRAME,
    dx: headPx,
    dy: headPy,
    dw: TILE_SIZE,
    dh: TILE_SIZE,
  })) {
    ctx.fillStyle = '#f9f9f9';
    ctx.fillRect(headPx + 1, headPy + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(headPx + 1.5, headPy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
  }

  return {
    x: head.x * TILE_SIZE + TILE_SIZE * 0.5,
    y: head.y * TILE_SIZE - 8,
    text: `${player.pseudo} (${player.score})`,
    color: baseColor,
    isTyping: Boolean(player.isTyping),
  };
}

function renderFrame() {
  const now = Date.now();
  const scale = state.camera.scale;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);

  const worldW = state.map.width * TILE_SIZE;
  const worldH = state.map.height * TILE_SIZE;
  ctx.fillStyle = '#07140e';
  ctx.fillRect(-200, -200, worldW + 400, worldH + 400);

  const viewW = canvas.width / scale;
  const viewH = canvas.height / scale;
  const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, state.map.width - 1);
  const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, state.map.width - 1);
  const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, state.map.height - 1);
  const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, state.map.height - 1);

  drawBoard(minX, maxX, minY, maxY);
  drawApples();

  const labels = [];
  for (const player of state.players.values()) {
    if (player.segments.length === 0) continue;
    labels.push(drawSnake(player, now));
  }

  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const label of labels) {
    if (label.isTyping) {
      ctx.strokeStyle = '#000000';
      ctx.strokeText('ecrit...', label.x, label.y - 11);
      ctx.fillStyle = '#ffd28f';
      ctx.fillText('ecrit...', label.x, label.y - 11);
    }

    ctx.strokeStyle = '#000000';
    ctx.strokeText(label.text, label.x, label.y);
    ctx.fillStyle = label.color;
    ctx.fillText(label.text, label.x, label.y);
  }

  drawAvatarPickerPreview(now);
}

function getMyHead() {
  const me = state.players.get(state.myId);
  if (!me || !Array.isArray(me.segments) || me.segments.length === 0) {
    return { x: Math.floor(state.map.width / 2), y: Math.floor(state.map.height / 2) };
  }

  return me.segments[0];
}

function centerCameraOnMe(immediate = false) {
  const meHead = getMyHead();
  centerCameraOnFocus({
    camera: state.camera,
    canvas,
    tileSize: TILE_SIZE,
    focusX: meHead.x,
    focusY: meHead.y,
    immediate,
    smoothing: 0.08,
  });

  clampCamera();
}

function clampCamera() {
  clampCameraToWorld({
    camera: state.camera,
    canvas,
    worldW: state.map.width * TILE_SIZE,
    worldH: state.map.height * TILE_SIZE,
  });
}

function updateCamera() {
  if (state.phase === 'lobby') return;
  if (state.camera.dragging) {
    clampCamera();
    return;
  }

  centerCameraOnMe(false);
}

function startGameLoop() {
  if (state.loopStarted) return;
  state.loopStarted = true;

  function tick() {
    updateCamera();
    renderFrame();
    updateHud();
    updateLeaderboard();
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

function emitTurn(direction) {
  if (state.phase !== 'playing' || state.chat.open) return;
  socket.emit(SNAKE_EVENTS.turn, { direction });
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
  setPreviousScore(null);

  socket.emit(SNAKE_EVENTS.join, {
    pseudo,
    avatar: state.myAvatar,
    colorIndex: state.myColorIndex,
    lobbyId: lobbyIdFromQuery,
  });
});

chatToggleBtnEl?.addEventListener('click', toggleChat);

chatFormEl?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.myId) return;

  const text = String(chatInputEl?.value || '').replace(/\s+/g, ' ').trim();
  if (!text) return;

  socket.emit(SNAKE_EVENTS.chatSend, { text });
  if (chatInputEl) {
    chatInputEl.value = '';
    chatInputEl.focus();
  }

  if (state.chat.open) {
    setTypingStatus(true);
  }
});

window.addEventListener('resize', resizeCanvas);

canvas.addEventListener('contextmenu', (event) => event.preventDefault());
canvas.addEventListener('mousedown', (event) => {
  if (event.button !== 1) return;
  state.camera.dragging = true;
  state.camera.dragLastX = event.clientX;
  state.camera.dragLastY = event.clientY;
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

  const direction = DIRECTION_BY_KEY[event.code];
  if (!direction) return;

  event.preventDefault();
  if (event.repeat) return;
  emitTurn(direction);
});

registerCommonSocketLifecycle({
  socket,
  events: SNAKE_EVENTS,
  state,
  onConnect: () => {
    state.myId = socket.id;
    reconnectEl.classList.add('hidden');

    if (state.hasJoinedOnce && state.myPseudo && state.phase === 'playing') {
      socket.emit(SNAKE_EVENTS.join, {
        pseudo: state.myPseudo,
        avatar: state.myAvatar,
        colorIndex: state.myColorIndex,
        lobbyId: lobbyIdFromQuery,
      });
    }
  },
  onDisconnect: () => {
    if (state.hasJoinedOnce) {
      reconnectEl.classList.remove('hidden');
    }
  },
  onJoinError: (payload = {}) => {
    state.phase = 'lobby';
    lobbyEl.classList.remove('hidden');
    hudModule.hide();
    leaderboardDockEl.classList.add('hidden');
    joinErrorEl.textContent = payload.message || 'Impossible de rejoindre.';
  },
  onState: applySnapshot,
  onPlayerJoined: applyPlayerPayload,
  onPlayerLeft: (payload) => {
    state.players.delete(payload.id);
  },
  onChatMessage: appendChatMessage,
  onChatTyping: (payload = {}) => {
    const player = state.players.get(payload.id);
    if (!player) return;
    player.isTyping = Boolean(payload.active);
  },
});

socket.on(SNAKE_EVENTS.tick, applyTick);

socket.on(SNAKE_EVENTS.playerDied, (payload = {}) => {
  state.phase = 'lobby';
  state.hasJoinedOnce = false;
  state.players = new Map();
  state.apples = [];
  state.chat.typingSent = false;

  setChatOpen(false, false);
  lobbyEl.classList.remove('hidden');
  reconnectEl.classList.add('hidden');
  hudModule.hide();
  leaderboardDockEl.classList.add('hidden');
  joinErrorEl.textContent = '';

  if (state.myPseudo) {
    pseudoInputEl.value = state.myPseudo;
  }

  setPreviousScore(Number(payload.score));
});

const rememberedPseudo = localStorage.getItem('pseudo');
if (rememberedPseudo) pseudoInputEl.value = rememberedPseudo;

setupAvatarPicker();
setupColorPicker();

const rememberedAvatar = localStorage.getItem('avatar');
if (rememberedAvatar !== null) setMyAvatar(rememberedAvatar, false);

const rememberedColorIndex = localStorage.getItem('colorIndex');
if (rememberedColorIndex !== null) setMyColorIndex(rememberedColorIndex, false);

setChatMessages([]);
setChatOpen(false, false);
setPreviousScore(null);
resizeCanvas();
startGameLoop();
