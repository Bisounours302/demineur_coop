/**
 * Terminal renderer for the minesweeper map
 * Produces an ASCII representation for debugging and verification
 */

const { generateValidMap, floodFillReveal, idx, GRID_W, GRID_H } = require('./generator');

// ─── ANSI colors ──────────────────────────────────────────────────────────────
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
  bgGreen: '\x1b[42m',
};

const NUMBER_COLORS = [
  C.dim,           // 0 — empty (usually hidden)
  C.blue,          // 1
  C.green,         // 2
  C.red,           // 3
  C.magenta,       // 4
  `\x1b[31m`,      // 5 — dark red
  C.cyan,          // 6
  C.white,         // 7
  C.bold + C.red,  // 8
];

// ─── Rendering functions ──────────────────────────────────────────────────────

function renderCell(x, y, map, revealedSet, options = {}) {
  const i = idx(x, y);
  const { showAll, showStartZones, showSafeZones } = options;

  const isBomb    = map.bombs[i];
  const isStart   = map.startZone[i];
  const isSafe    = map.safeZone[i] && !isStart;
  const isRevealed = revealedSet && revealedSet.has(i);
  const num       = map.numbers[i];

  if (showStartZones && isStart) {
    return C.bgRed + C.bold + ' S ' + C.reset;
  }

  if (showSafeZones && isSafe && !showAll) {
    return C.dim + ' · ' + C.reset;
  }

  if (!showAll && !isRevealed) {
    return C.dim + ' ░ ' + C.reset;
  }

  if (isBomb) {
    return C.bgRed + C.bold + ' * ' + C.reset;
  }

  if (num === 0) {
    return '   ';
  }

  return NUMBER_COLORS[num] + ` ${num} ` + C.reset;
}

function renderMap(map, options = {}) {
  const {
    showAll       = false,
    showStartZones = true,
    showSafeZones = false,
    revealedSet   = null,
    label         = '',
    maxWidth      = 70,
  } = options;

  // Print column ruler every 10
  const rulerTop = '   ' + Array.from({ length: maxWidth }, (_, x) =>
    x % 10 === 0 ? String(x).padStart(2, ' ') + ' ' : '   '
  ).join('');

  const lines = [];
  if (label) lines.push(C.bold + '\n' + label + C.reset);
  lines.push(C.dim + rulerTop + C.reset);

  for (let y = 0; y < GRID_H && y < maxWidth; y++) {
    const rowNum = String(y).padStart(2, ' ');
    let row = C.dim + rowNum + ' ' + C.reset;
    for (let x = 0; x < GRID_W && x < maxWidth; x++) {
      row += renderCell(x, y, map, revealedSet, { showAll, showStartZones, showSafeZones });
    }
    lines.push(row);
  }

  return lines.join('\n');
}

// ─── Stats printer ────────────────────────────────────────────────────────────

function printStats(map, result) {
  const { validation } = map;
  const ok  = C.green + '✓' + C.reset;
  const err = C.red   + '✗' + C.reset;

  console.log(C.bold + '\n═══ MAP GENERATION REPORT ═══' + C.reset);
  console.log(`  Seed           : ${C.cyan}${map.seed}${C.reset}`);
  console.log(`  Attempts       : ${result.attempts}`);
  console.log(`  Grid           : ${map.width} × ${map.height} = ${map.totalCells} cells`);
  console.log(`  Bombs          : ${C.red}${map.bombCount}${C.reset} (${map.bombRatio}%)`);
  console.log(`  Start zones    : ${map.zoneCenters.length}`);
  console.log(`  Safe buffer r  : ${map.safeZone.filter(v => v && !map.startZone[map.safeZone.indexOf(v)]).length} cells protected`);

  console.log(C.bold + '\n─── Validation ───' + C.reset);
  const v = validation;
  const validIcon = v.valid ? ok : err;
  console.log(`  ${validIcon} Overall playability : ${v.valid ? C.green + 'VALID' : C.red + 'WARNINGS'} ${C.reset}`);
  console.log(`  ${ok} Reachable from starts : ${C.cyan}${v.reachableCells}${C.reset} cells (${v.reachableRatio}%)`);

  if (v.issues.length) {
    v.issues.forEach(iss => console.log(`  ${err} ${C.yellow}${iss}${C.reset}`));
  }

  console.log(C.bold + '\n─── Start zones ───' + C.reset);
  map.zoneCenters.forEach(([cx, cy], i) => {
    const revealed = floodFillReveal(cx, cy, map.numbers, map.bombs);
    console.log(`  Z${i + 1} at (${String(cx).padStart(2)}, ${String(cy).padStart(2)})  →  cascade reveals ${C.cyan}${revealed.length}${C.reset} cells`);
  });

  console.log('');
}

// ─── Main demo ────────────────────────────────────────────────────────────────

function main() {
  const seed = parseInt(process.argv[2]) || Date.now() & 0xFFFFFF;
  console.log(C.bold + C.cyan + '\n  MINESWEEPER COOPERATIVE — MAP GENERATOR' + C.reset);
  console.log(C.dim + '  Generating 70×70 map with seed ' + seed + '...' + C.reset);

  const result = generateValidMap(seed);
  const { map } = result;

  printStats(map, result);

  // ── View 1: Full map revealed (all bombs and numbers visible) ──────────────
  console.log(renderMap(map, {
    showAll: true,
    showStartZones: true,
    label: '▶ FULL MAP (dev view — all bombs revealed)',
    maxWidth: 70,
  }));

  // ── View 2: Player view — only start zones visible ─────────────────────────
  console.log(renderMap(map, {
    showAll: false,
    showStartZones: true,
    showSafeZones: false,
    label: '\n▶ PLAYER VIEW (start of game — only red zones visible)',
    maxWidth: 70,
  }));

  // ── View 3: After flood-fill from all start zones ─────────────────────────
  const revealedSet = new Set();
  for (const [cx, cy] of map.zoneCenters) {
    floodFillReveal(cx, cy, map.numbers, map.bombs)
      .forEach(([x, y]) => revealedSet.add(idx(x, y)));
  }

  console.log(renderMap(map, {
    showAll: false,
    showStartZones: true,
    revealedSet,
    label: '\n▶ AFTER FIRST MOVE (all start zones clicked — cascade reveal)',
    maxWidth: 70,
  }));

  console.log(C.dim + '\n  Run with: node render.js [seed]\n' + C.reset);
}

main();
