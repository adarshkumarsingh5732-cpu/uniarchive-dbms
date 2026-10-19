@echo off
title UniArchive Live Demo (Vercel + Laptop Database)
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-demo.ps1"
pause
