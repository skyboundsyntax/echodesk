@echo off
setlocal
title ECHODESK - Powered by JOT
echo ==========================================================
echo  Launching ECHODESK Live Workspace...
echo ==========================================================

set "TARGET=%~dp0frontend\index.html"
echo Target file: %TARGET%

if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    echo Launching in Google Chrome...
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "%TARGET%"
    goto :done
)

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    echo Launching in Microsoft Edge...
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "%TARGET%"
    goto :done
)

echo Launching in default browser...
start "" "%TARGET%"

:done
echo ==========================================================
echo  ECHODESK launched successfully!
echo ==========================================================
exit /b 0
