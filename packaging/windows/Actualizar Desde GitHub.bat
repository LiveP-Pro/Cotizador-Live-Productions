@echo off
setlocal
cd /d "%~dp0"

where git >nul 2>&1
if errorlevel 1 (
  echo Git no esta instalado. Instale Git para Windows desde https://git-scm.com/download/win
  pause
  exit /b 1
)

if not exist ".git" (
  echo Esta carpeta aun no es un repositorio Git.
  pause
  exit /b 1
)

git remote get-url origin >nul 2>&1
if errorlevel 1 (
  echo Todavia no hay un repositorio de GitHub conectado.
  pause
  exit /b 1
)

git pull --ff-only
pause
endlocal
