(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // shared/events.js
  var require_events = __commonJS({
    "shared/events.js"(exports, module) {
      var MINES_EVENTS2 = {
        join: "mines:join",
        joinError: "mines:error:join",
        state: "mines:state",
        playerJoined: "mines:player:joined",
        playerLeft: "mines:player:left",
        move: "mines:move",
        playerMoved: "mines:player:moved",
        chatTyping: "mines:chat:typing",
        chatSend: "mines:chat:send",
        chatMessage: "mines:chat:message",
        reveal: "mines:cell:reveal",
        cellsRevealed: "mines:cells:revealed",
        flag: "mines:cell:flag",
        cellFlagged: "mines:cell:flagged",
        bombExploded: "mines:bomb:exploded",
        gameOver: "mines:game:over",
        gameNew: "mines:game:new"
      };
      var PAINT_EVENTS = {
        join: "paint:join",
        joinError: "paint:error:join",
        state: "paint:state",
        playerJoined: "paint:player:joined",
        playerLeft: "paint:player:left",
        move: "paint:move",
        playerMoved: "paint:player:moved",
        chatTyping: "paint:chat:typing",
        chatSend: "paint:chat:send",
        chatMessage: "paint:chat:message",
        place: "paint:pixel:place",
        pixel: "paint:pixel"
      };
      var SNAKE_EVENTS = {
        join: "snake:join",
        joinError: "snake:error:join",
        state: "snake:state",
        playerJoined: "snake:player:joined",
        playerLeft: "snake:player:left",
        chatTyping: "snake:chat:typing",
        chatSend: "snake:chat:send",
        chatMessage: "snake:chat:message",
        turn: "snake:turn",
        tick: "snake:tick",
        playerDied: "snake:player:died"
      };
      module.exports = {
        MINES_EVENTS: MINES_EVENTS2,
        PAINT_EVENTS,
        SNAKE_EVENTS
      };
    }
  });

  // src/client/core/shared.js
  var PLAYER_COLORS = [
    "#FF6B6B",
    "#4ECDC4",
    "#45B7D1",
    "#96CEB4",
    "#FFEAA7",
    "#DDA0DD",
    "#98D8C8",
    "#F7DC6F",
    "#FF8A80",
    "#80D8FF",
    "#B9F6CA",
    "#FFD180",
    "#EA80FC",
    "#A7FFEB",
    "#FF9E80",
    "#82B1FF",
    "#CCFF90",
    "#FFAB91",
    "#B388FF",
    "#84FFFF"
  ];
  var AVATAR_COUNT = 6;
  var CHAT_MAX_MESSAGES = 100;
  var CHAT_CLOSED_VISIBLE_MESSAGES = 3;
  var MOVE_KEY_DELTAS = {
    ArrowUp: [0, -1],
    KeyZ: [0, -1],
    KeyW: [0, -1],
    ArrowDown: [0, 1],
    KeyS: [0, 1],
    ArrowLeft: [-1, 0],
    KeyQ: [-1, 0],
    KeyA: [-1, 0],
    ArrowRight: [1, 0],
    KeyD: [1, 0]
  };
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
      h = h * 31 + str.charCodeAt(i) & 4294967295;
    }
    return Math.abs(h);
  }
  function colorForPseudo(pseudo) {
    return PLAYER_COLORS[hashPseudo(String(pseudo || "")) % PLAYER_COLORS.length];
  }
  function normalizeColorIndex(value) {
    const index = Number(value);
    if (!Number.isInteger(index)) return 0;
    if (index < 0 || index >= PLAYER_COLORS.length) return 0;
    return index;
  }
  function normalizeAvatarIndex(value) {
    const avatar = Number(value);
    if (!Number.isInteger(avatar)) return 0;
    if (avatar < 0 || avatar >= AVATAR_COUNT) return 0;
    return avatar;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function msToClock(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1e3));
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
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

  // src/client/modes/mines/index.js
  var import_events = __toESM(require_events());

  // src/client/modules/chat/createChatModule.js
  function createChatModule(options) {
    const {
      state: state2,
      chatDockEl,
      chatFormEl,
      chatMessagesEl,
      chatInputEl,
      resolveColorForPseudo,
      emitTyping,
      maxMessages = 100,
      closedVisibleMessages = 3,
      getMyId,
      onOpen,
      onClose,
      onLocalTypingChanged
    } = options;
    function normalizeChatEntry(entry) {
      const fallbackPseudo = String(entry?.pseudo || "System");
      const fallbackColor = typeof resolveColorForPseudo === "function" ? resolveColorForPseudo(fallbackPseudo) : "#ffffff";
      return {
        id: String(entry?.id || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
        pseudo: fallbackPseudo,
        color: String(entry?.color || fallbackColor),
        text: String(entry?.text || "").trim(),
        at: Number(entry?.at || Date.now())
      };
    }
    function renderMessages() {
      if (!chatMessagesEl) return;
      const messagesToRender = state2.chat.open ? state2.chat.messages : state2.chat.messages.slice(-closedVisibleMessages);
      chatMessagesEl.innerHTML = "";
      for (const entry of messagesToRender) {
        const li = document.createElement("li");
        li.className = "chat-item";
        li.innerHTML = `<strong style="color:${entry.color};">${entry.pseudo}</strong>: ${entry.text}`;
        chatMessagesEl.appendChild(li);
      }
      if (state2.chat.open) {
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      }
    }
    function setMessages(messages) {
      state2.chat.messages = (messages || []).map(normalizeChatEntry).filter((message) => message.text.length > 0).slice(-maxMessages);
      renderMessages();
    }
    function appendMessage(entry) {
      const normalized = normalizeChatEntry(entry);
      if (!normalized.text) return;
      state2.chat.messages.push(normalized);
      if (state2.chat.messages.length > maxMessages) {
        state2.chat.messages = state2.chat.messages.slice(-maxMessages);
      }
      renderMessages();
    }
    function setTypingStatus(active) {
      const myId = typeof getMyId === "function" ? getMyId() : state2.myId;
      if (!myId || state2.chat.typingSent === active) return;
      if (typeof onLocalTypingChanged === "function") {
        onLocalTypingChanged(active);
      }
      state2.chat.typingSent = active;
      if (typeof emitTyping === "function") {
        emitTyping(Boolean(active));
      }
    }
    function setOpen(open, focusInput = true) {
      const next = Boolean(open);
      if (state2.chat.open === next) return;
      state2.chat.open = next;
      if (chatDockEl) {
        chatDockEl.classList.toggle("open", next);
      }
      if (chatFormEl) {
        chatFormEl.classList.toggle("hidden", !next);
      }
      renderMessages();
      if (next) {
        if (typeof onOpen === "function") {
          onOpen();
        }
        setTypingStatus(true);
        if (focusInput && chatInputEl) {
          chatInputEl.focus();
        }
        return;
      }
      if (typeof onClose === "function") {
        onClose();
      }
      setTypingStatus(false);
      if (chatInputEl) {
        chatInputEl.blur();
      }
    }
    function toggleOpen() {
      setOpen(!state2.chat.open);
    }
    return {
      setMessages,
      appendMessage,
      renderMessages,
      setTypingStatus,
      setOpen,
      toggleOpen
    };
  }

  // src/client/modules/hud/createHudModule.js
  function createHudModule(options = {}) {
    const { rootEl } = options;
    function show() {
      if (!rootEl) return;
      rootEl.classList.remove("hidden");
    }
    function hide() {
      if (!rootEl) return;
      rootEl.classList.add("hidden");
    }
    function setText(el, text) {
      if (!el) return;
      el.textContent = String(text);
    }
    return {
      show,
      hide,
      setText
    };
  }

  // src/client/modules/lobby/createIdentityModule.js
  function createIdentityModule(options) {
    const {
      state: state2,
      avatarOptionEls,
      colorPickerEl,
      normalizeAvatarIndex: normalizeAvatarIndex2,
      normalizeColorIndex: normalizeColorIndex2,
      playerColors,
      avatarStorageKey = "avatar",
      colorStorageKey = "colorIndex"
    } = options;
    function updateAvatarSelectionUI() {
      for (const option of avatarOptionEls || []) {
        const avatar = normalizeAvatarIndex2(option.dataset.avatar);
        const selected = avatar === state2.myAvatar;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-checked", selected ? "true" : "false");
      }
    }
    function setMyAvatar(value, persist = true) {
      state2.myAvatar = normalizeAvatarIndex2(value);
      updateAvatarSelectionUI();
      if (persist) {
        localStorage.setItem(avatarStorageKey, String(state2.myAvatar));
      }
    }
    function updateColorSelectionUI() {
      if (!colorPickerEl) return;
      const options2 = Array.from(colorPickerEl.querySelectorAll(".color-option"));
      for (const option of options2) {
        const idxValue = normalizeColorIndex2(option.dataset.colorIndex);
        const selected = idxValue === state2.myColorIndex;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-checked", selected ? "true" : "false");
      }
    }
    function setMyColorIndex(value, persist = true) {
      state2.myColorIndex = normalizeColorIndex2(value);
      updateColorSelectionUI();
      if (persist) {
        localStorage.setItem(colorStorageKey, String(state2.myColorIndex));
      }
    }
    function setupColorPicker() {
      if (!colorPickerEl) return;
      colorPickerEl.innerHTML = "";
      for (let i = 0; i < playerColors.length; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "color-option";
        btn.dataset.colorIndex = String(i);
        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", "false");
        btn.title = `Couleur ${i + 1}`;
        btn.style.setProperty("--swatch-color", playerColors[i]);
        btn.addEventListener("click", () => setMyColorIndex(i));
        colorPickerEl.appendChild(btn);
      }
      updateColorSelectionUI();
    }
    function setupAvatarPicker() {
      for (const option of avatarOptionEls || []) {
        option.addEventListener("click", () => {
          setMyAvatar(option.dataset.avatar);
        });
      }
      updateAvatarSelectionUI();
    }
    function drawAvatarPickerPreview({
      now,
      sprites: sprites2,
      animIdleMs,
      frameSize,
      frameCols,
      fallbackColor = null
    }) {
      const idleCol = Math.floor(now / animIdleMs) % frameCols;
      for (const option of avatarOptionEls || []) {
        const canvasEl = option.querySelector(".avatar-preview");
        if (!canvasEl) continue;
        const avatar = normalizeAvatarIndex2(option.dataset.avatar);
        const image = sprites2[avatar];
        const pctx = canvasEl.getContext("2d");
        pctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
        pctx.imageSmoothingEnabled = false;
        if (image && image.loaded) {
          pctx.drawImage(
            image,
            idleCol * frameSize,
            0,
            frameSize,
            frameSize,
            0,
            0,
            canvasEl.width,
            canvasEl.height
          );
          continue;
        }
        if (fallbackColor) {
          pctx.fillStyle = fallbackColor;
          pctx.fillRect(10, 10, canvasEl.width - 20, canvasEl.height - 20);
        }
      }
    }
    return {
      updateAvatarSelectionUI,
      setMyAvatar,
      updateColorSelectionUI,
      setMyColorIndex,
      setupColorPicker,
      setupAvatarPicker,
      drawAvatarPickerPreview
    };
  }

  // src/client/modules/network/registerCommonSocketLifecycle.js
  function registerCommonSocketLifecycle(options) {
    const {
      socket,
      events,
      state: state2,
      onConnect,
      onDisconnect,
      onJoinError,
      onState,
      onPlayerJoined,
      onPlayerLeft,
      onChatMessage,
      onChatTyping,
      stateEvents = []
    } = options;
    socket.on("connect", () => {
      if (state2?.chat) {
        state2.chat.typingSent = false;
      }
      if (typeof onConnect === "function") {
        onConnect();
      }
    });
    socket.on("disconnect", () => {
      if (state2?.chat) {
        state2.chat.typingSent = false;
      }
      if (typeof onDisconnect === "function") {
        onDisconnect();
      }
    });
    if (events?.joinError && typeof onJoinError === "function") {
      socket.on(events.joinError, (payload = {}) => onJoinError(payload));
    }
    const uniqueStateEvents = Array.from(new Set([events?.state, ...stateEvents || []].filter(Boolean)));
    if (typeof onState === "function") {
      for (const eventName of uniqueStateEvents) {
        socket.on(eventName, (payload = {}) => onState(payload));
      }
    }
    if (events?.playerJoined && typeof onPlayerJoined === "function") {
      socket.on(events.playerJoined, (payload = {}) => onPlayerJoined(payload));
    }
    if (events?.playerLeft && typeof onPlayerLeft === "function") {
      socket.on(events.playerLeft, (payload = {}) => onPlayerLeft(payload));
    }
    if (events?.chatMessage && typeof onChatMessage === "function") {
      socket.on(events.chatMessage, (payload = {}) => onChatMessage(payload));
    }
    if (events?.chatTyping && typeof onChatTyping === "function") {
      socket.on(events.chatTyping, (payload = {}) => onChatTyping(payload));
    }
  }

  // src/client/modules/camera/followCamera.js
  function getCameraViewport(camera, canvas) {
    return {
      viewW: canvas.width / camera.scale,
      viewH: canvas.height / camera.scale
    };
  }
  function getCameraTarget({ focusX, focusY, tileSize, viewW, viewH }) {
    return {
      targetX: focusX * tileSize + tileSize * 0.5 - viewW * 0.5,
      targetY: focusY * tileSize + tileSize * 0.5 - viewH * 0.5
    };
  }
  function clampCameraToWorld({ camera, canvas, worldW, worldH }) {
    const { viewW, viewH } = getCameraViewport(camera, canvas);
    camera.x = Math.max(0, Math.min(camera.x, Math.max(0, worldW - viewW)));
    camera.y = Math.max(0, Math.min(camera.y, Math.max(0, worldH - viewH)));
  }
  function centerCameraOnFocus({
    camera,
    canvas,
    tileSize,
    focusX,
    focusY,
    immediate = false,
    smoothing = 0.05
  }) {
    const { viewW, viewH } = getCameraViewport(camera, canvas);
    const { targetX, targetY } = getCameraTarget({ focusX, focusY, tileSize, viewW, viewH });
    if (immediate) {
      camera.x = targetX;
      camera.y = targetY;
      return;
    }
    camera.x += (targetX - camera.x) * smoothing;
    camera.y += (targetY - camera.y) * smoothing;
  }

  // src/client/modules/input/holdMove.js
  function registerHoldMoveKey({
    holdControls,
    code,
    dx,
    dy,
    enqueueMove,
    holdDelayMs,
    moveCooldownMs
  }) {
    if (holdControls.has(code)) return;
    enqueueMove(dx, dy);
    const hold = {
      interval: null,
      timeout: setTimeout(() => {
        hold.interval = setInterval(() => enqueueMove(dx, dy), moveCooldownMs);
      }, holdDelayMs)
    };
    holdControls.set(code, hold);
  }
  function clearHoldMoveKey(holdControls, code) {
    const hold = holdControls.get(code);
    if (!hold) return;
    clearTimeout(hold.timeout);
    if (hold.interval) {
      clearInterval(hold.interval);
    }
    holdControls.delete(code);
  }
  function clearAllHoldMoveKeys(holdControls) {
    for (const code of holdControls.keys()) {
      clearHoldMoveKey(holdControls, code);
    }
  }

  // src/client/modules/player/spriteUtils.js
  var IDLE_ROWS = { down: 0, right: 1, left: 2, up: 3 };
  var RUN_ROWS = {
    down: [5, 6],
    left: [7, 8],
    right: [9, 10],
    up: [11, 12]
  };
  function spriteDirection(dx, dy, previous = "down") {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? "left" : "right";
    }
    if (dy < 0) return "up";
    if (dy > 0) return "down";
    return previous;
  }
  function getSpriteFrame(player, now, opts = {}) {
    const {
      animIdleMs = 220,
      animRunMs = 85,
      cols = 4,
      walkWindowMs = 240
    } = opts;
    const moving = now - player.lastMoveAt <= walkWindowMs;
    if (!moving) {
      return {
        row: IDLE_ROWS[player.dir] ?? 0,
        col: Math.floor(now / animIdleMs) % cols
      };
    }
    const rows = RUN_ROWS[player.dir] || RUN_ROWS.down;
    const frame = Math.floor(now / animRunMs) % 8;
    return {
      row: rows[Math.floor(frame / 4)],
      col: frame % 4
    };
  }

  // src/client/modules/bootstrap/createModeBootstrap.js
  function createModeBootstrap(config) {
    const {
      state: state2,
      events,
      sprites: sprites2,
      tileSize,
      minScale = 0.3,
      maxScale = 2,
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
      extraSocketSetup
    } = config;
    if (!state2.camera) {
      state2.camera = { x: 0, y: 0, scale: 1, isManual: false, dragging: false, dragLastX: 0, dragLastY: 0 };
    }
    if (!state2.chat) {
      state2.chat = { open: false, typingSent: false, messages: [] };
    }
    if (!state2.players) {
      state2.players = /* @__PURE__ */ new Map();
    }
    if (state2.phase === void 0) state2.phase = "lobby";
    if (state2.myId === void 0) state2.myId = null;
    if (state2.myPseudo === void 0) state2.myPseudo = null;
    if (state2.myAvatar === void 0) state2.myAvatar = 0;
    if (state2.myColorIndex === void 0) state2.myColorIndex = 0;
    if (state2.hasJoinedOnce === void 0) state2.hasJoinedOnce = false;
    if (state2.loopStarted === void 0) state2.loopStarted = false;
    if (state2.startTime === void 0) state2.startTime = null;
    if (hasPositionMove) {
      if (!state2.me) state2.me = { x: 0, y: 0 };
      if (!state2.moveQueue) state2.moveQueue = [];
      if (state2.lastMoveAt === void 0) state2.lastMoveAt = 0;
      if (!state2.holdControls) state2.holdControls = /* @__PURE__ */ new Map();
    }
    const lobbyIdFromQuery = (() => {
      const raw = new URLSearchParams(window.location.search).get("lobby");
      const v = String(raw || "").trim().toLowerCase();
      return v || null;
    })();
    const canvas = document.getElementById("gameCanvas");
    const ctx = canvas.getContext("2d");
    const els = {
      lobby: document.getElementById("lobby"),
      joinForm: document.getElementById("joinForm"),
      pseudoInput: document.getElementById("pseudoInput"),
      joinError: document.getElementById("joinError"),
      reconnect: document.getElementById("reconnect"),
      hud: document.getElementById("hud"),
      avatarOptions: Array.from(document.querySelectorAll(".avatar-option")),
      colorPicker: document.getElementById("colorPicker"),
      chatDock: document.getElementById("chatDock"),
      chatToggleBtn: document.getElementById("chatToggleBtn"),
      chatMessages: document.getElementById("chatMessages"),
      chatForm: document.getElementById("chatForm"),
      chatInput: document.getElementById("chatInput")
    };
    const socket = io();
    const identityModule = createIdentityModule({
      state: state2,
      avatarOptionEls: els.avatarOptions,
      colorPickerEl: els.colorPicker,
      normalizeAvatarIndex,
      normalizeColorIndex,
      playerColors: PLAYER_COLORS
    });
    function clearAllHoldMoves() {
      if (hasPositionMove) clearAllHoldMoveKeys(state2.holdControls);
    }
    const chatModule = createChatModule({
      state: state2,
      chatDockEl: els.chatDock,
      chatFormEl: els.chatForm,
      chatMessagesEl: els.chatMessages,
      chatInputEl: els.chatInput,
      resolveColorForPseudo: colorForPseudo,
      emitTyping: (active) => socket.emit(events.chatTyping, { active }),
      maxMessages: CHAT_MAX_MESSAGES,
      closedVisibleMessages: CHAT_CLOSED_VISIBLE_MESSAGES,
      getMyId: () => state2.myId,
      onOpen: () => {
        clearAllHoldMoves();
        if (hasPositionMove) state2.moveQueue = [];
        state2.camera.dragging = false;
      },
      onLocalTypingChanged: (active) => {
        const me = state2.players.get(state2.myId);
        if (me) me.isTyping = active;
      }
    });
    const hudModule = createHudModule({ rootEl: els.hud });
    function clampCamera() {
      const world = getWorldSize();
      clampCameraToWorld({ camera: state2.camera, canvas, worldW: world.w, worldH: world.h });
    }
    function centerCameraOnMe(immediate = false) {
      const focus = getFocusPosition();
      centerCameraOnFocus({
        camera: state2.camera,
        canvas,
        tileSize,
        focusX: focus.x,
        focusY: focus.y,
        immediate,
        smoothing: cameraSmoothing
      });
      clampCamera();
    }
    function updateCamera() {
      if (state2.phase === "lobby") return;
      if (state2.camera.dragging) {
        clampCamera();
        return;
      }
      if (cameraSnapThreshold !== null && hasPositionMove) {
        const focus = getFocusPosition();
        const { viewW, viewH } = getCameraViewport(state2.camera, canvas);
        const { targetX, targetY } = getCameraTarget({
          focusX: focus.x,
          focusY: focus.y,
          tileSize,
          viewW,
          viewH
        });
        if (!state2.camera.isManual) {
          state2.camera.x = targetX;
          state2.camera.y = targetY;
        } else {
          const px = focus.x * tileSize + tileSize * 0.5;
          const py = focus.y * tileSize + tileSize * 0.5;
          const dist = Math.max(
            Math.abs(state2.camera.x + viewW * 0.5 - px) / tileSize,
            Math.abs(state2.camera.y + viewH * 0.5 - py) / tileSize
          );
          if (dist > cameraSnapThreshold) {
            state2.camera.x = targetX;
            state2.camera.y = targetY;
          } else {
            state2.camera.x += (targetX - state2.camera.x) * cameraSmoothing;
            state2.camera.y += (targetY - state2.camera.y) * cameraSmoothing;
          }
        }
        clampCamera();
      } else {
        centerCameraOnMe(false);
      }
    }
    function enqueueMove(dx, dy) {
      if (!hasPositionMove) return;
      state2.moveQueue.push({ dx, dy });
    }
    function processInputQueue() {
      if (!hasPositionMove) return;
      if (state2.phase !== "playing" || state2.chat.open || state2.moveQueue.length === 0) return;
      const now = Date.now();
      if (now - state2.lastMoveAt < moveCooldownMs) return;
      const action = state2.moveQueue.shift();
      if (!action) return;
      const nx = state2.me.x + action.dx;
      const ny = state2.me.y + action.dy;
      const world = getWorldSize();
      if (nx < 0 || nx >= Math.round(world.w / tileSize) || ny < 0 || ny >= Math.round(world.h / tileSize)) return;
      state2.me.x = nx;
      state2.me.y = ny;
      const me = state2.players.get(state2.myId);
      if (me) {
        me.dir = spriteDirection(action.dx, action.dy, me.dir);
        me.lastMoveAt = now;
        me.x = nx;
        me.y = ny;
      }
      state2.lastMoveAt = now;
      socket.emit(events.move, { x: nx, y: ny });
    }
    function updateLocalPlayerFromServerMove(id, x, y) {
      const player = state2.players.get(id);
      if (!player) return;
      if (player.x !== x || player.y !== y) {
        player.dir = spriteDirection(x - player.x, y - player.y, player.dir);
        player.lastMoveAt = Date.now();
      }
      player.x = x;
      player.y = y;
      if (id === state2.myId) {
        state2.me.x = x;
        state2.me.y = y;
      }
    }
    function registerHoldMove(code, dx, dy) {
      registerHoldMoveKey({
        holdControls: state2.holdControls,
        code,
        dx,
        dy,
        enqueueMove,
        holdDelayMs,
        moveCooldownMs
      });
    }
    els.joinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pseudo = String(els.pseudoInput.value || "").trim();
      if (!pseudo) {
        els.joinError.textContent = "Entre un pseudo.";
        return;
      }
      state2.myPseudo = pseudo;
      state2.hasJoinedOnce = true;
      localStorage.setItem("pseudo", pseudo);
      els.joinError.textContent = "";
      const payload = {
        pseudo,
        avatar: state2.myAvatar,
        colorIndex: state2.myColorIndex,
        lobbyId: lobbyIdFromQuery
      };
      if (typeof onJoinPayload === "function") Object.assign(payload, onJoinPayload());
      socket.emit(events.join, payload);
    });
    els.chatToggleBtn?.addEventListener("click", () => chatModule.toggleOpen());
    els.chatForm?.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!state2.myId) return;
      const text = String(els.chatInput?.value || "").replace(/\s+/g, " ").trim();
      if (!text) return;
      socket.emit(events.chatSend, { text });
      if (els.chatInput) {
        els.chatInput.value = "";
        els.chatInput.focus();
      }
      if (state2.chat.open) chatModule.setTypingStatus(true);
    });
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("blur", () => {
      clearAllHoldMoves();
      if (typeof onWindowBlur === "function") onWindowBlur();
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("mousedown", (e) => {
      if (state2.chat.open) return;
      if (e.button === 1) {
        state2.camera.dragging = true;
        state2.camera.isManual = true;
        state2.camera.dragLastX = e.clientX;
        state2.camera.dragLastY = e.clientY;
        return;
      }
      if (typeof onMousedown === "function") onMousedown(e);
    });
    window.addEventListener("mouseup", () => {
      state2.camera.dragging = false;
    });
    window.addEventListener("mousemove", (e) => {
      if (!state2.camera.dragging) return;
      state2.camera.x -= (e.clientX - state2.camera.dragLastX) / state2.camera.scale;
      state2.camera.y -= (e.clientY - state2.camera.dragLastY) / state2.camera.scale;
      state2.camera.dragLastX = e.clientX;
      state2.camera.dragLastY = e.clientY;
      clampCamera();
    });
    canvas.addEventListener("wheel", (e) => {
      if (state2.chat.open) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const worldX = state2.camera.x + sx / state2.camera.scale;
      const worldY = state2.camera.y + sy / state2.camera.scale;
      const delta = e.deltaY < 0 ? 1.12 : 0.88;
      const next = clamp(state2.camera.scale * delta, minScale, maxScale);
      state2.camera.scale = next;
      state2.camera.x = worldX - sx / next;
      state2.camera.y = worldY - sy / next;
      state2.camera.isManual = true;
      clampCamera();
    }, { passive: false });
    window.addEventListener("keydown", (e) => {
      if (e.code === "Tab") {
        e.preventDefault();
        chatModule.toggleOpen();
        return;
      }
      if (state2.chat.open) {
        if (e.code === "Escape") {
          e.preventDefault();
          chatModule.setOpen(false, false);
          return;
        }
        if (e.code === "Enter" && document.activeElement !== els.chatInput) {
          e.preventDefault();
          els.chatInput?.focus();
        }
        return;
      }
      if (typeof onKeydown === "function") {
        const handled = onKeydown(e);
        if (handled) return;
      }
      if (hasPositionMove) {
        const delta = MOVE_KEY_DELTAS[e.code];
        if (delta) registerHoldMove(e.code, delta[0], delta[1]);
      }
    });
    window.addEventListener("keyup", (e) => {
      if (hasPositionMove) clearHoldMoveKey(state2.holdControls, e.code);
    });
    function emitJoin() {
      const payload = {
        pseudo: state2.myPseudo,
        avatar: state2.myAvatar,
        colorIndex: state2.myColorIndex,
        lobbyId: lobbyIdFromQuery
      };
      if (typeof onJoinPayload === "function") Object.assign(payload, onJoinPayload());
      socket.emit(events.join, payload);
    }
    registerCommonSocketLifecycle({
      socket,
      events,
      state: state2,
      stateEvents,
      onConnect: () => {
        state2.myId = socket.id;
        els.reconnect.classList.add("hidden");
        if (state2.hasJoinedOnce && state2.myPseudo) emitJoin();
      },
      onDisconnect: () => {
        clearAllHoldMoves();
        if (state2.hasJoinedOnce) els.reconnect.classList.remove("hidden");
      },
      onJoinError: (payload = {}) => {
        state2.phase = "lobby";
        clearAllHoldMoves();
        if (hasPositionMove) state2.moveQueue = [];
        state2.camera.dragging = false;
        chatModule.setOpen(false, false);
        hudModule.hide();
        els.reconnect.classList.add("hidden");
        els.lobby.classList.remove("hidden");
        els.joinError.textContent = payload.message || "Impossible de rejoindre.";
        if (typeof onModeJoinError === "function") {
          onModeJoinError(payload);
        }
      },
      onState: (payload) => {
        if (typeof onApplyState === "function") onApplyState(payload);
      },
      onPlayerJoined: (payload) => {
        if (typeof onPlayerJoined === "function") onPlayerJoined(payload);
      },
      onPlayerLeft: (payload) => {
        if (typeof onPlayerLeft === "function") onPlayerLeft(payload);
        else state2.players.delete(payload.id);
      },
      onChatMessage: (entry) => chatModule.appendMessage(entry),
      onChatTyping: (payload = {}) => {
        const player = state2.players.get(payload.id);
        if (player) player.isTyping = Boolean(payload.active);
      }
    });
    if (hasPositionMove && events.playerMoved) {
      socket.on(events.playerMoved, (payload) => {
        updateLocalPlayerFromServerMove(payload.id, payload.x, payload.y);
      });
    }
    if (typeof extraSocketSetup === "function") {
      extraSocketSetup(socket);
    }
    const rememberedPseudo = localStorage.getItem("pseudo");
    if (rememberedPseudo) els.pseudoInput.value = rememberedPseudo;
    identityModule.setupAvatarPicker();
    identityModule.setupColorPicker();
    const savedAvatar = localStorage.getItem("avatar");
    if (savedAvatar !== null) identityModule.setMyAvatar(savedAvatar, false);
    const savedColor = localStorage.getItem("colorIndex");
    if (savedColor !== null) identityModule.setMyColorIndex(savedColor, false);
    chatModule.setMessages([]);
    chatModule.setOpen(false, false);
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
      if (els.lobby.classList.contains("hidden")) return;
      identityModule.drawAvatarPickerPreview({
        now,
        sprites: sprites2,
        animIdleMs,
        frameSize: animalFrame,
        frameCols: animalCols,
        fallbackColor: "#d7e3ff"
      });
    }
    function startGameLoop() {
      if (state2.loopStarted) return;
      state2.loopStarted = true;
      function tick() {
        updateCamera();
        processInputQueue();
        if (typeof onRender === "function") onRender(Date.now());
        drawAvatarPickerPreview(Date.now());
        if (typeof onUpdateHud === "function") onUpdateHud();
        requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    resizeCanvas();
    if (typeof onInit === "function") onInit();
    startGameLoop();
    return {
      state: state2,
      socket,
      canvas,
      ctx,
      els,
      sprites: sprites2,
      lobbyIdFromQuery,
      chatModule,
      identityModule,
      hudModule,
      centerCameraOnMe,
      clampCamera,
      clearAllHoldMoves,
      enqueueMove,
      updateLocalPlayerFromServerMove
    };
  }

  // src/client/modules/player/drawLabels.js
  function drawPlayerLabels(ctx, labels) {
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const label of labels) {
      if (label.isTyping) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000000";
        ctx.strokeText("ecrit...", label.x, label.y - 12);
        ctx.fillStyle = "#ffd28f";
        ctx.fillText("ecrit...", label.x, label.y - 12);
      }
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#000000";
      ctx.strokeText(label.text, label.x, label.y);
      ctx.fillStyle = label.color || "#ffffff";
      ctx.fillText(label.text, label.x, label.y);
    }
  }

  // src/client/modes/mines/index.js
  var GRID_W = 70;
  var GRID_H = 70;
  var TOTAL_CELLS = GRID_W * GRID_H;
  var TILE_SIZE = 32;
  var ANIM_IDLE_MS = 220;
  var ANIM_RUN_MS = 85;
  var ANIMAL_FRAME = 32;
  var ANIMAL_COLS = 4;
  var WALK_WINDOW_MS = 240;
  var DIG_FRAME_MS = 60;
  var DIG_FRAMES = 4;
  var DIG_LOOPS = 2;
  var EXPLOSION_FRAME_W = 64;
  var EXPLOSION_FRAME_H = 64;
  var EXPLOSION_FRAME_MS = 75;
  var EXPLOSION_FRAMES = 5;
  var EXPLOSION_DRAW_SIZE = 40;
  var BOMB_SRC_X = 136;
  var BOMB_SRC_Y = 82;
  var BOMB_SRC_W = 326;
  var BOMB_SRC_H = 406;
  var BOMB_DRAW_W = 20;
  var BOMB_DRAW_H = 24;
  var TRANSITION_EDGE_HALF = 6;
  var TRANSITION_CORNER_QUAD = 12;
  var TRANSITION_CORNER_DRAW = 12;
  var TRANSITION_CORNER_SHIFT = 6;
  var NUMBER_COLORS = {
    1: "#4488ff",
    2: "#44ff88",
    3: "#ff4444",
    4: "#8844ff",
    5: "#ff8844",
    6: "#44ffff",
    7: "#ffffff",
    8: "#ff44ff"
  };
  var sprites = [
    loadImage("/assets/BIRDSPRITESHEET_Blue.png"),
    loadImage("/assets/BIRDSPRITESHEET_White.png"),
    loadImage("/assets/CATSPRITESHEET_Gray.png"),
    loadImage("/assets/CATSPRITESHEET_Orange.png"),
    loadImage("/assets/FOXSPRITESHEET.png"),
    loadImage("/assets/RACCOONSPRITESHEET.png")
  ];
  var assets = {
    tiles: {
      grass: loadImage("/assets/herbe.png"),
      dirt: loadImage("/assets/terre.png")
    },
    transitions: {
      edge: {
        herbe_droite_terre_gauche: loadImage("/assets/herbe_droite_terre_gauche.png"),
        herbe_gauche_terre_droite: loadImage("/assets/herbe_gauche_terre_droite.png"),
        herbe_haut_terre_bas: loadImage("/assets/herbe_haut_terre_bas.png"),
        herbe_bas_terre_haut: loadImage("/assets/herbe_bas_terre_haut.png")
      },
      corner: {
        herbe_coin_haut_gauche: loadImage("/assets/herbe_coin_haut_gauche.png"),
        herbe_coin_haut_droite: loadImage("/assets/herbe_coin_haut_droite.png"),
        herbe_coin_bas_gauche: loadImage("/assets/herbe_coin_bas_gauche.png"),
        herbe_coin_bas_droite: loadImage("/assets/herbe_coin_bas_droite.png"),
        terre_coin_haut_gauche: loadImage("/assets/terre_coin_haut_gauche.png"),
        terre_coin_haut_droite: loadImage("/assets/terre_coin_haut_droite.png"),
        terre_coin_bas_gauche: loadImage("/assets/terre_coin_bas_gauche.png"),
        terre_coin_bas_droite: loadImage("/assets/terre_coin_bas_droite.png")
      }
    },
    shovels: [
      loadImage("/assets/shovel_bird_blue.png"),
      loadImage("/assets/shovel_bird_white.png"),
      loadImage("/assets/shovel_cat_gray.png"),
      loadImage("/assets/shovel_cat_orange.png"),
      loadImage("/assets/shovel_fox.png"),
      loadImage("/assets/shovel_racoon.png")
    ],
    fx: {
      bomb: loadImage("/assets/bomb.png"),
      explosion: loadImage("/assets/explosion.png")
    }
  };
  var state = {
    map: {
      width: GRID_W,
      height: GRID_H,
      totalCells: TOTAL_CELLS,
      bombCount: 0,
      zoneCenters: [],
      bombs: new Uint8Array(TOTAL_CELLS),
      numbers: new Int8Array(TOTAL_CELLS),
      startZone: new Uint8Array(TOTAL_CELLS),
      safeZone: new Uint8Array(TOTAL_CELLS)
    },
    grid: new Int8Array(TOTAL_CELLS),
    flags: /* @__PURE__ */ new Map(),
    revealedSafeCount: 0,
    explosions: 0,
    maxExplosions: 10,
    activeExplosions: [],
    activeDigs: /* @__PURE__ */ new Map(),
    explodedCells: /* @__PURE__ */ new Set(),
    statsCountdown: 60,
    statsCountdownTimer: null
  };
  state.grid.fill(-2);
  var statsOverlayEl = document.getElementById("statsOverlay");
  var statsTitleEl = document.getElementById("statsTitle");
  var statsDurationEl = document.getElementById("statsDuration");
  var statsMiniMapEl = document.getElementById("statsMiniMap");
  var statsTableBodyEl = document.getElementById("statsTableBody");
  var explosionListEl = document.getElementById("explosionList");
  var statsCountdownEl = document.getElementById("statsCountdown");
  var hudBombsEl = document.getElementById("hudBombs");
  var hudTimeEl = document.getElementById("hudTime");
  var hudPlayersEl = document.getElementById("hudPlayers");
  var hudFlagsEl = document.getElementById("hudFlags");
  var hudRevealedEl = document.getElementById("hudRevealed");
  function idx(x, y) {
    return y * GRID_W + x;
  }
  function playerSheet(player) {
    if (Number.isInteger(player.avatar)) return sprites[normalizeAvatarIndex(player.avatar)];
    return sprites[hashPseudo(player.pseudo) % sprites.length];
  }
  function shovelSheet(player) {
    if (Number.isInteger(player.avatar)) return assets.shovels[normalizeAvatarIndex(player.avatar)] || null;
    return assets.shovels[hashPseudo(player.pseudo) % assets.shovels.length] || null;
  }
  function playerHasDigAnim(player) {
    const s = shovelSheet(player);
    return Boolean(s && s.loaded);
  }
  function getDigFrame(playerId, now) {
    const startedAt = state.activeDigs.get(playerId);
    if (!startedAt) return null;
    const elapsed = now - startedAt;
    const fi = Math.floor(elapsed / DIG_FRAME_MS);
    if (fi >= DIG_FRAMES * DIG_LOOPS) {
      state.activeDigs.delete(playerId);
      return null;
    }
    return fi % DIG_FRAMES;
  }
  function tileSheetInfo(image) {
    const cols = image.loaded ? Math.max(1, Math.floor(image.width / TILE_SIZE)) : 3;
    return { cols };
  }
  function drawSheetTile(ctx, image, col, row, dx, dy) {
    if (!image.loaded) return false;
    ctx.drawImage(image, col * TILE_SIZE, row * TILE_SIZE, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE);
    return true;
  }
  function getBorderTile(variantCols, x, y) {
    const last = variantCols - 1;
    const mA = variantCols > 3 ? 1 : Math.min(1, last);
    const mB = variantCols > 3 ? last - 1 : Math.max(0, last - 1);
    const onL = x === 0, onR = x === GRID_W - 1, onT = y === 0, onB = y === GRID_H - 1;
    if (onT && onL) return { col: 0, row: 0 };
    if (onT && onR) return { col: last, row: 0 };
    if (onB && onL) return { col: 0, row: last };
    if (onB && onR) return { col: last, row: last };
    if (onT) return { col: x % 2 === 0 ? mA : mB, row: 0 };
    if (onB) return { col: x % 2 === 0 ? mA : mB, row: last };
    if (onL) return { col: 0, row: y % 2 === 0 ? mA : mB };
    if (onR) return { col: last, row: y % 2 === 0 ? mA : mB };
    return { col: mA, row: mA };
  }
  function drawCell(ctx, x, y) {
    const i = idx(x, y);
    const px = x * TILE_SIZE, py = y * TILE_SIZE;
    const hidden = state.grid[i] === -2;
    if (hidden) {
      const { cols } = tileSheetInfo(assets.tiles.grass);
      const t = getBorderTile(cols, x, y);
      if (!drawSheetTile(ctx, assets.tiles.grass, t.col, t.row, px, py)) {
        ctx.fillStyle = "#7db24f";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    } else {
      const { cols } = tileSheetInfo(assets.tiles.dirt);
      const t = getBorderTile(cols, x, y);
      if (!drawSheetTile(ctx, assets.tiles.dirt, t.col, t.row, px, py)) {
        ctx.fillStyle = "#8b5a34";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
    if (state.map.startZone[i] === 1 && hidden) {
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
    }
  }
  function cellIsGrass(x, y) {
    return state.grid[idx(x, y)] === -2;
  }
  function isBorderCell(x, y) {
    return x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1;
  }
  function drawVerticalTransition(ctx, x, y, leftGrass) {
    const image = leftGrass ? assets.transitions.edge.herbe_gauche_terre_droite : assets.transitions.edge.herbe_droite_terre_gauche;
    if (!image.loaded) return;
    const px = x * TILE_SIZE, py = y * TILE_SIZE;
    ctx.drawImage(image, 0, 0, TRANSITION_EDGE_HALF, TILE_SIZE, px + TILE_SIZE - TRANSITION_EDGE_HALF, py, TRANSITION_EDGE_HALF, TILE_SIZE);
    ctx.drawImage(image, TRANSITION_EDGE_HALF, 0, TRANSITION_EDGE_HALF, TILE_SIZE, px + TILE_SIZE, py, TRANSITION_EDGE_HALF, TILE_SIZE);
  }
  function drawHorizontalTransition(ctx, x, y, topGrass) {
    const image = topGrass ? assets.transitions.edge.herbe_haut_terre_bas : assets.transitions.edge.herbe_bas_terre_haut;
    if (!image.loaded) return;
    const px = x * TILE_SIZE, py = y * TILE_SIZE;
    ctx.drawImage(image, 0, 0, TILE_SIZE, TRANSITION_EDGE_HALF, px, py + TILE_SIZE - TRANSITION_EDGE_HALF, TILE_SIZE, TRANSITION_EDGE_HALF);
    ctx.drawImage(image, 0, TRANSITION_EDGE_HALF, TILE_SIZE, TRANSITION_EDGE_HALF, px, py + TILE_SIZE, TILE_SIZE, TRANSITION_EDGE_HALF);
  }
  function drawCornerTransition(ctx, image, x, y, shiftX, shiftY) {
    if (!image || !image.loaded) return;
    const px = x * TILE_SIZE, py = y * TILE_SIZE;
    const src = TRANSITION_CORNER_QUAD, draw = TRANSITION_CORNER_DRAW;
    const ox = px + TILE_SIZE - draw + shiftX, oy = py + TILE_SIZE - draw + shiftY;
    ctx.drawImage(image, 0, 0, src, src, ox, oy, draw, draw);
    ctx.drawImage(image, src, 0, src, src, ox + draw, oy, draw, draw);
    ctx.drawImage(image, 0, src, src, src, ox, oy + draw, draw, draw);
    ctx.drawImage(image, src, src, src, src, ox + draw, oy + draw, draw, draw);
  }
  function pickCornerTransition(tl, tr, bl, br) {
    const gc = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
    if (gc !== 1 && gc !== 3) return null;
    const s = TRANSITION_CORNER_SHIFT;
    if (gc === 1) {
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
  function drawTransitions(ctx, minX, maxX, minY, maxY) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        if (isBorderCell(x, y) || isBorderCell(x + 1, y)) continue;
        const lg = cellIsGrass(x, y), rg = cellIsGrass(x + 1, y);
        if (lg !== rg) drawVerticalTransition(ctx, x, y, lg);
      }
    }
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (isBorderCell(x, y) || isBorderCell(x, y + 1)) continue;
        const tg = cellIsGrass(x, y), bg = cellIsGrass(x, y + 1);
        if (tg !== bg) drawHorizontalTransition(ctx, x, y, tg);
      }
    }
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        if (isBorderCell(x, y) || isBorderCell(x + 1, y) || isBorderCell(x, y + 1) || isBorderCell(x + 1, y + 1)) continue;
        const corner = pickCornerTransition(cellIsGrass(x, y), cellIsGrass(x + 1, y), cellIsGrass(x, y + 1), cellIsGrass(x + 1, y + 1));
        if (corner) drawCornerTransition(ctx, corner.image, x, y, corner.shiftX, corner.shiftY);
      }
    }
  }
  function drawFlags(ctx, minX, maxX, minY, maxY) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = idx(x, y);
        if (!state.flags.has(i) || state.grid[i] !== -2) continue;
        const px = x * TILE_SIZE, py = y * TILE_SIZE;
        ctx.beginPath();
        ctx.moveTo(px + 12, py + 7);
        ctx.lineTo(px + 12, py + 24);
        ctx.stroke();
        ctx.fillStyle = "#ff4b4b";
        ctx.beginPath();
        ctx.moveTo(px + 12, py + 8);
        ctx.lineTo(px + 22, py + 12);
        ctx.lineTo(px + 12, py + 16);
        ctx.closePath();
        ctx.fill();
      }
    }
  }
  function drawNumbers(ctx, minX, maxX, minY, maxY) {
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const v = state.grid[idx(x, y)];
        if (v <= 0) continue;
        ctx.fillStyle = NUMBER_COLORS[v] || "#ffffff";
        ctx.fillText(String(v), x * TILE_SIZE + TILE_SIZE * 0.5, y * TILE_SIZE + TILE_SIZE * 0.52);
      }
    }
  }
  function drawBombs(ctx, minX, maxX, minY, maxY) {
    const inStats = state.phase === "stats";
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const i = idx(x, y);
        const hidden = state.grid[i] === -2;
        if (!(inStats && state.map.bombs[i] === 1 || !hidden && state.grid[i] === -1)) continue;
        const px = x * TILE_SIZE, py = y * TILE_SIZE;
        if (assets.fx.bomb.loaded) {
          ctx.drawImage(
            assets.fx.bomb,
            BOMB_SRC_X,
            BOMB_SRC_Y,
            BOMB_SRC_W,
            BOMB_SRC_H,
            px + (TILE_SIZE - BOMB_DRAW_W) * 0.5,
            py + (TILE_SIZE - BOMB_DRAW_H) * 0.5,
            BOMB_DRAW_W,
            BOMB_DRAW_H
          );
        } else {
          ctx.fillStyle = "#1a1a1a";
          ctx.beginPath();
          ctx.arc(px + 16, py + 16, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  function drawExplosionAtCell(ctx, x, y, frame) {
    if (!assets.fx.explosion.loaded) return;
    const px = x * TILE_SIZE + (TILE_SIZE - EXPLOSION_DRAW_SIZE) * 0.5;
    const py = y * TILE_SIZE + (TILE_SIZE - EXPLOSION_DRAW_SIZE) * 0.5;
    ctx.drawImage(assets.fx.explosion, frame * EXPLOSION_FRAME_W, 0, EXPLOSION_FRAME_W, EXPLOSION_FRAME_H, px, py, EXPLOSION_DRAW_SIZE, EXPLOSION_DRAW_SIZE);
  }
  function bucketExplosions(now) {
    const byCell = /* @__PURE__ */ new Map();
    const alive = [];
    for (const fx of state.activeExplosions) {
      const frame = Math.floor((now - fx.startedAt) / EXPLOSION_FRAME_MS);
      if (frame >= EXPLOSION_FRAMES) continue;
      const key = idx(fx.x, fx.y);
      if (!byCell.has(key)) byCell.set(key, []);
      byCell.get(key).push(frame);
      alive.push(fx);
    }
    state.activeExplosions = alive;
    return byCell;
  }
  function drawPlayer(ctx, player, now) {
    const px = player.x * TILE_SIZE, py = player.y * TILE_SIZE;
    const stunned = player.stunnedUntil && now < player.stunnedUntil;
    ctx.globalAlpha = stunned && Math.floor(now / 250) % 2 === 0 ? 0.35 : 1;
    const sheet = playerSheet(player);
    const digFrame = getDigFrame(player.id, now);
    const digSheet = digFrame !== null ? shovelSheet(player) : null;
    const canDig = digSheet && digSheet.loaded;
    if (canDig) {
      ctx.drawImage(digSheet, digFrame * ANIMAL_FRAME, 0, ANIMAL_FRAME, ANIMAL_FRAME, px, py, TILE_SIZE, TILE_SIZE);
    } else if (sheet.loaded) {
      const frame = getSpriteFrame(player, now, { animIdleMs: ANIM_IDLE_MS, animRunMs: ANIM_RUN_MS, cols: ANIMAL_COLS, walkWindowMs: WALK_WINDOW_MS });
      ctx.drawImage(sheet, frame.col * ANIMAL_FRAME, frame.row * ANIMAL_FRAME, ANIMAL_FRAME, ANIMAL_FRAME, px, py, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = "#ffd86b";
      ctx.fillRect(px + 8, py + 8, 16, 16);
    }
    ctx.globalAlpha = 1;
    return {
      x: px + TILE_SIZE * 0.5,
      y: py - 12,
      text: player.pseudo,
      isTyping: Boolean(player.isTyping),
      color: player.color || colorForPseudo(player.pseudo)
    };
  }
  function applyRevealedCells(cells) {
    for (const c of cells || []) {
      const i = idx(c.x, c.y);
      if (state.grid[i] === -2 && c.value >= 0) state.revealedSafeCount += 1;
      state.grid[i] = c.value;
      state.flags.delete(i);
      if (c.value === -1) state.explodedCells.add(i);
    }
  }
  function applyPlayerPayload(payload) {
    const previous = state.players.get(payload.id);
    let avatar = payload.avatar !== void 0 && payload.avatar !== null ? normalizeAvatarIndex(payload.avatar) : previous && Number.isInteger(previous.avatar) ? previous.avatar : payload.id === state.myId ? state.myAvatar : hashPseudo(payload.pseudo) % sprites.length;
    let colorIndex = payload.colorIndex !== void 0 && payload.colorIndex !== null ? normalizeColorIndex(payload.colorIndex) : previous && Number.isInteger(previous.colorIndex) ? previous.colorIndex : payload.id === state.myId ? state.myColorIndex : hashPseudo(payload.pseudo) % PLAYER_COLORS.length;
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
      dir: previous ? previous.dir : "down",
      lastMoveAt: previous ? previous.lastMoveAt : 0
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
  function clearStatsCountdownTimer() {
    if (!state.statsCountdownTimer) return;
    clearInterval(state.statsCountdownTimer);
    state.statsCountdownTimer = null;
  }
  function hideStatsOverlay() {
    clearStatsCountdownTimer();
    statsOverlayEl.classList.add("hidden");
  }
  function drawStatsMiniMap() {
    const mapCtx = statsMiniMapEl.getContext("2d");
    const cw = statsMiniMapEl.width, ch = statsMiniMapEl.height;
    mapCtx.clearRect(0, 0, cw, ch);
    mapCtx.fillStyle = "#0b0f1c";
    mapCtx.fillRect(0, 0, cw, ch);
    const cell = Math.max(1, Math.floor(Math.min(cw / GRID_W, ch / GRID_H)));
    const ox = Math.floor((cw - GRID_W * cell) / 2), oy = Math.floor((ch - GRID_H * cell) / 2);
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const i = idx(x, y);
        const px = ox + x * cell, py = oy + y * cell;
        if (state.map.bombs[i]) {
          mapCtx.fillStyle = state.explodedCells.has(i) ? "#ff0000" : "#666666";
        } else {
          mapCtx.fillStyle = "#141727";
        }
        mapCtx.fillRect(px, py, cell, cell);
        if (!state.map.bombs[i]) {
          const n = state.map.numbers[i];
          if (n > 0 && cell >= 4) {
            mapCtx.fillStyle = NUMBER_COLORS[n] || "#ffffff";
            mapCtx.font = `${Math.max(4, Math.floor(cell * 0.8))}px monospace`;
            mapCtx.textAlign = "center";
            mapCtx.textBaseline = "middle";
            mapCtx.fillText(String(n), px + cell * 0.5, py + cell * 0.58);
          }
        }
      }
    }
  }
  function showStatsOverlay(result, stats) {
    state.phase = "stats";
    statsOverlayEl.classList.remove("hidden");
    statsTitleEl.textContent = result === "win" ? "VICTOIRE" : "DEFAITE";
    statsTitleEl.style.color = result === "win" ? "#5cff8d" : "#ff5c5c";
    statsDurationEl.textContent = `Duree de partie: ${msToClock(stats.durationMs || 0)}`;
    statsTableBodyEl.innerHTML = "";
    for (let i = 0; i < (stats.players || []).length; i++) {
      const p = stats.players[i];
      const row = document.createElement("tr");
      row.innerHTML = `<td>${i + 1}</td><td style="font-weight:bold;color:${p.color || colorForPseudo(p.pseudo)};">${p.pseudo}</td><td>${p.cellsRevealed}</td><td>${p.bombsTriggered}</td><td>${p.flagsCorrect}/${p.flagsIncorrect}</td>`;
      statsTableBodyEl.appendChild(row);
    }
    explosionListEl.innerHTML = "";
    if (!stats.explodedBy || stats.explodedBy.length === 0) {
      const li = document.createElement("li");
      li.textContent = "Aucune explosion.";
      explosionListEl.appendChild(li);
    } else {
      for (const e of stats.explodedBy) {
        const li = document.createElement("li");
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
    }, 1e3);
  }
  function emitCellAction(eventName) {
    if (state.phase !== "playing" || state.chat.open) return;
    const me = state.players.get(state.myId);
    const x = me ? me.x : state.me.x;
    const y = me ? me.y : state.me.y;
    game.socket.emit(eventName, { x, y });
  }
  var game = createModeBootstrap({
    state,
    events: import_events.MINES_EVENTS,
    sprites,
    tileSize: TILE_SIZE,
    minScale: 0.3,
    maxScale: 2,
    animIdleMs: ANIM_IDLE_MS,
    animalFrame: ANIMAL_FRAME,
    animalCols: ANIMAL_COLS,
    hasPositionMove: true,
    cameraSmoothing: 0.05,
    cameraSnapThreshold: 5,
    stateEvents: [import_events.MINES_EVENTS.gameNew],
    getWorldSize: () => ({ w: GRID_W * TILE_SIZE, h: GRID_H * TILE_SIZE }),
    getFocusPosition: () => ({ x: state.me.x, y: state.me.y }),
    onApplyState(payload) {
      state.phase = payload.phase === "stats" ? "stats" : "playing";
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
      state.flags = /* @__PURE__ */ new Map();
      state.players = /* @__PURE__ */ new Map();
      state.revealedSafeCount = 0;
      state.explodedCells = /* @__PURE__ */ new Set();
      state.activeExplosions = [];
      state.activeDigs = /* @__PURE__ */ new Map();
      for (const c of payload.revealed || []) {
        const i = idx(c.x, c.y);
        state.grid[i] = c.value;
        if (c.value >= 0) state.revealedSafeCount += 1;
        if (c.value === -1) state.explodedCells.add(i);
      }
      for (const f of payload.flags || []) state.flags.set(idx(f.x, f.y), f.pseudo);
      for (const p of payload.players || []) applyPlayerPayload(p);
      game.chatModule.setMessages(payload.chatMessages || []);
      const me = state.players.get(state.myId);
      if (me) {
        state.me.x = me.x;
        state.me.y = me.y;
      }
      game.els.lobby.classList.add("hidden");
      game.els.joinError.textContent = "";
      game.els.reconnect.classList.add("hidden");
      game.hudModule.show();
      hideStatsOverlay();
      game.centerCameraOnMe(true);
      if (state.chat.open) game.chatModule.setTypingStatus(true);
    },
    onPlayerJoined: applyPlayerPayload,
    onPlayerLeft(payload) {
      state.activeDigs.delete(payload.id);
      state.players.delete(payload.id);
    },
    onJoinError() {
      hideStatsOverlay();
    },
    onRender(now) {
      const { ctx, canvas } = game;
      const scale = state.camera.scale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);
      ctx.fillStyle = "#00d9ff";
      ctx.fillRect(-200, -200, GRID_W * TILE_SIZE + 400, GRID_H * TILE_SIZE + 400);
      const viewW = canvas.width / scale, viewH = canvas.height / scale;
      const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, GRID_W - 1);
      const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, GRID_W - 1);
      const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, GRID_H - 1);
      const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, GRID_H - 1);
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) drawCell(ctx, x, y);
      }
      drawTransitions(ctx, minX, maxX, minY, maxY);
      drawBombs(ctx, minX, maxX, minY, maxY);
      drawNumbers(ctx, minX, maxX, minY, maxY);
      drawFlags(ctx, minX, maxX, minY, maxY);
      const labels = [];
      for (const player of state.players.values()) {
        if (player.x < minX - 1 || player.x > maxX + 1 || player.y < minY - 1 || player.y > maxY + 1) continue;
        labels.push(drawPlayer(ctx, player, now));
      }
      const explosionsByCell = bucketExplosions(now);
      for (const [key, frames] of explosionsByCell.entries()) {
        for (const frame of frames) drawExplosionAtCell(ctx, key % GRID_W, Math.floor(key / GRID_W), frame);
      }
      drawPlayerLabels(ctx, labels);
    },
    onUpdateHud() {
      const elapsed = state.startTime ? Date.now() - state.startTime : 0;
      const safeTotal = Math.max(0, state.map.totalCells - state.map.bombCount);
      game.hudModule.setText(hudBombsEl, `Bombes: ${state.explosions}/${state.maxExplosions}`);
      hudBombsEl.classList.toggle("bombs-danger", state.explosions >= 7);
      game.hudModule.setText(hudTimeEl, msToClock(elapsed));
      game.hudModule.setText(hudPlayersEl, `${state.players.size} joueurs`);
      game.hudModule.setText(hudFlagsEl, `Drapeaux: ${state.flags.size}`);
      game.hudModule.setText(hudRevealedEl, `Cases revelees: ${state.revealedSafeCount}/${safeTotal}`);
      game.els.hud.classList.toggle("near-top", state.me.y <= 3);
    },
    onKeydown(event) {
      if (event.code === "Space") {
        event.preventDefault();
        if (!event.repeat) emitCellAction(import_events.MINES_EVENTS.reveal);
        return true;
      }
      if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
        event.preventDefault();
        if (!event.repeat) emitCellAction(import_events.MINES_EVENTS.flag);
        return true;
      }
      return false;
    },
    onMousedown(event) {
      if (event.button === 0) {
        event.preventDefault();
        emitCellAction(import_events.MINES_EVENTS.reveal);
      }
      if (event.button === 2) {
        event.preventDefault();
        emitCellAction(import_events.MINES_EVENTS.flag);
      }
    },
    extraSocketSetup(socket) {
      socket.on(import_events.MINES_EVENTS.cellsRevealed, (payload) => {
        const pid = payload?.playerId;
        const player = pid ? state.players.get(pid) : null;
        if (pid && player && playerHasDigAnim(player)) state.activeDigs.set(pid, Date.now());
        applyRevealedCells(payload.cells || []);
      });
      socket.on(import_events.MINES_EVENTS.cellFlagged, (payload) => {
        const i = idx(payload.x, payload.y);
        if (payload.active) state.flags.set(i, payload.pseudo);
        else state.flags.delete(i);
      });
      socket.on(import_events.MINES_EVENTS.bombExploded, (payload) => {
        state.explosions = payload.count;
        state.explodedCells.add(idx(payload.x, payload.y));
        state.activeExplosions.push({ x: payload.x, y: payload.y, startedAt: Date.now() });
        const player = state.players.get(payload.id);
        if (player) player.stunnedUntil = payload.stunEndTime || Date.now() + 2e3;
      });
      socket.on(import_events.MINES_EVENTS.gameOver, (payload) => {
        showStatsOverlay(payload.result, payload.stats || {});
      });
    }
  });
})();
