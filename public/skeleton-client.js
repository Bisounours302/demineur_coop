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

  // src/client/core/events.js
  var SKELETON_EVENTS = {
    join: "skeleton:join",
    joinError: "skeleton:error:join",
    state: "skeleton:state",
    playerJoined: "skeleton:player:joined",
    playerLeft: "skeleton:player:left",
    move: "skeleton:move",
    playerMoved: "skeleton:player:moved",
    action: "skeleton:action",
    actionApplied: "skeleton:action:applied",
    chatMessage: "skeleton:chat:message",
    chatTyping: "skeleton:chat:typing",
    chatSend: "skeleton:chat:send"
  };

  // src/client/modes/skeleton/index.js
  var TILE_SIZE = 24;
  var GRID_W = 80;
  var GRID_H = 80;
  var TOTAL_CELLS = GRID_W * GRID_H;
  var MOVE_COOLDOWN_MS = 120;
  var HOLD_DELAY_MS = 300;
  var MIN_SCALE = 0.2;
  var MAX_SCALE = 2.2;
  var ANIM_IDLE_MS = 220;
  var ANIM_RUN_MS = 85;
  var WALK_WINDOW_MS = 240;
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
  var colorPickerEl = document.getElementById("colorPicker");
  var hudEl = document.getElementById("hud");
  var hudPlayersEl = document.getElementById("hudPlayers");
  var hudScoreEl = document.getElementById("hudScore");
  var hudTimeEl = document.getElementById("hudTime");
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
    ]
  };
  var state = {
    phase: "lobby",
    myId: null,
    myPseudo: null,
    myAvatar: 0,
    myColorIndex: 0,
    startTime: null,
    me: { x: 0, y: 0, score: 0 },
    players: /* @__PURE__ */ new Map(),
    moveQueue: [],
    holdControls: /* @__PURE__ */ new Map(),
    lastMoveAt: 0,
    loopStarted: false,
    camera: {
      x: 0,
      y: 0,
      scale: 1,
      isManual: false,
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
  function isInBounds(x, y) {
    return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
  }
  function normalizeChatEntry(entry) {
    return {
      id: String(entry?.id || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
      pseudo: String(entry?.pseudo || "System"),
      color: String(entry?.color || colorForPseudo(entry?.pseudo || "System")),
      text: String(entry?.text || "").trim(),
      at: Number(entry?.at || Date.now())
    };
  }
  function setChatMessages(messages) {
    state.chat.messages = (messages || []).map(normalizeChatEntry).filter((m) => m.text.length > 0).slice(-CHAT_MAX_MESSAGES);
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
    const messagesToRender = state.chat.open ? state.chat.messages : state.chat.messages.slice(-CHAT_CLOSED_VISIBLE_MESSAGES);
    chatMessagesEl.innerHTML = "";
    for (const entry of messagesToRender) {
      const li = document.createElement("li");
      li.className = "chat-item";
      li.innerHTML = `<strong style="color:${entry.color};">${entry.pseudo}</strong>: ${entry.text}`;
      chatMessagesEl.appendChild(li);
    }
    if (state.chat.open) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  }
  function updateAvatarSelectionUI() {
    for (const option of avatarOptionEls) {
      const avatar = normalizeAvatarIndex(option.dataset.avatar);
      const selected = avatar === state.myAvatar;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-checked", selected ? "true" : "false");
    }
  }
  function setMyAvatar(value, persist = true) {
    state.myAvatar = normalizeAvatarIndex(value);
    updateAvatarSelectionUI();
    if (persist) localStorage.setItem("avatar", String(state.myAvatar));
  }
  function updateColorSelectionUI() {
    if (!colorPickerEl) return;
    const options = Array.from(colorPickerEl.querySelectorAll(".color-option"));
    for (const option of options) {
      const idxValue = normalizeColorIndex(option.dataset.colorIndex);
      const selected = idxValue === state.myColorIndex;
      option.classList.toggle("selected", selected);
      option.setAttribute("aria-checked", selected ? "true" : "false");
    }
  }
  function setMyColorIndex(value, persist = true) {
    state.myColorIndex = normalizeColorIndex(value);
    updateColorSelectionUI();
    if (persist) localStorage.setItem("colorIndex", String(state.myColorIndex));
  }
  function setupColorPicker() {
    if (!colorPickerEl) return;
    colorPickerEl.innerHTML = "";
    for (let i = 0; i < PLAYER_COLORS.length; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-option";
      btn.dataset.colorIndex = String(i);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.style.setProperty("--swatch-color", PLAYER_COLORS[i]);
      btn.addEventListener("click", () => setMyColorIndex(i));
      colorPickerEl.appendChild(btn);
    }
    updateColorSelectionUI();
  }
  function setupAvatarPicker() {
    for (const option of avatarOptionEls) {
      option.addEventListener("click", () => setMyAvatar(option.dataset.avatar));
    }
    updateAvatarSelectionUI();
  }
  function drawAvatarPickerPreview(now) {
    if (!avatarPickerEl) return;
    if (lobbyEl.classList.contains("hidden")) return;
    const idleCol = Math.floor(now / ANIM_IDLE_MS) % ANIMAL_COLS;
    for (const option of avatarOptionEls) {
      const canvasEl = option.querySelector(".avatar-preview");
      if (!canvasEl) continue;
      const avatar = normalizeAvatarIndex(option.dataset.avatar);
      const image = assets.sprites[avatar];
      const pctx = canvasEl.getContext("2d");
      pctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      pctx.imageSmoothingEnabled = false;
      if (image && image.loaded) {
        pctx.drawImage(image, idleCol * ANIMAL_FRAME, 0, ANIMAL_FRAME, ANIMAL_FRAME, 0, 0, canvasEl.width, canvasEl.height);
      }
    }
  }
  function spriteDirection(dx, dy, previous = "down") {
    if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
    if (dy < 0) return "up";
    if (dy > 0) return "down";
    return previous;
  }
  function getSpriteFrame(player, now) {
    const moving = now - player.lastMoveAt <= WALK_WINDOW_MS;
    if (!moving) {
      const rowByDir = { down: 0, right: 1, left: 2, up: 3 };
      return { row: rowByDir[player.dir] ?? 0, col: Math.floor(now / ANIM_IDLE_MS) % ANIMAL_COLS };
    }
    const runRowsByDir = { down: [5, 6], left: [7, 8], right: [9, 10], up: [11, 12] };
    const rows = runRowsByDir[player.dir] || runRowsByDir.down;
    const frame = Math.floor(now / ANIM_RUN_MS) % 8;
    return { row: rows[Math.floor(frame / 4)], col: frame % 4 };
  }
  function drawPlayer(player, now) {
    const px = player.x * TILE_SIZE;
    const py = player.y * TILE_SIZE;
    const sprite = assets.sprites[normalizeAvatarIndex(player.avatar)];
    if (sprite && sprite.loaded) {
      const frame = getSpriteFrame(player, now);
      ctx.drawImage(sprite, frame.col * ANIMAL_FRAME, frame.row * ANIMAL_FRAME, ANIMAL_FRAME, ANIMAL_FRAME, px, py, TILE_SIZE, TILE_SIZE);
    } else {
      ctx.fillStyle = "#ffd86b";
      ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
    }
    return {
      x: px + TILE_SIZE * 0.5,
      y: py - 10,
      text: player.pseudo,
      color: player.color || colorForPseudo(player.pseudo),
      isTyping: Boolean(player.isTyping)
    };
  }
  function drawGrid(minX, maxX, minY, maxY) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        ctx.fillStyle = (x + y) % 2 === 0 ? "#e7f5ea" : "#dff0e6";
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = "rgba(0,0,0,0.08)";
        ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }
  }
  function renderFrame() {
    const now = Date.now();
    const scale = state.camera.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);
    const worldW = GRID_W * TILE_SIZE;
    const worldH = GRID_H * TILE_SIZE;
    ctx.fillStyle = "#9bd0ef";
    ctx.fillRect(-200, -200, worldW + 400, worldH + 400);
    const viewW = canvas.width / scale;
    const viewH = canvas.height / scale;
    const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, GRID_W - 1);
    const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, GRID_W - 1);
    const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, GRID_H - 1);
    const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, GRID_H - 1);
    drawGrid(minX, maxX, minY, maxY);
    const labels = [];
    for (const player of state.players.values()) {
      if (player.x < minX - 1 || player.x > maxX + 1 || player.y < minY - 1 || player.y > maxY + 1) continue;
      labels.push(drawPlayer(player, now));
    }
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const label of labels) {
      if (label.isTyping) {
        ctx.strokeStyle = "#000";
        ctx.strokeText("ecrit...", label.x, label.y - 12);
        ctx.fillStyle = "#ffd28f";
        ctx.fillText("ecrit...", label.x, label.y - 12);
      }
      ctx.strokeStyle = "#000";
      ctx.strokeText(label.text, label.x, label.y);
      ctx.fillStyle = label.color;
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
    if (state.phase === "lobby") return;
    if (state.camera.dragging) {
      clampCamera();
      return;
    }
    centerCameraOnMe(false);
  }
  function updateHud() {
    const elapsed = state.startTime ? Date.now() - state.startTime : 0;
    const me = state.players.get(state.myId);
    hudPlayersEl.textContent = `${state.players.size} joueurs`;
    hudScoreEl.textContent = `Score: ${me ? me.score || 0 : 0}`;
    hudTimeEl.textContent = msToClock(elapsed);
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
      }, HOLD_DELAY_MS)
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
    for (const code of state.holdControls.keys()) clearHoldMove(code);
  }
  function processInputQueue() {
    if (state.phase !== "playing" || state.chat.open || state.moveQueue.length === 0) return;
    const now = Date.now();
    if (now - state.lastMoveAt < MOVE_COOLDOWN_MS) return;
    const action = state.moveQueue.shift();
    if (!action) return;
    const nx = state.me.x + action.dx;
    const ny = state.me.y + action.dy;
    if (!isInBounds(nx, ny)) return;
    state.me.x = nx;
    state.me.y = ny;
    state.lastMoveAt = now;
    const me = state.players.get(state.myId);
    if (me) {
      me.x = nx;
      me.y = ny;
      me.dir = spriteDirection(action.dx, action.dy, me.dir);
      me.lastMoveAt = now;
    }
    socket.emit(SKELETON_EVENTS.move, { x: nx, y: ny });
  }
  function emitPrimaryAction() {
    if (state.phase !== "playing" || state.chat.open) return;
    const me = state.players.get(state.myId);
    if (!me) return;
    socket.emit(SKELETON_EVENTS.action, { x: me.x, y: me.y });
  }
  function setTypingStatus(active) {
    if (!state.myId || state.chat.typingSent === active) return;
    state.chat.typingSent = active;
    socket.emit(SKELETON_EVENTS.chatTyping, { active });
  }
  function setChatOpen(open, focusInput = true) {
    const next = Boolean(open);
    if (state.chat.open === next) return;
    state.chat.open = next;
    chatDockEl.classList.toggle("open", next);
    chatFormEl.classList.toggle("hidden", !next);
    renderChatMessages();
    if (next) {
      clearAllHoldMoves();
      state.moveQueue = [];
      state.camera.dragging = false;
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
  function applyPlayerPayload(payload) {
    const previous = state.players.get(payload.id);
    const player = {
      id: payload.id,
      pseudo: payload.pseudo,
      avatar: normalizeAvatarIndex(payload.avatar),
      colorIndex: normalizeColorIndex(payload.colorIndex),
      color: payload.color || colorForPseudo(payload.pseudo),
      x: Number(payload.x) || 0,
      y: Number(payload.y) || 0,
      score: Math.max(0, Number(payload.score) || 0),
      energy: Math.max(0, Number(payload.energy) || 0),
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
      state.me.x = player.x;
      state.me.y = player.y;
    }
  }
  function applySnapshot(payload) {
    state.phase = "playing";
    state.myId = payload.myId || state.myId;
    state.startTime = payload.startTime || Date.now();
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
    hudEl.classList.remove("hidden");
    centerCameraOnMe(true);
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
    localStorage.setItem("pseudo", pseudo);
    joinErrorEl.textContent = "";
    socket.emit(SKELETON_EVENTS.join, {
      pseudo,
      avatar: state.myAvatar,
      colorIndex: state.myColorIndex
    });
  });
  chatToggleBtnEl?.addEventListener("click", toggleChat);
  chatFormEl?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!state.myId) return;
    const text = String(chatInputEl?.value || "").replace(/\s+/g, " ").trim();
    if (!text) return;
    socket.emit(SKELETON_EVENTS.chatSend, { text });
    chatInputEl.value = "";
    chatInputEl.focus();
    setTypingStatus(true);
  });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("blur", clearAllHoldMoves);
  canvas.addEventListener("mousedown", (event) => {
    if (state.chat.open) return;
    if (event.button === 0) {
      event.preventDefault();
      emitPrimaryAction();
      return;
    }
    if (event.button !== 1) return;
    state.camera.dragging = true;
    state.camera.isManual = true;
    state.camera.dragLastX = event.clientX;
    state.camera.dragLastY = event.clientY;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
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
      if (!event.repeat) emitPrimaryAction();
      return;
    }
    const delta = MOVE_KEY_DELTAS[event.code];
    if (!delta) return;
    registerHoldMove(event.code, delta[0], delta[1]);
  });
  window.addEventListener("keyup", (event) => clearHoldMove(event.code));
  socket.on("connect", () => {
    state.myId = socket.id;
    state.chat.typingSent = false;
  });
  socket.on(SKELETON_EVENTS.joinError, (payload = {}) => {
    state.phase = "lobby";
    lobbyEl.classList.remove("hidden");
    joinErrorEl.textContent = payload.message || "Impossible de rejoindre.";
  });
  socket.on(SKELETON_EVENTS.state, applySnapshot);
  socket.on(SKELETON_EVENTS.playerJoined, (payload) => applyPlayerPayload(payload));
  socket.on(SKELETON_EVENTS.playerLeft, (payload) => {
    state.players.delete(payload.id);
  });
  socket.on(SKELETON_EVENTS.playerMoved, (payload) => {
    const player = state.players.get(payload.id);
    if (!player) return;
    if (player.x !== payload.x || player.y !== payload.y) {
      player.dir = spriteDirection(payload.x - player.x, payload.y - player.y, player.dir);
      player.lastMoveAt = Date.now();
    }
    player.x = payload.x;
    player.y = payload.y;
    if (player.id === state.myId) {
      state.me.x = payload.x;
      state.me.y = payload.y;
    }
  });
  socket.on(SKELETON_EVENTS.actionApplied, (payload = {}) => {
    const player = state.players.get(payload.playerId);
    if (!player) return;
    player.score = Math.max(player.score || 0, Number(payload.score) || 0);
    player.energy = Number.isFinite(payload.energy) ? payload.energy : player.energy;
  });
  socket.on(SKELETON_EVENTS.chatMessage, (payload) => appendChatMessage(payload));
  socket.on(SKELETON_EVENTS.chatTyping, (payload = {}) => {
    const player = state.players.get(payload.id);
    if (!player) return;
    player.isTyping = Boolean(payload.active);
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
  resizeCanvas();
  startGameLoop();
})();
