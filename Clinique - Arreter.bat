@echo off
chcp 65001 >nul
title Arret de Clinique
cd /d "%~dp0"

echo Arret de Clinique en cours...

rem Ferme la fenetre du serveur lancee par "Clinique - Demarrer".
taskkill /FI "WINDOWTITLE eq Clinique (serveur - ne pas fermer)*" /T /F >nul 2>nul

rem Filet de securite : arrete tout node ecoutant sur le port 3000.
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>nul
)

echo Clinique est arrete.
timeout /t 2 >nul
exit /b 0
