@echo off
chcp 65001 >nul
title Detener Servidor Avomedidas
echo ============================================================
echo   DETENER SERVIDOR AVOMEDIDAS
echo ============================================================
echo.

setlocal enabledelayedexpansion
set "ENCONTRADO=0"

for /f "tokens=5" %%a in ('netstat -ano ^| findstr "LISTENING" ^| findstr ":3000 "') do (
    set "ENCONTRADO=1"
    taskkill /PID %%a /F >nul 2>&1
    echo Detenido proceso del servidor con PID: %%a
)

if "%ENCONTRADO%"=="0" (
    echo El servidor no estaba en ejecucion (puerto 3000 libre).
) else (
    echo.
    echo [LISTO] El servidor ha sido detenido correctamente.
)

echo.
pause
