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

module.exports = {
  MODE_EVENTS,
  MINES_ACTION_EVENTS,
  PAINT_ACTION_EVENTS,
};
