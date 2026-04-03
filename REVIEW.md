# Code Review - Demineur Coop (avril 2026)

## Ce qui a été bien fait depuis le dernier état

- **esbuild ajouté** — build client modulaire, `scripts/build-client.js`, propre
- **Modules client partagés** — camera, chat, HUD, lobby, input, sprites, tiles sont extraits dans `src/client/modules/`
- **Events unifiés** — convention `mode:action` cohérente dans `server/socket/events.js` et `src/client/core/events.js`
- **Socket handlers extraits** — `registerMinesSocketHandlers`, `registerPaintSocketHandlers`, `registerSnakeSocketHandlers` dans `server/socket/`
- **CORS restreint** — whitelist explicite des domaines, plus de `origin: '*'`
- **JSDoc sur createSessionCore** — types `SessionPlayer`, `SessionState`, `SessionCoreOptions` documentés
- **Snake mode ajouté** — proprement intégré via le pattern existant
- **createSessionCore** — toujours solide, bon pattern de composition

---

## Ce qui reste à améliorer

### 1. Les clients sont toujours des monolithes (problème n°1)

Les modules partagés existent mais ne sont pas assez utilisés. Chaque mode copie-colle encore énormément de code :

| Fichier | Lignes |
|---------|--------|
| `mines/index.js` | 1573 |
| `paint/index.js` | 1058 |
| `snake/index.js` | 739 |
| `skeleton/index.js` | 682 |
| **Total client** | **4052** |

**Code dupliqué entre les modes** (mines ≈ paint, presque identique) :

- `applyPlayerPayload()` — ~55 lignes, copié entre mines et paint avec des différences mineures (stunnedUntil vs rien)
- `spriteDirection()`, `playerSheetForPlayer()`, `getSpriteFrame()` — identiques entre mines et paint
- `updateCamera()` — ~40 lignes, identique entre mines et paint (snake a une version simplifiée)
- `processInputQueue()` + `enqueueMove()` + `registerHoldMove()` — identiques entre mines et paint
- `updateLocalPlayerFromServerMove()` — identique entre mines et paint
- Gestion drag/zoom (mousedown btn1, mousemove, mouseup, wheel) — identique dans les 3 modes
- `resizeCanvas()` — identique dans les 3 modes
- `startGameLoop()` — identique dans les 3 modes
- Join form handler — identique dans les 3 modes
- Chat form handler — identique dans les 3 modes
- Boîte keydown (Tab → chat, Escape → fermer, Enter → focus input) — identique dans les 3 modes
- Wrapper functions qui délèguent aux modules sans rien ajouter : `setChatMessages`, `appendChatMessage`, `setTypingStatus`, `setChatOpen`, `toggleChat`, `updateAvatarSelectionUI`, `setMyAvatar`, etc. — ~20 lignes de boilerplate identique par mode
- Init localStorage (pseudo, avatar, colorIndex) — identique dans les 3 modes

**Estimation** : ~400-500 lignes sont dupliquées entre chaque paire de modes avec position-move (mines/paint).

#### Ce qui devrait être extrait

| Module manquant | Contenu |
|----------------|---------|
| `modules/player/applyPlayerPayload.js` | Résolution avatar/color, direction, merge avec previous |
| `modules/player/spriteRenderer.js` | `spriteDirection`, `getSpriteFrame`, `playerSheetForPlayer`, `drawPlayer` |
| `modules/camera/cameraControls.js` | `updateCamera` avec mode manuel/auto, `clampCamera`, `centerCameraOnMe` |
| `modules/input/dragZoom.js` | Middle-click drag, wheel zoom, clamp |
| `modules/input/moveQueue.js` | `processInputQueue`, `enqueueMove`, wrappers holdMove |
| `modules/bootstrap/createGameBootstrap.js` | `resizeCanvas`, `startGameLoop`, init localStorage, join form, chat form, keydown/keyup, reconnect lifecycle |

Avec ça, un mode ne contiendrait plus que sa logique spécifique : ~200-400 lignes au lieu de 700-1500.

### 2. Fichiers proxy inutiles à la racine

```
gameSession.js    → require('./server/games/minesweeperSession')
paintSession.js   → require('./server/games/paintSession')
snakeSession.js   → require('./server/games/snakeSession')
gameState.js      → crée une instance default + spread (jamais utilisé directement)
```

`server.js` importe déjà via les proxy. Soit supprimer les proxy et importer directement, soit garder les proxy mais supprimer `gameState.js` qui ne sert à rien (il spread une instance default qui n'est jamais consommée).

### 3. `public/base-client-common.js` est du code mort

Remplacé par `src/client/core/shared.js` via esbuild. Le fichier existe encore dans `public/` et est peut-être encore référencé par les HTML en fallback. À nettoyer.

### 4. server.js contient encore de la logique mines-spécifique

`scheduleMinesNextRound()` et `handleMinesPotentialGameOver()` sont des fonctions spécifiques au démineur qui vivent dans server.js au lieu de `minesweeperSession.js` ou `registerMinesSocketHandlers.js`. Le snake a déjà `onPlayerDied`/`onPlayerRemoved` dans sa session — le mines devrait faire pareil pour le game over.

### 5. Snake callbacks dans server.js sont complexes

Le `createSession` du snake dans `MODE_RUNTIME` fait 15 lignes avec des callbacks `onPlayerDied` et `onPlayerRemoved` qui manipulent directement `io.sockets` et appellent `tryRemoveLobby`. Cette logique devrait être dans le handler socket ou la session, pas dans la déclaration du mode.

### 6. Les events client et serveur sont dupliqués

- Serveur : `server/socket/events.js` (CommonJS, `module.exports`)
- Client : `src/client/core/events.js` (ESM, `export`)

Les mêmes strings sont écrites deux fois. Si quelqu'un change un event d'un côté sans l'autre, ça casse silencieusement. Solution : un seul fichier source (ESM) importé des deux côtés, ou généré au build.

---

## Ce que je ne toucherais PAS

- `generator.js` — testé, isolé, marche
- `createSessionCore` — bon pattern, JSDoc ajouté
- Les sessions serveur (`minesweeperSession.js`, `paintSession.js`, `snakeSession.js`) — bien structurées
- `server/socket/register*SocketHandlers.js` — propres et focalisés
- Le CSS — cohérent
- Le système de persistence paint — propre
- Le build esbuild — simple et efficace

---

## Priorités d'action

| Priorité | Action | Impact | Effort |
|----------|--------|--------|--------|
| **1** | Extraire les ~500 lignes dupliquées des clients dans des modules partagés (voir tableau ci-dessus) | Élimine la moitié du code de chaque mode | Moyen |
| **2** | Créer un `createGameBootstrap()` qui encapsule le boilerplate commun (resize, game loop, join form, chat form, keydown/up, localStorage init) | Réduit chaque mode à sa logique spécifique | Moyen |
| **3** | Déplacer `scheduleMinesNextRound` et `handleMinesPotentialGameOver` hors de server.js | server.js devient agnostique des modes | Faible |
| **4** | Nettoyer les fichiers proxy racine et `base-client-common.js` | Moins de confusion | Faible |
| **5** | Unifier events.js (un seul fichier source) | Élimine le risque de désync client/serveur | Faible |

---

## Résumé

L'architecture serveur est propre et modulaire. Le gros du travail restant est côté client : les modules partagés existent mais ne couvrent que ~20% du code commun. Chaque nouveau mode copie encore ~500 lignes de boilerplate identique. Un `createGameBootstrap()` + quelques modules supplémentaires (player rendering, camera controls, drag/zoom, move queue) ramèneraient chaque mode à sa logique métier uniquement.
