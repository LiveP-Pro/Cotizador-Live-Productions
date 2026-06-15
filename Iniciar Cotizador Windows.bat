@echo off
setlocal
cd /d "%~dp0"

set "APP_URL=http://127.0.0.1:8787/index.html"
set "API_URL=http://127.0.0.1:8787/api/secuencia"

if not exist "cotizaciones-generadas" mkdir "cotizaciones-generadas"

where git >nul 2>&1
if not errorlevel 1 (
  if exist ".git" (
    git remote get-url origin >nul 2>&1
    if not errorlevel 1 (
      git pull --ff-only
    )
  )
)

set "NODE_EXE=%~dp0bin\node.exe"
if not exist "%NODE_EXE%" (
  where node >nul 2>&1
  if errorlevel 1 (
    echo No se encontro Node.js. Instale Node.js o use el ZIP completo del cotizador.
    pause
    exit /b 1
  )
  set "NODE_EXE=node"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%API_URL%' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  netstat -ano | findstr ":8787 " | findstr "LISTENING" >nul 2>&1
  if not errorlevel 1 (
    echo No se pudo abrir Cotizador Live Productions.
    echo El puerto 8787 ya esta ocupado por otro programa.
    echo Cierre ese programa o reinicie Windows y vuelva a abrir el cotizador.
    pause
    exit /b 1
  )
  start "Cotizador Live Productions" /min "%NODE_EXE%" --no-warnings "%~dp0server.js"
  timeout /t 2 /nobreak >nul
)

powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 '%API_URL%' | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  echo No se pudo iniciar el servidor local del cotizador en el puerto 8787.
  echo Revise cotizador-servidor.log o reinicie la computadora.
  pause
  exit /b 1
)

start "" "%APP_URL%"
endlocal
