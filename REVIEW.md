# Code Review - Demineur Coop

## Ce qui est bien

- **`createSessionCore`** : bon pattern de composition, chaque mode ne définit que ses spécificités
- **Skeleton template** : ajouter un nouveau mode est guidé, c'est rare et appréciable
- **Paint persistence** : autosave async avec dirty flag, propre
- **Generator** : seeded RNG + validation de jouabilité, bien couvert par les tests
- **Pas de dépendances inutiles** : juste Express + Socket.IO, minimaliste

---

## Les vrais problèmes

### 1. Les clients sont des monolithes (client.js = 1676 lignes, paint-client.js = 1123)

C'est le problème n°1. Chaque client est un seul fichier géant qui mélange :
- Gestion d'état
- Rendu canvas
- Input clavier/souris
- Réseau Socket.IO
- UI (chat, lobby, HUD)
- Animations sprites

Et **beaucoup de code est dupliqué entre les deux clients** : caméra, mouvement, chat, lobby, sprites, rendu des joueurs. `base-client-common.js` ne partage que des constantes et utilitaires triviaux — toute la logique lourde est copiée-collée.

**Impact** : chaque bugfix ou changement cosmétique doit être fait 2 (bientôt 3+) fois.

### 2. Pas de bundler / modules côté client

Tout est en `<script>` globals. Pas d'import/export, pas de bundler. Ca bloque la factorisation des clients en modules réutilisables. Avec un bundler minimal (esbuild, 0 config), tu pourrais découper en :

```
client/
  core/camera.js        # zoom, pan, drag
  core/sprites.js       # chargement, animation, rendu
  core/chat.js          # UI chat + socket events
  core/lobby.js         # join flow, avatar/color picker
  core/input.js         # clavier, souris
  core/renderer.js      # boucle de rendu, canvas setup
  modes/minesweeper.js  # logique spécifique mines
  modes/paint.js        # logique spécifique paint
```

### 3. `server.js` fait trop de choses

Il fait 300+ lignes et gère :
- Configuration Express
- Routing HTTP
- Enregistrement des modes
- Gestion des lobbies
- Binding de **tous** les événements Socket.IO par mode
- Graceful shutdown

Les handlers Socket.IO spécifiques (`cell:reveal`, `paint:place`) devraient vivre dans leurs modules respectifs, pas dans server.js.

### 4. Événements Socket.IO préfixés manuellement

Chaque mode préfixe ses events différemment (`cell:reveal` vs `paint:place` vs `skeleton:action`). Le système `MODE_RUNTIME.events` est une bonne idée mais les noms sont incohérents :
- mines : `cell:reveal`, `cell:flag` (pas de préfixe mode)
- paint : `paint:place`, `paint:join` (préfixe mode)
- skeleton : `skeleton:action` (préfixe mode)

Choisis une convention et tiens-la.

### 5. Pas de validation d'input côté serveur sur certains chemins

- `cell:reveal` et `cell:flag` vérifient les bornes via `validateAction`, bien
- Mais les coordonnées de mouvement dans `createSessionCore.movePlayer` ne sont validées que par `isInBounds` — pas de rate-limiting sur le mouvement (un client peut spammer)
- `io` a `cors: { origin: '*' }` — ok en dev, risqué en prod

### 6. Fuites mémoire potentielles

- `stunTimers` dans minesweeper utilise `setTimeout` avec des refs socket — si le serveur crash pendant un stun, le timer n'est pas nettoyé (mineur car PM2 restart, mais pas propre)
- Les lobbies vides sont supprimées (`onEmptyLobby`) mais `pseudoProgress` dans minesweeper accumule indéfiniment les pseudos qui ont joué

### 7. Pas de types

Aucun JSDoc ni TypeScript. Avec la taille actuelle c'est gérable, mais ca va devenir un frein à mesure que le projet grandit — surtout les objets `state` et `player` qui ont des formes différentes par mode.

---

## Ce que je ne toucherais PAS

- Le generator — il marche, il est testé, il est isolé
- Le système de persistence paint — propre et fonctionnel
- `createSessionCore` — bon pattern, juste besoin de l'enrichir un peu
- Le CSS — cohérent et bien structuré

---

## Priorités d'action

| Priorité | Action | Effort |
|----------|--------|--------|
| **1** | Ajouter esbuild + découper les clients en modules | Moyen |
| **2** | Extraire les handlers Socket.IO de server.js vers chaque mode | Faible |
| **3** | Unifier la convention de nommage des events | Faible |
| **4** | Rate-limit mouvement + restreindre CORS | Faible |
| **5** | Ajouter JSDoc sur les interfaces clés (state, player) | Faible |

La priorité 1 est de loin la plus impactante. Tant que les clients sont des monolithes sans modules, chaque nouveau mode multiplie la dette.
