@echo off
chcp 65001 >nul
color 0C
title Desinstalar Panel de Administracion Avocat

echo ======================================================================
echo          AVOCAT POUR LES HOMMES - DESINSTALADOR
echo ======================================================================
echo.
echo ¿Estas seguro de que deseas desinstalar la aplicacion de este equipo?
echo.
set /p CONFIRMAR="Escribe S y presiona Enter para confirmar (o cualquier otra tecla para cancelar): "
if /i not "%CONFIRMAR%"=="S" (
    echo.
    echo Desinstalacion cancelada por el usuario.
    pause
    exit /b 0
)

echo.
echo [1/3] Eliminando acceso directo del Escritorio...
if exist "%USERPROFILE%\Desktop\Taller Avocat - Administracion.lnk" (
    del /F /Q "%USERPROFILE%\Desktop\Taller Avocat - Administracion.lnk"
)
if exist "%USERPROFILE%\Desktop\Panel Taller Avocat.bat" (
    del /F /Q "%USERPROFILE%\Desktop\Panel Taller Avocat.bat"
)

echo [2/3] Eliminando acceso directo del Menu Inicio...
if exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Taller Avocat.lnk" (
    del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Taller Avocat.lnk"
)

echo [3/3] Eliminando archivos de la aplicacion...
if exist "%LOCALAPPDATA%\AvocatTaller" (
    cd /d "%LOCALAPPDATA%"
    rmdir /S /Q "%LOCALAPPDATA%\AvocatTaller" >nul 2>&1
)

ie4uinit.exe -show >nul 2>&1

echo.
echo ======================================================================
echo              ¡DESINSTALACION COMPLETADA CON EXITO!
echo ======================================================================
echo.
echo El panel y sus accesos directos han sido removidos limpiamente.
echo Presiona cualquier tecla para salir.
pause >nul
