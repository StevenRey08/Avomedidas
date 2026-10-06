@echo off
chcp 65001 >nul
title Desinstalar Auto-Inicio de Avomedidas
echo ============================================================
echo   DESINSTALAR AUTO-INICIO DE AVOMEDIDAS
echo ============================================================
echo.

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS_FILE=%STARTUP_DIR%\Avomedidas-AutoInicio.vbs"

if exist "%VBS_FILE%" (
    del "%VBS_FILE%"
    echo [EXITO] El auto-inicio ha sido desactivado de la carpeta de inicio de Windows.
) else (
    echo El auto-inicio no estaba activo en esta computadora.
)

echo.
pause
