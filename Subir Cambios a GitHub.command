#!/bin/zsh

APP_DIR="${0:A:h}"
cd "${APP_DIR}" || exit 1

if [[ ! -d ".git" ]]; then
  osascript -e 'display dialog "Esta carpeta aun no es un repositorio Git." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  osascript -e 'display dialog "Todavia no hay un repositorio de GitHub conectado. Primero agregue el remote origin." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

git add .
if git diff --cached --quiet; then
  osascript -e 'display dialog "No hay cambios nuevos para subir." buttons {"OK"} default button "OK"'
  exit 0
fi

STAMP="$(date '+%Y-%m-%d %H:%M')"
git commit -m "Actualizar cotizador ${STAMP}"
git push

if [[ $? -eq 0 ]]; then
  osascript -e 'display dialog "Cambios subidos a GitHub correctamente." buttons {"OK"} default button "OK"'
else
  osascript -e 'display dialog "No se pudieron subir los cambios. Revise usuario, token o internet." buttons {"OK"} default button "OK" with icon caution'
fi
