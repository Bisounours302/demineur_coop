export function drawCheckerTiles(options) {
  const {
    ctx,
    minX,
    maxX,
    minY,
    maxY,
    tileSize,
    primaryColor,
    secondaryColor,
    strokeStyle = null,
  } = options;

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x * tileSize;
      const py = y * tileSize;
      ctx.fillStyle = (x + y) % 2 === 0 ? primaryColor : secondaryColor;
      ctx.fillRect(px, py, tileSize, tileSize);

      if (strokeStyle) {
        ctx.strokeStyle = strokeStyle;
        ctx.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);
      }
    }
  }
}