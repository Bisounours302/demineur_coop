const {
  generateValidMap,
  floodFillReveal,
  idx,
  GRID_W,
  GRID_H,
  TOTAL_CELLS,
} = require('./generator');

const MAX_PLAYERS = 10;
const MAX_EXPLOSIONS = 10;
const STUN_DURATION_MS = 2000;
const STATS_DURATION_MS = 60_000;
const AVATAR_COUNT = 6;
const MAX_CHAT_MESSAGES = 100;
const MAX_CHAT_MESSAGE_LENGTH = 180;

const PLAYER_COLORS = [
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#FF8A80',
  '#80D8FF',
  '#B9F6CA',
  '#FFD180',
  '#EA80FC',
  '#A7FFEB',
  '#FF9E80',
  '#82B1FF',
  '#CCFF90',
  '#FFAB91',
  '#B388FF',
  '#84FFFF',
];

const state = {
  phase: 'waiting',
  map: null,
  revealed: new Set(),
  revealedSafeCount: 0,
  flagged: new Map(),
  explosions: 0,
  explodedBy: [],
  players: new Map(),
  startTime: null,
  endTime: null,
  statsTimeout: null,
  statsEndsAt: null,
  seed: 0,
  result: null,
  pseudoProgress: new Map(),
  chatMessages: [],
};

const stunTimers = new Map();

function toBase64(typedArray) {
  return Buffer
    .from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
    .toString('base64');
}

function randomSeed() {
  return Math.floor(Math.random() * 0x7fffffff);
}

function isInBounds(x, y) {
  return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H;
}

function isAdjacentToPlayer(player, x, y) {
  return Math.abs(player.x - x) <= 1 && Math.abs(player.y - y) <= 1;
}

function hashPseudo(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

function colorForPseudo(pseudo) {
  return PLAYER_COLORS[hashPseudo(pseudo) % PLAYER_COLORS.length];
}

function normalizeAvatarChoice(avatarChoice) {
  const value = Number(avatarChoice);
  if (!Number.isInteger(value)) return 0;
  if (value < 0 || value >= AVATAR_COUNT) return 0;
  return value;
}

function normalizeColorChoice(colorChoice) {
  const value = Number(colorChoice);
  if (!Number.isInteger(value)) return 0;
  if (value < 0 || value >= PLAYER_COLORS.length) return 0;
  return value;
}

function normalizeChatMessage(message) {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, MAX_CHAT_MESSAGE_LENGTH);
}

function clearStatsTimer() {
  if (state.statsTimeout) {
    clearTimeout(state.statsTimeout);
    state.statsTimeout = null;
  }
  state.statsEndsAt = null;
}

function clearStunTimer(socketId) {
  const timer = stunTimers.get(socketId);
  if (timer) {
    clearTimeout(timer);
    stunTimers.delete(socketId);
  }
}

function refreshStun(player) {
  if (player.stunned && player.stunEndTime && Date.now() >= player.stunEndTime) {
    player.stunned = false;
    player.stunEndTime = 0;
  }
}

function numberOrFallback(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function savePseudoProgressFromPlayer(player) {
  if (!player || !player.pseudo) return;

  refreshStun(player);
  state.pseudoProgress.set(player.pseudo, {
    x: player.x,
    y: player.y,
    avatar: normalizeAvatarChoice(player.avatar),
    colorIndex: normalizeColorChoice(player.colorIndex),
    stunned: Boolean(player.stunned),
    stunEndTime: player.stunEndTime || 0,
    cellsRevealed: Math.max(0, numberOrFallback(player.cellsRevealed, 0)),
    flagsPlaced: Math.max(0, numberOrFallback(player.flagsPlaced, 0)),
    bombsTriggered: Math.max(0, numberOrFallback(player.bombsTriggered, 0)),
    correctFlags: Math.max(0, numberOrFallback(player.correctFlags, 0)),
    spawnZone: player.spawnZone,
  });
}

function colorForPlayer(player) {
  const colorIndex = normalizeColorChoice(player?.colorIndex);
  return PLAYER_COLORS[colorIndex] || colorForPseudo(String(player?.pseudo || ''));
}

function getZoneCellsByCenter() {
  const result = state.map.zoneCenters.map(() => []);

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = idx(x, y);
      if (!state.map.startZone[i]) continue;

      let bestZone = 0;
      let bestDist = Number.POSITIVE_INFINITY;

      for (let z = 0; z < state.map.zoneCenters.length; z++) {
        const [cx, cy] = state.map.zoneCenters[z];
        const dx = x - cx;
        const dy = y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          bestZone = z;
        }
      }

      result[bestZone].push({ x, y, i });
    }
  }

  return result;
}

function chooseZoneForSpawn() {
  const counts = state.map.zoneCenters.map(() => 0);
  for (const p of state.players.values()) {
    if (typeof p.spawnZone === 'number' && counts[p.spawnZone] !== undefined) {
      counts[p.spawnZone] += 1;
    }
  }

  let bestZone = 0;
  let bestCount = counts[0] || 0;
  for (let i = 1; i < counts.length; i++) {
    if (counts[i] < bestCount) {
      bestZone = i;
      bestCount = counts[i];
    }
  }
  return bestZone;
}

function pickSpawnPosition(zoneIndex, zoneCells) {
  const occupied = new Set();
  for (const p of state.players.values()) {
    occupied.add(idx(p.x, p.y));
  }

  const cells = zoneCells[zoneIndex] || [];
  if (cells.length > 0) {
    const startOffset = Math.floor(Math.random() * cells.length);
    for (let step = 0; step < cells.length; step++) {
      const cell = cells[(startOffset + step) % cells.length];
      if (!occupied.has(cell.i)) {
        return { x: cell.x, y: cell.y };
      }
    }
  }

  const fallback = state.map.zoneCenters[zoneIndex] || [Math.floor(GRID_W / 2), Math.floor(GRID_H / 2)];
  return { x: fallback[0], y: fallback[1] };
}

function scheduleStunRelease(player, durationMs) {
  clearStunTimer(player.id);
  if (durationMs <= 0) {
    player.stunned = false;
    player.stunEndTime = 0;
    return;
  }

  const timeout = setTimeout(() => {
    const latest = state.players.get(player.id);
    if (!latest) return;
    latest.stunned = false;
    latest.stunEndTime = 0;
    stunTimers.delete(player.id);
    savePseudoProgressFromPlayer(latest);
  }, durationMs);

  stunTimers.set(player.id, timeout);
}

function resetPlayerForNewGame(player, zoneCells) {
  clearStunTimer(player.id);
  const zone = chooseZoneForSpawn();
  const spawn = pickSpawnPosition(zone, zoneCells);

  player.x = spawn.x;
  player.y = spawn.y;
  player.stunned = false;
  player.stunEndTime = 0;
  player.cellsRevealed = 0;
  player.flagsPlaced = 0;
  player.bombsTriggered = 0;
  player.correctFlags = 0;
  player.spawnZone = zone;
  player.isTyping = false;
  savePseudoProgressFromPlayer(player);
}

function publicPlayer(player) {
  refreshStun(player);
  const colorIndex = normalizeColorChoice(player.colorIndex);
  return {
    id: player.id,
    pseudo: player.pseudo,
    avatar: normalizeAvatarChoice(player.avatar),
    colorIndex,
    x: player.x,
    y: player.y,
    stunned: player.stunned,
    stunEndTime: player.stunEndTime || 0,
    cellsRevealed: player.cellsRevealed,
    flagsPlaced: player.flagsPlaced,
    bombsTriggered: player.bombsTriggered,
    correctFlags: player.correctFlags,
    spawnZone: player.spawnZone,
    isTyping: Boolean(player.isTyping),
    color: PLAYER_COLORS[colorIndex] || colorForPseudo(player.pseudo),
  };
}

function revealedCellsPayload() {
  const cells = [];
  for (const i of state.revealed) {
    const x = i % GRID_W;
    const y = Math.floor(i / GRID_W);
    cells.push({ x, y, value: state.map.numbers[i] });
  }
  return cells;
}

function flagsPayload() {
  const flags = [];
  for (const [i, pseudo] of state.flagged.entries()) {
    const x = i % GRID_W;
    const y = Math.floor(i / GRID_W);
    flags.push({ x, y, pseudo });
  }
  return flags;
}

function chatMessagesPayload() {
  return state.chatMessages.slice();
}

function getPublicState(forSocketId = null) {
  return {
    phase: state.phase,
    seed: state.seed,
    result: state.result,
    explosions: state.explosions,
    maxExplosions: MAX_EXPLOSIONS,
    startTime: state.startTime,
    endTime: state.endTime,
    statsEndsAt: state.statsEndsAt,
    myId: forSocketId,
    map: {
      width: state.map.width,
      height: state.map.height,
      totalCells: state.map.totalCells,
      bombCount: state.map.bombCount,
      zoneCenters: state.map.zoneCenters,
      data: {
        bombs: toBase64(state.map.bombs),
        numbers: toBase64(state.map.numbers),
        startZone: toBase64(state.map.startZone),
        safeZone: toBase64(state.map.safeZone),
      },
    },
    revealed: revealedCellsPayload(),
    flags: flagsPayload(),
    chatMessages: chatMessagesPayload(),
    players: Array.from(state.players.values()).map(publicPlayer),
  };
}

function initNewGame(seed = randomSeed()) {
  clearStatsTimer();

  const { map } = generateValidMap(seed);
  state.map = map;
  state.phase = 'playing';
  state.revealed = new Set();
  state.revealedSafeCount = 0;
  state.flagged = new Map();
  state.explosions = 0;
  state.explodedBy = [];
  state.startTime = Date.now();
  state.endTime = null;
  state.seed = map.seed;
  state.result = null;
  state.pseudoProgress = new Map();

  const zoneCells = getZoneCellsByCenter();
  for (const player of state.players.values()) {
    resetPlayerForNewGame(player, zoneCells);
  }

  return getPublicState();
}

function addPlayer(socketId, pseudo, avatarChoice = 0, colorChoice) {
  if (!state.map) {
    initNewGame();
  }

  const cleanPseudo = String(pseudo || '').trim();
  if (!cleanPseudo) {
    return { ok: false, error: 'Pseudo invalide.' };
  }

  if (cleanPseudo.length > 20) {
    return { ok: false, error: 'Pseudo trop long (20 caractères max).' };
  }

  if (state.phase === 'stats') {
    return { ok: false, error: 'Partie en écran de stats. Attends la prochaine manche.' };
  }

  if (state.players.size >= MAX_PLAYERS) {
    return { ok: false, error: `Serveur plein (${MAX_PLAYERS} joueurs max).` };
  }

  for (const p of state.players.values()) {
    if (p.pseudo === cleanPseudo) {
      return { ok: false, error: 'Pseudo déjà pris.' };
    }
  }

  const zoneCells = getZoneCellsByCenter();
  const savedProgress = state.pseudoProgress.get(cleanPseudo);
  const zone = Number.isInteger(savedProgress?.spawnZone)
    ? savedProgress.spawnZone
    : chooseZoneForSpawn();
  const spawn = pickSpawnPosition(zone, zoneCells);

  const savedX = numberOrFallback(savedProgress?.x, spawn.x);
  const savedY = numberOrFallback(savedProgress?.y, spawn.y);
  const canRestoreCoords = Number.isInteger(savedX) && Number.isInteger(savedY) && isInBounds(savedX, savedY);
  const savedStunEnd = Math.max(0, numberOrFallback(savedProgress?.stunEndTime, 0));
  const savedStunned = Boolean(savedProgress?.stunned) && savedStunEnd > Date.now();
  const hasExplicitAvatarChoice = Number.isInteger(Number(avatarChoice));
  const hasExplicitColorChoice = Number.isInteger(Number(colorChoice));
  const avatarToUse = hasExplicitAvatarChoice
    ? normalizeAvatarChoice(avatarChoice)
    : normalizeAvatarChoice(savedProgress?.avatar);
  const colorIndexToUse = hasExplicitColorChoice
    ? normalizeColorChoice(colorChoice)
    : (savedProgress && savedProgress.colorIndex !== undefined)
      ? normalizeColorChoice(savedProgress.colorIndex)
      : (hashPseudo(cleanPseudo) % PLAYER_COLORS.length);

  const player = {
    id: socketId,
    pseudo: cleanPseudo,
    avatar: avatarToUse,
    colorIndex: colorIndexToUse,
    x: canRestoreCoords ? savedX : spawn.x,
    y: canRestoreCoords ? savedY : spawn.y,
    stunned: savedStunned,
    stunEndTime: savedStunned ? savedStunEnd : 0,
    cellsRevealed: Math.max(0, numberOrFallback(savedProgress?.cellsRevealed, 0)),
    flagsPlaced: Math.max(0, numberOrFallback(savedProgress?.flagsPlaced, 0)),
    bombsTriggered: Math.max(0, numberOrFallback(savedProgress?.bombsTriggered, 0)),
    correctFlags: Math.max(0, numberOrFallback(savedProgress?.correctFlags, 0)),
    spawnZone: zone,
    isTyping: false,
  };

  state.players.set(socketId, player);
  if (savedStunned) {
    scheduleStunRelease(player, Math.max(0, savedStunEnd - Date.now()));
  }
  savePseudoProgressFromPlayer(player);

  return { ok: true, player: publicPlayer(player) };
}

function removePlayer(socketId) {
  const player = state.players.get(socketId);
  if (!player) {
    return false;
  }

  player.isTyping = false;

  if (state.phase === 'playing') {
    savePseudoProgressFromPlayer(player);
  } else {
    state.pseudoProgress.delete(player.pseudo);
  }

  clearStunTimer(socketId);
  return state.players.delete(socketId);
}

function setPlayerTyping(socketId, active) {
  const player = state.players.get(socketId);
  if (!player) {
    return { ok: false, error: 'Joueur introuvable.' };
  }

  player.isTyping = Boolean(active);
  return {
    ok: true,
    player: publicPlayer(player),
  };
}

function addChatMessage(socketId, message) {
  const player = state.players.get(socketId);
  if (!player) {
    return { ok: false, error: 'Joueur introuvable.' };
  }

  const text = normalizeChatMessage(message);
  if (!text) {
    return { ok: false, error: 'Message vide.' };
  }

  const entry = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
    pseudo: player.pseudo,
    color: colorForPlayer(player),
    text,
    at: Date.now(),
  };

  state.chatMessages.push(entry);
  if (state.chatMessages.length > MAX_CHAT_MESSAGES) {
    state.chatMessages = state.chatMessages.slice(-MAX_CHAT_MESSAGES);
  }

  return {
    ok: true,
    message: entry,
    player: publicPlayer(player),
  };
}

function validateAction(socketId, x, y, distanceError = 'Case hors rayon d action.') {
  const player = state.players.get(socketId);
  if (!player) {
    return { ok: false, error: 'Joueur introuvable.' };
  }

  if (state.phase !== 'playing') {
    return { ok: false, error: 'La partie n est pas en cours.' };
  }

  refreshStun(player);
  if (player.stunned) {
    return { ok: false, error: 'Joueur étourdi.' };
  }

  if (!Number.isInteger(x) || !Number.isInteger(y) || !isInBounds(x, y)) {
    return { ok: false, error: 'Coordonnées invalides.' };
  }

  if (!isAdjacentToPlayer(player, x, y)) {
    return { ok: false, error: distanceError };
  }

  return { ok: true, player };
}

function applyFlagCountForPseudo(pseudo, delta) {
  if (!pseudo || !delta) return;

  for (const p of state.players.values()) {
    if (p.pseudo !== pseudo) continue;
    p.flagsPlaced = Math.max(0, p.flagsPlaced + delta);
    break;
  }

  const saved = state.pseudoProgress.get(pseudo);
  if (saved) {
    saved.flagsPlaced = Math.max(0, numberOrFallback(saved.flagsPlaced, 0) + delta);
    state.pseudoProgress.set(pseudo, saved);
  }
}

function movePlayer(socketId, x, y) {
  const validated = validateAction(socketId, x, y, 'Déplacement invalide.');
  if (!validated.ok) {
    return validated;
  }

  const { player } = validated;
  player.x = x;
  player.y = y;
  savePseudoProgressFromPlayer(player);

  return { ok: true, player: publicPlayer(player) };
}

function removeFlagAtIndex(i) {
  const ownerPseudo = state.flagged.get(i);
  if (!ownerPseudo) {
    return;
  }

  applyFlagCountForPseudo(ownerPseudo, -1);
  state.flagged.delete(i);
}

function applyRevealCells(player, coords) {
  const cells = [];

  for (const [x, y] of coords) {
    const i = idx(x, y);
    if (state.revealed.has(i)) continue;

    state.revealed.add(i);
    removeFlagAtIndex(i);

    const value = state.map.numbers[i];
    cells.push({ x, y, value });

    if (value >= 0) {
      state.revealedSafeCount += 1;
      player.cellsRevealed += 1;
    }
  }

  return cells;
}

function setPlayerStunned(player) {
  player.stunned = true;
  player.stunEndTime = Date.now() + STUN_DURATION_MS;
  scheduleStunRelease(player, STUN_DURATION_MS);
  savePseudoProgressFromPlayer(player);
}

function checkLoseCondition() {
  return state.explosions >= MAX_EXPLOSIONS;
}

function checkWinCondition() {
  const safeCellsTotal = TOTAL_CELLS - state.map.bombCount;
  return state.revealedSafeCount >= safeCellsTotal;
}

function revealCell(socketId, x, y) {
  const validated = validateAction(socketId, x, y);
  if (!validated.ok) {
    return validated;
  }

  const { player } = validated;
  const i = idx(x, y);
  if (state.revealed.has(i)) {
    return { ok: true, cells: [], bomb: false, triggeredBy: player.pseudo };
  }

  if (state.flagged.has(i)) {
    return { ok: false, error: 'Retire le drapeau avant de creuser.' };
  }

  if (state.map.bombs[i]) {
    const cells = applyRevealCells(player, [[x, y]]);
    state.explosions += 1;
    player.bombsTriggered += 1;
    setPlayerStunned(player);
    state.explodedBy.push({
      pseudo: player.pseudo,
      x,
      y,
      at: Date.now(),
    });
    savePseudoProgressFromPlayer(player);

    return {
      ok: true,
      bomb: true,
      cells,
      triggeredBy: player.pseudo,
      playerId: player.id,
      stunEndTime: player.stunEndTime,
      explosionCount: state.explosions,
      gameOver: checkLoseCondition() ? 'lose' : null,
    };
  }

  const coords = state.map.numbers[i] === 0
    ? floodFillReveal(x, y, state.map.numbers, state.map.bombs)
    : [[x, y]];

  const cells = applyRevealCells(player, coords);
  savePseudoProgressFromPlayer(player);

  return {
    ok: true,
    bomb: false,
    cells,
    triggeredBy: player.pseudo,
    gameOver: checkWinCondition() ? 'win' : null,
  };
}

function toggleFlag(socketId, x, y) {
  const validated = validateAction(socketId, x, y);
  if (!validated.ok) {
    return validated;
  }

  const { player } = validated;
  const i = idx(x, y);
  if (state.revealed.has(i)) {
    return { ok: false, error: 'Case déjà révélée.' };
  }

  if (state.flagged.has(i)) {
    const owner = state.flagged.get(i);
    applyFlagCountForPseudo(owner, -1);
    state.flagged.delete(i);
    savePseudoProgressFromPlayer(player);
    return {
      ok: true,
      x,
      y,
      pseudo: player.pseudo,
      active: false,
    };
  }

  state.flagged.set(i, player.pseudo);
  player.flagsPlaced += 1;
  savePseudoProgressFromPlayer(player);

  return {
    ok: true,
    x,
    y,
    pseudo: player.pseudo,
    active: true,
  };
}

function computeFinalStats() {
  const durationMs = state.startTime && state.endTime
    ? Math.max(0, state.endTime - state.startTime)
    : 0;

  const perPseudoFlags = new Map();

  for (const [i, pseudo] of state.flagged.entries()) {
    if (!perPseudoFlags.has(pseudo)) {
      perPseudoFlags.set(pseudo, { correct: 0, incorrect: 0, total: 0 });
    }
    const row = perPseudoFlags.get(pseudo);
    row.total += 1;
    if (state.map.bombs[i]) {
      row.correct += 1;
    } else {
      row.incorrect += 1;
    }
  }

  const players = Array
    .from(state.players.values())
    .map((p) => {
      const f = perPseudoFlags.get(p.pseudo) || { correct: 0, incorrect: 0, total: 0 };
      p.correctFlags = f.correct;
      return {
        id: p.id,
        pseudo: p.pseudo,
        color: colorForPlayer(p),
        cellsRevealed: p.cellsRevealed,
        bombsTriggered: p.bombsTriggered,
        flagsCorrect: f.correct,
        flagsIncorrect: f.incorrect,
        flagsTotal: f.total,
        spawnZone: p.spawnZone,
      };
    })
    .sort((a, b) => {
      if (b.cellsRevealed !== a.cellsRevealed) return b.cellsRevealed - a.cellsRevealed;
      if (b.flagsCorrect !== a.flagsCorrect) return b.flagsCorrect - a.flagsCorrect;
      return a.bombsTriggered - b.bombsTriggered;
    });

  return {
    result: state.result,
    seed: state.seed,
    startTime: state.startTime,
    endTime: state.endTime,
    durationMs,
    explosions: state.explosions,
    maxExplosions: MAX_EXPLOSIONS,
    players,
    explodedBy: state.explodedBy.slice(),
    totalSafeCells: TOTAL_CELLS - state.map.bombCount,
    revealedSafeCells: state.revealedSafeCount,
  };
}

function endGame(result) {
  if (state.phase !== 'playing') {
    return null;
  }

  state.phase = 'stats';
  state.result = result;
  state.endTime = Date.now();
  state.statsEndsAt = Date.now() + STATS_DURATION_MS;
  state.pseudoProgress = new Map();

  for (const p of state.players.values()) {
    p.isTyping = false;
  }

  return computeFinalStats();
}

function setStatsTimeout(timeout) {
  clearStatsTimer();
  state.statsTimeout = timeout;
}

module.exports = {
  STATS_DURATION_MS,
  addChatMessage,
  setPlayerTyping,
  initNewGame,
  addPlayer,
  removePlayer,
  movePlayer,
  revealCell,
  toggleFlag,
  endGame,
  setStatsTimeout,
  getPublicState,
};
