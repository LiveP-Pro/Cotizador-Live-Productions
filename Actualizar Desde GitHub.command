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

git pull --ff-only
if [[ $? -eq 0 ]]; then
  osascript -e 'display dialog "Cotizador actualizado desde GitHub." buttons {"OK"} default button "OK"'
else
  osascript -e 'display dialog "No se pudo actualizar. Revise si hay cambios locales sin subir." buttons {"OK"} default button "OK" with icon caution'
fi
