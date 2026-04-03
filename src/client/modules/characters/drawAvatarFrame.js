export function drawAvatarFrame(options) {
  const {
    ctx,
    image,
    frameCol,
    frameRow,
    frameSize,
    dx,
    dy,
    dw,
    dh,
  } = options;

  if (!image || !image.loaded) {
    return false;
  }

  ctx.drawImage(
    image,
    frameCol * frameSize,
    frameRow * frameSize,
    frameSize,
    frameSize,
    dx,
    dy,
    dw,
    dh,
  );

  return true;
}