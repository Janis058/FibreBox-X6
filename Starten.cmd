@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Bitte zuerst Node.js ab Version 22 installieren.
  pause
  exit /b 1
)
if not exist node_modules\qrcode\package.json (
  echo Installiere die Bibliothek fuer lokale WLAN-QR-Codes...
  call npm.cmd ci --ignore-scripts --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Oeffne http://127.0.0.1:8787 im Browser.
echo Dieses Fenster zum Beenden schliessen oder Strg+C druecken.
node server.mjs
pause
