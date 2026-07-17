@echo off
setlocal
cd /d "%~dp0"

if "%OPENAI_API_KEY%"=="" (
  echo Paste your OpenAI API key for this window only, then press Enter.
  set /p OPENAI_API_KEY=OPENAI_API_KEY: 
)

if "%OPENAI_API_KEY%"=="" (
  echo.
  echo No API key entered. The live Web check needs OPENAI_API_KEY.
  pause
  exit /b 1
)

node --version >nul 2>&1
if errorlevel 1 (
  echo.
  echo Node.js was not found. Install Node.js 20 or newer, then run this again.
  echo https://nodejs.org/
  pause
  exit /b 1
)

echo.
echo Starting The Blitz Room live web server...
echo Leave this window open while drafting.
echo Health check: http://localhost:8787/health
echo.
node advisor-server\server.js

pause
