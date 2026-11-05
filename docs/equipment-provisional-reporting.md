# Descargas provisionales nativas de Requerimiento de Equipo

`POST /api/cuadros-equipo/reportes/provisional` requiere la sesión habitual. Recibe:

```json
{
  "events": [{ "id": "ventana-actual", "place": "Lugar", "date": "2026-11-05", "sections": [] }],
  "mode": "master",
  "from": "2026-11-02",
  "to": "2026-11-08"
}
```

`mode` admite `master` (XLSX), `summary`, `rent` y `purchase` (PDF). La respuesta es binaria y tiene `Content-Disposition: attachment`, `Cache-Control: no-store` y `X-Equipment-Report-Status: provisional`. Los otros encabezados `X-Equipment-Report-Events`, `X-Equipment-Report-Rows` y `X-Equipment-Report-Pending` permiten comprobar los conteos en la descarga.

La descarga lee **únicamente el inventario activo de Contabilidad en el servidor** mediante `readWarehouseInventory()`. No acepta un inventario del navegador ni carga respaldos, fuentes iniciales o catálogos para rellenar faltantes. Los eventos son los cuadros actuales seleccionados, incluidos sus borradores. No abre el almacén de eventos, no guarda reservas, no produce salidas/ingresos y no genera un JSON de despacho ni un archivo permanente en bodega. PDF utiliza una carpeta temporal eliminada incluso cuando la impresión falla. Se usa la cola de impresión existente para evitar que dos documentos sustituyan simultáneamente el contenido de Chromium.

## Cálculo conservador

- La demanda se suma por referencia física segura para todos los eventos seleccionados. No se presume ningún trasiego, retorno ni reutilización, incluso si los horarios están completos. Las fechas y horas originales permanecen en el informe.
- Existencia = registrado menos salidas netas, consumido, taller, renta y perdido; cada saldo se descuenta una sola vez. `danado` usa el saldo de taller, como el motor vigente.
- Faltante provisional = `MAX(0, demanda total - existencia disponible)`.
- Cantidad cero sigue siendo un renglón válido; no desaparece del detalle ni de las celdas fuente.
- Una identidad no resuelta muestra existencia y faltante pendientes; **nunca** supone existencia cero. Se excluye de las órdenes hasta identificarla.
- Una clasificación contradictoria detectada por `EquipmentIdentity.classification` aparece en Pendientes y se excluye de órdenes. La descarga no corrige el tipo ni altera el inventario.
- Una elección explícita externa de renta/compra conserva la demanda como cantidad provisional externa. No se atribuye existencia al equipo sin ID.
- No se suman cantidades de unidades diferentes en un total general.

## Contenido del Excel

Control, Eventos, Resumen de equipo, Renta provisional, Compra provisional, Pendientes, Detalle por evento, Inventario consultado, Celdas fuente, Filas originales y Datos completos. Las categorías se agrupan para lectura sin perder el orden original del documento en las hojas de evidencia. Resumen tiene una columna por evento, total y faltante con fórmulas y resultados calculados para lectura inmediata. Los valores cero son números, no celdas vacías.

Las celdas fuente conservan sus referencias y valores. Valores largos se dividen en partes numeradas. Datos completos conserva JSON íntegro de cada evento recibido y del inventario activo, sin truncamiento, en partes de 30 000 caracteres; se recupera concatenando las partes por ID y ejecutando `JSON.parse`. Se escapan caracteres Unicode en ese JSON para evitar daños por cortes de los búferes XML. Un texto de visualización que exceda el límite de Excel indica expresamente dónde está conservado completo. Los PDFs muestran la marca provisional, los eventos, el resumen correspondiente y todos los pendientes; el Excel contiene el detalle original completo.

## Importación múltiple

`POST /api/requerimientos-equipo/importar-eventos` recibe un Excel/PDF binario de hasta 15 MB con `X-File-Name: encodeURIComponent(nombre)` y MIME habitual. Devuelve la vista previa de `parseEventFile` y `productionMutations: 0`. Comparte un máximo de dos lecturas simultáneas con el lector de servicios. No publica servicios, inventario ni eventos.

## Verificaciones automatizadas

`test/equipment-provisional-reporting.test.cjs` verifica cálculo sin reutilización aun con horarios completos; descuento único de taller/salida; identidad ambigua sin stock ficticio; clasificación pendiente fuera de órdenes; horarios faltantes exportables; conservación de ceros, encabezados, notas y JSON extenso/Unicode; reapertura del XLSX con fórmulas y resultados; los cuatro formatos mediante el endpoint autenticado; no acceso al almacén de reservas; inventario inalterado y eliminación de temporales. Los PDF del test de ruta usan una impresión sintética para verificar el contrato y las garantías de no escritura; la prueba de impresión real con Chromium y el ejercicio de seis eventos se realizan por separado durante la revisión de la publicación.

## Avisos de contrato y confirmación protegida

`equipment-document-audit.js` expone `EquipmentDocumentAudit.audit(event)` tanto en navegador como en CommonJS. Solo compara el texto contratado de los datos actuales contra el detalle de ese mismo evento. Advierte conteos diferentes de familias textuales claras, elementos contratados sin desglose y unidades o modelos ambiguos. Cada aviso incluye evento, motivo y celdas de origen legibles; nunca modifica cantidades, crea equivalencias físicas o convierte una mención sin cantidad en una unidad. Las cantidades de conjuntos no se convierten automáticamente a unidades individuales. Los avisos e incidencias de importación (`warnings`, `issues`, `sourceImport.warnings`) también se incluyen en Pendientes y PDF.

La ruta PUT de confirmación revalida identidad y clasificación con el inventario activo **antes** de llamar a `putEvent`. Una línea positiva desconocida, un ID incompatible, una clasificación pendiente o una opción Guardar sin ingreso verificado devuelve 422 sin escribir reservas o bodega. Los ceros y las decisiones explícitas de renta/compra externa se conservan; un ingreso real se acepta únicamente con su comprobante contrastado contra el registro vigente. Las descargas provisionales siguen disponibles para resolver esos casos.
