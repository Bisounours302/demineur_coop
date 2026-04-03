export function drawPlayerLabels(ctx, labels) {
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const label of labels) {
    if (label.isTyping) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.strokeText('ecrit...', label.x, label.y - 12);
      ctx.fillStyle = '#ffd28f';
      ctx.fillText('ecrit...', label.x, label.y - 12);
    }

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(label.text, label.x, label.y);
    ctx.fillStyle = label.color || '#ffffff';
    ctx.fillText(label.text, label.x, label.y);
  }
}
