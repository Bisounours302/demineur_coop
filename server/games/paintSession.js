const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { createSessionCore } = require('../core/createSessionCore');

const GRID_W = 140;
const GRID_H = 140;
const TOTAL_CELLS = GRID_W * GRID_H;

const MAX_PLAYERS = 40;
const MAX_PLACES_PER_SECOND = 10;
const EMPTY_PIXEL = 255;
const AUTOSAVE_INTERVAL_MS = 5 * 60 * 1000;
const SAVE_FORMAT_VERSION = 1;
const PAINT_SAVE_DIR = path.join(__dirname, '..', '..', 'data', 'paint');

const PAINT_PALETTE = [
  '#000000',
  '#3a3a3a',
  '#7a7a7a',
  '#ffffff',
  '#f94144',
  '#f3722c',
  '#f8961e',
  '#f9c74f',
  '#90be6d',
  '#43aa8b',
  '#4d908e',
  '#577590',
  '#277da1',
  '#7b2cbf',
  '#f72585',
  '#4cc9f0',
];

function normalizePersistKey(value) {
  const sanitized = String(value || 'paint-global')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 60);

  return sanitized || 'paint-global';
}

function createPaintSession(options = {}) {
  const persistKey = normalizePersistKey(options.persistKey);
  const saveFilePath = path.join(PAINT_SAVE_DIR, `${persistKey}.json`);

  const core = createSessionCore({
    maxPlayers: MAX_PLAYERS,
    isInBounds: (_, x, y) => x >= 0 && x < GRID_W && y >= 0 && y < GRID_H,
    getSpawn: () => ({
      x: Math.floor(Math.random() * GRID_W),
      y: Math.floor(Math.random() * GRID_H),
    }),
    buildPlayerExtras: (_, __, ___, savedProgress, spawn) => {
      const canRestoreCoords = Number.isInteger(savedProgress?.x)
        && Number.isInteger(savedProgress?.y)
        && savedProgress.x >= 0
        && savedProgress.x < GRID_W
        && savedProgress.y >= 0
        && savedProgress.y < GRID_H;

      return {
        x: canRestoreCoords ? savedProgress.x : spawn.x,
        y: canRestoreCoords ? savedProgress.y : spawn.y,
        pixelsPlaced: Math.max(0, Number(savedProgress?.pixelsPlaced) || 0),
        placeWindowStartedAt: 0,
        placeCountInWindow: 0,
      };
    },
    toPublicPlayer: (player) => ({
      pixelsPlaced: Math.max(0, Number(player.pixelsPlaced) || 0),
    }),
    getProgressSnapshot: (player) => ({
      x: player.x,
      y: player.y,
      avatar: player.avatar,
      colorIndex: player.colorIndex,
      pixelsPlaced: Math.max(0, Number(player.pixelsPlaced) || 0),
    }),
    onBeforeRemovePlayer: (player) => {
      player.isTyping = false;
    },
  });

  const state = core.state;
  Object.assign(state, {
    phase: 'playing',
    pixels: new Uint8Array(TOTAL_CELLS),
    startTime: Date.now(),
    mapDirty: false,
  });

  let autosaveTimer = null;
  let saveInFlight = false;
  let pendingSave = false;

  state.pixels.fill(EMPTY_PIXEL);

  function toBase64(typedArray) {
    return Buffer
      .from(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength)
      .toString('base64');
  }

  function idx(x, y) {
    return y * GRID_W + x;
  }

  function normalizePaletteIndex(value) {
    const index = Number(value);
    if (!Number.isInteger(index)) return -1;
    if (index < 0 || index >= PAINT_PALETTE.length) return -1;
    return index;
  }

  function buildSnapshotPayload() {
    return {
      version: SAVE_FORMAT_VERSION,
      savedAt: Date.now(),
      startTime: Number(state.startTime) || Date.now(),
      map: {
        width: GRID_W,
        height: GRID_H,
        totalCells: TOTAL_CELLS,
        emptyPixel: EMPTY_PIXEL,
        palette: PAINT_PALETTE,
        data: {
          pixels: toBase64(state.pixels),
        },
      },
    };
  }

  function loadSnapshotFromDisk() {
    let raw;
    try {
      raw = fs.readFileSync(saveFilePath, 'utf8');
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        return;
      }
      console.error(`[paint] Impossible de lire la sauvegarde ${saveFilePath}:`, error);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const map = parsed && parsed.map;
      if (!map) return;

      if (Number(map.width) !== GRID_W || Number(map.height) !== GRID_H || Number(map.totalCells) !== TOTAL_CELLS) {
        console.warn(`[paint] Sauvegarde ignoree (dimensions incompatibles) pour ${persistKey}.`);
        return;
      }

      const encodedPixels = map.data && map.data.pixels;
      if (typeof encodedPixels !== 'string') {
        return;
      }

      const decoded = Buffer.from(encodedPixels, 'base64');
      if (decoded.length !== TOTAL_CELLS) {
        console.warn(`[paint] Sauvegarde ignoree (taille invalide) pour ${persistKey}.`);
        return;
      }

      state.pixels = Uint8Array.from(decoded);
      if (Number.isFinite(Number(parsed.startTime))) {
        state.startTime = Number(parsed.startTime);
      }

      console.log(`[paint] Carte restauree depuis ${saveFilePath}`);
    } catch (error) {
      console.error(`[paint] Sauvegarde corrompue (${saveFilePath}):`, error);
    }
  }

  async function flushSnapshotIfNeeded(force = false) {
    if (!force && !state.mapDirty) {
      return;
    }

    if (saveInFlight) {
      pendingSave = true;
      return;
    }

    saveInFlight = true;
    pendingSave = false;
    state.mapDirty = false;

    try {
      await fsp.mkdir(PAINT_SAVE_DIR, { recursive: true });
      await fsp.writeFile(saveFilePath, JSON.stringify(buildSnapshotPayload()), 'utf8');
    } catch (error) {
      state.mapDirty = true;
      pendingSave = true;
      console.error(`[paint] Echec de sauvegarde (${saveFilePath}):`, error);
    } finally {
      saveInFlight = false;
      if (pendingSave) {
        void flushSnapshotIfNeeded(false);
      }
    }
  }

  function flushSnapshotSyncIfNeeded(force = false) {
    if (!force && !state.mapDirty) {
      return;
    }

    try {
      fs.mkdirSync(PAINT_SAVE_DIR, { recursive: true });
      fs.writeFileSync(saveFilePath, JSON.stringify(buildSnapshotPayload()), 'utf8');
      state.mapDirty = false;
      pendingSave = false;
    } catch (error) {
      state.mapDirty = true;
      pendingSave = true;
      console.error(`[paint] Echec de sauvegarde sync (${saveFilePath}):`, error);
    }
  }

  function markMapDirty() {
    state.mapDirty = true;
    if (saveInFlight) {
      pendingSave = true;
    }
  }

  function startAutosave() {
    if (autosaveTimer) {
      return;
    }

    autosaveTimer = setInterval(() => {
      void flushSnapshotIfNeeded(false);
    }, AUTOSAVE_INTERVAL_MS);

    if (typeof autosaveTimer.unref === 'function') {
      autosaveTimer.unref();
    }
  }

  function dispose() {
    if (autosaveTimer) {
      clearInterval(autosaveTimer);
      autosaveTimer = null;
    }

    flushSnapshotSyncIfNeeded(false);
  }

  loadSnapshotFromDisk();
  startAutosave();

  function canPlacePixel(player) {
    const now = Date.now();
    if (now - player.placeWindowStartedAt >= 1000) {
      player.placeWindowStartedAt = now;
      player.placeCountInWindow = 0;
    }

    if (player.placeCountInWindow >= MAX_PLACES_PER_SECOND) {
      return false;
    }

    player.placeCountInWindow += 1;
    return true;
  }

  function getPublicState(forSocketId = null) {
    return {
      phase: state.phase,
      myId: forSocketId,
      startTime: state.startTime,
      map: {
        width: GRID_W,
        height: GRID_H,
        totalCells: TOTAL_CELLS,
        palette: PAINT_PALETTE,
        emptyPixel: EMPTY_PIXEL,
        data: {
          pixels: toBase64(state.pixels),
        },
      },
      chatMessages: core.getChatMessages(),
      players: core.getPublicPlayers(),
    };
  }

  function placePixel(socketId, x, y, paletteIndex) {
    const validated = core.validateAction(socketId, x, y);
    if (!validated.ok) {
      return validated;
    }

    const { player } = validated;
    const normalizedIndex = normalizePaletteIndex(paletteIndex);
    if (normalizedIndex < 0) {
      return { ok: false, error: 'Couleur invalide.' };
    }

    if (!canPlacePixel(player)) {
      return { ok: false, error: 'Trop rapide.' };
    }

    const i = idx(x, y);
    const previous = state.pixels[i];
    state.pixels[i] = normalizedIndex;
    if (previous !== normalizedIndex) {
      markMapDirty();
    }
    player.pixelsPlaced += 1;

    return {
      ok: true,
      x,
      y,
      paletteIndex: normalizedIndex,
      playerId: player.id,
      pseudo: player.pseudo,
      pixelsPlaced: player.pixelsPlaced,
    };
  }

  return {
    addChatMessage: core.addChatMessage,
    addPlayer: core.addPlayer,
    getPublicState,
    movePlayer: core.movePlayer,
    placePixel,
    removePlayer: core.removePlayer,
    setPlayerTyping: core.setPlayerTyping,
    getPlayerCount: core.getPlayerCount,
    dispose,
  };
}

module.exports = {
  createPaintSession,
};
