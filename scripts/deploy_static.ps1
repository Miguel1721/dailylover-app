# ─────────────────────────────────────────────────────────────────────────────
# scripts/deploy_static.ps1
# Deploy solo los estáticos buildeados (admin + app-preview) al VPS
# Uso: .\scripts\deploy_static.ps1 -KeyFile "C:\ruta\a\tu\llave_ssh" -VpsUser "ubuntu"
# ─────────────────────────────────────────────────────────────────────────────

param(
    [Parameter(Mandatory=$false)]
    [string]$KeyFile = "C:\Users\jeloz\.ssh\llave_server_149",
    
    [Parameter(Mandatory=$false)]
    [string]$VpsUser = "ubuntu",
    
    [Parameter(Mandatory=$false)]
    [string]$VpsHost = "prueba-daily.agentesia.cloud",
    
    [Parameter(Mandatory=$false)]
    [string]$RemotePath = "/home/ubuntu/dailylover/backend/app/static"
)

$ProjectRoot = "C:\Users\jeloz\Documents\antigravity\zealous-fermi"

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " 🚀 Daily Lover — Deploy Estáticos al VPS " -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📦 Servidor: $VpsUser@$VpsHost" -ForegroundColor Yellow
Write-Host "📁 Destino:  $RemotePath" -ForegroundColor Yellow
Write-Host ""

# Verificar que los estáticos existen
$AdminDist  = "$ProjectRoot\backend\app\static\admin"
$AppDist    = "$ProjectRoot\backend\app\static\app-preview"

if (-not (Test-Path $AdminDist)) {
    Write-Host "❌ No se encontró el build de admin en: $AdminDist" -ForegroundColor Red
    Write-Host "   Ejecuta primero: cd frontend/admin && npm run build" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $AppDist)) {
    Write-Host "❌ No se encontró el build de app-preview en: $AppDist" -ForegroundColor Red
    Write-Host "   Ejecuta primero: cd frontend/app-preview && npm run build" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Builds encontrados." -ForegroundColor Green

# Subir admin panel
Write-Host ""
Write-Host "⬆️  Subiendo Panel Admin..." -ForegroundColor Cyan
scp -i $KeyFile -r "$AdminDist" "${VpsUser}@${VpsHost}:${RemotePath}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error subiendo admin. Verifica la llave SSH y los permisos." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Admin subido correctamente." -ForegroundColor Green

# Subir app-preview
Write-Host ""
Write-Host "⬆️  Subiendo App Preview (PWA)..." -ForegroundColor Cyan
scp -i $KeyFile -r "$AppDist" "${VpsUser}@${VpsHost}:${RemotePath}/"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Error subiendo app-preview." -ForegroundColor Red
    exit 1
}
Write-Host "✅ App Preview subida correctamente." -ForegroundColor Green

# Reiniciar el contenedor api en el VPS
Write-Host ""
Write-Host "🔄 Reiniciando servicio API en el VPS..." -ForegroundColor Cyan
ssh -i $KeyFile "${VpsUser}@${VpsHost}" "cd /home/ubuntu/dailylover && docker compose restart api"
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  No se pudo reiniciar el servicio api. Reinicia manualmente." -ForegroundColor Yellow
} else {
    Write-Host "✅ API reiniciada." -ForegroundColor Green
}

Write-Host ""
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
Write-Host " ✅ Deploy completado exitosamente!" -ForegroundColor Green
Write-Host "   🌐 Admin:       https://prueba-daily.agentesia.cloud/admin/" -ForegroundColor Green
Write-Host "   📱 App Cliente: https://prueba-daily.agentesia.cloud/app-preview/" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Green
