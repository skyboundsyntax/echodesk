@echo off
setlocal
title ECHODESK — Office Kit Companion Server
echo ==========================================================
echo  Starting ECHODESK Office Kit Station & Mobile Server...
echo ==========================================================

echo Starting Node.js server on 0.0.0.0:3001...
start "" cmd /k "node backend\server.js"

timeout /t 2 >nul

echo Opening ECHODESK in your browser...
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" "http://localhost:3001/"
    goto :done
)

if exist "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" (
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" "http://localhost:3001/"
    goto :done
)

start "" "http://localhost:3001/"

:done
echo ==========================================================
echo  Office Kit Server is live at http://localhost:3001/
echo  Open http://<YOUR-IP>:3001/ on your phone to connect!
echo ==========================================================
exit /b 0
