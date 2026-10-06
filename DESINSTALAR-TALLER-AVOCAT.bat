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
echo [1/3] Eliminando accesos directos del Escritorio...
del /F /Q "%USERPROFILE%\Desktop\Panel Taller Avocat.lnk" 2>nul
del /F /Q "%USERPROFILE%\Desktop\Panel Taller Avocat.bat" 2>nul
del /F /Q "%USERPROFILE%\Desktop\Taller Avocat - Administracion.lnk" 2>nul
if defined OneDrive (
    del /F /Q "%OneDrive%\Desktop\Panel Taller Avocat.lnk" 2>nul
    del /F /Q "%OneDrive%\Desktop\Panel Taller Avocat.bat" 2>nul
    del /F /Q "%OneDrive%\Desktop\Taller Avocat - Administracion.lnk" 2>nul
)

echo [2/3] Eliminando accesos directos del Menu Inicio...
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Panel Taller Avocat.lnk" 2>nul
del /F /Q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Taller Avocat.lnk" 2>nul

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
