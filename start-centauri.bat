@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"
title Centauri Aegis v1.1.0 — AI Security Testing ^& Research

rem Resolve Node runtime (bundled portable runtime takes precedence)
set "NODE_EXE=%~dp0runtime\node.exe"
if not exist "%NODE_EXE%" (
    where node >nul 2>&1
    if !errorlevel! equ 0 (
        set "NODE_EXE=node"
    ) else (
        echo [ERROR] No Node.js runtime found!
        echo Neither bundled runtime\node.exe nor system Node.js was detected.
        echo Please ensure runtime\node.exe is present in this folder.
        echo.
        pause
        exit /b 1
    )
)

rem Verify launcher.js exists
if not exist "%~dp0launcher.js" (
    echo [ERROR] launcher.js not found in %~dp0
    echo Please verify the distribution package is intact.
    echo.
    pause
    exit /b 1
)

rem Optional override configuration (advanced users only)
if exist "%~dp0config.bat" (
    call "%~dp0config.bat"
)

rem Execute the Centauri Aegis production launcher
"%NODE_EXE%" "%~dp0launcher.js" %*

set EXIT_CODE=%errorlevel%
if %EXIT_CODE% neq 0 (
    echo.
    echo [ERROR] Centauri Aegis exited with error code %EXIT_CODE%.
    pause
)
exit /b %EXIT_CODE%
