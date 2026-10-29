@echo off
title Cafe POS - Build Installer
echo ===============================================
echo  Cafe POS - building Windows installer (.exe)
echo  Needs: Node.js LTS (https://nodejs.org) + internet (first time only)
echo ===============================================
where node >nul 2>nul || (echo Node.js is not installed. Install it from https://nodejs.org then run this again. & pause & exit /b 1)
call npm install || (echo npm install failed & pause & exit /b 1)
call npm run build || (echo Build failed & pause & exit /b 1)
echo.
echo DONE! Your installer is in the "dist" folder: Cafe POS Setup 1.0.0.exe
explorer dist
pause
