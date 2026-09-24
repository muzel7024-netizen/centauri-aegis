@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"
title Centauri Aegis — Reset Administrator Credentials

rem Resolve Node runtime
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" (
    where node >nul 2>&1
    if !errorlevel! equ 0 (
        set "NODE_EXE=node"
    ) else (
        echo [ERROR] No Node.js runtime found!
        pause
        exit /b 1
    )
)

if not exist "%~dp0launcher.js" (
    echo [ERROR] launcher.js not found in %~dp0
    pause
    exit /b 1
)

"%NODE_EXE%" "%~dp0launcher.js" --reset

echo.
pause
