export function createIdentityModule(options) {
  const {
    state,
    avatarOptionEls,
    colorPickerEl,
    normalizeAvatarIndex,
    normalizeColorIndex,
    playerColors,
    avatarStorageKey = 'avatar',
    colorStorageKey = 'colorIndex',
  } = options;

  function updateAvatarSelectionUI() {
    for (const option of avatarOptionEls || []) {
      const avatar = normalizeAvatarIndex(option.dataset.avatar);
      const selected = avatar === state.myAvatar;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-checked', selected ? 'true' : 'false');
    }
  }

  function setMyAvatar(value, persist = true) {
    state.myAvatar = normalizeAvatarIndex(value);
    updateAvatarSelectionUI();

    if (persist) {
      localStorage.setItem(avatarStorageKey, String(state.myAvatar));
    }
  }

  function updateColorSelectionUI() {
    if (!colorPickerEl) return;
    const options = Array.from(colorPickerEl.querySelectorAll('.color-option'));
    for (const option of options) {
      const idxValue = normalizeColorIndex(option.dataset.colorIndex);
      const selected = idxValue === state.myColorIndex;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-checked', selected ? 'true' : 'false');
    }
  }

  function setMyColorIndex(value, persist = true) {
    state.myColorIndex = normalizeColorIndex(value);
    updateColorSelectionUI();

    if (persist) {
      localStorage.setItem(colorStorageKey, String(state.myColorIndex));
    }
  }

  function setupColorPicker() {
    if (!colorPickerEl) return;

    colorPickerEl.innerHTML = '';
    for (let i = 0; i < playerColors.length; i++) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-option';
      btn.dataset.colorIndex = String(i);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.title = `Couleur ${i + 1}`;
      btn.style.setProperty('--swatch-color', playerColors[i]);
      btn.addEventListener('click', () => setMyColorIndex(i));
      colorPickerEl.appendChild(btn);
    }

    updateColorSelectionUI();
  }

  function setupAvatarPicker() {
    for (const option of avatarOptionEls || []) {
      option.addEventListener('click', () => {
        setMyAvatar(option.dataset.avatar);
      });
    }

    updateAvatarSelectionUI();
  }

  function drawAvatarPickerPreview({
    now,
    sprites,
    animIdleMs,
    frameSize,
    frameCols,
    fallbackColor = null,
  }) {
    const idleCol = Math.floor(now / animIdleMs) % frameCols;
    for (const option of avatarOptionEls || []) {
      const canvasEl = option.querySelector('.avatar-preview');
      if (!canvasEl) continue;

      const avatar = normalizeAvatarIndex(option.dataset.avatar);
      const image = sprites[avatar];
      const pctx = canvasEl.getContext('2d');

      pctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      pctx.imageSmoothingEnabled = false;

      if (image && image.loaded) {
        pctx.drawImage(
          image,
          idleCol * frameSize,
          0,
          frameSize,
          frameSize,
          0,
          0,
          canvasEl.width,
          canvasEl.height,
        );
        continue;
      }

      if (fallbackColor) {
        pctx.fillStyle = fallbackColor;
        pctx.fillRect(10, 10, canvasEl.width - 20, canvasEl.height - 20);
      }
    }
  }

  return {
    updateAvatarSelectionUI,
    setMyAvatar,
    updateColorSelectionUI,
    setMyColorIndex,
    setupColorPicker,
    setupAvatarPicker,
    drawAvatarPickerPreview,
  };
}