/**
 * Single source of truth for all socket event names.
 * Used by server (CommonJS require) and client (ESM import via esbuild).
 */

const MINES_EVENTS = {
  join: 'mines:join',
  joinError: 'mines:error:join',
  state: 'mines:state',
  playerJoined: 'mines:player:joined',
  playerLeft: 'mines:player:left',
  move: 'mines:move',
  playerMoved: 'mines:player:moved',
  chatTyping: 'mines:chat:typing',
  chatSend: 'mines:chat:send',
  chatMessage: 'mines:chat:message',
  reveal: 'mines:cell:reveal',
  cellsRevealed: 'mines:cells:revealed',
  flag: 'mines:cell:flag',
  cellFlagged: 'mines:cell:flagged',
  bombExploded: 'mines:bomb:exploded',
  gameOver: 'mines:game:over',
  gameNew: 'mines:game:new',
};

const PAINT_EVENTS = {
  join: 'paint:join',
  joinError: 'paint:error:join',
  state: 'paint:state',
  playerJoined: 'paint:player:joined',
  playerLeft: 'paint:player:left',
  move: 'paint:move',
  playerMoved: 'paint:player:moved',
  chatTyping: 'paint:chat:typing',
  chatSend: 'paint:chat:send',
  chatMessage: 'paint:chat:message',
  place: 'paint:pixel:place',
  pixel: 'paint:pixel',
};

const SNAKE_EVENTS = {
  join: 'snake:join',
  joinError: 'snake:error:join',
  state: 'snake:state',
  playerJoined: 'snake:player:joined',
  playerLeft: 'snake:player:left',
  chatTyping: 'snake:chat:typing',
  chatSend: 'snake:chat:send',
  chatMessage: 'snake:chat:message',
  turn: 'snake:turn',
  tick: 'snake:tick',
  playerDied: 'snake:player:died',
};

const SKELETON_EVENTS = {
  join: 'skeleton:join',
  joinError: 'skeleton:error:join',
  state: 'skeleton:state',
  playerJoined: 'skeleton:player:joined',
  playerLeft: 'skeleton:player:left',
  move: 'skeleton:move',
  playerMoved: 'skeleton:player:moved',
  chatTyping: 'skeleton:chat:typing',
  chatSend: 'skeleton:chat:send',
  chatMessage: 'skeleton:chat:message',
  action: 'skeleton:action',
  actionApplied: 'skeleton:action:applied',
};

module.exports = {
  MINES_EVENTS,
  PAINT_EVENTS,
  SNAKE_EVENTS,
  SKELETON_EVENTS,
};
