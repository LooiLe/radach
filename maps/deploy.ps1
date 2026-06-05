## ============================================
## Radach Maps - One-Click Deploy Script
## Run from: c:\Users\looil\Desktop\radach\maps
## Usage: .\deploy.ps1            (deploy everything)
##        .\deploy.ps1 -backend   (backend only)
##        .\deploy.ps1 -frontend  (frontend only)
## ============================================

param(
    [switch]$backend,
    [switch]$frontend
)

$VPS = "root@93.127.194.132"
$REMOTE_DIR = "/opt/radach-maps"
$SSH_OPTS = "-o ConnectTimeout=10 -o ServerAliveInterval=5"

# If no flag specified, deploy both
if (-not $backend -and -not $frontend) {
    $backend = $true
    $frontend = $true
}

Write-Host "`n=== Radach Maps Deploy ===" -ForegroundColor Cyan

# --- FRONTEND ---
if ($frontend) {
    Write-Host "`n[1/3] Uploading frontend source..." -ForegroundColor Yellow
    scp -O -o ConnectTimeout=10 -r frontend/src $VPS`:$REMOTE_DIR/frontend/
    scp -O -o ConnectTimeout=10 -r frontend/public $VPS`:$REMOTE_DIR/frontend/
    scp -O -o ConnectTimeout=10 frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html $VPS`:$REMOTE_DIR/frontend/

    Write-Host "[2/3] Building frontend on VPS..." -ForegroundColor Yellow
    ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 $VPS "cd $REMOTE_DIR/frontend && npm ci && npm run build && rm -rf /var/www/radach/assets && cp -r dist/* /var/www/radach/ && chown -R www-data:www-data /var/www/radach && echo 'Frontend deployed!'"

    Write-Host "[3/3] Reloading Nginx..." -ForegroundColor Yellow
    ssh -o ConnectTimeout=10 $VPS "systemctl reload nginx"

    Write-Host "Frontend deploy complete!" -ForegroundColor Green
}

# --- BACKEND ---
if ($backend) {
    Write-Host "`n[1/3] Uploading backend source..." -ForegroundColor Yellow
    ssh -o ConnectTimeout=10 $VPS "rm -rf $REMOTE_DIR/src"
    scp -O -o ConnectTimeout=10 -r src $VPS`:$REMOTE_DIR/
    scp -O -o ConnectTimeout=10 pom.xml $VPS`:$REMOTE_DIR/

    Write-Host "[2/3] Building backend on VPS..." -ForegroundColor Yellow
    ssh -o ConnectTimeout=10 -o ServerAliveInterval=5 $VPS "cd $REMOTE_DIR && ./mvnw clean package -DskipTests 2>&1 | tail -5"

    Write-Host "[3/3] Restarting Spring Boot..." -ForegroundColor Yellow
    ssh -o ConnectTimeout=10 $VPS "systemctl restart radach-maps && sleep 5 && systemctl status radach-maps --no-pager -l | head -15"

    Write-Host "Backend deploy complete!" -ForegroundColor Green
}

Write-Host "`n=== Deploy finished! ===" -ForegroundColor Cyan
Write-Host "Site: http://93.127.194.132`n"
