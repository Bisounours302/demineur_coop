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

function normalizeChatEntry(entry) {
  return {
    id: String(entry?.id || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
    pseudo: String(entry?.pseudo || 'System'),
    color: String(entry?.color || colorForPseudo(entry?.pseudo || 'System')),
    text: String(entry?.text || '').trim(),
    at: Number(entry?.at || Date.now()),
  };
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

function setTypingStatus(active) {
  if (!state.myId || state.chat.typingSent === active) return;

  state.chat.typingSent = active;
  socket.emit(SNAKE_EVENTS.chatTyping, { active });
}

function setChatOpen(open, focusInput = true) {
  const next = Boolean(open);
  if (state.chat.open === next) return;

  state.chat.open = next;
  chatDockEl.classList.toggle('open', next);
  chatFormEl.classList.toggle('hidden', !next);
  renderChatMessages();

  if (next) {
    setTypingStatus(true);
    if (focusInput) chatInputEl?.focus();
  } else {
    setTypingStatus(false);
    chatInputEl?.blur();
  }
}

function toggleChat() {
  setChatOpen(!state.chat.open);
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
  if (persist) localStorage.setItem('avatar', String(state.myAvatar));
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
  if (persist) localStorage.setItem('colorIndex', String(state.myColorIndex));
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
    option.addEventListener('click', () => setMyAvatar(option.dataset.avatar));
  }

  updateAvatarSelectionUI();
}

function drawAvatarPickerPreview(now) {
  if (!avatarPickerEl) return;
  if (lobbyEl.classList.contains('hidden')) return;

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
    }
  }
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
    deaths: Math.max(0, Number(payload.deaths) || 0),
    alive: payload.alive !== false,
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
  hudEl.classList.remove('hidden');
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

  hudPlayersEl.textContent = `${state.players.size} joueurs`;
  hudScoreEl.textContent = `Score: ${Math.max(0, Number(me?.score) || 0)}`;
  hudTimeEl.textContent = msToClock(elapsed);
}

function updateLeaderboard() {
  if (!leaderboardListEl || !leaderboardDockEl) return;

  const rows = Array.from(state.players.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.deaths - b.deaths;
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
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;
      ctx.fillStyle = (x + y) % 2 === 0 ? '#0f271c' : '#143023';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }
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

  if (headSheet && headSheet.loaded) {
    ctx.drawImage(
      headSheet,
      headCol * ANIMAL_FRAME,
      headRow * ANIMAL_FRAME,
      ANIMAL_FRAME,
      ANIMAL_FRAME,
      headPx,
      headPy,
      TILE_SIZE,
      TILE_SIZE,
    );
  } else {
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
  const viewW = canvas.width / state.camera.scale;
  const viewH = canvas.height / state.camera.scale;

  const targetX = meHead.x * TILE_SIZE + TILE_SIZE * 0.5 - viewW * 0.5;
  const targetY = meHead.y * TILE_SIZE + TILE_SIZE * 0.5 - viewH * 0.5;

  if (immediate) {
    state.camera.x = targetX;
    state.camera.y = targetY;
  } else {
    state.camera.x += (targetX - state.camera.x) * 0.08;
    state.camera.y += (targetY - state.camera.y) * 0.08;
  }

  clampCamera();
}

function clampCamera() {
  const worldW = state.map.width * TILE_SIZE;
  const worldH = state.map.height * TILE_SIZE;
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

socket.on('connect', () => {
  state.myId = socket.id;
  state.chat.typingSent = false;
  reconnectEl.classList.add('hidden');

  if (state.hasJoinedOnce && state.myPseudo && state.phase === 'playing') {
    socket.emit(SNAKE_EVENTS.join, {
      pseudo: state.myPseudo,
      avatar: state.myAvatar,
      colorIndex: state.myColorIndex,
      lobbyId: lobbyIdFromQuery,
    });
  }
});

socket.on('disconnect', () => {
  state.chat.typingSent = false;
  if (state.hasJoinedOnce) {
    reconnectEl.classList.remove('hidden');
  }
});

socket.on(SNAKE_EVENTS.joinError, (payload = {}) => {
  state.phase = 'lobby';
  lobbyEl.classList.remove('hidden');
  hudEl.classList.add('hidden');
  leaderboardDockEl.classList.add('hidden');
  joinErrorEl.textContent = payload.message || 'Impossible de rejoindre.';
});

socket.on(SNAKE_EVENTS.state, applySnapshot);

socket.on(SNAKE_EVENTS.playerJoined, (payload) => {
  applyPlayerPayload(payload);
});

socket.on(SNAKE_EVENTS.playerLeft, (payload) => {
  state.players.delete(payload.id);
});

socket.on(SNAKE_EVENTS.chatMessage, (payload) => appendChatMessage(payload));

socket.on(SNAKE_EVENTS.chatTyping, (payload = {}) => {
  const player = state.players.get(payload.id);
  if (!player) return;
  player.isTyping = Boolean(payload.active);
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
  hudEl.classList.add('hidden');
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
