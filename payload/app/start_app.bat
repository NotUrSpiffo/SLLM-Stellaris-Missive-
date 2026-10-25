@echo off
chcp 65001 >nul
cd /d "%~dp0"
set "SLLM_CLIENT_ID=01a139d0-0356-7e9a-9c8f-c1d8450f3fde"
rem Release build: start with the bundled runtime\electron.exe. Node.js is not required.
rem Paquete: arranca con runtime\electron.exe. Node.js no hace falta.
if exist "runtime\electron.exe" (
  rem First install: if app files are missing, the helper fills them from the Workshop mod, then starts.
  if not exist "dist\main.js" (
    start "" "runtime\electron.exe" "%~dp0dist\bootstrap.js"
    exit /b 0
  )
  start "" "runtime\electron.exe" "%~dp0."
  exit /b 0
)
rem Dev folder (no runtime): run with Node.js and npm.
where node >nul 2>nul
if errorlevel 1 (
  echo [SLLM] No runtime folder. Reinstall with the setup program, or install Node.js and run this file again.
  pause
  exit /b 1
)
if not exist "node_modules\electron\dist\electron.exe" (
  echo [SLLM] Installing dependencies for the first run. Please wait...
  call npm install
  if errorlevel 1 (
    echo [SLLM] Dependency installation failed. Check your internet connection and run this file again.
    pause
    exit /b 1
  )
)
call npm start
if errorlevel 1 (
  echo [SLLM] Startup failed. See the message above.
  pause
  exit /b 1
)
exit /b 0
