@echo off
chcp 65001 >nul
color 0A
title Instalador - Panel de Administracion Avocat

echo ======================================================================
echo          AVOCAT POUR LES HOMMES - TALLER Y CONFECCION
echo           INSTALADOR OFICIAL DEL PANEL DE ADMINISTRACION
echo ======================================================================
echo.
echo  Iniciando instalacion...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"

echo.
echo Presiona cualquier tecla para cerrar el instalador.
pause >nul
