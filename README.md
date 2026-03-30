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

## Architecture

- server.js: serveur Express + Socket.io
- gameState.js: logique serveur autoritaire de la partie unique
- public/index.html: page unique (lobby + canvas + overlays)
- public/client.js: rendu canvas, controles, synchronisation reseau
- public/style.css: styles HUD et overlays
- ecosystem.config.js: configuration PM2
- nginx.conf.example: bloc reverse proxy

## Notes gameplay

- Une seule partie globale en memoire
- Maximum 10 joueurs connectes
- 10 explosions -> defaite
- Toutes les cases non-bombe revelees -> victoire
- Ecran de stats 60 secondes puis nouvelle partie automatique
