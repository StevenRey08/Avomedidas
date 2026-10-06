@echo off
chcp 65001 >nul
title Configurar Auto-Inicio de Avomedidas en Windows
echo ============================================================
echo   AVOMEDIDAS - CONFIGURAR AUTO-INICIO CON WINDOWS
echo ============================================================
echo.
echo Este asistente configurará el servidor para que arranque
echo automáticamente cada vez que enciendas la computadora del local,
echo en segundo plano (sin ventanas negras).
echo.

set "PROJ_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_DIR%\Avomedidas-AutoInicio.vbs"

echo Instalando lanzador en la carpeta de inicio de Windows...
(
echo Set WshShell = CreateObject^("WScript.Shell"^)
echo WshShell.CurrentDirectory = "%PROJ_DIR:~0,-1%"
echo WshShell.Run "node server.js", 0, False
) > "%VBS_FILE%"

if exist "%VBS_FILE%" (
    echo.
    echo ============================================================
    echo   [LISTO] Auto-inicio configurado con éxito.
    echo ============================================================
    echo A partir de ahora, cada vez que enciendas esta PC:
    echo 1. El servidor arrancará automáticamente en segundo plano.
    echo 2. Nadie tendrá que abrir la terminal ni escribir comandos.
    echo 3. Los datos de las clientas se guardarán siempre en disco.
    echo ============================================================
    echo.
    echo Iniciando el servidor en este momento...
    wscript "%PROJ_DIR%iniciar-segundo-plano.vbs"
    timeout /t 2 >nul
    echo.
    echo Abriendo la aplicación en tu navegador...
    start http://localhost:3000
) else (
    echo [ERROR] No se pudo escribir en la carpeta de inicio de Windows.
)

echo.
pause
