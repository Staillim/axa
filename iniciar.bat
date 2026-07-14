@echo off
setlocal

REM Start the CORS proxy in a new minimized window
echo Iniciando proxy de Roblox en http://localhost:3000 ...
start "Roblox Proxy" /min cmd /c "node proxy.js"

REM Give the proxy a moment to bind the port
timeout /t 2 /nobreak >nul

REM Open the page
start "" "index.html"

endlocal
exit
