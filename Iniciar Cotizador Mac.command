#!/bin/zsh

APP_DIR="${0:A:h}"
PORT="${PORT:-8787}"
APP_URL="http://127.0.0.1:${PORT}/index.html"
API_URL="http://127.0.0.1:${PORT}/api/secuencia"

cd "${APP_DIR}" || exit 1
mkdir -p cotizaciones-generadas

if [[ -d ".git" ]] && git remote get-url origin >/dev/null 2>&1; then
  git pull --ff-only
  if [[ $? -ne 0 ]]; then
    osascript -e 'display dialog "No se pudo actualizar desde GitHub. Revise si hay cambios sin subir o conexion a internet. El cotizador se abrira con la version local." buttons {"OK"} default button "OK" with icon caution'
  fi
fi

if [[ -x "${APP_DIR}/bin/node" ]]; then
  NODE_BIN="${APP_DIR}/bin/node"
elif [[ -x "${HOME}/Downloads/Cotizador Live Productions FINAL/Cotizador Live Productions.app/Contents/Resources/bin/node" ]]; then
  NODE_BIN="${HOME}/Downloads/Cotizador Live Productions FINAL/Cotizador Live Productions.app/Contents/Resources/bin/node"
elif [[ -x "${HOME}/Downloads/Cotizador Live Productions.app/Contents/Resources/bin/node" ]]; then
  NODE_BIN="${HOME}/Downloads/Cotizador Live Productions.app/Contents/Resources/bin/node"
elif [[ -x "/opt/homebrew/bin/node" ]]; then
  NODE_BIN="/opt/homebrew/bin/node"
elif [[ -x "/usr/local/bin/node" ]]; then
  NODE_BIN="/usr/local/bin/node"
else
  NODE_BIN="$(command -v node)"
fi

if [[ -z "${NODE_BIN}" || ! -x "${NODE_BIN}" ]]; then
  osascript -e 'display dialog "No se encontro Node.js. Abra la app completa del Cotizador o instale Node.js para usar este acceso." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

server_ok() {
  curl -fsS "${API_URL}" >/dev/null 2>&1 &&
    curl -fsS "${APP_URL}" 2>/dev/null | grep -q "quote-document-set"
}

port_owner() {
  lsof -nP -iTCP:${PORT} -sTCP:LISTEN 2>/dev/null | awk 'NR == 2 { print $1 " PID " $2 }'
}

show_port_error() {
  local OWNER="$1"
  osascript -e "display dialog \"No se pudo abrir Cotizador Live Productions porque el puerto ${PORT} ya esta ocupado por: ${OWNER}. Cierre ese programa o reinicie la Mac y vuelva a abrir el cotizador.\" buttons {\"OK\"} default button \"OK\" with icon caution"
}

if ! server_ok; then
  OWNER="$(port_owner)"
  if [[ -n "${OWNER}" ]]; then
    show_port_error "${OWNER}"
    exit 1
  fi
  (sleep 2; open "${APP_URL}") >/dev/null 2>&1 &
  exec "${NODE_BIN}" --no-warnings server.js > cotizador-servidor.log 2>&1
fi

open "${APP_URL}"
