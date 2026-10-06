@echo off
chcp 65001 >nul
color 0A
title Empaquetar Instalador para Google Drive
echo ======================================================================
echo          AVOCAT POUR LES HOMMES - GENERADOR DE PAQUETE
echo             CREAR INSTALADOR ZIP PARA GOOGLE DRIVE
echo ======================================================================
echo.
echo Generando paquete portátil para la otra computadora...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\empaquetar.ps1"

echo.
echo Presiona cualquier tecla para cerrar esta ventana.
pause >nul
