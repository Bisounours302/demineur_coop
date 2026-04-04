# Demineur cooperatif en ligne

## Prerequis

- Node.js 18+
- npm
- Nginx (prod)

## Lancer en local

```bash
# 1. Installer les dependances
npm install

# 2. Build client (esbuild)
npm run build

# 3. Tests
npm test

# 4. Dev (build + serveur)
npm run dev

# 5. Demarrage simple
npm start
```

## Architecture actuelle

### Serveur

- `server/core/sharedConstants.js`: constantes communes (avatars, couleurs, chat)
- `server/core/sharedUtils.js`: utilitaires communs (normalisation, hash)
- `server/core/createSessionCore.js`: noyau realtime commun
- `server/games/minesweeperSession.js`: logique Demineur
- `server/games/paintSession.js`: logique Paint
- `server/games/snakeSession.js`: logique Snake
- `server/socket/registerMinesSocketHandlers.js`: actions Demineur
- `server/socket/registerPaintSocketHandlers.js`: actions Paint
- `server/socket/registerSnakeSocketHandlers.js`: actions Snake
- `shared/events.js`: source unique des noms d evenements Socket.io
- `server.js`: orchestration Express + Socket.io + lobbies multi-modes

### Client

- `src/client/core/shared.js`: utilitaires front communs
- `src/client/modules/bootstrap/createModeBootstrap.js`: bootstrap client commun par mode
- `src/client/modules/chat/createChatModule.js`: chat commun
- `src/client/modules/lobby/createIdentityModule.js`: lobby/avatar/couleur
- `src/client/modules/hud/createHudModule.js`: HUD commun
- `src/client/modules/network/registerCommonSocketLifecycle.js`: lifecycle socket commun
- `src/client/modules/camera/followCamera.js`: helpers camera
- `src/client/modules/input/holdMove.js`: hold-move clavier
- `src/client/modules/tiles/drawCheckerTiles.js`: grille damier
- `src/client/modules/characters/drawAvatarFrame.js`: rendu sprite avatar
- `src/client/modules/player/spriteUtils.js`: direction + frames sprite
- `src/client/modules/player/drawLabels.js`: labels joueurs
- `src/client/modes/mines/index.js`: mode Demineur
- `src/client/modes/paint/index.js`: mode Paint
- `src/client/modes/snake/index.js`: mode Snake
- `scripts/build-client.js`: generation des bundles client

### Pages et bundles publics

- `public/index.html` + `public/client.js`: Demineur
- `public/paint.html` + `public/paint-client.js`: Paint
- `public/snake.html` + `public/snake-client.js`: Snake
- `public/style.css`: styles partages

## Evenements Socket.io

Les evenements sont prefixes par mode:

- `mines:*`
- `paint:*`
- `snake:*`

Exemples: `mines:join`, `paint:pixel:place`, `snake:turn`.

## Notes gameplay

- Demineur: 10 explosions -> defaite, reveal total -> victoire, stats puis nouvelle manche auto
- Paint: sauvegarde auto periodique si carte modifiee dans `data/paint/<lobbyId>.json`
- Snake: deplacement auto, rotation aux fleches, collision -> mort et retour lobby

## Configuration reseau

- CORS Socket.io filtre par origines autorisees
- Variable optionnelle: `ALLOWED_ORIGINS` (CSV)

Exemple:

`ALLOWED_ORIGINS=https://demineur.everbloom.fr,https://paint.everbloom.fr,https://snake.everbloom.fr`

## Configuration Snake (latence)

- `SNAKE_TICK_MS` controle le tick serveur Snake (ms)
- Valeur plus basse = ressenti plus reactif mais charge un peu plus elevee
- Recommande en prod: `130`

Le `ecosystem.config.js` inclut deja `SNAKE_TICK_MS: 130`.

## Production (PM2)

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```
