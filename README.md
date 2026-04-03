# Demineur cooperatif en ligne (V1)

## Prerequis

- Node.js 18+
- npm
- Nginx (deja installe sur le VPS)

## Lancer en local

```bash
# 1. Aller dans le dossier projet
cd /path/to/project

# 2. Installer les dependances
npm install

# 3. Generer les bundles client (esbuild)
npm run build

# 4. Tester le generateur (doit afficher 18 tests passes)
node test.js

# 5. Lancer en developpement (port 3000)
npm run dev

# 6. En production — demarrer avec PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # pour redemarrage automatique au boot

# 7. Configurer Nginx (voir nginx.conf.example)
# Ajouter le bloc location dans /etc/nginx/sites-available/ton-domaine
sudo nginx -t
sudo systemctl reload nginx
```

## Architecture modulaire

Base serveur (reutilisable pour d autres jeux):

- `server/core/sharedConstants.js`: constantes communes (couleurs, avatars, chat)
- `server/core/sharedUtils.js`: helpers communs (normalisation, hash, couleurs)
- `server/core/createSessionCore.js`: noyau temps reel (joueurs, deplacement, chat)

Modules de jeux (separes):

- `server/games/minesweeperSession.js`: regles et etat du demineur
- `server/games/paintSession.js`: regles et etat du paint geant
- `server/games/snakeSession.js`: regles et etat du snake geant
- `server/games/skeletonSession.js`: squelette de session pour demarrer un 3e mode

Points d entree compatibilite:

- `gameSession.js`: wrapper vers le module demineur
- `paintSession.js`: wrapper vers le module paint
- `snakeSession.js`: wrapper vers le module snake
- `server/socket/events.js`: conventions de noms d evenements Socket.io
- `server/socket/registerMinesSocketHandlers.js`: handlers Socket.io specifiques demineur
- `server/socket/registerPaintSocketHandlers.js`: handlers Socket.io specifiques paint
- `server/socket/registerSnakeSocketHandlers.js`: handlers Socket.io specifiques snake
- `server.js`: orchestration Express + Socket.io + lobbies par mode

Client modulaire + build:

- `src/client/core/shared.js`: utilitaires front communs (couleurs, avatars, conversion, clavier)
- `src/client/core/events.js`: noms d evenements Socket.io partages
- `src/client/modes/mines/index.js`: entree client demineur
- `src/client/modes/paint/index.js`: entree client paint
- `src/client/modes/snake/index.js`: entree client snake
- `src/client/modes/skeleton/index.js`: entree client squelette
- `scripts/build-client.js`: bundling esbuild vers `public/*.js`

Clients de jeux (separes):

- `public/client.js`: bundle client demineur genere
- `public/paint-client.js`: bundle client paint genere
- `public/snake-client.js`: bundle client snake genere
- `public/skeleton-client.js`: bundle client squelette genere
- `public/index.html`, `public/paint.html` et `public/snake.html`: pages dediees
- `public/skeleton.html`: page squelette de reference
- `public/style.css`: style partage HUD, chat, overlays, palette

Convention evenements Socket.io:

- Tous les evenements sont prefixes par mode (`mines:*`, `paint:*`, `snake:*`, `skeleton:*`)
- Exemples: `mines:join`, `mines:cell:reveal`, `paint:pixel:place`, `snake:turn`

## Ajouter un nouveau jeu

Le plus simple est de partir du squelette deja inclus:

1. Dupliquer `server/games/skeletonSession.js` vers `server/games/<tonJeu>Session.js`.
2. Dupliquer `public/skeleton.html` et `public/skeleton-client.js` avec tes noms (`<tonJeu>.html`, `<tonJeu>-client.js`).
3. Dans `server.js`, ajouter l import du nouveau module puis une entree dans `MODE_RUNTIME`:

```js
newMode: {
	defaultLobbyId: 'new-global',
	lobbies: new Map(),
	createSession: () => createNewModeSession(),
	onEmptyLobby: null,
	events: {
		join: 'new:join',
		joinError: 'new:error:join',
		state: 'new:state',
		playerJoined: 'new:player:joined',
		playerLeft: 'new:player:left',
		move: 'new:move',
		moved: 'new:player:moved',
		typingIn: 'new:chat:typing',
		typingOut: 'new:chat:typing',
		chatIn: 'new:chat:send',
		chatOut: 'new:chat:message',
	},
}
```

4. Ajouter les actions specifiques du mode dans un module dedie de `server/socket/` (comme `registerPaintSocketHandlers.js`).
5. Exposer la page avec une route Express (`app.get('/<tonJeu>', ...)`) et ajouter les boutons de navigation entre modes.
6. Ajouter un client mode dans `src/client/modes/<tonJeu>/index.js`, puis inclure ce bundle dans `scripts/build-client.js`.

## Notes gameplay

- Une seule partie globale en memoire
- Maximum 10 joueurs connectes
- 10 explosions -> defaite
- Toutes les cases non-bombe revelees -> victoire
- Ecran de stats 60 secondes puis nouvelle partie automatique
- Mode paint: sauvegarde auto toutes les 5 minutes uniquement si la carte a change
- Sauvegardes paint: `data/paint/<lobbyId>.json` (restaurees automatiquement au demarrage)
- Mode snake: deplacement automatique, changement de direction aux fleches, collision queue = mort + respawn

## Securite reseau

- Le CORS Socket.io est filtre par liste d origines autorisees (plus de `origin: *`).
- Variable optionnelle: `ALLOWED_ORIGINS` (CSV), exemple:
	`ALLOWED_ORIGINS=https://demineur.everbloom.fr,https://paint.everbloom.fr,https://snake.everbloom.fr`

## Sous-domaines

- `paint.everbloom.fr`: script d aide `setup-paint.sh`
- `snake.everbloom.fr`: script d aide `setup-snake.sh`
