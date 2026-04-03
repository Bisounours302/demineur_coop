export function createHudModule(options = {}) {
  const { rootEl } = options;

  function show() {
    if (!rootEl) return;
    rootEl.classList.remove('hidden');
  }

  function hide() {
    if (!rootEl) return;
    rootEl.classList.add('hidden');
  }

  function setText(el, text) {
    if (!el) return;
    el.textContent = String(text);
  }

  return {
    show,
    hide,
    setText,
  };
}