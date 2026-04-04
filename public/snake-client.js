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
      var MINES_EVENTS = {
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
      var SNAKE_EVENTS2 = {
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
        MINES_EVENTS,
        PAINT_EVENTS,
        SNAKE_EVENTS: SNAKE_EVENTS2
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

  // src/client/modes/snake/index.js
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
  function spriteDirection(dx, dy, previous = "down") {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? "left" : "right";
    }
    if (dy < 0) return "up";
    if (dy > 0) return "down";
    return previous;
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

  // src/client/modules/characters/drawAvatarFrame.js
  function drawAvatarFrame(options) {
    const {
      ctx,
      image,
      frameCol,
      frameRow,
      frameSize,
      dx,
      dy,
      dw,
      dh
    } = options;
    if (!image || !image.loaded) {
      return false;
    }
    ctx.drawImage(
      image,
      frameCol * frameSize,
      frameRow * frameSize,
      frameSize,
      frameSize,
      dx,
      dy,
      dw,
      dh
    );
    return true;
  }

  // src/client/modules/tiles/drawCheckerTiles.js
  function drawCheckerTiles(options) {
    const {
      ctx,
      minX,
      maxX,
      minY,
      maxY,
      tileSize,
      primaryColor,
      secondaryColor,
      strokeStyle = null
    } = options;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x * tileSize;
        const py = y * tileSize;
        ctx.fillStyle = (x + y) % 2 === 0 ? primaryColor : secondaryColor;
        ctx.fillRect(px, py, tileSize, tileSize);
        if (strokeStyle) {
          ctx.strokeStyle = strokeStyle;
          ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
        }
      }
    }
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

  // src/client/modes/snake/index.js
  var TILE_SIZE = 18;
  var ANIM_IDLE_MS = 220;
  var ANIMAL_FRAME = 32;
  var ANIMAL_COLS = 4;
  var HUD_UPDATE_INTERVAL_MS = 120;
  var LEADERBOARD_UPDATE_INTERVAL_MS = 220;
  var DIRECTION_BY_KEY = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right"
  };
  var OPPOSITE_DIRECTION = {
    up: "down",
    down: "up",
    left: "right",
    right: "left"
  };
  var sprites = [
    loadImage("/assets/BIRDSPRITESHEET_Blue.png"),
    loadImage("/assets/BIRDSPRITESHEET_White.png"),
    loadImage("/assets/CATSPRITESHEET_Gray.png"),
    loadImage("/assets/CATSPRITESHEET_Orange.png"),
    loadImage("/assets/FOXSPRITESHEET.png"),
    loadImage("/assets/RACCOONSPRITESHEET.png")
  ];
  var appleImage = loadImage("/assets/apple.png");
  var state = {
    apples: [],
    map: { width: 70, height: 70, totalCells: 70 * 70, tickMs: 180, appleCount: 1 },
    input: {
      pendingDirection: null,
      pendingUntil: 0
    },
    ui: {
      lastHudUpdateAt: 0,
      lastLeaderboardUpdateAt: 0,
      leaderboardListSignature: "",
      leaderboardStatusSignature: ""
    }
  };
  var hudScoreEl = document.getElementById("hudScore");
  var hudPlayersEl = document.getElementById("hudPlayers");
  var hudTimeEl = document.getElementById("hudTime");
  var leaderboardDockEl = document.getElementById("leaderboardDock");
  var leaderboardListEl = document.getElementById("leaderboardList");
  var leaderboardStatusEl = document.getElementById("leaderboardStatus");
  var previousScoreEl = document.getElementById("previousScore");
  function setPreviousScore(score) {
    if (!previousScoreEl) return;
    if (!Number.isFinite(score)) {
      previousScoreEl.textContent = "";
      previousScoreEl.classList.add("hidden");
      return;
    }
    previousScoreEl.textContent = `Ton score avant mort: ${Math.max(0, Math.floor(score))}`;
    previousScoreEl.classList.remove("hidden");
  }
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
    player.direction = String(payload.direction || "right");
    player.score = Math.max(0, Number(payload.score) || 0);
    player.isTyping = Boolean(payload.isTyping);
    player.segments = Array.isArray(payload.segments) ? payload.segments.map((s) => ({ x: Number(s.x) || 0, y: Number(s.y) || 0 })) : [];
    state.players.set(payload.id, player);
    if (payload.id === state.myId && state.input.pendingDirection === player.direction) {
      state.input.pendingDirection = null;
      state.input.pendingUntil = 0;
    }
  }
  function updatePlayersFromPayload(playersPayload = []) {
    const seenIds = /* @__PURE__ */ new Set();
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
    const raw = Array.isArray(payload.apples) ? payload.apples : payload.apple ? [payload.apple] : [];
    return raw.map((a) => ({ x: Number(a?.x) || 0, y: Number(a?.y) || 0 }));
  }
  function drawApples(ctx) {
    for (const apple of state.apples) {
      const px = apple.x * TILE_SIZE, py = apple.y * TILE_SIZE;
      if (appleImage.loaded) {
        ctx.drawImage(appleImage, px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      } else {
        ctx.fillStyle = "#ff4d4d";
        ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.fillStyle = "#63b45c";
        ctx.fillRect(px + Math.floor(TILE_SIZE * 0.45), py + 1, 3, 5);
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
    const renderDirection = String(directionOverride || player.direction || "right");
    const rowByDir = { down: 0, right: 1, left: 2, up: 3 };
    const headCol = Math.floor(now / ANIM_IDLE_MS) % ANIMAL_COLS;
    if (!drawAvatarFrame({
      ctx,
      image: headSheet,
      frameCol: headCol,
      frameRow: rowByDir[renderDirection] ?? 0,
      frameSize: ANIMAL_FRAME,
      dx: hpx,
      dy: hpy,
      dw: TILE_SIZE,
      dh: TILE_SIZE
    })) {
      ctx.fillStyle = "#f9f9f9";
      ctx.fillRect(hpx + 1, hpy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(hpx + 1.5, hpy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    }
    return {
      x: head.x * TILE_SIZE + TILE_SIZE * 0.5,
      y: head.y * TILE_SIZE - 8,
      text: `${player.pseudo} (${player.score})`,
      color: baseColor,
      isTyping: Boolean(player.isTyping)
    };
  }
  function updateLeaderboard(force = false) {
    if (!leaderboardListEl || !leaderboardDockEl) return;
    const now = Date.now();
    if (!force && now - state.ui.lastLeaderboardUpdateAt < LEADERBOARD_UPDATE_INTERVAL_MS) {
      return;
    }
    state.ui.lastLeaderboardUpdateAt = now;
    const rows = Array.from(state.players.values()).sort((a, b) => b.score !== a.score ? b.score - a.score : a.pseudo.localeCompare(b.pseudo, "fr"));
    const myRank = rows.findIndex((r) => r.id === state.myId) + 1;
    const topScore = rows.length > 0 ? rows[0].score : 0;
    const me = state.players.get(state.myId);
    const myScore = Math.max(0, Number(me?.score) || 0);
    const listSignature = rows.slice(0, 10).map((player) => `${player.id}:${player.score}`).join("|");
    const statusSignature = `${myRank}|${topScore}|${myScore}|${rows.length}`;
    if (!force && listSignature === state.ui.leaderboardListSignature && statusSignature === state.ui.leaderboardStatusSignature) {
      return;
    }
    state.ui.leaderboardListSignature = listSignature;
    state.ui.leaderboardStatusSignature = statusSignature;
    leaderboardListEl.innerHTML = "";
    rows.slice(0, 10).forEach((player, i) => {
      const li = document.createElement("li");
      const isMe = player.id === state.myId;
      li.innerHTML = `<strong style="color:${colorForPlayer(player)};">${i + 1}. ${player.pseudo}${isMe ? " (toi)" : ""}</strong> - ${player.score}`;
      leaderboardListEl.appendChild(li);
    });
    leaderboardDockEl.classList.toggle("hidden-behind", myRank > 1 && myScore < topScore);
    leaderboardStatusEl.textContent = myRank <= 0 ? "En attente" : myRank === 1 ? "En tete" : `Derriere (#${myRank})`;
  }
  function getMyHead() {
    const me = state.players.get(state.myId);
    if (!me || !Array.isArray(me.segments) || me.segments.length === 0) {
      return { x: Math.floor(state.map.width / 2), y: Math.floor(state.map.height / 2) };
    }
    return me.segments[0];
  }
  var game = createModeBootstrap({
    state,
    events: import_events.SNAKE_EVENTS,
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
      state.phase = "playing";
      state.hasJoinedOnce = true;
      state.myId = payload.myId || state.myId;
      state.startTime = Number(payload.startTime) || Date.now();
      state.map.width = Number(payload.map?.width) || 70;
      state.map.height = Number(payload.map?.height) || 70;
      state.map.totalCells = Number(payload.map?.totalCells) || state.map.width * state.map.height;
      state.map.tickMs = Number(payload.map?.tickMs) || 180;
      state.map.appleCount = Number(payload.map?.appleCount) || 1;
      state.input.pendingDirection = null;
      state.input.pendingUntil = 0;
      state.apples = parseApples(payload);
      updatePlayersFromPayload(payload.players || []);
      game.chatModule.setMessages(payload.chatMessages || []);
      setPreviousScore(null);
      game.els.lobby.classList.add("hidden");
      game.els.reconnect.classList.add("hidden");
      game.els.joinError.textContent = "";
      game.hudModule.show();
      leaderboardDockEl.classList.remove("hidden");
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
      leaderboardDockEl.classList.add("hidden");
    },
    onRender(now) {
      const { ctx, canvas } = game;
      const scale = state.camera.scale;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);
      const worldW = state.map.width * TILE_SIZE, worldH = state.map.height * TILE_SIZE;
      ctx.fillStyle = "#07140e";
      ctx.fillRect(-200, -200, worldW + 400, worldH + 400);
      const viewW = canvas.width / scale, viewH = canvas.height / scale;
      const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, state.map.width - 1);
      const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, state.map.width - 1);
      const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, state.map.height - 1);
      const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, state.map.height - 1);
      drawCheckerTiles({
        ctx,
        minX,
        maxX,
        minY,
        maxY,
        tileSize: TILE_SIZE,
        primaryColor: "#0f271c",
        secondaryColor: "#143023",
        strokeStyle: "rgba(255,255,255,0.04)"
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
      if (state.phase === "playing") {
        const me = state.players.get(state.myId);
        const currentDirection = String(state.input.pendingDirection || me?.direction || "right");
        if (dir === currentDirection) return true;
        if (OPPOSITE_DIRECTION[currentDirection] === dir) return true;
        const tickMs = Math.max(90, Number(state.map.tickMs) || 180);
        state.input.pendingDirection = dir;
        state.input.pendingUntil = Date.now() + Math.max(180, Math.round(tickMs * 1.5));
        game.socket.emit(import_events.SNAKE_EVENTS.turn, { direction: dir });
      }
      return true;
    },
    extraSocketSetup(socket) {
      socket.on(import_events.SNAKE_EVENTS.tick, (payload = {}) => {
        if (state.phase !== "playing") return;
        if (Array.isArray(payload.players)) updatePlayersFromPayload(payload.players);
        state.apples = parseApples(payload);
      });
      socket.on(import_events.SNAKE_EVENTS.playerDied, (payload = {}) => {
        state.phase = "lobby";
        state.hasJoinedOnce = false;
        state.players = /* @__PURE__ */ new Map();
        state.apples = [];
        state.chat.typingSent = false;
        state.input.pendingDirection = null;
        state.input.pendingUntil = 0;
        game.chatModule.setOpen(false, false);
        game.els.lobby.classList.remove("hidden");
        game.els.reconnect.classList.add("hidden");
        game.hudModule.hide();
        leaderboardDockEl.classList.add("hidden");
        game.els.joinError.textContent = "";
        if (state.myPseudo) game.els.pseudoInput.value = state.myPseudo;
        setPreviousScore(Number(payload.score));
        updateLeaderboard(true);
      });
    },
    onInit() {
      setPreviousScore(null);
    }
  });
})();
