import {
  PLAYER_COLORS,
  base64ToTypedArray,
  clamp,
  colorForPseudo,
  hashPseudo,
  loadImage,
  msToClock,
  normalizeAvatarIndex,
  normalizeColorIndex,
} from '../../core/shared.js';
import { MINES_EVENTS } from '../../../../shared/events.js';
import { createModeBootstrap } from '../../modules/bootstrap/createModeBootstrap.js';
import { spriteDirection, getSpriteFrame } from '../../modules/player/spriteUtils.js';
import { drawPlayerLabels } from '../../modules/player/drawLabels.js';

// ---------------------------------------------------------------- constants
const GRID_W = 70;
const GRID_H = 70;
const TOTAL_CELLS = GRID_W * GRID_H;
const TILE_SIZE = 32;

const ANIM_IDLE_MS = 220;
const ANIM_RUN_MS = 85;
const ANIMAL_FRAME = 32;
const ANIMAL_COLS = 4;
const WALK_WINDOW_MS = 240;

const DIG_FRAME_MS = 60;
const DIG_FRAMES = 4;
const DIG_LOOPS = 2;

const EXPLOSION_FRAME_W = 64;
const EXPLOSION_FRAME_H = 64;
const EXPLOSION_FRAME_MS = 75;
const EXPLOSION_FRAMES = 5;
const EXPLOSION_DRAW_SIZE = 40;

const BOMB_SRC_X = 136;
const BOMB_SRC_Y = 82;
const BOMB_SRC_W = 326;
const BOMB_SRC_H = 406;
const BOMB_DRAW_W = 20;
const BOMB_DRAW_H = 24;

const TRANSITION_EDGE_HALF = 6;
const TRANSITION_CORNER_QUAD = 12;
const TRANSITION_CORNER_DRAW = 12;
const TRANSITION_CORNER_SHIFT = 6;

const NUMBER_COLORS = {
  1: '#4488ff', 2: '#44ff88', 3: '#ff4444', 4: '#8844ff',
  5: '#ff8844', 6: '#44ffff', 7: '#ffffff', 8: '#ff44ff',
};

// ------------------------------------------------------------------ assets
const sprites = [
  loadImage('/assets/BIRDSPRITESHEET_Blue.png'),
  loadImage('/assets/BIRDSPRITESHEET_White.png'),
  loadImage('/assets/CATSPRITESHEET_Gray.png'),
  loadImage('/assets/CATSPRITESHEET_Orange.png'),
  loadImage('/assets/FOXSPRITESHEET.png'),
  loadImage('/assets/RACCOONSPRITESHEET.png'),
];

const assets = {
  tiles: {
    grass: loadImage('/assets/herbe.png'),
    dirt: loadImage('/assets/terre.png'),
  },
  transitions: {
    edge: {
      herbe_droite_terre_gauche: loadImage('/assets/herbe_droite_terre_gauche.png'),
      herbe_gauche_terre_droite: loadImage('/assets/herbe_gauche_terre_droite.png'),
      herbe_haut_terre_bas: loadImage('/assets/herbe_haut_terre_bas.png'),
      herbe_bas_terre_haut: loadImage('/assets/herbe_bas_terre_haut.png'),
    },
    corner: {
      herbe_coin_haut_gauche: loadImage('/assets/herbe_coin_haut_gauche.png'),
      herbe_coin_haut_droite: loadImage('/assets/herbe_coin_haut_droite.png'),
      herbe_coin_bas_gauche: loadImage('/assets/herbe_coin_bas_gauche.png'),
      herbe_coin_bas_droite: loadImage('/assets/herbe_coin_bas_droite.png'),
      terre_coin_haut_gauche: loadImage('/assets/terre_coin_haut_gauche.png'),
      terre_coin_haut_droite: loadImage('/assets/terre_coin_haut_droite.png'),
      terre_coin_bas_gauche: loadImage('/assets/terre_coin_bas_gauche.png'),
      terre_coin_bas_droite: loadImage('/assets/terre_coin_bas_droite.png'),
    },
  },
  shovels: [
    loadImage('/assets/shovel_bird_blue.png'),
    loadImage('/assets/shovel_bird_white.png'),
    loadImage('/assets/shovel_cat_gray.png'),
    loadImage('/assets/shovel_cat_orange.png'),
    loadImage('/assets/shovel_fox.png'),
    loadImage('/assets/shovel_racoon.png'),
  ],
  fx: {
    bomb: loadImage('/assets/bomb.png'),
    explosion: loadImage('/assets/explosion.png'),
  },
};

// ------------------------------------------------------------------- state
const state = {
  map: {
    width: GRID_W, height: GRID_H, totalCells: TOTAL_CELLS, bombCount: 0, zoneCenters: [],
    bombs: new Uint8Array(TOTAL_CELLS), numbers: new Int8Array(TOTAL_CELLS),
    startZone: new Uint8Array(TOTAL_CELLS), safeZone: new Uint8Array(TOTAL_CELLS),
  },
  grid: new Int8Array(TOTAL_CELLS),
  flags: new Map(),
  revealedSafeCount: 0,
  explosions: 0,
  maxExplosions: 10,
  activeExplosions: [],
  activeDigs: new Map(),
  explodedCells: new Set(),
  statsCountdown: 60,
  statsCountdownTimer: null,
};
state.grid.fill(-2);

// ---------------------------------------------------------- stats-specific DOM
const statsOverlayEl = document.getElementById('statsOverlay');
const statsTitleEl = document.getElementById('statsTitle');
const statsDurationEl = document.getElementById('statsDuration');
const statsMiniMapEl = document.getElementById('statsMiniMap');
const statsTableBodyEl = document.getElementById('statsTableBody');
const explosionListEl = document.getElementById('explosionList');
const statsCountdownEl = document.getElementById('statsCountdown');
const hudBombsEl = document.getElementById('hudBombs');
const hudTimeEl = document.getElementById('hudTime');
const hudPlayersEl = document.getElementById('hudPlayers');
const hudFlagsEl = document.getElementById('hudFlags');
const hudRevealedEl = document.getElementById('hudRevealed');

// ----------------------------------------------------------------- helpers
function idx(x, y) { return y * GRID_W + x; }
function isInBounds(x, y) { return x >= 0 && x < GRID_W && y >= 0 && y < GRID_H; }

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
  if (fi >= DIG_FRAMES * DIG_LOOPS) { state.activeDigs.delete(playerId); return null; }
  return fi % DIG_FRAMES;
}

// -------------------------------------------------------- tile rendering
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
      ctx.fillStyle = '#7db24f'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  } else {
    const { cols } = tileSheetInfo(assets.tiles.dirt);
    const t = getBorderTile(cols, x, y);
    if (!drawSheetTile(ctx, assets.tiles.dirt, t.col, t.row, px, py)) {
      ctx.fillStyle = '#8b5a34'; ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  if (state.map.startZone[i] === 1 && hidden) {
    ctx.strokeStyle = '#ff4444'; ctx.lineWidth = 1;
    ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);
  }
}

function cellIsGrass(x, y) { return state.grid[idx(x, y)] === -2; }
function isBorderCell(x, y) { return x === 0 || y === 0 || x === GRID_W - 1 || y === GRID_H - 1; }

function drawVerticalTransition(ctx, x, y, leftGrass) {
  const image = leftGrass
    ? assets.transitions.edge.herbe_gauche_terre_droite
    : assets.transitions.edge.herbe_droite_terre_gauche;
  if (!image.loaded) return;
  const px = x * TILE_SIZE, py = y * TILE_SIZE;
  ctx.drawImage(image, 0, 0, TRANSITION_EDGE_HALF, TILE_SIZE, px + TILE_SIZE - TRANSITION_EDGE_HALF, py, TRANSITION_EDGE_HALF, TILE_SIZE);
  ctx.drawImage(image, TRANSITION_EDGE_HALF, 0, TRANSITION_EDGE_HALF, TILE_SIZE, px + TILE_SIZE, py, TRANSITION_EDGE_HALF, TILE_SIZE);
}

function drawHorizontalTransition(ctx, x, y, topGrass) {
  const image = topGrass
    ? assets.transitions.edge.herbe_haut_terre_bas
    : assets.transitions.edge.herbe_bas_terre_haut;
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
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = idx(x, y);
      if (!state.flags.has(i) || state.grid[i] !== -2) continue;
      const px = x * TILE_SIZE, py = y * TILE_SIZE;
      ctx.beginPath(); ctx.moveTo(px + 12, py + 7); ctx.lineTo(px + 12, py + 24); ctx.stroke();
      ctx.fillStyle = '#ff4b4b';
      ctx.beginPath(); ctx.moveTo(px + 12, py + 8); ctx.lineTo(px + 22, py + 12); ctx.lineTo(px + 12, py + 16); ctx.closePath(); ctx.fill();
    }
  }
}

function drawNumbers(ctx, minX, maxX, minY, maxY) {
  ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const v = state.grid[idx(x, y)];
      if (v <= 0) continue;
      ctx.fillStyle = NUMBER_COLORS[v] || '#ffffff';
      ctx.fillText(String(v), x * TILE_SIZE + TILE_SIZE * 0.5, y * TILE_SIZE + TILE_SIZE * 0.52);
    }
  }
}

function drawBombs(ctx, minX, maxX, minY, maxY) {
  const inStats = state.phase === 'stats';
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const i = idx(x, y);
      const hidden = state.grid[i] === -2;
      if (!((inStats && state.map.bombs[i] === 1) || (!hidden && state.grid[i] === -1))) continue;
      const px = x * TILE_SIZE, py = y * TILE_SIZE;
      if (assets.fx.bomb.loaded) {
        ctx.drawImage(assets.fx.bomb, BOMB_SRC_X, BOMB_SRC_Y, BOMB_SRC_W, BOMB_SRC_H,
          px + (TILE_SIZE - BOMB_DRAW_W) * 0.5, py + (TILE_SIZE - BOMB_DRAW_H) * 0.5, BOMB_DRAW_W, BOMB_DRAW_H);
      } else {
        ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(px + 16, py + 16, 7, 0, Math.PI * 2); ctx.fill();
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
  const byCell = new Map();
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

// --------------------------------------------------------- player rendering
function drawPlayer(ctx, player, now) {
  const px = player.x * TILE_SIZE, py = player.y * TILE_SIZE;
  const stunned = player.stunnedUntil && now < player.stunnedUntil;
  ctx.globalAlpha = (stunned && Math.floor(now / 250) % 2 === 0) ? 0.35 : 1;

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
    ctx.fillStyle = '#ffd86b'; ctx.fillRect(px + 8, py + 8, 16, 16);
  }

  ctx.globalAlpha = 1;
  return {
    x: px + TILE_SIZE * 0.5, y: py - 12,
    text: player.pseudo, isTyping: Boolean(player.isTyping),
    color: player.color || colorForPseudo(player.pseudo),
  };
}

// --------------------------------------------------------- apply payload
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
    id: payload.id, pseudo: payload.pseudo, colorIndex,
    color: payload.color || PLAYER_COLORS[colorIndex] || colorForPseudo(payload.pseudo),
    avatar, x: payload.x, y: payload.y,
    isTyping: Boolean(payload.isTyping),
    stunnedUntil: payload.stunEndTime || 0,
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

// --------------------------------------------------------- stats overlay
function clearStatsCountdownTimer() {
  if (!state.statsCountdownTimer) return;
  clearInterval(state.statsCountdownTimer);
  state.statsCountdownTimer = null;
}

function hideStatsOverlay() {
  clearStatsCountdownTimer();
  statsOverlayEl.classList.add('hidden');
}

function drawStatsMiniMap() {
  const mapCtx = statsMiniMapEl.getContext('2d');
  const cw = statsMiniMapEl.width, ch = statsMiniMapEl.height;
  mapCtx.clearRect(0, 0, cw, ch);
  mapCtx.fillStyle = '#0b0f1c'; mapCtx.fillRect(0, 0, cw, ch);
  const cell = Math.max(1, Math.floor(Math.min(cw / GRID_W, ch / GRID_H)));
  const ox = Math.floor((cw - GRID_W * cell) / 2), oy = Math.floor((ch - GRID_H * cell) / 2);
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = idx(x, y);
      const px = ox + x * cell, py = oy + y * cell;
      if (state.map.bombs[i]) {
        mapCtx.fillStyle = state.explodedCells.has(i) ? '#ff0000' : '#666666';
      } else {
        mapCtx.fillStyle = '#141727';
      }
      mapCtx.fillRect(px, py, cell, cell);
      if (!state.map.bombs[i]) {
        const n = state.map.numbers[i];
        if (n > 0 && cell >= 4) {
          mapCtx.fillStyle = NUMBER_COLORS[n] || '#ffffff';
          mapCtx.font = `${Math.max(4, Math.floor(cell * 0.8))}px monospace`;
          mapCtx.textAlign = 'center'; mapCtx.textBaseline = 'middle';
          mapCtx.fillText(String(n), px + cell * 0.5, py + cell * 0.58);
        }
      }
    }
  }
}

function showStatsOverlay(result, stats) {
  state.phase = 'stats';
  statsOverlayEl.classList.remove('hidden');
  statsTitleEl.textContent = result === 'win' ? 'VICTOIRE' : 'DEFAITE';
  statsTitleEl.style.color = result === 'win' ? '#5cff8d' : '#ff5c5c';
  statsDurationEl.textContent = `Duree de partie: ${msToClock(stats.durationMs || 0)}`;

  statsTableBodyEl.innerHTML = '';
  for (let i = 0; i < (stats.players || []).length; i++) {
    const p = stats.players[i];
    const row = document.createElement('tr');
    row.innerHTML = `<td>${i + 1}</td><td style="font-weight:bold;color:${p.color || colorForPseudo(p.pseudo)};">${p.pseudo}</td><td>${p.cellsRevealed}</td><td>${p.bombsTriggered}</td><td>${p.flagsCorrect}/${p.flagsIncorrect}</td>`;
    statsTableBodyEl.appendChild(row);
  }

  explosionListEl.innerHTML = '';
  if (!stats.explodedBy || stats.explodedBy.length === 0) {
    const li = document.createElement('li'); li.textContent = 'Aucune explosion.'; explosionListEl.appendChild(li);
  } else {
    for (const e of stats.explodedBy) {
      const li = document.createElement('li'); li.textContent = `Bombe: ${e.pseudo} en (${e.x}, ${e.y})`; explosionListEl.appendChild(li);
    }
  }

  drawStatsMiniMap();

  clearStatsCountdownTimer();
  state.statsCountdown = 60;
  statsCountdownEl.textContent = `Nouvelle partie dans: ${state.statsCountdown}s`;
  state.statsCountdownTimer = setInterval(() => {
    state.statsCountdown = Math.max(0, state.statsCountdown - 1);
    statsCountdownEl.textContent = `Nouvelle partie dans: ${state.statsCountdown}s`;
  }, 1000);
}

// --------------------------------------------------------- actions
function emitCellAction(eventName) {
  if (state.phase !== 'playing' || state.chat.open) return;
  const me = state.players.get(state.myId);
  const x = me ? me.x : state.me.x;
  const y = me ? me.y : state.me.y;
  game.socket.emit(eventName, { x, y });
}

// --------------------------------------------------------- bootstrap
const game = createModeBootstrap({
  state,
  events: MINES_EVENTS,
  sprites,
  tileSize: TILE_SIZE,
  minScale: 0.3,
  maxScale: 2.0,
  animIdleMs: ANIM_IDLE_MS,
  animalFrame: ANIMAL_FRAME,
  animalCols: ANIMAL_COLS,
  hasPositionMove: true,
  cameraSmoothing: 0.05,
  cameraSnapThreshold: 5,
  stateEvents: [MINES_EVENTS.gameNew],

  getWorldSize: () => ({ w: GRID_W * TILE_SIZE, h: GRID_H * TILE_SIZE }),
  getFocusPosition: () => ({ x: state.me.x, y: state.me.y }),

  onApplyState(payload) {
    state.phase = payload.phase === 'stats' ? 'stats' : 'playing';
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

    state.grid = new Int8Array(TOTAL_CELLS); state.grid.fill(-2);
    state.flags = new Map();
    state.players = new Map();
    state.revealedSafeCount = 0;
    state.explodedCells = new Set();
    state.activeExplosions = [];
    state.activeDigs = new Map();

    for (const c of payload.revealed || []) {
      const i = idx(c.x, c.y); state.grid[i] = c.value;
      if (c.value >= 0) state.revealedSafeCount += 1;
      if (c.value === -1) state.explodedCells.add(i);
    }
    for (const f of payload.flags || []) state.flags.set(idx(f.x, f.y), f.pseudo);
    for (const p of payload.players || []) applyPlayerPayload(p);

    game.chatModule.setMessages(payload.chatMessages || []);

    const me = state.players.get(state.myId);
    if (me) { state.me.x = me.x; state.me.y = me.y; }

    game.els.lobby.classList.add('hidden');
    game.els.joinError.textContent = '';
    game.els.reconnect.classList.add('hidden');
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

  onRender(now) {
    const { ctx, canvas } = game;
    const scale = state.camera.scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, -state.camera.x * scale, -state.camera.y * scale);

    ctx.fillStyle = '#00d9ff';
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
    hudBombsEl.classList.toggle('bombs-danger', state.explosions >= 7);
    game.hudModule.setText(hudTimeEl, msToClock(elapsed));
    game.hudModule.setText(hudPlayersEl, `${state.players.size} joueurs`);
    game.hudModule.setText(hudFlagsEl, `Drapeaux: ${state.flags.size}`);
    game.hudModule.setText(hudRevealedEl, `Cases revelees: ${state.revealedSafeCount}/${safeTotal}`);
    game.els.hud.classList.toggle('near-top', state.me.y <= 3);
  },

  onKeydown(event) {
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) emitCellAction(MINES_EVENTS.reveal);
      return true;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      event.preventDefault();
      if (!event.repeat) emitCellAction(MINES_EVENTS.flag);
      return true;
    }
    return false;
  },

  onMousedown(event) {
    if (event.button === 0) { event.preventDefault(); emitCellAction(MINES_EVENTS.reveal); }
    if (event.button === 2) { event.preventDefault(); emitCellAction(MINES_EVENTS.flag); }
  },

  extraSocketSetup(socket) {
    socket.on(MINES_EVENTS.cellsRevealed, (payload) => {
      const pid = payload?.playerId;
      const player = pid ? state.players.get(pid) : null;
      if (pid && player && playerHasDigAnim(player)) state.activeDigs.set(pid, Date.now());
      applyRevealedCells(payload.cells || []);
    });

    socket.on(MINES_EVENTS.cellFlagged, (payload) => {
      const i = idx(payload.x, payload.y);
      if (payload.active) state.flags.set(i, payload.pseudo);
      else state.flags.delete(i);
    });

    socket.on(MINES_EVENTS.bombExploded, (payload) => {
      state.explosions = payload.count;
      state.explodedCells.add(idx(payload.x, payload.y));
      state.activeExplosions.push({ x: payload.x, y: payload.y, startedAt: Date.now() });
      const player = state.players.get(payload.id);
      if (player) player.stunnedUntil = payload.stunEndTime || Date.now() + 2000;
    });

    socket.on(MINES_EVENTS.gameOver, (payload) => {
      showStatsOverlay(payload.result, payload.stats || {});
    });
  },
});
