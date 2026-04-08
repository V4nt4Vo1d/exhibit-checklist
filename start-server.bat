@echo off
title Daily Exhibit Checklist
cd /d "%~dp0"
echo Starting Daily Exhibit Checklist server...
echo.
npm run dev -- --host
pause
