(() => {
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

  // src/client/core/events.js
  var PAINT_EVENTS = {
    join: "paint:join",
    joinError: "paint:error:join",
    state: "paint:state",
    playerJoined: "paint:player:joined",
    playerLeft: "paint:player:left",
    chatMessage: "paint:chat:message",
    chatTyping: "paint:chat:typing",
    move: "paint:move",
    playerMoved: "paint:player:moved",
    place: "paint:pixel:place",
    pixel: "paint:pixel",
    chatSend: "paint:chat:send"
  };

  // src/client/modules/chat/createChatModule.js
  function createChatModule(options) {
    const {
      state: state2,
      chatDockEl: chatDockEl2,
      chatFormEl: chatFormEl2,
      chatMessagesEl: chatMessagesEl2,
      chatInputEl: chatInputEl2,
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
      if (!chatMessagesEl2) return;
      const messagesToRender = state2.chat.open ? state2.chat.messages : state2.chat.messages.slice(-closedVisibleMessages);
      chatMessagesEl2.innerHTML = "";
      for (const entry of messagesToRender) {
        const li = document.createElement("li");
        li.className = "chat-item";
        li.innerHTML = `<strong style="color:${entry.color};">${entry.pseudo}</strong>: ${entry.text}`;
        chatMessagesEl2.appendChild(li);
      }
      if (state2.chat.open) {
        chatMessagesEl2.scrollTop = chatMessagesEl2.scrollHeight;
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
    function setTypingStatus2(active) {
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
      if (chatDockEl2) {
        chatDockEl2.classList.toggle("open", next);
      }
      if (chatFormEl2) {
        chatFormEl2.classList.toggle("hidden", !next);
      }
      renderMessages();
      if (next) {
        if (typeof onOpen === "function") {
          onOpen();
        }
        setTypingStatus2(true);
        if (focusInput && chatInputEl2) {
          chatInputEl2.focus();
        }
        return;
      }
      if (typeof onClose === "function") {
        onClose();
      }
      setTypingStatus2(false);
      if (chatInputEl2) {
        chatInputEl2.blur();
      }
    }
    function toggleOpen() {
      setOpen(!state2.chat.open);
    }
    return {
      setMessages,
      appendMessage,
      renderMessages,
      setTypingStatus: setTypingStatus2,
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
      avatarOptionEls: avatarOptionEls2,
      colorPickerEl: colorPickerEl2,
      normalizeAvatarIndex: normalizeAvatarIndex2,
      normalizeColorIndex: normalizeColorIndex2,
      playerColors,
      avatarStorageKey = "avatar",
      colorStorageKey = "colorIndex"
    } = options;
    function updateAvatarSelectionUI2() {
      for (const option of avatarOptionEls2 || []) {
        const avatar = normalizeAvatarIndex2(option.dataset.avatar);
        const selected = avatar === state2.myAvatar;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-checked", selected ? "true" : "false");
      }
    }
    function setMyAvatar2(value, persist = true) {
      state2.myAvatar = normalizeAvatarIndex2(value);
      updateAvatarSelectionUI2();
      if (persist) {
        localStorage.setItem(avatarStorageKey, String(state2.myAvatar));
      }
    }
    function updateColorSelectionUI2() {
      if (!colorPickerEl2) return;
      const options2 = Array.from(colorPickerEl2.querySelectorAll(".color-option"));
      for (const option of options2) {
        const idxValue = normalizeColorIndex2(option.dataset.colorIndex);
        const selected = idxValue === state2.myColorIndex;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-checked", selected ? "true" : "false");
      }
    }
    function setMyColorIndex2(value, persist = true) {
      state2.myColorIndex = normalizeColorIndex2(value);
      updateColorSelectionUI2();
      if (persist) {
        localStorage.setItem(colorStorageKey, String(state2.myColorIndex));
      }
    }
    function setupColorPicker2() {
      if (!colorPickerEl2) return;
      colorPickerEl2.innerHTML = "";
      for (let i = 0; i < playerColors.length; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "color-option";
        btn.dataset.colorIndex = String(i);
        btn.setAttribute("role", "radio");
        btn.setAttribute("aria-checked", "false");
        btn.title = `Couleur ${i + 1}`;
        btn.style.setProperty("--swatch-color", playerColors[i]);
        btn.addEventListener("click", () => setMyColorIndex2(i));
        colorPickerEl2.appendChild(btn);
      }
      updateColorSelectionUI2();
    }
    function setupAvatarPicker2() {
      for (const option of avatarOptionEls2 || []) {
        option.addEventListener("click", () => {
          setMyAvatar2(option.dataset.avatar);
        });
      }
      updateAvatarSelectionUI2();
    }
    function drawAvatarPickerPreview2({
      now,
      sprites,
      animIdleMs,
      frameSize,
      frameCols,
      fallbackColor = null
    }) {
      const idleCol = Math.floor(now / animIdleMs) % frameCols;
      for (const option of avatarOptionEls2 || []) {
        const canvasEl = option.querySelector(".avatar-preview");
        if (!canvasEl) continue;
        const avatar = normalizeAvatarIndex2(option.dataset.avatar);
        const image = sprites[avatar];
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
      updateAvatarSelectionUI: updateAvatarSelectionUI2,
      setMyAvatar: setMyAvatar2,
      updateColorSelectionUI: updateColorSelectionUI2,
      setMyColorIndex: setMyColorIndex2,
      setupColorPicker: setupColorPicker2,
      setupAvatarPicker: setupAvatarPicker2,
      drawAvatarPickerPreview: drawAvatarPickerPreview2
    };
  }

  // src/client/modules/network/registerCommonSocketLifecycle.js
  function registerCommonSocketLifecycle(options) {
    const {
      socket: socket2,
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
    socket2.on("connect", () => {
      if (state2?.chat) {
        state2.chat.typingSent = false;
      }
      if (typeof onConnect === "function") {
        onConnect();
      }
    });
    socket2.on("disconnect", () => {
      if (state2?.chat) {
        state2.chat.typingSent = false;
      }
      if (typeof onDisconnect === "function") {
        onDisconnect();
      }
    });
    if (events?.joinError && typeof onJoinError === "function") {
      socket2.on(events.joinError, (payload = {}) => onJoinError(payload));
    }
    const uniqueStateEvents = Array.from(new Set([events?.state, ...stateEvents || []].filter(Boolean)));
    if (typeof onState === "function") {
      for (const eventName of uniqueStateEvents) {
        socket2.on(eventName, (payload = {}) => onState(payload));
      }
    }
    if (events?.playerJoined && typeof onPlayerJoined === "function") {
      socket2.on(events.playerJoined, (payload = {}) => onPlayerJoined(payload));
    }
    if (events?.playerLeft && typeof onPlayerLeft === "function") {
      socket2.on(events.playerLeft, (payload = {}) => onPlayerLeft(payload));
    }
    if (events?.chatMessage && typeof onChatMessage === "function") {
      socket2.on(events.chatMessage, (payload = {}) => onChatMessage(payload));
    }
    if (events?.chatTyping && typeof onChatTyping === "function") {
      socket2.on(events.chatTyping, (payload = {}) => onChatTyping(payload));
    }
  }

  // src/client/modules/camera/followCamera.js
  function getCameraViewport(camera, canvas2) {
    return {
      viewW: canvas2.width / camera.scale,
      viewH: canvas2.height / camera.scale
    };
  }
  function getCameraTarget({ focusX, focusY, tileSize, viewW, viewH }) {
    return {
      targetX: focusX * tileSize + tileSize * 0.5 - viewW * 0.5,
      targetY: focusY * tileSize + tileSize * 0.5 - viewH * 0.5
    };
  }
  function clampCameraToWorld({ camera, canvas: canvas2, worldW, worldH }) {
    const { viewW, viewH } = getCameraViewport(camera, canvas2);
    camera.x = Math.max(0, Math.min(camera.x, Math.max(0, worldW - viewW)));
    camera.y = Math.max(0, Math.min(camera.y, Math.max(0, worldH - viewH)));
  }
  function centerCameraOnFocus({
    camera,
    canvas: canvas2,
    tileSize,
    focusX,
    focusY,
    immediate = false,
    smoothing = 0.05
  }) {
    const { viewW, viewH } = getCameraViewport(camera, canvas2);
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
    enqueueMove: enqueueMove2,
    holdDelayMs,
    moveCooldownMs
  }) {
    if (holdControls.has(code)) return;
    enqueueMove2(dx, dy);
    const hold = {
      interval: null,
      timeout: setTimeout(() => {
        hold.interval = setInterval(() => enqueueMove2(dx, dy), moveCooldownMs);
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

  // src/client/modes/paint/index.js
  var TILE_SIZE = 20;
  var EXPORT_TILE_SIZE = 2;
  var EXPORT_EMPTY_COLOR = "#f6f1e8";
  var MIN_SCALE = 0.14;
  var MAX_SCALE = 2.2;
  var MOVE_COOLDOWN_MS = 120;
  var HOLD_DELAY_MS = 300;
  var WALK_WINDOW_MS = 240;
  var ANIM_IDLE_MS = 220;
  var ANIM_RUN_MS = 85;
  var DEFAULT_PALETTE = [
    "#000000",
    "#3a3a3a",
    "#7a7a7a",
    "#ffffff",
    "#f94144",
    "#f3722c",
    "#f8961e",
    "#f9c74f",
    "#90be6d",
    "#43aa8b",
    "#4d908e",
    "#577590",
    "#277da1",
    "#7b2cbf",
    "#f72585",
    "#4cc9f0"
  ];
  var ANIMAL_FRAME = 32;
  var ANIMAL_COLS = 4;
  var socket = io();
  var canvas = document.getElementById("gameCanvas");
  var ctx = canvas.getContext("2d");
  var lobbyEl = document.getElementById("lobby");
  var joinFormEl = document.getElementById("joinForm");
  var pseudoInputEl = document.getElementById("pseudoInput");
  var joinErrorEl = document.getElementById("joinError");
  var avatarPickerEl = document.getElementById("avatarPicker");
  var avatarOptionEls = Array.from(document.querySelectorAll(".avatar-option"));
  var reconnectEl = document.getElementById("reconnect");
  var hudEl = document.getElementById("hud");
  var hudPlayersEl = document.getElementById("hudPlayers");
  var hudTimeEl = document.getElementById("hudTime");
  var hudColorEl = document.getElementById("hudColor");
  var chatDockEl = document.getElementById("chatDock");
  var chatToggleBtnEl = document.getElementById("chatToggleBtn");
  var chatMessagesEl = document.getElementById("chatMessages");
  var chatFormEl = document.getElementById("chatForm");
  var chatInputEl = document.getElementById("chatInput");
  var colorPickerEl = document.getElementById("colorPicker");
  var paletteDockEl = document.getElementById("paintPaletteDock");
  var paintPaletteGridEl = document.getElementById("paintPaletteGrid");
  var selectedColorLabelEl = document.getElementById("selectedColorLabel");
  var downloadPngBtnEl = document.getElementById("downloadPngBtn");
  var lobbyIdFromQuery = (() => {
    const raw = new URLSearchParams(window.location.search).get("lobby");
    const value = String(raw || "").trim().toLowerCase();
    return value || null;
  })();
  function idx(x, y) {
    return y * state.map.width + x;
  }
  function isInBounds(x, y) {
    return x >= 0 && x < state.map.width && y >= 0 && y < state.map.height;
  }
  function normalizePaletteIndex(value) {
    const palette = state.map.palette;
    const index = Number(value);
    if (!Number.isInteger(index)) return 0;
    if (index < 0 || index >= palette.length) return 0;
    return index;
  }
  var identityModule = createIdentityModule({
    state,
    avatarOptionEls,
    colorPickerEl,
    normalizeAvatarIndex,
    normalizeColorIndex,
    playerColors: PLAYER_COLORS,
    avatarStorageKey: "avatar",
    colorStorageKey: "colorIndex"
  });
  var chatModule = createChatModule({
    state,
    chatDockEl,
    chatFormEl,
    chatMessagesEl,
    chatInputEl,
    resolveColorForPseudo: colorForPseudo,
    emitTyping: (active) => {
      socket.emit(PAINT_EVENTS.chatTyping, { active });
    },
    maxMessages: CHAT_MAX_MESSAGES,
    closedVisibleMessages: CHAT_CLOSED_VISIBLE_MESSAGES,
    getMyId: () => state.myId,
    onOpen: () => {
      clearAllHoldMoves();
      state.moveQueue = [];
      state.camera.dragging = false;
    },
    onLocalTypingChanged: (active) => {
      const me = state.players.get(state.myId);
      if (me) {
        me.isTyping = active;
      }
    }
  });
  var hudModule = createHudModule({ rootEl: hudEl });
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
    if (lobbyEl.classList.contains("hidden")) return;
    identityModule.drawAvatarPickerPreview({
      now,
      sprites: assets.sprites,
      animIdleMs: ANIM_IDLE_MS,
      frameSize: ANIMAL_FRAME,
      frameCols: ANIMAL_COLS,
      fallbackColor: "#d7e3ff"
    });
  }
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
  function updatePaletteSelectionUI() {
    if (!paintPaletteGridEl) return;
    const options = Array.from(paintPaletteGridEl.querySelectorAll(".palette-option"));
    for (const option of options) {
      const index = normalizePaletteIndex(option.dataset.paletteIndex);
      const selected = index === state.selectedPaletteIndex;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-checked", selected ? "true" : "false");
    }
    const color = state.map.palette[state.selectedPaletteIndex] || "#000000";
    if (selectedColorLabelEl) {
      selectedColorLabelEl.textContent = color;
    }
  }
  function setSelectedPaletteIndex(value, persist = true) {
    state.selectedPaletteIndex = normalizePaletteIndex(value);
    updatePaletteSelectionUI();
    if (persist) {
      localStorage.setItem("paintPaletteIndex", String(state.selectedPaletteIndex));
    }
  }
  function setupPaintPalette() {
    if (!paintPaletteGridEl) return;
    paintPaletteGridEl.innerHTML = "";
    for (let i = 0; i < state.map.palette.length; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-option";
      btn.dataset.paletteIndex = String(i);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.title = `Couleur ${i + 1}`;
      btn.style.setProperty("--swatch-color", state.map.palette[i]);
      btn.addEventListener("click", () => setSelectedPaletteIndex(i));
      paintPaletteGridEl.appendChild(btn);
    }
    updatePaletteSelectionUI();
  }
  function downloadMapAsPng() {
    const width = Number(state.map.width) || 0;
    const height = Number(state.map.height) || 0;
    if (width <= 0 || height <= 0) return;
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width * EXPORT_TILE_SIZE;
    exportCanvas.height = height * EXPORT_TILE_SIZE;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;
    exportCtx.imageSmoothingEnabled = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelValue = state.map.pixels[idx(x, y)];
        const isEmpty = pixelValue === state.map.emptyPixel;
        const color = isEmpty ? EXPORT_EMPTY_COLOR : state.map.palette[pixelValue] || "#000000";
        exportCtx.fillStyle = color;
        exportCtx.fillRect(
          x * EXPORT_TILE_SIZE,
          y * EXPORT_TILE_SIZE,
          EXPORT_TILE_SIZE,
          EXPORT_TILE_SIZE
        );
      }
    }
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = exportCanvas.toDataURL("image/png");
    link.download = `paint-map-${stamp}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  var assets = {
    sprites: [
      loadImage("/assets/BIRDSPRITESHEET_Blue.png"),
      loadImage("/assets/BIRDSPRITESHEET_White.png"),
      loadImage("/assets/CATSPRITESHEET_Gray.png"),
      loadImage("/assets/CATSPRITESHEET_Orange.png"),
      loadImage("/assets/FOXSPRITESHEET.png"),
      loadImage("/assets/RACCOONSPRITESHEET.png")
    ]
  };
  var state = {
    phase: "lobby",
    myId: null,
    myPseudo: null,
    myAvatar: 0,
    myColorIndex: 0,
    selectedPaletteIndex: 0,
    map: {
      width: 140,
      height: 140,
      totalCells: 140 * 140,
      emptyPixel: 255,
      palette: DEFAULT_PALETTE.slice(),
      pixels: new Uint8Array(140 * 140)
    },
    players: /* @__PURE__ */ new Map(),
    startTime: null,
    camera: {
      x: 0,
      y: 0,
      scale: 1,
      isManual: false,
      dragging: false,
      dragLastX: 0,
      dragLastY: 0
    },
    me: {
      x: 0,
      y: 0
    },
    moveQueue: [],
    lastMoveAt: 0,
    holdControls: /* @__PURE__ */ new Map(),
    hasJoinedOnce: false,
    loopStarted: false,
    chat: {
      open: false,
      typingSent: false,
      messages: []
    }
  };
  state.map.pixels.fill(state.map.emptyPixel);
  function spriteDirection(dx, dy, previous = "down") {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx < 0 ? "left" : "right";
    }
    if (dy < 0) return "up";
    if (dy > 0) return "down";
    return previous;
  }
  function playerSheetForPlayer(player) {
    if (Number.isInteger(player.avatar)) {
      return assets.sprites[normalizeAvatarIndex(player.avatar)];
    }
    const fallback = hashPseudo(player.pseudo) % assets.sprites.length;
    return assets.sprites[fallback];
  }
  function getSpriteFrame(player, now) {
    const moving = now - player.lastMoveAt <= WALK_WINDOW_MS;
    if (!moving) {
      const rowByDir = { down: 0, right: 1, left: 2, up: 3 };
      return {
        row: rowByDir[player.dir] ?? 0,
        col: Math.floor(now / ANIM_IDLE_MS) % ANIMAL_COLS
      };
    }
    const runRowsByDir = {
      down: [5, 6],
      left: [7, 8],
      right: [9, 10],
      up: [11, 12]
    };
    const rows = runRowsByDir[player.dir] || runRowsByDir.down;
    const frame = Math.floor(now / ANIM_RUN_MS) % 8;
    return {
      row: rows[Math.floor(frame / 4)],
      col: frame % 4
    };
  }
  function drawPlayer(player, now) {
    const px = player.x * TILE_SIZE;
    const py = player.y * TILE_SIZE;
    const sheet = playerSheetForPlayer(player);
    if (sheet.loaded) {
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
        TILE_SIZE
      );
    } else {
      ctx.fillStyle = "#ffd86b";
      ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }
    return {
      x: px + TILE_SIZE * 0.5,
      y: py - 10,
      text: player.pseudo,
      isTyping: Boolean(player.isTyping),
      color: player.color || colorForPseudo(player.pseudo)
    };
  }
  function drawCell(x, y) {
    const i = idx(x, y);
    const px = x * TILE_SIZE;
    const py = y * TILE_SIZE;
    const paletteIndex = state.map.pixels[i];
    const isEmpty = paletteIndex === state.map.emptyPixel;
    if (isEmpty) {
      ctx.fillStyle = (x + y) % 2 === 0 ? "#efe8da" : "#f6f1e8";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = state.map.palette[paletteIndex] || "#000000";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
    ctx.strokeStyle = "rgba(0, 0, 0, 0.08)";
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }
  function drawActionTarget() {
    const me = state.players.get(state.myId);
    if (!me) return;
    const px = me.x * TILE_SIZE;
    const py = me.y * TILE_SIZE;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
  }
  function renderFrame() {
    const scale = state.camera.scale;
    const now = Date.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);
    const worldW = state.map.width * TILE_SIZE;
    const worldH = state.map.height * TILE_SIZE;
    ctx.fillStyle = "#b8d8e8";
    ctx.fillRect(-200, -200, worldW + 400, worldH + 400);
    const viewW = canvas.width / scale;
    const viewH = canvas.height / scale;
    const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, state.map.width - 1);
    const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, state.map.width - 1);
    const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, state.map.height - 1);
    const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, state.map.height - 1);
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        drawCell(x, y);
      }
    }
    drawActionTarget();
    const labels = [];
    for (const player of state.players.values()) {
      if (player.x < minX - 1 || player.x > maxX + 1 || player.y < minY - 1 || player.y > maxY + 1) {
        continue;
      }
      labels.push(drawPlayer(player, now));
    }
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
    drawAvatarPickerPreview(now);
  }
  function centerCameraOnMe(immediate = false) {
    centerCameraOnFocus({
      camera: state.camera,
      canvas,
      tileSize: TILE_SIZE,
      focusX: state.me.x,
      focusY: state.me.y,
      immediate,
      smoothing: 0.05
    });
    clampCamera();
  }
  function clampCamera() {
    clampCameraToWorld({
      camera: state.camera,
      canvas,
      worldW: state.map.width * TILE_SIZE,
      worldH: state.map.height * TILE_SIZE
    });
  }
  function updateCamera() {
    if (state.phase === "lobby") return;
    if (state.camera.dragging) {
      clampCamera();
      return;
    }
    const { viewW, viewH } = getCameraViewport(state.camera, canvas);
    const px = state.me.x * TILE_SIZE + TILE_SIZE * 0.5;
    const py = state.me.y * TILE_SIZE + TILE_SIZE * 0.5;
    const { targetX, targetY } = getCameraTarget({
      focusX: state.me.x,
      focusY: state.me.y,
      tileSize: TILE_SIZE,
      viewW,
      viewH
    });
    if (!state.camera.isManual) {
      state.camera.x = targetX;
      state.camera.y = targetY;
    } else {
      const centerX = state.camera.x + viewW * 0.5;
      const centerY = state.camera.y + viewH * 0.5;
      const maxCellDelta = Math.max(
        Math.abs(centerX - px) / TILE_SIZE,
        Math.abs(centerY - py) / TILE_SIZE
      );
      if (maxCellDelta > 6) {
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
    const elapsed = state.startTime ? Date.now() - state.startTime : 0;
    const selectedColor = state.map.palette[state.selectedPaletteIndex] || "#000000";
    hudModule.setText(hudPlayersEl, `${playerCount} joueurs`);
    hudModule.setText(hudTimeEl, msToClock(elapsed));
    hudModule.setText(hudColorEl, `Couleur: ${selectedColor}`);
  }
  function applyPlayerPayload(payload) {
    const previous = state.players.get(payload.id);
    let avatar = null;
    let colorIndex = null;
    if (payload.avatar !== void 0 && payload.avatar !== null) {
      avatar = normalizeAvatarIndex(payload.avatar);
    } else if (previous && Number.isInteger(previous.avatar)) {
      avatar = previous.avatar;
    } else if (payload.id === state.myId) {
      avatar = state.myAvatar;
    } else {
      avatar = hashPseudo(payload.pseudo) % assets.sprites.length;
    }
    if (payload.colorIndex !== void 0 && payload.colorIndex !== null) {
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
      updateAvatarSelectionUI();
      state.myColorIndex = player.colorIndex;
      updateColorSelectionUI();
      state.me.x = player.x;
      state.me.y = player.y;
    }
  }
  function applySnapshot(payload) {
    state.phase = "playing";
    state.myId = payload.myId || state.myId;
    state.startTime = payload.startTime || Date.now();
    state.map.width = Number(payload.map.width) || 140;
    state.map.height = Number(payload.map.height) || 140;
    state.map.totalCells = Number(payload.map.totalCells) || state.map.width * state.map.height;
    state.map.palette = Array.isArray(payload.map.palette) && payload.map.palette.length > 0 ? payload.map.palette.slice() : DEFAULT_PALETTE.slice();
    state.map.emptyPixel = Number.isInteger(payload.map.emptyPixel) ? payload.map.emptyPixel : 255;
    state.map.pixels = base64ToTypedArray(payload.map.data.pixels, Uint8Array);
    if (state.map.pixels.length !== state.map.totalCells) {
      const resized = new Uint8Array(state.map.totalCells);
      resized.fill(state.map.emptyPixel);
      resized.set(state.map.pixels.slice(0, Math.min(state.map.pixels.length, resized.length)));
      state.map.pixels = resized;
    }
    state.players = /* @__PURE__ */ new Map();
    for (const player of payload.players || []) {
      applyPlayerPayload(player);
    }
    setChatMessages(payload.chatMessages || []);
    const me = state.players.get(state.myId);
    if (me) {
      state.me.x = me.x;
      state.me.y = me.y;
    }
    lobbyEl.classList.add("hidden");
    joinErrorEl.textContent = "";
    reconnectEl.classList.add("hidden");
    hudModule.show();
    paletteDockEl?.classList.remove("hidden");
    setupPaintPalette();
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
  function emitPaintPlace(target = null) {
    if (state.phase !== "playing" || state.chat.open) return;
    const actionTarget = target || getActionTargetCell();
    if (!actionTarget) return;
    socket.emit(PAINT_EVENTS.place, {
      x: actionTarget.x,
      y: actionTarget.y,
      paletteIndex: state.selectedPaletteIndex
    });
  }
  function processInputQueue() {
    if (state.phase !== "playing") return;
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
    socket.emit(PAINT_EVENTS.move, { x: nx, y: ny });
  }
  function enqueueMove(dx, dy) {
    state.moveQueue.push({ dx, dy });
  }
  function registerHoldMove(code, dx, dy) {
    registerHoldMoveKey({
      holdControls: state.holdControls,
      code,
      dx,
      dy,
      enqueueMove,
      holdDelayMs: HOLD_DELAY_MS,
      moveCooldownMs: MOVE_COOLDOWN_MS
    });
  }
  function clearHoldMove(code) {
    clearHoldMoveKey(state.holdControls, code);
  }
  function clearAllHoldMoves() {
    clearAllHoldMoveKeys(state.holdControls);
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
  joinFormEl.addEventListener("submit", (event) => {
    event.preventDefault();
    const pseudo = String(pseudoInputEl.value || "").trim();
    if (!pseudo) {
      joinErrorEl.textContent = "Entre un pseudo.";
      return;
    }
    state.myPseudo = pseudo;
    state.hasJoinedOnce = true;
    localStorage.setItem("pseudo", pseudo);
    joinErrorEl.textContent = "";
    socket.emit(PAINT_EVENTS.join, {
      pseudo,
      avatar: state.myAvatar,
      colorIndex: state.myColorIndex,
      lobbyId: lobbyIdFromQuery
    });
  });
  chatToggleBtnEl?.addEventListener("click", () => {
    toggleChat();
  });
  chatFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.myId) return;
    const text = String(chatInputEl?.value || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    socket.emit(PAINT_EVENTS.chatSend, { text });
    if (chatInputEl) {
      chatInputEl.value = "";
      chatInputEl.focus();
    }
    if (state.chat.open) {
      setTypingStatus(true);
    }
  });
  downloadPngBtnEl?.addEventListener("click", () => {
    downloadMapAsPng();
  });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("blur", clearAllHoldMoves);
  canvas.addEventListener("mousedown", (event) => {
    if (state.chat.open) return;
    if (event.button === 0) {
      event.preventDefault();
      emitPaintPlace();
      return;
    }
    if (event.button !== 1) return;
    state.camera.dragging = true;
    state.camera.isManual = true;
    state.camera.dragLastX = event.clientX;
    state.camera.dragLastY = event.clientY;
  });
  canvas.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
  window.addEventListener("mouseup", () => {
    state.camera.dragging = false;
  });
  window.addEventListener("mousemove", (event) => {
    if (!state.camera.dragging) return;
    const dx = event.clientX - state.camera.dragLastX;
    const dy = event.clientY - state.camera.dragLastY;
    state.camera.dragLastX = event.clientX;
    state.camera.dragLastY = event.clientY;
    state.camera.x -= dx / state.camera.scale;
    state.camera.y -= dy / state.camera.scale;
    clampCamera();
  });
  canvas.addEventListener("wheel", (event) => {
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
  window.addEventListener("keydown", (event) => {
    if (event.code === "Tab") {
      event.preventDefault();
      toggleChat();
      return;
    }
    if (state.chat.open) {
      if (event.code === "Escape") {
        event.preventDefault();
        setChatOpen(false, false);
        return;
      }
      if (event.code === "Enter" && document.activeElement !== chatInputEl) {
        event.preventDefault();
        chatInputEl?.focus();
      }
      return;
    }
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) emitPaintPlace();
      return;
    }
    const paletteDigit = Number(event.key);
    if (Number.isInteger(paletteDigit) && paletteDigit >= 1 && paletteDigit <= 9) {
      const nextIndex = paletteDigit - 1;
      if (nextIndex < state.map.palette.length) {
        setSelectedPaletteIndex(nextIndex);
      }
    }
    const delta = MOVE_KEY_DELTAS[event.code];
    if (!delta) return;
    registerHoldMove(event.code, delta[0], delta[1]);
  });
  window.addEventListener("keyup", (event) => {
    clearHoldMove(event.code);
  });
  registerCommonSocketLifecycle({
    socket,
    events: PAINT_EVENTS,
    state,
    onConnect: () => {
      state.myId = socket.id;
      reconnectEl.classList.add("hidden");
      if (state.hasJoinedOnce && state.myPseudo) {
        socket.emit(PAINT_EVENTS.join, {
          pseudo: state.myPseudo,
          avatar: state.myAvatar,
          colorIndex: state.myColorIndex,
          lobbyId: lobbyIdFromQuery
        });
      }
    },
    onDisconnect: () => {
      clearAllHoldMoves();
      if (state.hasJoinedOnce) {
        reconnectEl.classList.remove("hidden");
      }
    },
    onJoinError: (payload = {}) => {
      state.phase = "lobby";
      lobbyEl.classList.remove("hidden");
      joinErrorEl.textContent = payload.message || "Impossible de rejoindre.";
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
    }
  });
  socket.on(PAINT_EVENTS.playerMoved, (payload) => {
    updateLocalPlayerFromServerMove(payload.id, payload.x, payload.y);
  });
  socket.on(PAINT_EVENTS.pixel, (payload = {}) => {
    const x = Number(payload.x);
    const y = Number(payload.y);
    const paletteIndex = Number(payload.paletteIndex);
    if (!Number.isInteger(x) || !Number.isInteger(y) || !isInBounds(x, y)) return;
    if (!Number.isInteger(paletteIndex) || paletteIndex < 0 || paletteIndex >= state.map.palette.length) return;
    state.map.pixels[idx(x, y)] = paletteIndex;
  });
  var rememberedPseudo = localStorage.getItem("pseudo");
  if (rememberedPseudo) {
    pseudoInputEl.value = rememberedPseudo;
  }
  setupAvatarPicker();
  setupColorPicker();
  setupPaintPalette();
  var rememberedAvatar = localStorage.getItem("avatar");
  if (rememberedAvatar !== null) {
    setMyAvatar(rememberedAvatar, false);
  }
  var rememberedColorIndex = localStorage.getItem("colorIndex");
  if (rememberedColorIndex !== null) {
    setMyColorIndex(rememberedColorIndex, false);
  }
  var rememberedPaletteIndex = localStorage.getItem("paintPaletteIndex");
  if (rememberedPaletteIndex !== null) {
    setSelectedPaletteIndex(rememberedPaletteIndex, false);
  }
  setChatMessages([]);
  setChatOpen(false, false);
  resizeCanvas();
  startGameLoop();
})();
