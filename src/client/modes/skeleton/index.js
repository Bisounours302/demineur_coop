/**
 * Skeleton game mode — template for creating new modes.
 * Copy this file and customise the rendering, state, and event handling.
 */

import {
  PLAYER_COLORS,
  clamp,
  colorForPseudo,
  hashPseudo,
  loadImage,
  msToClock,
  normalizeAvatarIndex,
  normalizeColorIndex,
} from '../../core/shared.js';
import { SKELETON_EVENTS } from '../../../../shared/events.js';
import { createModeBootstrap } from '../../modules/bootstrap/createModeBootstrap.js';
import { spriteDirection, getSpriteFrame } from '../../modules/player/spriteUtils.js';
import { drawPlayerLabels } from '../../modules/player/drawLabels.js';
import { drawCheckerTiles } from '../../modules/tiles/drawCheckerTiles.js';

const TILE_SIZE = 24;
const GRID_W = 80;
const GRID_H = 80;
const ANIM_IDLE_MS = 220;
const ANIMAL_FRAME = 32;
const ANIMAL_COLS = 4;

const sprites = [
  loadImage('/assets/BIRDSPRITESHEET_Blue.png'),
  loadImage('/assets/BIRDSPRITESHEET_White.png'),
  loadImage('/assets/CATSPRITESHEET_Gray.png'),
  loadImage('/assets/CATSPRITESHEET_Orange.png'),
  loadImage('/assets/FOXSPRITESHEET.png'),
  loadImage('/assets/RACCOONSPRITESHEET.png'),
];

// ------------------------------------------------------------------- state
// Add your game-specific state fields here.
const state = {
  me: { x: 0, y: 0, score: 0 },
};

// -------------------------------------------------- skeleton-specific DOM
const hudPlayersEl = document.getElementById('hudPlayers');
const hudScoreEl = document.getElementById('hudScore');
const hudTimeEl = document.getElementById('hudTime');

// ----------------------------------------------------------------- helpers
function playerSheet(player) {
  if (Number.isInteger(player.avatar)) return sprites[normalizeAvatarIndex(player.avatar)];
  return sprites[hashPseudo(player.pseudo) % sprites.length];
}

function applyPlayerPayload(payload) {
  const previous = state.players.get(payload.id);

  let avatar = (payload.avatar !== undefined && payload.avatar !== null)
    ? normalizeAvatarIndex(payload.avatar)
    : (previous && Number.isInteger(previous.avatar))
      ? previous.avatar
      : (payload.id === state.myId ? state.myAvatar : hashPseudo(payload.pseudo) % sprites.length);

  let colorIndex = (payload.colorIndex !== undefined && payload.colorIndex !== null)
    ? normalizeColorIndex(payload.colorIndex)
    : (previous && Number.isInteger(previous.colorIndex))
      ? previous.colorIndex
      : (payload.id === state.myId ? state.myColorIndex : hashPseudo(payload.pseudo) % PLAYER_COLORS.length);

  const player = {
    id: payload.id,
    pseudo: payload.pseudo,
    colorIndex,
    color: payload.color || PLAYER_COLORS[colorIndex] || colorForPseudo(payload.pseudo),
    avatar,
    x: payload.x,
    y: payload.y,
    isTyping: Boolean(payload.isTyping),
    dir: previous ? previous.dir : 'down',
    lastMoveAt: previous ? previous.lastMoveAt : 0,
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

function drawPlayer(ctx, player, now) {
  const px = player.x * TILE_SIZE, py = player.y * TILE_SIZE;
  const sheet = playerSheet(player);
  if (sheet.loaded) {
    const frame = getSpriteFrame(player, now, { animIdleMs: ANIM_IDLE_MS, cols: ANIMAL_COLS });
    ctx.drawImage(sheet, frame.col * ANIMAL_FRAME, frame.row * ANIMAL_FRAME, ANIMAL_FRAME, ANIMAL_FRAME, px, py, TILE_SIZE, TILE_SIZE);
  } else {
    ctx.fillStyle = '#ffd86b';
    ctx.fillRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }
  return {
    x: px + TILE_SIZE * 0.5, y: py - 10,
    text: player.pseudo, isTyping: Boolean(player.isTyping),
    color: player.color || colorForPseudo(player.pseudo),
  };
}

// ----------------------------------------------------- your action here
function performPrimaryAction() {
  if (state.phase !== 'playing' || state.chat.open) return;
  const me = state.players.get(state.myId);
  if (!me) return;
  game.socket.emit(SKELETON_EVENTS.action, { x: me.x, y: me.y });
}

// --------------------------------------------------------- bootstrap
const game = createModeBootstrap({
  state,
  events: SKELETON_EVENTS,
  sprites,
  tileSize: TILE_SIZE,
  minScale: 0.2,
  maxScale: 2.2,
  animIdleMs: ANIM_IDLE_MS,
  animalFrame: ANIMAL_FRAME,
  animalCols: ANIMAL_COLS,
  hasPositionMove: true,
  cameraSmoothing: 0.05,
  cameraSnapThreshold: 5,

  getWorldSize: () => ({ w: GRID_W * TILE_SIZE, h: GRID_H * TILE_SIZE }),
  getFocusPosition: () => ({ x: state.me.x, y: state.me.y }),

  onApplyState(payload) {
    state.phase = 'playing';
    state.myId = payload.myId || state.myId;
    state.startTime = payload.startTime || Date.now();

    state.players = new Map();
    for (const p of payload.players || []) applyPlayerPayload(p);

    game.chatModule.setMessages(payload.chatMessages || []);

    const me = state.players.get(state.myId);
    if (me) { state.me.x = me.x; state.me.y = me.y; }

    game.els.lobby.classList.add('hidden');
    game.els.joinError.textContent = '';
    game.els.reconnect.classList.add('hidden');
    game.hudModule.show();
    game.centerCameraOnMe(true);
    if (state.chat.open) game.chatModule.setTypingStatus(true);
  },

  onPlayerJoined: applyPlayerPayload,
  onPlayerLeft: (payload) => { state.players.delete(payload.id); },

  onRender(now) {
    const { ctx, canvas } = game;
    const scale = state.camera.scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);

    const worldW = GRID_W * TILE_SIZE, worldH = GRID_H * TILE_SIZE;
    ctx.fillStyle = '#0a0a1e';
    ctx.fillRect(-200, -200, worldW + 400, worldH + 400);

    const viewW = canvas.width / scale, viewH = canvas.height / scale;
    const minX = clamp(Math.floor(state.camera.x / TILE_SIZE) - 1, 0, GRID_W - 1);
    const maxX = clamp(Math.ceil((state.camera.x + viewW) / TILE_SIZE) + 1, 0, GRID_W - 1);
    const minY = clamp(Math.floor(state.camera.y / TILE_SIZE) - 1, 0, GRID_H - 1);
    const maxY = clamp(Math.ceil((state.camera.y + viewH) / TILE_SIZE) + 1, 0, GRID_H - 1);

    drawCheckerTiles({
      ctx, minX, maxX, minY, maxY, tileSize: TILE_SIZE,
      primaryColor: '#181830', secondaryColor: '#1e1e3a',
      strokeStyle: 'rgba(255,255,255,0.04)',
    });

    // Action target
    const me = state.players.get(state.myId);
    if (me) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.strokeRect(me.x * TILE_SIZE + 2, me.y * TILE_SIZE + 2, TILE_SIZE - 4, TILE_SIZE - 4);
    }

    const labels = [];
    for (const player of state.players.values()) {
      if (player.x < minX - 1 || player.x > maxX + 1 || player.y < minY - 1 || player.y > maxY + 1) continue;
      labels.push(drawPlayer(ctx, player, now));
    }
    drawPlayerLabels(ctx, labels);
  },

  onUpdateHud() {
    const elapsed = state.startTime ? Date.now() - state.startTime : 0;
    game.hudModule.setText(hudPlayersEl, `${state.players.size} joueurs`);
    game.hudModule.setText(hudScoreEl, `Score: ${state.me.score || 0}`);
    game.hudModule.setText(hudTimeEl, msToClock(elapsed));
  },

  onKeydown(event) {
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) performPrimaryAction();
      return true;
    }
    return false;
  },

  onMousedown(event) {
    if (event.button === 0) { event.preventDefault(); performPrimaryAction(); }
  },

  extraSocketSetup(socket) {
    socket.on(SKELETON_EVENTS.actionApplied, (payload = {}) => {
      // Handle action result from server
      if (payload.score !== undefined) state.me.score = Number(payload.score) || 0;
    });
  },
});
