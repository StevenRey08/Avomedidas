@echo off
chcp 65001 >nul
title Panel de Administracion Avocat
set "HTML_PATH=%~dp0admin.html"
set "HTML_PATH=%HTML_PATH:\=/%"

start "" msedge.exe --app="file:///%HTML_PATH%" 2>nul || start "" "%~dp0admin.html"
