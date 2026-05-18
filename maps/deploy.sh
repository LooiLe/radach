#!/bin/bash
set -e
## ============================================
## Radach Maps - Deploy Script (Mac/Linux/WSL)
## Run from: project root (maps/)
## Usage: ./deploy.sh              (deploy everything)
##        ./deploy.sh frontend     (frontend only)
##        ./deploy.sh backend      (backend only)
## ============================================

VPS="root@93.127.194.132"
REMOTE_DIR="/opt/radach-maps"

deploy_frontend() {
    echo -e "\n[1/3] Uploading frontend source..."
    scp -o ConnectTimeout=10 -r frontend/src "$VPS:$REMOTE_DIR/frontend/"
    scp -o ConnectTimeout=10 -r frontend/public "$VPS:$REMOTE_DIR/frontend/"
    scp -o ConnectTimeout=10 frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html "$VPS:$REMOTE_DIR/frontend/"

    echo "[2/3] Building frontend on VPS..."
    ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 "$VPS" "cd $REMOTE_DIR/frontend && npm ci && npm run build && rm -rf /var/www/radach/assets && cp -r dist/* /var/www/radach/ && chown -R www-data:www-data /var/www/radach && echo 'Frontend deployed!'"

    echo "[3/3] Reloading Nginx..."
    ssh -o ConnectTimeout=10 "$VPS" "systemctl reload nginx"
    echo "Frontend deploy complete!"
}

deploy_backend() {
    echo -e "\n[1/3] Uploading backend source..."
    ssh -o ConnectTimeout=10 "$VPS" "rm -rf $REMOTE_DIR/src"
    scp -o ConnectTimeout=10 -r src "$VPS:$REMOTE_DIR/"
    scp -o ConnectTimeout=10 pom.xml "$VPS:$REMOTE_DIR/"

    echo "[2/3] Building backend on VPS..."
    ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 "$VPS" "cd $REMOTE_DIR && ./mvnw clean package -DskipTests 2>&1 | tail -5"

    echo "[3/3] Restarting Spring Boot..."
    ssh -o ConnectTimeout=10 "$VPS" "systemctl restart radach-maps && sleep 5 && systemctl status radach-maps --no-pager -l | head -15"
    echo "Backend deploy complete!"
}

echo -e "\n=== Radach Maps Deploy ==="

case "${1:-all}" in
    frontend) deploy_frontend ;;
    backend)  deploy_backend ;;
    all)      deploy_frontend; deploy_backend ;;
    *)        echo "Usage: ./deploy.sh [frontend|backend]" ;;
esac

echo -e "\n=== Deploy finished! ==="
echo "Site: http://93.127.194.132"
