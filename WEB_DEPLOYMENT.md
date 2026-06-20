# Publicar Cotizador Live Productions como pagina web

Esta version esta preparada para publicarse como app web con Node.js, Docker, SQLite y PDFs generados con Chromium.

## Dominio

Dominio deseado:

```text
liveproductions.com
```

Para usarlo se necesita una de estas dos cosas:

- Comprar el dominio si esta disponible.
- Tener acceso al panel DNS si el dominio ya pertenece a Live Productions.

## Hosting recomendado

Usar un hosting que acepte Docker y disco persistente, por ejemplo:

- Render
- Railway
- DigitalOcean App Platform
- VPS propio

La app necesita disco persistente porque guarda:

- `cotizaciones.sqlite`
- `cotizaciones-generadas/*.pdf`

## Variables de entorno

Configurar estas variables en el hosting:

```text
NODE_ENV=production
HOST=0.0.0.0
PORT=8787
COTIZADOR_DATA_DIR=/data
CHROME_PATH=/usr/bin/chromium
WHATSAPP_ACCESS_TOKEN=TOKEN_DE_META
WHATSAPP_PHONE_NUMBER_ID=ID_DEL_NUMERO_DE_WHATSAPP
WHATSAPP_API_VERSION=v23.0
```

Las variables de WhatsApp permiten enviar las cotizaciones guardadas como PDF por WhatsApp Business Platform. No las escribas dentro del codigo ni las compartas por chat; deben ir solo en Environment Variables del hosting.

## Disco persistente

Crear un disco o volumen persistente y montarlo en:

```text
/data
```

Dentro de `/data` la app creara:

```text
/data/cotizaciones.sqlite
/data/cotizaciones-generadas
```

## Publicacion con Docker

El proyecto ya incluye `Dockerfile`.

Comando local de prueba:

```bash
docker build -t cotizador-live-productions .
docker run --rm -p 8787:8787 -v "$PWD/data:/data" cotizador-live-productions
```

Abrir:

```text
http://localhost:8787/index.html
```

## Conectar liveproductions.com

Despues de publicar la app, el hosting dara una URL temporal.

En el panel DNS del dominio se deben crear estos registros:

```text
A     @      IP_DEL_HOSTING
CNAME www    URL_DEL_HOSTING
```

Algunos hostings no dan IP fija. En ese caso se usa el registro que indique el hosting, normalmente `CNAME` o configuracion de dominio personalizado.

## Importante sobre correlativos

Cuando la app esta en web, todos los usuarios usan la misma base de datos en `/data`, por eso el correlativo de cotizaciones queda centralizado y sube en orden.

## Seguridad recomendada

Antes de dejar el link abierto al equipo completo, se recomienda agregar acceso con usuario y contrasena para proteger precios, historial y PDFs.
