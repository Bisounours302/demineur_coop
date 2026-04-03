export function getCameraViewport(camera, canvas) {
  return {
    viewW: canvas.width / camera.scale,
    viewH: canvas.height / camera.scale,
  };
}

export function getCameraTarget({ focusX, focusY, tileSize, viewW, viewH }) {
  return {
    targetX: focusX * tileSize + tileSize * 0.5 - viewW * 0.5,
    targetY: focusY * tileSize + tileSize * 0.5 - viewH * 0.5,
  };
}

export function clampCameraToWorld({ camera, canvas, worldW, worldH }) {
  const { viewW, viewH } = getCameraViewport(camera, canvas);
  camera.x = Math.max(0, Math.min(camera.x, Math.max(0, worldW - viewW)));
  camera.y = Math.max(0, Math.min(camera.y, Math.max(0, worldH - viewH)));
}

export function centerCameraOnFocus({
  camera,
  canvas,
  tileSize,
  focusX,
  focusY,
  immediate = false,
  smoothing = 0.05,
}) {
  const { viewW, viewH } = getCameraViewport(camera, canvas);
  const { targetX, targetY } = getCameraTarget({ focusX, focusY, tileSize, viewW, viewH });

  if (immediate) {
    camera.x = targetX;
    camera.y = targetY;
    return;
  }

  camera.x += (targetX - camera.x) * smoothing;
  camera.y += (targetY - camera.y) * smoothing;
}