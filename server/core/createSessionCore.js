const {
  MAX_CHAT_MESSAGES,
  MAX_CHAT_MESSAGE_LENGTH,
  PLAYER_COLORS,
} = require('./sharedConstants');
const {
  hashPseudo,
  normalizeAvatarChoice,
  normalizeColorChoice,
  normalizeChatMessage,
} = require('./sharedUtils');

/**
 * @typedef {Object} SessionPlayer
 * @property {string} id
 * @property {string} pseudo
 * @property {number} avatar
 * @property {number} colorIndex
 * @property {number} x
 * @property {number} y
 * @property {boolean} isTyping
 */

/**
 * @typedef {Object} SessionState
 * @property {string} phase
 * @property {Map<string, SessionPlayer>} players
 * @property {Map<string, Object>} pseudoProgress
 * @property {Array<Object>} chatMessages
 * @property {number} startTime
 */

/**
 * @typedef {Object} SessionCoreOptions
 * @property {number} [maxPlayers]
 * @property {number} [maxChatMessages]
 * @property {number} [maxChatMessageLength]
 * @property {(state: SessionState, x: number, y: number) => boolean} isInBounds
 * @property {(player: SessionPlayer, x: number, y: number) => boolean} [isAdjacentToPlayer]
 * @property {(state: SessionState, pseudo: string) => (boolean|{ok:boolean,error?:string})} [canJoin]
 * @property {(state: SessionState, player: SessionPlayer) => (boolean|{ok:boolean,error?:string})} [canAct]
 */

function defaultIsAdjacentToPlayer(player, x, y) {
  return Math.abs(player.x - x) <= 1 && Math.abs(player.y - y) <= 1;
}

function normalizeCheckResult(result, fallbackError) {
  if (result === undefined || result === true) {
    return { ok: true };
  }

  if (result === false) {
    return { ok: false, error: fallbackError };
  }

  if (typeof result === 'object') {
    if (result.ok === false) {
      return { ok: false, error: String(result.error || fallbackError) };
    }
    return { ok: true };
  }

  return { ok: false, error: fallbackError };
}

/**
 * Build a reusable realtime session core shared by game modes.
 * @param {SessionCoreOptions & Record<string, any>} options
 */
function createSessionCore(options = {}) {
  const {
    maxPlayers = 20,
    maxChatMessages = MAX_CHAT_MESSAGES,
    maxChatMessageLength = MAX_CHAT_MESSAGE_LENGTH,
    isInBounds,
    isAdjacentToPlayer = defaultIsAdjacentToPlayer,
    canJoin,
    canAct,
    getSpawn,
    buildPlayerExtras,
    toPublicPlayer,
    getProgressSnapshot,
    shouldPersistProgress = () => true,
    onAfterAddPlayer,
    onBeforeRemovePlayer,
    onBeforeValidateAction,
    onAfterMove,
  } = options;

  if (typeof isInBounds !== 'function') {
    throw new Error('createSessionCore requires an isInBounds function.');
  }

  /** @type {SessionState} */
  const state = {
    phase: 'playing',
    players: new Map(),
    pseudoProgress: new Map(),
    chatMessages: [],
    startTime: Date.now(),
  };

  function colorForPlayer(player) {
    const colorIndex = normalizeColorChoice(player?.colorIndex);
    return PLAYER_COLORS[colorIndex] || PLAYER_COLORS[hashPseudo(String(player?.pseudo || '')) % PLAYER_COLORS.length];
  }

  function publicPlayer(player) {
    const base = {
      id: player.id,
      pseudo: player.pseudo,
      avatar: normalizeAvatarChoice(player.avatar),
      colorIndex: normalizeColorChoice(player.colorIndex),
      x: player.x,
      y: player.y,
      isTyping: Boolean(player.isTyping),
      color: colorForPlayer(player),
    };

    if (typeof toPublicPlayer !== 'function') {
      return base;
    }

    const extra = toPublicPlayer(player, state) || {};
    return {
      ...base,
      ...extra,
      color: extra.color || base.color,
    };
  }

  function getPublicPlayers() {
    return Array.from(state.players.values()).map(publicPlayer);
  }

  function getChatMessages() {
    return state.chatMessages.slice();
  }

  function addPlayer(socketId, pseudo, avatarChoice = 0, colorChoice) {
    const cleanPseudo = String(pseudo || '').trim();
    if (!cleanPseudo) {
      return { ok: false, error: 'Pseudo invalide.' };
    }

    if (cleanPseudo.length > 20) {
      return { ok: false, error: 'Pseudo trop long (20 caracteres max).' };
    }

    const joinCheck = normalizeCheckResult(
      typeof canJoin === 'function' ? canJoin(state, cleanPseudo) : true,
      'Impossible de rejoindre.',
    );
    if (!joinCheck.ok) {
      return joinCheck;
    }

    if (state.players.size >= maxPlayers) {
      return { ok: false, error: `Serveur plein (${maxPlayers} joueurs max).` };
    }

    for (const p of state.players.values()) {
      if (p.pseudo === cleanPseudo) {
        return { ok: false, error: 'Pseudo deja pris.' };
      }
    }

    const savedProgress = state.pseudoProgress.get(cleanPseudo);
    const spawn = typeof getSpawn === 'function'
      ? (getSpawn(state, cleanPseudo, savedProgress) || { x: 0, y: 0 })
      : { x: 0, y: 0 };

    const hasExplicitAvatarChoice = Number.isInteger(Number(avatarChoice));
    const hasExplicitColorChoice = Number.isInteger(Number(colorChoice));

    const avatar = hasExplicitAvatarChoice
      ? normalizeAvatarChoice(avatarChoice)
      : normalizeAvatarChoice(savedProgress?.avatar);

    const colorIndex = hasExplicitColorChoice
      ? normalizeColorChoice(colorChoice)
      : (savedProgress && savedProgress.colorIndex !== undefined)
        ? normalizeColorChoice(savedProgress.colorIndex)
        : (hashPseudo(cleanPseudo) % PLAYER_COLORS.length);

    const hasSavedCoords = Number.isInteger(savedProgress?.x)
      && Number.isInteger(savedProgress?.y)
      && isInBounds(state, savedProgress.x, savedProgress.y);

    const basePlayer = {
      id: socketId,
      pseudo: cleanPseudo,
      avatar,
      colorIndex,
      x: hasSavedCoords
        ? savedProgress.x
        : spawn.x,
      y: hasSavedCoords
        ? savedProgress.y
        : spawn.y,
      isTyping: false,
    };

    const extra = typeof buildPlayerExtras === 'function'
      ? (buildPlayerExtras(basePlayer, state, cleanPseudo, savedProgress, spawn) || {})
      : {};

    const player = {
      ...basePlayer,
      ...extra,
    };

    state.players.set(socketId, player);

    if (typeof onAfterAddPlayer === 'function') {
      onAfterAddPlayer(player, state, savedProgress);
    }

    return {
      ok: true,
      player: publicPlayer(player),
    };
  }

  function removePlayer(socketId) {
    const player = state.players.get(socketId);
    if (!player) {
      return false;
    }

    if (typeof onBeforeRemovePlayer === 'function') {
      onBeforeRemovePlayer(player, state);
    }

    const persist = shouldPersistProgress(player, state) !== false;
    if (persist) {
      const snapshot = typeof getProgressSnapshot === 'function'
        ? getProgressSnapshot(player, state)
        : {
          x: player.x,
          y: player.y,
          avatar: normalizeAvatarChoice(player.avatar),
          colorIndex: normalizeColorChoice(player.colorIndex),
        };

      if (snapshot) {
        state.pseudoProgress.set(player.pseudo, snapshot);
      }
    } else {
      state.pseudoProgress.delete(player.pseudo);
    }

    return state.players.delete(socketId);
  }

  function validateAction(socketId, x, y, distanceError = 'Case hors rayon d action.') {
    const player = state.players.get(socketId);
    if (!player) {
      return { ok: false, error: 'Joueur introuvable.' };
    }

    if (typeof onBeforeValidateAction === 'function') {
      onBeforeValidateAction(player, state);
    }

    const actionCheck = normalizeCheckResult(
      typeof canAct === 'function' ? canAct(state, player) : true,
      'Action impossible pour le moment.',
    );
    if (!actionCheck.ok) {
      return actionCheck;
    }

    if (!Number.isInteger(x) || !Number.isInteger(y) || !isInBounds(state, x, y)) {
      return { ok: false, error: 'Coordonnees invalides.' };
    }

    if (!isAdjacentToPlayer(player, x, y)) {
      return { ok: false, error: distanceError };
    }

    return { ok: true, player };
  }

  function movePlayer(socketId, x, y, distanceError = 'Deplacement invalide.') {
    const validated = validateAction(socketId, x, y, distanceError);
    if (!validated.ok) {
      return validated;
    }

    const { player } = validated;
    player.x = x;
    player.y = y;

    if (typeof onAfterMove === 'function') {
      onAfterMove(player, state);
    }

    return {
      ok: true,
      player: publicPlayer(player),
    };
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

    const text = normalizeChatMessage(message, maxChatMessageLength);
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
    if (state.chatMessages.length > maxChatMessages) {
      state.chatMessages = state.chatMessages.slice(-maxChatMessages);
    }

    return {
      ok: true,
      message: entry,
      player: publicPlayer(player),
    };
  }

  return {
    state,
    addChatMessage,
    addPlayer,
    addPlayerPublic: publicPlayer,
    colorForPlayer,
    getChatMessages,
    getPlayerCount: () => state.players.size,
    getPublicPlayers,
    movePlayer,
    removePlayer,
    setPlayerTyping,
    validateAction,
  };
}

module.exports = {
  createSessionCore,
};
