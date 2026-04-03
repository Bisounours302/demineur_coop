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

  // src/client/core/events.js
  var SNAKE_EVENTS = {
    join: "snake:join",
    joinError: "snake:error:join",
    state: "snake:state",
    playerJoined: "snake:player:joined",
    playerLeft: "snake:player:left",
    chatMessage: "snake:chat:message",
    chatTyping: "snake:chat:typing",
    turn: "snake:turn",
    tick: "snake:tick",
    playerDied: "snake:player:died",
    chatSend: "snake:chat:send"
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
    function updateAvatarSelectionUI() {
      for (const option of avatarOptionEls2 || []) {
        const avatar = normalizeAvatarIndex2(option.dataset.avatar);
        const selected = avatar === state2.myAvatar;
        option.classList.toggle("selected", selected);
        option.setAttribute("aria-checked", selected ? "true" : "false");
      }
    }
    function setMyAvatar2(value, persist = true) {
      state2.myAvatar = normalizeAvatarIndex2(value);
      updateAvatarSelectionUI();
      if (persist) {
        localStorage.setItem(avatarStorageKey, String(state2.myAvatar));
      }
    }
    function updateColorSelectionUI() {
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
      updateColorSelectionUI();
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
      updateColorSelectionUI();
    }
    function setupAvatarPicker2() {
      for (const option of avatarOptionEls2 || []) {
        option.addEventListener("click", () => {
          setMyAvatar2(option.dataset.avatar);
        });
      }
      updateAvatarSelectionUI();
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
      updateAvatarSelectionUI,
      setMyAvatar: setMyAvatar2,
      updateColorSelectionUI,
      setMyColorIndex: setMyColorIndex2,
      setupColorPicker: setupColorPicker2,
      setupAvatarPicker: setupAvatarPicker2,
      drawAvatarPickerPreview: drawAvatarPickerPreview2
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

  // src/client/modules/tiles/drawCheckerTiles.js
  function drawCheckerTiles(options) {
    const {
      ctx: ctx2,
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
        ctx2.fillStyle = (x + y) % 2 === 0 ? primaryColor : secondaryColor;
        ctx2.fillRect(px, py, tileSize, tileSize);
        if (strokeStyle) {
          ctx2.strokeStyle = strokeStyle;
          ctx2.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
        }
      }
    }
  }

  // src/client/modules/characters/drawAvatarFrame.js
  function drawAvatarFrame(options) {
    const {
      ctx: ctx2,
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
    ctx2.drawImage(
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

  // src/client/modes/snake/index.js
  var TILE_SIZE = 18;
  var MIN_SCALE = 0.25;
  var MAX_SCALE = 2.2;
  var ANIM_IDLE_MS = 220;
  var ANIMAL_FRAME = 32;
  var ANIMAL_COLS = 4;
  var DIRECTION_BY_KEY = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right"
  };
  var socket = io();
  var canvas = document.getElementById("gameCanvas");
  var ctx = canvas.getContext("2d");
  var lobbyEl = document.getElementById("lobby");
  var joinFormEl = document.getElementById("joinForm");
  var pseudoInputEl = document.getElementById("pseudoInput");
  var joinErrorEl = document.getElementById("joinError");
  var previousScoreEl = document.getElementById("previousScore");
  var avatarPickerEl = document.getElementById("avatarPicker");
  var avatarOptionEls = Array.from(document.querySelectorAll(".avatar-option"));
  var colorPickerEl = document.getElementById("colorPicker");
  var reconnectEl = document.getElementById("reconnect");
  var hudEl = document.getElementById("hud");
  var hudPlayersEl = document.getElementById("hudPlayers");
  var hudScoreEl = document.getElementById("hudScore");
  var hudTimeEl = document.getElementById("hudTime");
  var leaderboardDockEl = document.getElementById("leaderboardDock");
  var leaderboardListEl = document.getElementById("leaderboardList");
  var leaderboardStatusEl = document.getElementById("leaderboardStatus");
  var chatDockEl = document.getElementById("chatDock");
  var chatToggleBtnEl = document.getElementById("chatToggleBtn");
  var chatMessagesEl = document.getElementById("chatMessages");
  var chatFormEl = document.getElementById("chatForm");
  var chatInputEl = document.getElementById("chatInput");
  var assets = {
    sprites: [
      loadImage("/assets/BIRDSPRITESHEET_Blue.png"),
      loadImage("/assets/BIRDSPRITESHEET_White.png"),
      loadImage("/assets/CATSPRITESHEET_Gray.png"),
      loadImage("/assets/CATSPRITESHEET_Orange.png"),
      loadImage("/assets/FOXSPRITESHEET.png"),
      loadImage("/assets/RACCOONSPRITESHEET.png")
    ],
    apple: loadImage("/assets/apple.png")
  };
  var lobbyIdFromQuery = (() => {
    const raw = new URLSearchParams(window.location.search).get("lobby");
    const value = String(raw || "").trim().toLowerCase();
    return value || null;
  })();
  var state = {
    phase: "lobby",
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
      appleCount: 1
    },
    apples: [],
    players: /* @__PURE__ */ new Map(),
    loopStarted: false,
    camera: {
      x: 0,
      y: 0,
      scale: 1,
      dragging: false,
      dragLastX: 0,
      dragLastY: 0
    },
    chat: {
      open: false,
      typingSent: false,
      messages: []
    }
  };
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
      socket.emit(SNAKE_EVENTS.chatTyping, { active });
    },
    maxMessages: CHAT_MAX_MESSAGES,
    closedVisibleMessages: CHAT_CLOSED_VISIBLE_MESSAGES,
    getMyId: () => state.myId
  });
  var hudModule = createHudModule({ rootEl: hudEl });
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
  function setMyAvatar(value, persist = true) {
    identityModule.setMyAvatar(value, persist);
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
      frameCols: ANIMAL_COLS
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
      direction: String(payload.direction || "right"),
      score: Math.max(0, Number(payload.score) || 0),
      isTyping: Boolean(payload.isTyping),
      segments: Array.isArray(payload.segments) ? payload.segments.map((segment) => ({ x: Number(segment.x) || 0, y: Number(segment.y) || 0 })) : []
    });
  }
  function updatePlayersFromPayload(playersPayload = []) {
    state.players = /* @__PURE__ */ new Map();
    for (const payload of playersPayload) {
      applyPlayerPayload(payload);
    }
  }
  function applySnapshot(payload) {
    state.phase = "playing";
    state.hasJoinedOnce = true;
    state.myId = payload.myId || state.myId;
    state.startTime = Number(payload.startTime) || Date.now();
    state.map.width = Number(payload.map?.width) || 70;
    state.map.height = Number(payload.map?.height) || 70;
    state.map.totalCells = Number(payload.map?.totalCells) || state.map.width * state.map.height;
    state.map.tickMs = Number(payload.map?.tickMs) || 180;
    state.map.appleCount = Number(payload.map?.appleCount) || 1;
    const applesPayload = Array.isArray(payload.apples) ? payload.apples : payload.apple ? [payload.apple] : [];
    state.apples = applesPayload.map((apple) => ({
      x: Number(apple?.x) || 0,
      y: Number(apple?.y) || 0
    }));
    updatePlayersFromPayload(payload.players || []);
    setChatMessages(payload.chatMessages || []);
    setPreviousScore(null);
    lobbyEl.classList.add("hidden");
    reconnectEl.classList.add("hidden");
    joinErrorEl.textContent = "";
    hudModule.show();
    leaderboardDockEl.classList.remove("hidden");
    centerCameraOnMe(true);
  }
  function applyTick(payload = {}) {
    if (state.phase !== "playing") return;
    if (Array.isArray(payload.players)) {
      updatePlayersFromPayload(payload.players);
    }
    const applesPayload = Array.isArray(payload.apples) ? payload.apples : payload.apple ? [payload.apple] : [];
    state.apples = applesPayload.map((apple) => ({
      x: Number(apple?.x) || 0,
      y: Number(apple?.y) || 0
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
    const rows = Array.from(state.players.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.pseudo.localeCompare(b.pseudo, "fr");
    });
    leaderboardListEl.innerHTML = "";
    rows.slice(0, 10).forEach((player, idx) => {
      const li = document.createElement("li");
      const isMe = player.id === state.myId;
      li.innerHTML = `<strong style="color:${colorForPlayer(player)};">${idx + 1}. ${player.pseudo}${isMe ? " (toi)" : ""}</strong> - ${player.score}`;
      leaderboardListEl.appendChild(li);
    });
    const myRank = rows.findIndex((row) => row.id === state.myId) + 1;
    const topScore = rows.length > 0 ? rows[0].score : 0;
    const me = state.players.get(state.myId);
    const myScore = Math.max(0, Number(me?.score) || 0);
    const isBehind = myRank > 1 && myScore < topScore;
    leaderboardDockEl.classList.toggle("hidden-behind", isBehind);
    if (myRank <= 0) {
      leaderboardStatusEl.textContent = "En attente";
    } else if (myRank === 1) {
      leaderboardStatusEl.textContent = "En tete";
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
      primaryColor: "#0f271c",
      secondaryColor: "#143023",
      strokeStyle: "rgba(255,255,255,0.04)"
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
      ctx.fillStyle = "#ff4d4d";
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);
      ctx.fillStyle = "#63b45c";
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
      dh: TILE_SIZE
    })) {
      ctx.fillStyle = "#f9f9f9";
      ctx.fillRect(headPx + 1, headPy + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(headPx + 1.5, headPy + 1.5, TILE_SIZE - 3, TILE_SIZE - 3);
    }
    return {
      x: head.x * TILE_SIZE + TILE_SIZE * 0.5,
      y: head.y * TILE_SIZE - 8,
      text: `${player.pseudo} (${player.score})`,
      color: baseColor,
      isTyping: Boolean(player.isTyping)
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
    ctx.fillStyle = "#07140e";
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
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const label of labels) {
      if (label.isTyping) {
        ctx.strokeStyle = "#000000";
        ctx.strokeText("ecrit...", label.x, label.y - 11);
        ctx.fillStyle = "#ffd28f";
        ctx.fillText("ecrit...", label.x, label.y - 11);
      }
      ctx.strokeStyle = "#000000";
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
      smoothing: 0.08
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
    if (state.phase !== "playing" || state.chat.open) return;
    socket.emit(SNAKE_EVENTS.turn, { direction });
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
    setPreviousScore(null);
    socket.emit(SNAKE_EVENTS.join, {
      pseudo,
      avatar: state.myAvatar,
      colorIndex: state.myColorIndex,
      lobbyId: lobbyIdFromQuery
    });
  });
  chatToggleBtnEl?.addEventListener("click", toggleChat);
  chatFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.myId) return;
    const text = String(chatInputEl?.value || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    socket.emit(SNAKE_EVENTS.chatSend, { text });
    if (chatInputEl) {
      chatInputEl.value = "";
      chatInputEl.focus();
    }
    if (state.chat.open) {
      setTypingStatus(true);
    }
  });
  window.addEventListener("resize", resizeCanvas);
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 1) return;
    state.camera.dragging = true;
    state.camera.dragLastX = event.clientX;
    state.camera.dragLastY = event.clientY;
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
      reconnectEl.classList.add("hidden");
      if (state.hasJoinedOnce && state.myPseudo && state.phase === "playing") {
        socket.emit(SNAKE_EVENTS.join, {
          pseudo: state.myPseudo,
          avatar: state.myAvatar,
          colorIndex: state.myColorIndex,
          lobbyId: lobbyIdFromQuery
        });
      }
    },
    onDisconnect: () => {
      if (state.hasJoinedOnce) {
        reconnectEl.classList.remove("hidden");
      }
    },
    onJoinError: (payload = {}) => {
      state.phase = "lobby";
      lobbyEl.classList.remove("hidden");
      hudModule.hide();
      leaderboardDockEl.classList.add("hidden");
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
  socket.on(SNAKE_EVENTS.tick, applyTick);
  socket.on(SNAKE_EVENTS.playerDied, (payload = {}) => {
    state.phase = "lobby";
    state.hasJoinedOnce = false;
    state.players = /* @__PURE__ */ new Map();
    state.apples = [];
    state.chat.typingSent = false;
    setChatOpen(false, false);
    lobbyEl.classList.remove("hidden");
    reconnectEl.classList.add("hidden");
    hudModule.hide();
    leaderboardDockEl.classList.add("hidden");
    joinErrorEl.textContent = "";
    if (state.myPseudo) {
      pseudoInputEl.value = state.myPseudo;
    }
    setPreviousScore(Number(payload.score));
  });
  var rememberedPseudo = localStorage.getItem("pseudo");
  if (rememberedPseudo) pseudoInputEl.value = rememberedPseudo;
  setupAvatarPicker();
  setupColorPicker();
  var rememberedAvatar = localStorage.getItem("avatar");
  if (rememberedAvatar !== null) setMyAvatar(rememberedAvatar, false);
  var rememberedColorIndex = localStorage.getItem("colorIndex");
  if (rememberedColorIndex !== null) setMyColorIndex(rememberedColorIndex, false);
  setChatMessages([]);
  setChatOpen(false, false);
  setPreviousScore(null);
  resizeCanvas();
  startGameLoop();
})();
