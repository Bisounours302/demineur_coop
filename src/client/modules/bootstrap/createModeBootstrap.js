import {
  PLAYER_COLORS,
  CHAT_MAX_MESSAGES,
  CHAT_CLOSED_VISIBLE_MESSAGES,
  MOVE_KEY_DELTAS,
  colorForPseudo,
  normalizeAvatarIndex,
  normalizeColorIndex,
  clamp,
} from '../../core/shared.js';
import { createChatModule } from '../chat/createChatModule.js';
import { createHudModule } from '../hud/createHudModule.js';
import { createIdentityModule } from '../lobby/createIdentityModule.js';
import { registerCommonSocketLifecycle } from '../network/registerCommonSocketLifecycle.js';
import {
  clampCameraToWorld,
  centerCameraOnFocus,
  getCameraViewport,
  getCameraTarget,
} from '../camera/followCamera.js';
import {
  registerHoldMoveKey,
  clearHoldMoveKey,
  clearAllHoldMoveKeys,
} from '../input/holdMove.js';
import { spriteDirection } from '../player/spriteUtils.js';

/**
 * Creates a fully-wired game mode bootstrap.
 *
 * The caller passes a `state` object with mode-specific fields; common fields
 * (phase, camera, chat, players …) are merged in automatically.
 *
 * Returns an api object the mode can use to interact with canvas, socket,
 * shared modules, camera helpers, and move-queue helpers.
 */
export function createModeBootstrap(config) {
  const {
    state,
    events,
    sprites,
    tileSize,
    minScale = 0.3,
    maxScale = 2.0,
    animIdleMs = 220,
    animalFrame = 32,
    animalCols = 4,
    hasPositionMove = true,
    moveCooldownMs = 120,
    holdDelayMs = 300,
    cameraSmoothing = 0.05,
    cameraSnapThreshold = null,
    stateEvents = [],

    getWorldSize,
    getFocusPosition,
    onApplyState,
    onPlayerJoined,
    onPlayerLeft,
    onRender,
    onUpdateHud,
    onKeydown,
    onMousedown,
    onWindowBlur,
    onJoinPayload,
    onJoinError: onModeJoinError,
    onInit,
    extraSocketSetup,
  } = config;

  // ------------------------------------------------------------------ state
  if (!state.camera) {
    state.camera = { x: 0, y: 0, scale: 1, isManual: false, dragging: false, dragLastX: 0, dragLastY: 0 };
  }
  if (!state.chat) {
    state.chat = { open: false, typingSent: false, messages: [] };
  }
  if (!state.players) {
    state.players = new Map();
  }
  if (state.phase === undefined) state.phase = 'lobby';
  if (state.myId === undefined) state.myId = null;
  if (state.myPseudo === undefined) state.myPseudo = null;
  if (state.myAvatar === undefined) state.myAvatar = 0;
  if (state.myColorIndex === undefined) state.myColorIndex = 0;
  if (state.hasJoinedOnce === undefined) state.hasJoinedOnce = false;
  if (state.loopStarted === undefined) state.loopStarted = false;
  if (state.startTime === undefined) state.startTime = null;

  if (hasPositionMove) {
    if (!state.me) state.me = { x: 0, y: 0 };
    if (!state.moveQueue) state.moveQueue = [];
    if (state.lastMoveAt === undefined) state.lastMoveAt = 0;
    if (!state.holdControls) state.holdControls = new Map();
  }

  // ------------------------------------------------------------- lobby query
  const lobbyIdFromQuery = (() => {
    const raw = new URLSearchParams(window.location.search).get('lobby');
    const v = String(raw || '').trim().toLowerCase();
    return v || null;
  })();

  // ----------------------------------------------------------- DOM elements
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const els = {
    lobby: document.getElementById('lobby'),
    joinForm: document.getElementById('joinForm'),
    pseudoInput: document.getElementById('pseudoInput'),
    joinError: document.getElementById('joinError'),
    reconnect: document.getElementById('reconnect'),
    hud: document.getElementById('hud'),
    avatarOptions: Array.from(document.querySelectorAll('.avatar-option')),
    colorPicker: document.getElementById('colorPicker'),
    chatDock: document.getElementById('chatDock'),
    chatToggleBtn: document.getElementById('chatToggleBtn'),
    chatMessages: document.getElementById('chatMessages'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
  };

  // ----------------------------------------------------------------- socket
  const socket = io();

  // ---------------------------------------------------------------- modules
  const identityModule = createIdentityModule({
    state,
    avatarOptionEls: els.avatarOptions,
    colorPickerEl: els.colorPicker,
    normalizeAvatarIndex,
    normalizeColorIndex,
    playerColors: PLAYER_COLORS,
  });

  function clearAllHoldMoves() {
    if (hasPositionMove) clearAllHoldMoveKeys(state.holdControls);
  }

  const chatModule = createChatModule({
    state,
    chatDockEl: els.chatDock,
    chatFormEl: els.chatForm,
    chatMessagesEl: els.chatMessages,
    chatInputEl: els.chatInput,
    resolveColorForPseudo: colorForPseudo,
    emitTyping: (active) => socket.emit(events.chatTyping, { active }),
    maxMessages: CHAT_MAX_MESSAGES,
    closedVisibleMessages: CHAT_CLOSED_VISIBLE_MESSAGES,
    getMyId: () => state.myId,
    onOpen: () => {
      clearAllHoldMoves();
      if (hasPositionMove) state.moveQueue = [];
      state.camera.dragging = false;
    },
    onLocalTypingChanged: (active) => {
      const me = state.players.get(state.myId);
      if (me) me.isTyping = active;
    },
  });

  const hudModule = createHudModule({ rootEl: els.hud });

  // ----------------------------------------------------------------- camera
  function clampCamera() {
    const world = getWorldSize();
    clampCameraToWorld({ camera: state.camera, canvas, worldW: world.w, worldH: world.h });
  }

  function centerCameraOnMe(immediate = false) {
    const focus = getFocusPosition();
    centerCameraOnFocus({
      camera: state.camera,
      canvas,
      tileSize,
      focusX: focus.x,
      focusY: focus.y,
      immediate,
      smoothing: cameraSmoothing,
    });
    clampCamera();
  }

  function updateCamera() {
    if (state.phase === 'lobby') return;
    if (state.camera.dragging) { clampCamera(); return; }

    if (cameraSnapThreshold !== null && hasPositionMove) {
      const focus = getFocusPosition();
      const { viewW, viewH } = getCameraViewport(state.camera, canvas);
      const { targetX, targetY } = getCameraTarget({
        focusX: focus.x, focusY: focus.y, tileSize, viewW, viewH,
      });

      if (!state.camera.isManual) {
        state.camera.x = targetX;
        state.camera.y = targetY;
      } else {
        const px = focus.x * tileSize + tileSize * 0.5;
        const py = focus.y * tileSize + tileSize * 0.5;
        const dist = Math.max(
          Math.abs((state.camera.x + viewW * 0.5) - px) / tileSize,
          Math.abs((state.camera.y + viewH * 0.5) - py) / tileSize,
        );
        if (dist > cameraSnapThreshold) {
          state.camera.x = targetX;
          state.camera.y = targetY;
        } else {
          state.camera.x += (targetX - state.camera.x) * cameraSmoothing;
          state.camera.y += (targetY - state.camera.y) * cameraSmoothing;
        }
      }
      clampCamera();
    } else {
      centerCameraOnMe(false);
    }
  }

  // ------------------------------------------------------------ move queue
  function enqueueMove(dx, dy) {
    if (!hasPositionMove) return;
    state.moveQueue.push({ dx, dy });
  }

  function processInputQueue() {
    if (!hasPositionMove) return;
    if (state.phase !== 'playing' || state.chat.open || state.moveQueue.length === 0) return;

    const now = Date.now();
    if (now - state.lastMoveAt < moveCooldownMs) return;

    const action = state.moveQueue.shift();
    if (!action) return;

    const nx = state.me.x + action.dx;
    const ny = state.me.y + action.dy;
    const world = getWorldSize();
    if (nx < 0 || nx >= Math.round(world.w / tileSize) || ny < 0 || ny >= Math.round(world.h / tileSize)) return;

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
    socket.emit(events.move, { x: nx, y: ny });
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

  function registerHoldMove(code, dx, dy) {
    registerHoldMoveKey({
      holdControls: state.holdControls,
      code, dx, dy, enqueueMove,
      holdDelayMs: holdDelayMs,
      moveCooldownMs: moveCooldownMs,
    });
  }

  // --------------------------------------------------------------- join form
  els.joinForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const pseudo = String(els.pseudoInput.value || '').trim();
    if (!pseudo) { els.joinError.textContent = 'Entre un pseudo.'; return; }

    state.myPseudo = pseudo;
    state.hasJoinedOnce = true;
    localStorage.setItem('pseudo', pseudo);
    els.joinError.textContent = '';

    const payload = {
      pseudo,
      avatar: state.myAvatar,
      colorIndex: state.myColorIndex,
      lobbyId: lobbyIdFromQuery,
    };
    if (typeof onJoinPayload === 'function') Object.assign(payload, onJoinPayload());
    socket.emit(events.join, payload);
  });

  // --------------------------------------------------------------- chat form
  els.chatToggleBtn?.addEventListener('click', () => chatModule.toggleOpen());

  els.chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.myId) return;
    const text = String(els.chatInput?.value || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    socket.emit(events.chatSend, { text });
    if (els.chatInput) { els.chatInput.value = ''; els.chatInput.focus(); }
    if (state.chat.open) chatModule.setTypingStatus(true);
  });

  // ------------------------------------------------------------------- input
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('blur', () => {
    clearAllHoldMoves();
    if (typeof onWindowBlur === 'function') onWindowBlur();
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('mousedown', (e) => {
    if (state.chat.open) return;

    // Middle-click → drag
    if (e.button === 1) {
      state.camera.dragging = true;
      state.camera.isManual = true;
      state.camera.dragLastX = e.clientX;
      state.camera.dragLastY = e.clientY;
      return;
    }

    if (typeof onMousedown === 'function') onMousedown(e);
  });

  window.addEventListener('mouseup', () => { state.camera.dragging = false; });

  window.addEventListener('mousemove', (e) => {
    if (!state.camera.dragging) return;
    state.camera.x -= (e.clientX - state.camera.dragLastX) / state.camera.scale;
    state.camera.y -= (e.clientY - state.camera.dragLastY) / state.camera.scale;
    state.camera.dragLastX = e.clientX;
    state.camera.dragLastY = e.clientY;
    clampCamera();
  });

  canvas.addEventListener('wheel', (e) => {
    if (state.chat.open) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldX = state.camera.x + sx / state.camera.scale;
    const worldY = state.camera.y + sy / state.camera.scale;
    const delta = e.deltaY < 0 ? 1.12 : 0.88;
    const next = clamp(state.camera.scale * delta, minScale, maxScale);
    state.camera.scale = next;
    state.camera.x = worldX - sx / next;
    state.camera.y = worldY - sy / next;
    state.camera.isManual = true;
    clampCamera();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab') {
      e.preventDefault();
      chatModule.toggleOpen();
      return;
    }

    if (state.chat.open) {
      if (e.code === 'Escape') { e.preventDefault(); chatModule.setOpen(false, false); return; }
      if (e.code === 'Enter' && document.activeElement !== els.chatInput) {
        e.preventDefault(); els.chatInput?.focus();
      }
      return;
    }

    // Mode-specific keys first
    if (typeof onKeydown === 'function') {
      const handled = onKeydown(e);
      if (handled) return;
    }

    // Hold-move keys
    if (hasPositionMove) {
      const delta = MOVE_KEY_DELTAS[e.code];
      if (delta) registerHoldMove(e.code, delta[0], delta[1]);
    }
  });

  window.addEventListener('keyup', (e) => {
    if (hasPositionMove) clearHoldMoveKey(state.holdControls, e.code);
  });

  // -------------------------------------------------------------- socket
  function emitJoin() {
    const payload = {
      pseudo: state.myPseudo,
      avatar: state.myAvatar,
      colorIndex: state.myColorIndex,
      lobbyId: lobbyIdFromQuery,
    };
    if (typeof onJoinPayload === 'function') Object.assign(payload, onJoinPayload());
    socket.emit(events.join, payload);
  }

  registerCommonSocketLifecycle({
    socket,
    events,
    state,
    stateEvents,
    onConnect: () => {
      state.myId = socket.id;
      els.reconnect.classList.add('hidden');
      if (state.hasJoinedOnce && state.myPseudo) emitJoin();
    },
    onDisconnect: () => {
      clearAllHoldMoves();
      if (state.hasJoinedOnce) els.reconnect.classList.remove('hidden');
    },
    onJoinError: (payload = {}) => {
      state.phase = 'lobby';
      clearAllHoldMoves();
      if (hasPositionMove) state.moveQueue = [];
      state.camera.dragging = false;
      chatModule.setOpen(false, false);
      hudModule.hide();
      els.reconnect.classList.add('hidden');
      els.lobby.classList.remove('hidden');
      els.joinError.textContent = payload.message || 'Impossible de rejoindre.';
      if (typeof onModeJoinError === 'function') {
        onModeJoinError(payload);
      }
    },
    onState: (payload) => {
      if (typeof onApplyState === 'function') onApplyState(payload);
    },
    onPlayerJoined: (payload) => {
      if (typeof onPlayerJoined === 'function') onPlayerJoined(payload);
    },
    onPlayerLeft: (payload) => {
      if (typeof onPlayerLeft === 'function') onPlayerLeft(payload);
      else state.players.delete(payload.id);
    },
    onChatMessage: (entry) => chatModule.appendMessage(entry),
    onChatTyping: (payload = {}) => {
      const player = state.players.get(payload.id);
      if (player) player.isTyping = Boolean(payload.active);
    },
  });

  if (hasPositionMove && events.playerMoved) {
    socket.on(events.playerMoved, (payload) => {
      updateLocalPlayerFromServerMove(payload.id, payload.x, payload.y);
    });
  }

  if (typeof extraSocketSetup === 'function') {
    extraSocketSetup(socket);
  }

  // ----------------------------------------------------------- localStorage
  const rememberedPseudo = localStorage.getItem('pseudo');
  if (rememberedPseudo) els.pseudoInput.value = rememberedPseudo;

  identityModule.setupAvatarPicker();
  identityModule.setupColorPicker();

  const savedAvatar = localStorage.getItem('avatar');
  if (savedAvatar !== null) identityModule.setMyAvatar(savedAvatar, false);

  const savedColor = localStorage.getItem('colorIndex');
  if (savedColor !== null) identityModule.setMyColorIndex(savedColor, false);

  chatModule.setMessages([]);
  chatModule.setOpen(false, false);

  // ---------------------------------------------------- canvas / game loop
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

  function drawAvatarPickerPreview(now) {
    if (els.lobby.classList.contains('hidden')) return;
    identityModule.drawAvatarPickerPreview({
      now,
      sprites,
      animIdleMs,
      frameSize: animalFrame,
      frameCols: animalCols,
      fallbackColor: '#d7e3ff',
    });
  }

  function startGameLoop() {
    if (state.loopStarted) return;
    state.loopStarted = true;

    function tick() {
      updateCamera();
      processInputQueue();
      if (typeof onRender === 'function') onRender(Date.now());
      drawAvatarPickerPreview(Date.now());
      if (typeof onUpdateHud === 'function') onUpdateHud();
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  resizeCanvas();

  if (typeof onInit === 'function') onInit();

  startGameLoop();

  // ----------------------------------------------------------- public API
  return {
    state,
    socket,
    canvas,
    ctx,
    els,
    sprites,
    lobbyIdFromQuery,
    chatModule,
    identityModule,
    hudModule,
    centerCameraOnMe,
    clampCamera,
    clearAllHoldMoves,
    enqueueMove,
    updateLocalPlayerFromServerMove,
  };
}
