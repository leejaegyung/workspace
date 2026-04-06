@echo off
chcp 65001 > nul
title Kinetic Workspace

set "NODE_HOME=C:\nvm4w\nodejs"
set "PATH=%NODE_HOME%;%PATH%"
set "WORK_DIR=%~dp0kinetic-workspace"

cls
echo.
echo  ============================================
echo   Kinetic Workspace Starting...
echo  ============================================
echo.

if not exist "%NODE_HOME%\node.exe" (
    echo  [ERROR] node.exe not found at %NODE_HOME%
    pause
    exit /b 1
)

if not exist "%WORK_DIR%" (
    echo  [ERROR] Folder not found: %WORK_DIR%
    pause
    exit /b 1
)

cd /d "%WORK_DIR%"
echo  Working dir: %CD%
echo.

echo  [1/2] Building frontend...
call npm run build
if not %errorlevel% == 0 (
    echo.
    echo  [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo  [1/2] Build complete!
echo.
echo  [2/2] Starting server on port 3001...
echo.
echo  ============================================
echo   URL: http://localhost:3001
echo   Stop: close this window or Ctrl+C
echo  ============================================
echo.

node_modules\.bin\tsx.cmd server/index.ts

echo.
echo  Server stopped.
pause
