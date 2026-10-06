@echo off
chcp 65001 >nul
title Estado del Servidor Avomedidas
cd /d "%~dp0"
node scripts/estado.js
pause
