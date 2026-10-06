# ======================================================================
#  Avocat · Instalador del Panel de Administracion para Windows
# ======================================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "          AVOCAT POUR LES HOMMES - TALLER Y CONFECCION                " -ForegroundColor Green
Write-Host "           INSTALADOR OFICIAL DEL PANEL DE ADMINISTRACION             " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""

$sourceDir = $PSScriptRoot
if (-not $sourceDir) {
    $sourceDir = (Get-Location).Path
}

$targetDir = Join-Path $env:LOCALAPPDATA "AvocatTaller"

Write-Host " [1/5] Preparando carpetas en $targetDir..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetDir "css") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetDir "js") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $targetDir "assets") -Force | Out-Null

Write-Host " [2/5] Copiando archivos de la aplicacion..." -ForegroundColor Cyan
Copy-Item (Join-Path $sourceDir "admin.html") -Destination (Join-Path $targetDir "admin.html") -Force
Copy-Item (Join-Path $sourceDir "index.html") -Destination (Join-Path $targetDir "index.html") -Force
Copy-Item (Join-Path $sourceDir "css\admin.css") -Destination (Join-Path $targetDir "css\admin.css") -Force
Copy-Item (Join-Path $sourceDir "js\admin.js") -Destination (Join-Path $targetDir "js\admin.js") -Force
Copy-Item (Join-Path $sourceDir "js\app.js") -Destination (Join-Path $targetDir "js\app.js") -Force

$jspdf = Join-Path $sourceDir "js\jspdf.umd.min.js"
if (Test-Path $jspdf) {
    Copy-Item $jspdf -Destination (Join-Path $targetDir "js\jspdf.umd.min.js") -Force
}

Copy-Item (Join-Path $sourceDir "assets\*") -Destination (Join-Path $targetDir "assets") -Force -Recurse

Write-Host " [3/5] Creando accesos directos con logo en alta resolucion..." -ForegroundColor Cyan
$WshShell = New-Object -ComObject WScript.Shell

$desktopPaths = @(
    [System.Environment]::GetFolderPath('Desktop'),
    (Join-Path $env:USERPROFILE "Desktop")
)
if ($env:OneDrive) {
    $desktopPaths += (Join-Path $env:OneDrive "Desktop")
}
$desktopPaths = $desktopPaths | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$startMenuPaths = @(
    [System.Environment]::GetFolderPath('Programs'),
    (Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs")
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

$Edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $Edge)) {
    $Edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
}

$HtmlFile = Join-Path $targetDir "admin.html"
$IconFile = Join-Path $targetDir "assets\Logo.ico"
$AppUrl = "--app=file:///$($HtmlFile.Replace('\', '/'))"

# Limpiar accesos directos obsoletos y crear el acceso en el Escritorio
foreach ($d in $desktopPaths) {
    @("Panel Taller Avocat.bat", "Taller Avocat - Administracion.lnk") | ForEach-Object {
        $oldFile = Join-Path $d $_
        if (Test-Path $oldFile) { Remove-Item $oldFile -Force -ErrorAction SilentlyContinue }
    }

    $DeskLink = Join-Path $d "Panel Taller Avocat.lnk"
    $ShortcutDesk = $WshShell.CreateShortcut($DeskLink)
    $ShortcutDesk.TargetPath = $Edge
    $ShortcutDesk.Arguments = $AppUrl
    $ShortcutDesk.IconLocation = "$IconFile,0"
    $ShortcutDesk.Description = "Panel de Administracion y Confeccion - Avocat"
    $ShortcutDesk.WorkingDirectory = $targetDir
    $ShortcutDesk.Save()
}

# Acceso directo en el Menu Inicio
foreach ($sm in $startMenuPaths) {
    @("Taller Avocat.lnk") | ForEach-Object {
        $oldSm = Join-Path $sm $_
        if (Test-Path $oldSm) { Remove-Item $oldSm -Force -ErrorAction SilentlyContinue }
    }

    $MenuLink = Join-Path $sm "Panel Taller Avocat.lnk"
    $ShortcutMenu = $WshShell.CreateShortcut($MenuLink)
    $ShortcutMenu.TargetPath = $Edge
    $ShortcutMenu.Arguments = $AppUrl
    $ShortcutMenu.IconLocation = "$IconFile,0"
    $ShortcutMenu.Description = "Panel de Administracion y Confeccion - Avocat"
    $ShortcutMenu.WorkingDirectory = $targetDir
    $ShortcutMenu.Save()
}

# Crear script de desinstalacion en la carpeta instalada
$uninstallContent = @"
@echo off
chcp 65001 >nul
color 0C
title Desinstalar Panel Avocat
echo ======================================================================
echo            DESINSTALADOR DEL PANEL DE TALLER AVOCAT
echo ======================================================================
echo.
echo Desinstalando la aplicacion y eliminando accesos directos...
del /F /Q "%USERPROFILE%\Desktop\Panel Taller Avocat.lnk" 2>nul
del /F /Q "%USERPROFILE%\Desktop\Panel Taller Avocat.bat" 2>nul
del /F /Q "%USERPROFILE%\Desktop\Taller Avocat - Administracion.lnk" 2>nul
if defined OneDrive (
    del /F /Q "%OneDrive%\Desktop\Panel Taller Avocat.lnk" 2>nul
    del /F /Q "%OneDrive%\Desktop\Panel Taller Avocat.bat" 2>nul
    del /F /Q "%OneDrive%\Desktop\Taller Avocat - Administracion.lnk" 2>nul
)
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Panel Taller Avocat.lnk" 2>nul
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Taller Avocat.lnk" 2>nul

timeout /t 1 >nul
echo Eliminando archivos de la aplicacion...
cd /d "%LOCALAPPDATA%"
rmdir /S /Q "%LOCALAPPDATA%\AvocatTaller" >nul 2>&1
echo.
echo ¡Desinstalacion completada!
pause
"@
Set-Content -Path (Join-Path $targetDir "DESINSTALAR.bat") -Value $uninstallContent -Encoding UTF8

Write-Host " [4/5] Actualizando cache de iconos de Windows..." -ForegroundColor Cyan
try {
    Start-Process "ie4uinit.exe" -ArgumentList "-show" -Wait -WindowStyle Hidden
} catch {}
try {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class ShellNotification {
        [DllImport("shell32.dll")]
        public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
    }
"@ -ErrorAction SilentlyContinue
    [ShellNotification]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
} catch {}

Write-Host " [5/5] Iniciando aplicacion en modo ventana de escritorio..." -ForegroundColor Cyan
Start-Process $Edge -ArgumentList $AppUrl

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "              ¡INSTALACION COMPLETADA CON EXITO!                      " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  * Icono en tu Escritorio: [Panel Taller Avocat]" -ForegroundColor Yellow
Write-Host "  * Tambien disponible en el Menu Inicio de Windows como [Panel Taller Avocat]" -ForegroundColor Yellow
Write-Host "  * Conectado 24/7 con los pedidos de la nube en tiempo real." -ForegroundColor Yellow
Write-Host ""
