const MODE_EVENTS = {
  mines: {
    join: 'mines:join',
    joinError: 'mines:error:join',
    state: 'mines:state',
    playerJoined: 'mines:player:joined',
    playerLeft: 'mines:player:left',
    move: 'mines:move',
    moved: 'mines:player:moved',
    typingIn: 'mines:chat:typing',
    typingOut: 'mines:chat:typing',
    chatIn: 'mines:chat:send',
    chatOut: 'mines:chat:message',
  },
  paint: {
    join: 'paint:join',
    joinError: 'paint:error:join',
    state: 'paint:state',
    playerJoined: 'paint:player:joined',
    playerLeft: 'paint:player:left',
    move: 'paint:move',
    moved: 'paint:player:moved',
    typingIn: 'paint:chat:typing',
    typingOut: 'paint:chat:typing',
    chatIn: 'paint:chat:send',
    chatOut: 'paint:chat:message',
  },
  snake: {
    join: 'snake:join',
    joinError: 'snake:error:join',
    state: 'snake:state',
    playerJoined: 'snake:player:joined',
    playerLeft: 'snake:player:left',
    typingIn: 'snake:chat:typing',
    typingOut: 'snake:chat:typing',
    chatIn: 'snake:chat:send',
    chatOut: 'snake:chat:message',
  },
};

const MINES_ACTION_EVENTS = {
  revealIn: 'mines:cell:reveal',
  revealOut: 'mines:cells:revealed',
  flagIn: 'mines:cell:flag',
  flagOut: 'mines:cell:flagged',
  bombOut: 'mines:bomb:exploded',
  gameOverOut: 'mines:game:over',
  gameNewOut: 'mines:game:new',
};

const PAINT_ACTION_EVENTS = {
  placeIn: 'paint:pixel:place',
  placeOut: 'paint:pixel',
};

const SNAKE_ACTION_EVENTS = {
  turnIn: 'snake:turn',
  tickOut: 'snake:tick',
  deathOut: 'snake:player:died',
};

module.exports = {
  MODE_EVENTS,
  MINES_ACTION_EVENTS,
  PAINT_ACTION_EVENTS,
  SNAKE_ACTION_EVENTS,
};
