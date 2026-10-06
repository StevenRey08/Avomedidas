param(
    [string]$SourceDir = "$PSScriptRoot\.."
)

$SourceDir = [System.IO.Path]::GetFullPath($SourceDir)
$stagingDir = Join-Path $env:TEMP "AvocatInstallerStaging"

if (Test-Path $stagingDir) {
    Remove-Item $stagingDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingDir | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingDir "css") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingDir "js") | Out-Null
New-Item -ItemType Directory -Path (Join-Path $stagingDir "assets") | Out-Null

Copy-Item (Join-Path $SourceDir "INSTALADOR-TALLER-AVOCAT.bat") -Destination $stagingDir
Copy-Item (Join-Path $SourceDir "DESINSTALAR-TALLER-AVOCAT.bat") -Destination $stagingDir
Copy-Item (Join-Path $SourceDir "instalar.ps1") -Destination $stagingDir
Copy-Item (Join-Path $SourceDir "admin.html") -Destination $stagingDir
Copy-Item (Join-Path $SourceDir "css\admin.css") -Destination (Join-Path $stagingDir "css\admin.css")
Copy-Item (Join-Path $SourceDir "js\admin.js") -Destination (Join-Path $stagingDir "js\admin.js")

$jspdf = Join-Path $SourceDir "js\jspdf.umd.min.js"
if (Test-Path $jspdf) {
    Copy-Item $jspdf -Destination (Join-Path $stagingDir "js\jspdf.umd.min.js")
}

Copy-Item (Join-Path $SourceDir "assets\*") -Destination (Join-Path $stagingDir "assets") -Recurse

$readmeText = @"
======================================================================
     AVOCAT POUR LES HOMMES - INSTALADOR DEL PANEL DE TALLER
======================================================================

INSTRUCCIONES DE INSTALACION EN ESTA PC:

1. Descomprime este archivo ZIP (Clic derecho -> Extraer todo).
2. Entra a la carpeta descomprimida y haz doble clic en:
   👉 INSTALADOR-TALLER-AVOCAT.bat

3. ¡Listo! El sistema creara el acceso directo [Panel Taller Avocat]
   en tu Escritorio y en el Menu Inicio con el logo oficial.

NOTAS IMPORTANTES:
- No requiere instalar Node.js ni ningun programa adicional.
- Se conecta en tiempo real a la nube de Avocat con Vercel y Upstash.
- Para desinstalar limpiamente, usa DESINSTALAR-TALLER-AVOCAT.bat.
"@
Set-Content -Path (Join-Path $stagingDir "LEEME-INSTRUCCIONES.txt") -Value $readmeText -Encoding UTF8

$desktop = [System.Environment]::GetFolderPath('Desktop')
$zipDesktop = Join-Path $desktop "Instalador-Panel-Taller-Avocat.zip"
$zipRepo = Join-Path $SourceDir "Instalador-Panel-Taller-Avocat.zip"

if (Test-Path $zipRepo) { Remove-Item $zipRepo -Force }
if (Test-Path $zipDesktop) { Remove-Item $zipDesktop -Force }

Compress-Archive -Path "$stagingDir\*" -DestinationPath $zipRepo
Copy-Item $zipRepo -Destination $zipDesktop

Write-Host " [OK] Paquete ZIP generado con exito en:" -ForegroundColor Green
Write-Host "      1. Tu Escritorio: $zipDesktop" -ForegroundColor Yellow
Write-Host "      2. Carpeta del proyecto: $zipRepo" -ForegroundColor Yellow
Write-Host ""
Write-Host " ¡Solo sube 'Instalador-Panel-Taller-Avocat.zip' a Google Drive!" -ForegroundColor Cyan
