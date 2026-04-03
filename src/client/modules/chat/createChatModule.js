export function createChatModule(options) {
  const {
    state,
    chatDockEl,
    chatFormEl,
    chatMessagesEl,
    chatInputEl,
    resolveColorForPseudo,
    emitTyping,
    maxMessages = 100,
    closedVisibleMessages = 3,
    getMyId,
    onOpen,
    onClose,
    onLocalTypingChanged,
  } = options;

  function normalizeChatEntry(entry) {
    const fallbackPseudo = String(entry?.pseudo || 'System');
    const fallbackColor = typeof resolveColorForPseudo === 'function'
      ? resolveColorForPseudo(fallbackPseudo)
      : '#ffffff';

    return {
      id: String(entry?.id || `${Date.now()}-${Math.floor(Math.random() * 1e6)}`),
      pseudo: fallbackPseudo,
      color: String(entry?.color || fallbackColor),
      text: String(entry?.text || '').trim(),
      at: Number(entry?.at || Date.now()),
    };
  }

  function renderMessages() {
    if (!chatMessagesEl) return;

    const messagesToRender = state.chat.open
      ? state.chat.messages
      : state.chat.messages.slice(-closedVisibleMessages);

    chatMessagesEl.innerHTML = '';
    for (const entry of messagesToRender) {
      const li = document.createElement('li');
      li.className = 'chat-item';
      li.innerHTML = `<strong style="color:${entry.color};">${entry.pseudo}</strong>: ${entry.text}`;
      chatMessagesEl.appendChild(li);
    }

    if (state.chat.open) {
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
    }
  }

  function setMessages(messages) {
    state.chat.messages = (messages || [])
      .map(normalizeChatEntry)
      .filter((message) => message.text.length > 0)
      .slice(-maxMessages);
    renderMessages();
  }

  function appendMessage(entry) {
    const normalized = normalizeChatEntry(entry);
    if (!normalized.text) return;

    state.chat.messages.push(normalized);
    if (state.chat.messages.length > maxMessages) {
      state.chat.messages = state.chat.messages.slice(-maxMessages);
    }
    renderMessages();
  }

  function setTypingStatus(active) {
    const myId = typeof getMyId === 'function' ? getMyId() : state.myId;
    if (!myId || state.chat.typingSent === active) return;

    if (typeof onLocalTypingChanged === 'function') {
      onLocalTypingChanged(active);
    }

    state.chat.typingSent = active;
    if (typeof emitTyping === 'function') {
      emitTyping(Boolean(active));
    }
  }

  function setOpen(open, focusInput = true) {
    const next = Boolean(open);
    if (state.chat.open === next) return;

    state.chat.open = next;
    if (chatDockEl) {
      chatDockEl.classList.toggle('open', next);
    }
    if (chatFormEl) {
      chatFormEl.classList.toggle('hidden', !next);
    }
    renderMessages();

    if (next) {
      if (typeof onOpen === 'function') {
        onOpen();
      }
      setTypingStatus(true);
      if (focusInput && chatInputEl) {
        chatInputEl.focus();
      }
      return;
    }

    if (typeof onClose === 'function') {
      onClose();
    }
    setTypingStatus(false);
    if (chatInputEl) {
      chatInputEl.blur();
    }
  }

  function toggleOpen() {
    setOpen(!state.chat.open);
  }

  return {
    setMessages,
    appendMessage,
    renderMessages,
    setTypingStatus,
    setOpen,
    toggleOpen,
  };
}