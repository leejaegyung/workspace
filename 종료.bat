@echo off
chcp 65001 > nul
title Kinetic Workspace - Stop

echo.
echo  Stopping Kinetic Workspace (port 3001)...
echo.

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo  Killing PID %%a...
    taskkill /PID %%a /F > nul 2>&1
    set FOUND=1
)

if %FOUND% == 0 (
    echo  No process found on port 3001.
) else (
    echo  Done!
)

echo.
timeout /t 2 > nul
