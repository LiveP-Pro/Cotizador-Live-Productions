# Publicar Cotizador Live Productions como pagina web

Esta version esta preparada para publicarse como app web con Node.js, Docker, SQLite y PDFs generados con Chromium.

## Importar inventario en Contabilidad de equipo

`Importar respaldo` admite libros Excel `.xlsx`, PDF con texto seleccionable y
respaldos `.json` exportados por la aplicación. Para desarrollar o desplegar sin
Docker, usar Node.js 22.13 o posterior y ejecutar `npm ci` desde la raíz del
repositorio. Docker instala las dependencias desde `package-lock.json`.

En Excel, incluir columnas `Descripción` (o `Equipo`) y `Cantidad`; también se
reconocen `Categoría` y `Observaciones`. Se leen todas las hojas y se conservan
las cantidades cero. También admite cuadros sin encabezados cuando la primera
celda ocupada es una cantidad y la siguiente contiene la descripción, incluso
con cantidad cero; la revisión indica que se detectó este orden. Si hay otras
columnas numéricas, no se elige una cantidad diferente de forma automática.
Un PDF digital debe contener una tabla legible con las
descripciones y cantidades; los PDFs escaneados requieren convertirlos antes a
texto o usar el Excel original. El límite por archivo es 15 MB.

Para un libro con varias hojas, `Hoja a importar` permite elegir una hoja concreta
o `Todas las hojas`. Si las hojas repiten equipos para mostrar estados distintos,
seleccionar una sola evita crear filas duplicadas. Cambiar la hoja vuelve a leer
el archivo y descarta las decisiones anteriores; no guarda cambios hasta aplicar
la nueva revisión. Si una hoja no se puede interpretar, se puede elegir otra y
el botón de guardar permanece deshabilitado.

La ventana compara el archivo con el inventario actual y muestra variantes,
números de modelo y coincidencias ambiguas. Un clic permite conservar el nombre
actual, usar el del archivo, agregar un equipo separado u omitir la fila. Al
resolver la última diferencia, la importación se guarda automáticamente; sin
diferencias, usar `Importar y guardar`. Cancelar conserva el inventario actual.
Las filas sin cantidad válida se muestran como observaciones para revisión.

Excel y PDF reemplazan las cantidades de los equipos elegidos, sin sumarlas, y
conservan los equipos ausentes y sus bitácoras. Un respaldo JSON restaura su
inventario y sus bitácoras completos, como indica la ventana antes de aplicarlo.

## Sincronización con Requerimiento de Equipo

Contabilidad de Equipo comparte el inventario guardado con Requerimiento de
Equipo. Los nombres, categorías, notas, cantidades, altas, bajas y movimientos
actualizan sus listas, disponibilidad, resúmenes y próximos PDF. Los cambios de
nombre conservan el identificador del equipo y las descripciones aprobadas para
mantener la relación con los requerimientos existentes.

La misma página se actualiza inmediatamente; otras pestañas reciben los cambios
guardados y otros equipos consultan el servidor cada cinco segundos mientras el
módulo está abierto. Si otra sesión guardó antes, se evita sobrescribirla y se
informa el conflicto. Una edición o importación en curso conserva sus datos para
revisión. Los cuadros de servicios y sus cantidades requeridas se mantienen.
Si un cambio no pudo guardarse, exportar el respaldo antes de recargar: al abrir
la página de nuevo se carga el inventario vigente del servidor.

## Importar tipos de servicio en Requerimiento de Equipo

El botón `Importar Excel o PDF` permite revisar todos los cuadros del archivo y
guardar cada uno como un nuevo tipo de servicio. Se elige una categoría existente
o se escribe el nombre de una nueva; pueden asignarse destinos diferentes a cada
servicio. Cancelar no modifica el catálogo ni el inventario.

El Excel debe incluir `Cantidad` y `Descripción` (o `Equipo`). También reconoce
`Servicio`, `Categoría` y `Observaciones`. Sin columna de servicio, cada hoja
forma un servicio; los bloques `Servicio: Nombre` permiten varios cuadros por
hoja. Los PDF deben tener texto seleccionable y encabezados de tabla legibles.
Se conservan todas las cantidades cero, notas, encabezados y celdas adicionales.
Una cantidad o fórmula que no pueda interpretarse bloquea el guardado y se
muestra para corregir el archivo, sin completar información con otros libros.

Antes de guardar se compara cada celda con su representación en el catálogo.
Una nueva versión con el mismo nombre de archivo reemplaza por completo los
servicios importados desde ese libro y conserva los otros libros. Los equipos
del archivo conservan su descripción aunque aún no existan en Contabilidad;
su disponibilidad se consulta en ese módulo.

El catálogo y las categorías se guardan en
`COTIZADOR_DATA_DIR/catalogo-requerimiento-equipo.json`. Los originales y sus
celdas verificadas se conservan en `COTIZADOR_DATA_DIR/fuentes-requerimiento-equipo/`.
Este directorio debe estar en el disco persistente de Render. El archivo original
se puede descargar con la sesión iniciada desde el cuadro importado. Estos datos
privados se excluyen de Git y permanecen en el servidor al desplegar el código.

La publicación del código usa la rama `main`. Si el servicio de Render está
conectado a esta rama con Auto Deploy, se inicia al subir el commit; si Auto
Deploy está desactivado, se debe elegir `Deploy latest commit` en Render. La
configuración del entorno de Codex es independiente del despliegue del sitio.

## Importar cuadros de eventos desde un archivo

En Requerimiento de Equipo, abra `Personaliza tu Cuadro de Evento` y pulse
`Importar Excel o PDF`. El botón abre el selector de archivos de la computadora.
Se leen todas las hojas y todos los cuadros del archivo seleccionado antes de
cargar los eventos. Se conservan las filas en cero, encabezados, notas y celdas
originales.

El lector reconoce los horarios de montaje, intervalos del evento, desmontaje y
llegada a bodega. Cuando los días escritos corroboran otra fecha, se propone esa
fecha y se conserva la original. Dentro de una misma hoja, una tabla sin datos
propios de evento que repite exactamente el equipo de un único evento
identificado se conserva como referencia; sus cantidades se cuentan una sola
vez. Los cuadros que podrían corresponder a eventos distintos permanecen
seleccionados y ofrecen una opción para elegir cuáles cargar.

Las fechas contradictorias, los metadatos pendientes y las filas de origen sin
interpretar se reúnen en un solo aviso. `Cargar eventos y preparar reportes`
permite aceptar ese aviso y cargar los cuadros seleccionados como borradores.
Cancelar conserva la revisión sin cargar eventos. Las filas pendientes conservan
sus valores originales y aparecen en los reportes; no se les inventa una
cantidad. Un archivo ilegible, una verificación incompleta o líneas activas de
equipo con cantidades o descripciones inválidas siguen requiriendo corrección.

El período del resumen se ajusta a las fechas del archivo. Después de cargarlo,
los tres botones abren sus reportes con un clic y conservan el lote:

- `Generar trasiego`: eventos de origen y destino, equipo y cantidades propuestas,
  horarios, tiempos estimados y datos que falta confirmar.
- `Renta con y sin trasiego`: compara las unidades requeridas en ambos escenarios
  usando los mismos eventos y el inventario vigente. El escenario sin traslado
  directo contempla los retornos a bodega que permiten los horarios; el escenario
  con trasiego incluye las rutas propuestas y sus supuestos por revisar.
- `Compra de consumibles`: suma la demanda de todos los eventos por consumible y
  descuenta su existencia disponible. Los consumibles no se reutilizan entre eventos.

Cada reporte se abre dentro de la página. `Imprimir / Guardar PDF` utiliza el
navegador del usuario; esta vista no espera la impresión de Chromium en el
servidor. Al cerrar el reporte siguen disponibles los eventos y los otros dos
botones. Un error muestra su motivo o código HTTP y permite reintentar sin
volver a importar el archivo.

La vista consulta el inventario activo de Contabilidad. Una identidad,
clasificación o fecha pendiente queda señalada; no se inventan existencias ni
rutas. Se conservan las celdas originales, notas y cantidades en cero. Los eventos
siguen como borradores hasta confirmar las reservas; abrir o imprimir un reporte
no registra movimientos de inventario.

El resumen distingue la cantidad pedida por todos los eventos de las unidades
físicas necesarias. Si dos micrófonos pasan de un evento a otro, siguen siendo
dos micrófonos: no se convierten en cuatro salidas ni en una renta adicional.
Los consumibles se muestran por evento y en total, incluso cuando ya hay
existencia suficiente y la compra queda en cero.

Al registrar una salida real, las unidades recibidas por un trasiego confirmado
y respaldado por la salida del origen no se descuentan de bodega otra vez. Su
custodia se conserva hasta la devolución física desde el evento que las tiene.
Solo las unidades adicionales producen una nueva salida; las rutas propuestas
del reporte siguen requiriendo confirmación para registrar ese movimiento.

## Dominio

Dominio deseado:

```text
liveproductionsgt.com
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

## Conectar liveproductionsgt.com

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
