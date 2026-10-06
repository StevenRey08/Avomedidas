@echo off
chcp 65001 >nul
title Iniciar Servidor Avomedidas
echo ============================================================
echo   INICIANDO SERVIDOR AVOMEDIDAS (TIENDA Y TALLER)
echo ============================================================
echo.

cd /d "%~dp0"

netstat -ano | findstr "LISTENING" | findstr ":3000 " >nul
if %errorlevel% equ 0 (
    echo [OK] El servidor YA ESTA ENCENDIDO y activo en el puerto 3000.
    echo.
) else (
    echo Encendiendo servidor en segundo plano...
    wscript "iniciar-segundo-plano.vbs"
    timeout /t 2 >nul
    echo [LISTO] Servidor iniciado con exito.
    echo.
)

echo Acceso para clientas:   http://localhost:3000
echo Acceso administrativo:  http://localhost:3000/admin
echo.
echo Abriendo la aplicacion en tu navegador...
start http://localhost:3000
timeout /t 2 >nul
