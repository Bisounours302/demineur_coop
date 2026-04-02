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

# 3. Tester le generateur (doit afficher 18 tests passes)
node test.js

# 4. Lancer en developpement (port 3000)
npm run dev

# 5. En production — demarrer avec PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # pour redemarrage automatique au boot

# 6. Configurer Nginx (voir nginx.conf.example)
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
- `server/games/skeletonSession.js`: squelette de session pour demarrer un 3e mode

Points d entree compatibilite:

- `gameSession.js`: wrapper vers le module demineur
- `paintSession.js`: wrapper vers le module paint
- `server.js`: orchestration Express + Socket.io + lobbies par mode

Base client (reutilisable):

- `public/base-client-common.js`: utilitaires/constantes partages (personnages, deplacements, chat)

Clients de jeux (separes):

- `public/client.js`: client demineur
- `public/paint-client.js`: client paint
- `public/skeleton-client.js`: client squelette (base reutilisable)
- `public/index.html` et `public/paint.html`: pages dediees
- `public/skeleton.html`: page squelette de reference
- `public/style.css`: style partage HUD, chat, overlays, palette

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

4. Ajouter les actions specifiques du mode dans `io.on('connection')` (comme `paint:place` pour le paint).
5. Exposer la page avec une route Express (`app.get('/<tonJeu>', ...)`) et ajouter les boutons de navigation entre modes.
6. Reutiliser `public/base-client-common.js` pour conserver les memes personnages/deplacements/chat.

## Notes gameplay

- Une seule partie globale en memoire
- Maximum 10 joueurs connectes
- 10 explosions -> defaite
- Toutes les cases non-bombe revelees -> victoire
- Ecran de stats 60 secondes puis nouvelle partie automatique
- Mode paint: sauvegarde auto toutes les 5 minutes uniquement si la carte a change
- Sauvegardes paint: `data/paint/<lobbyId>.json` (restaurees automatiquement au demarrage)
