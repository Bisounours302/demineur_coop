const { AVATAR_COUNT, PLAYER_COLORS } = require('./sharedConstants');

function hashPseudo(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(h);
}

function colorForPseudo(pseudo) {
  return PLAYER_COLORS[hashPseudo(String(pseudo || '')) % PLAYER_COLORS.length];
}

function normalizeAvatarChoice(avatarChoice) {
  const value = Number(avatarChoice);
  if (!Number.isInteger(value)) return 0;
  if (value < 0 || value >= AVATAR_COUNT) return 0;
  return value;
}

function normalizeColorChoice(colorChoice) {
  const value = Number(colorChoice);
  if (!Number.isInteger(value)) return 0;
  if (value < 0 || value >= PLAYER_COLORS.length) return 0;
  return value;
}

function normalizeChatMessage(message, maxLength) {
  const text = String(message || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.slice(0, Math.max(1, Number(maxLength) || 180));
}

function numberOrFallback(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

module.exports = {
  colorForPseudo,
  hashPseudo,
  normalizeAvatarChoice,
  normalizeColorChoice,
  normalizeChatMessage,
  numberOrFallback,
};
