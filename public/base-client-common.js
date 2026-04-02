(function attachClientShared(globalScope) {
  const PLAYER_COLORS = [
    '#FF6B6B',
    '#4ECDC4',
    '#45B7D1',
    '#96CEB4',
    '#FFEAA7',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#FF8A80',
    '#80D8FF',
    '#B9F6CA',
    '#FFD180',
    '#EA80FC',
    '#A7FFEB',
    '#FF9E80',
    '#82B1FF',
    '#CCFF90',
    '#FFAB91',
    '#B388FF',
    '#84FFFF',
  ];

  const AVATAR_COUNT = 6;
  const CHAT_MAX_MESSAGES = 100;
  const CHAT_CLOSED_VISIBLE_MESSAGES = 3;

  const MOVE_KEY_DELTAS = {
    ArrowUp: [0, -1],
    KeyZ: [0, -1],
    KeyW: [0, -1],
    ArrowDown: [0, 1],
    KeyS: [0, 1],
    ArrowLeft: [-1, 0],
    KeyQ: [-1, 0],
    KeyA: [-1, 0],
    ArrowRight: [1, 0],
    KeyD: [1, 0],
  };

  function loadImage(src) {
    const image = new Image();
    image.loaded = false;
    image.onload = () => {
      image.loaded = true;
    };
    image.src = src;
    return image;
  }

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

  function normalizeColorIndex(value) {
    const index = Number(value);
    if (!Number.isInteger(index)) return 0;
    if (index < 0 || index >= PLAYER_COLORS.length) return 0;
    return index;
  }

  function normalizeAvatarIndex(value) {
    const avatar = Number(value);
    if (!Number.isInteger(avatar)) return 0;
    if (avatar < 0 || avatar >= AVATAR_COUNT) return 0;
    return avatar;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function msToClock(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function base64ToTypedArray(b64, TypedArray) {
    const bin = atob(b64);
    const buffer = new ArrayBuffer(bin.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < bin.length; i++) {
      view[i] = bin.charCodeAt(i);
    }
    return new TypedArray(buffer);
  }

  globalScope.ClientShared = {
    AVATAR_COUNT,
    CHAT_CLOSED_VISIBLE_MESSAGES,
    CHAT_MAX_MESSAGES,
    MOVE_KEY_DELTAS,
    PLAYER_COLORS,
    base64ToTypedArray,
    clamp,
    colorForPseudo,
    hashPseudo,
    loadImage,
    msToClock,
    normalizeAvatarIndex,
    normalizeColorIndex,
  };
})(window);
