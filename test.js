/**
 * Test suite for the map generator
 */

const {
  generateMap, generateValidMap, floodFillReveal,
  getStartZoneCenters, idx, GRID_W, GRID_H, TOTAL_CELLS, TARGET_BOMBS
} = require('./generator');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    → ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${b}, got ${a}`);
}

function assertBetween(v, min, max, msg) {
  if (v < min || v > max) throw new Error(msg || `Expected ${v} to be between ${min} and ${max}`);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\n══ Generator Unit Tests ══\n');

const SEED = 42;
let map;

test('Map generates without errors', () => {
  map = generateMap(SEED);
  assert(map !== null);
});

test('Grid dimensions are correct', () => {
  assertEqual(map.width, GRID_W);
  assertEqual(map.height, GRID_H);
  assertEqual(map.totalCells, TOTAL_CELLS);
});

test('Bomb count is approximately 17%', () => {
  assertBetween(map.bombCount, TARGET_BOMBS - 50, TARGET_BOMBS + 50,
    `Bombs: ${map.bombCount}, expected ~${TARGET_BOMBS}`);
});

test('No bombs in start zone cells', () => {
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (map.startZone[i]) {
      assert(!map.bombs[i], `Bomb found at start zone cell ${i}`);
    }
  }
});

test('No bombs in safe zone buffer', () => {
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (map.safeZone[i]) {
      assert(!map.bombs[i], `Bomb found in safe zone at cell ${i}`);
    }
  }
});

test('Numbers array is consistent with bombs', () => {
  let errors = 0;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = idx(x, y);
      if (map.bombs[i]) {
        assert(map.numbers[i] === -1, `Bomb cell should have number -1`);
      } else {
        assertBetween(map.numbers[i], 0, 8, `Number out of range at (${x},${y})`);
      }
    }
  }
});

test('Numbers are computed correctly (spot-check)', () => {
  // For each non-bomb cell, manually count adjacent bombs
  let mismatch = 0;
  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const i = idx(x, y);
      if (map.bombs[i]) continue;

      let count = 0;
      const dirs = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
      for (const [dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < GRID_W && ny >= 0 && ny < GRID_H)
          if (map.bombs[idx(nx, ny)]) count++;
      }
      if (map.numbers[i] !== count) mismatch++;
    }
  }
  assertEqual(mismatch, 0, `${mismatch} cells have wrong numbers`);
});

test('Start zones are 5 in count', () => {
  assertEqual(map.zoneCenters.length, 5);
});

test('Start zone centers are within grid bounds', () => {
  for (const [cx, cy] of map.zoneCenters) {
    assertBetween(cx, 0, GRID_W - 1, `cx=${cx} out of bounds`);
    assertBetween(cy, 0, GRID_H - 1, `cy=${cy} out of bounds`);
  }
});

test('Each start zone reveals at least 10 cells via flood-fill', () => {
  for (let z = 0; z < map.zoneCenters.length; z++) {
    const [cx, cy] = map.zoneCenters[z];
    const revealed = floodFillReveal(cx, cy, map.numbers, map.bombs);
    assert(revealed.length >= 10,
      `Zone Z${z+1} only reveals ${revealed.length} cells`);
  }
});

test('Flood-fill never reveals a bomb cell', () => {
  for (const [cx, cy] of map.zoneCenters) {
    const revealed = floodFillReveal(cx, cy, map.numbers, map.bombs);
    for (const [x, y] of revealed) {
      assert(!map.bombs[idx(x, y)],
        `Flood-fill revealed bomb at (${x},${y})`);
    }
  }
});

test('Flood-fill: all revealed 0-cells have all non-bomb neighbours also revealed', () => {
  const [cx, cy] = map.zoneCenters[0];
  const revealed  = new Set(
    floodFillReveal(cx, cy, map.numbers, map.bombs).map(([x, y]) => idx(x, y))
  );

  for (const ri of revealed) {
    if (map.numbers[ri] !== 0) continue; // only check 0-cells
    const rx = ri % GRID_W, ry = Math.floor(ri / GRID_W);
    for (const [nx, ny] of [
      [rx-1,ry-1],[rx,ry-1],[rx+1,ry-1],
      [rx-1,ry],           [rx+1,ry],
      [rx-1,ry+1],[rx,ry+1],[rx+1,ry+1]
    ]) {
      if (nx < 0 || nx >= GRID_W || ny < 0 || ny >= GRID_H) continue;
      const ni = idx(nx, ny);
      if (!map.bombs[ni]) {
        assert(revealed.has(ni),
          `0-cell at (${rx},${ry}) has unrevealed non-bomb neighbour (${nx},${ny})`);
      }
    }
  }
});

test('Deterministic: same seed produces same map', () => {
  const map2 = generateMap(SEED);
  for (let i = 0; i < TOTAL_CELLS; i++) {
    if (map.bombs[i] !== map2.bombs[i]) throw new Error(`Mismatch at cell ${i}`);
  }
});

test('Different seeds produce different maps', () => {
  const map2 = generateMap(SEED + 1);
  let diffs = 0;
  for (let i = 0; i < TOTAL_CELLS; i++)
    if (map.bombs[i] !== map2.bombs[i]) diffs++;
  assert(diffs > 100, `Only ${diffs} cells differ — seeds might not be working`);
});

test('Playability validation runs and returns data', () => {
  const v = map.validation;
  assert(typeof v.valid === 'boolean');
  assert(typeof v.reachableCells === 'number');
  assert(Array.isArray(v.issues));
});

test('Overall map reachability ≥ 8% (calibrated for 17% bomb density)', () => {
  const ratio = parseFloat(map.validation.reachableRatio);
  assert(ratio >= 8, `Reachability is only ${ratio}%`);
});

test('Deduction frontier ≥ 5% of map', () => {
  const ratio = parseFloat(map.validation.frontierRatio);
  assert(ratio >= 5, `Frontier is only ${ratio}%`);
});

test('generateValidMap finds a valid map (≤ 20 attempts)', () => {
  const result = generateValidMap(SEED, 20);
  assert(result.map.validation.valid,
    `Could not find valid map in ${result.attempts} attempts: ${result.map.validation.issues.join(', ')}`);
  assert(result.attempts >= 1);
});

// ─── Stress test: 20 different seeds ─────────────────────────────────────────

console.log('\n── Stress test: 20 seeds ──\n');

let validCount = 0;
const stressSeeds = Array.from({ length: 20 }, (_, i) => i * 1337 + 999);

for (const s of stressSeeds) {
  const m = generateMap(s);
  const ratio = parseFloat(m.validation.reachableRatio);
  const ok = m.validation.valid;
  if (ok) validCount++;
  process.stdout.write(ok
    ? `  \x1b[32m✓\x1b[0m seed=${String(s).padEnd(6)} bombs=${m.bombCount} reach=${ratio.toFixed(1)}%\n`
    : `  \x1b[33m!\x1b[0m seed=${String(s).padEnd(6)} bombs=${m.bombCount} reach=${ratio.toFixed(1)}% issues: ${m.validation.issues.length}\n`
  );
}

console.log(`\n  ${validCount}/20 seeds produced valid maps without retry\n`);

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n══ Results: ${passed} passed, ${failed} failed ══\n`);
process.exit(failed > 0 ? 1 : 0);
