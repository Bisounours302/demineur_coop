/**
 * Export a generated map to JSON format for WebSocket server consumption.
 *
 * The server needs:
 *  - bombs / numbers arrays (typed arrays → base64 for compact transport)
 *  - startZone / safeZone masks
 *  - zoneCenters (for player spawn logic)
 *  - validation metadata
 */

const { generateValidMap } = require('./generator');

function toBase64(typedArray) {
  return Buffer.from(typedArray.buffer).toString('base64');
}

function exportMap(seed) {
  const { map, attempts } = generateValidMap(seed);

  return {
    seed: map.seed,
    attempts,
    width: map.width,
    height: map.height,
    totalCells: map.totalCells,
    bombCount: map.bombCount,
    bombRatio: map.bombRatio,
    zoneCenters: map.zoneCenters,
    validation: map.validation,
    // Compact binary payloads (base64-encoded typed arrays)
    data: {
      bombs:     toBase64(map.bombs),     // Uint8Array: 1=bomb
      numbers:   toBase64(map.numbers),   // Int8Array:  -1=bomb, 0-8=count
      startZone: toBase64(map.startZone), // Uint8Array: 1=red zone
      safeZone:  toBase64(map.safeZone),  // Uint8Array: 1=no-bomb zone
    }
  };
}

const seed = parseInt(process.argv[2]) || Date.now() & 0xFFFFFF;
const exported = exportMap(seed);
console.log(JSON.stringify(exported, null, 2));
