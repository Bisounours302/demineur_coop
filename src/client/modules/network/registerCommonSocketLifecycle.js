export function registerCommonSocketLifecycle(options) {
  const {
    socket,
    events,
    state,
    onConnect,
    onDisconnect,
    onJoinError,
    onState,
    onPlayerJoined,
    onPlayerLeft,
    onChatMessage,
    onChatTyping,
    stateEvents = [],
  } = options;

  socket.on('connect', () => {
    if (state?.chat) {
      state.chat.typingSent = false;
    }

    if (typeof onConnect === 'function') {
      onConnect();
    }
  });

  socket.on('disconnect', () => {
    if (state?.chat) {
      state.chat.typingSent = false;
    }

    if (typeof onDisconnect === 'function') {
      onDisconnect();
    }
  });

  if (events?.joinError && typeof onJoinError === 'function') {
    socket.on(events.joinError, (payload = {}) => onJoinError(payload));
  }

  const uniqueStateEvents = Array.from(new Set([events?.state, ...(stateEvents || [])].filter(Boolean)));
  if (typeof onState === 'function') {
    for (const eventName of uniqueStateEvents) {
      socket.on(eventName, (payload = {}) => onState(payload));
    }
  }

  if (events?.playerJoined && typeof onPlayerJoined === 'function') {
    socket.on(events.playerJoined, (payload = {}) => onPlayerJoined(payload));
  }

  if (events?.playerLeft && typeof onPlayerLeft === 'function') {
    socket.on(events.playerLeft, (payload = {}) => onPlayerLeft(payload));
  }

  if (events?.chatMessage && typeof onChatMessage === 'function') {
    socket.on(events.chatMessage, (payload = {}) => onChatMessage(payload));
  }

  if (events?.chatTyping && typeof onChatTyping === 'function') {
    socket.on(events.chatTyping, (payload = {}) => onChatTyping(payload));
  }
}