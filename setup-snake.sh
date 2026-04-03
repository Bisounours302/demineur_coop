#!/bin/bash
set -euo pipefail

DOMAIN="snake.everbloom.fr"
NGINX_CONF="/etc/nginx/sites-available/$DOMAIN"
NGINX_LINK="/etc/nginx/sites-enabled/$DOMAIN"

echo "=== 1. Vhost Nginx (HTTP uniquement pour certbot) ==="
sudo tee "$NGINX_CONF" > /dev/null <<'NGINX'
server {
    listen 80;
    server_name snake.everbloom.fr;

    # Racine uniquement -> /snake sur le backend
    location = / {
        proxy_pass http://127.0.0.1:3000/snake;

        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Tout le reste (assets, JS, CSS) -> backend tel quel
    location / {
        proxy_pass http://127.0.0.1:3000;

        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;

        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
NGINX

echo "=== 2. Activation du site ==="
if [ ! -L "$NGINX_LINK" ]; then
    sudo ln -s "$NGINX_CONF" "$NGINX_LINK"
fi

echo "=== 3. Reload Nginx (HTTP) ==="
sudo nginx -t && sudo systemctl reload nginx

echo "=== 4. Certificat Let's Encrypt ==="
sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect

echo "=== 5. Test final ==="
sudo nginx -t
sudo systemctl reload nginx

echo "Termine. Teste avec: curl -I https://$DOMAIN/"
