# Acceso y publicación: reglas permanentes del proyecto

Estas instrucciones aplican a los cambios de este proyecto en cualquier computadora.

- Cada cambio solicitado o autorizado por el usuario debe incluir las pruebas pertinentes y su publicación directa en la web antes de darlo por terminado. No esperar una petición adicional para publicar ni volver a pedir una autorización que el usuario ya dio. Si existe un bloqueo real, informar el bloqueo sin afirmar que el cambio está publicado.
- Mantener el inicio de sesión con usuarios y contraseñas. La instrucción de no tener un módulo de usuarios NO significa quitar la autenticación.
- Configurar las cuentas y sus permisos únicamente desde el código del servidor y su configuración privada. No agregar pantallas, módulos ni rutas web para administrar cuentas o cambiar contraseñas.
- Mantener las contraseñas protegidas mediante hashes en el servidor. No incluir contraseñas en texto plano en el repositorio ni en HTML o JavaScript enviados al navegador.
- Conservar las cuentas existentes. No inventar, borrar, restablecer ni sustituir el listado de cuentas o sus contraseñas al publicar otros cambios.

# Requerimiento de Equipo: reglas permanentes

Estas reglas aplican exclusivamente al modulo **Requerimiento de Equipo** de
`https://liveproductionsgt.com/#requerimiento-equipo`.

## Ley 1: usar solo la fuente actual

- Para servicios e inventario, usar unicamente los libros y cuadros que el
  usuario entregue durante la reconstruccion limpia actual.
- Nunca importar, copiar, completar ni mezclar datos de equipos, servicios,
  cantidades, inventarios o equivalencias provenientes del historial de Git,
  respaldos, catalogos antiguos, archivos guardados, caches, exportaciones o
  sesiones anteriores.
- Los libros ya entregados durante la reconstruccion limpia actual se conservan
  hasta que el usuario solicite reemplazarlos o eliminarlos.
- Cuando el usuario entregue una version nueva de un libro, reemplazar por
  completo los datos de ese libro. No completar vacios con versiones anteriores.
- El historial solo puede consultarse para comprender el funcionamiento de la
  interfaz o del codigo; nunca puede utilizarse como fuente de datos.

## Ley 2: incluir todos los cuadros y celdas

- Incluir todos los servicios y cuadros presentes en cada libro entregado.
- Conservar toda celda con informacion: nombres de servicios, categorias,
  descripciones de equipo, cantidades, notas, observaciones y su orden original.
- Incluir obligatoriamente todas las filas cuya cantidad sea `0`. El valor
  numerico `0` es un dato valido y nunca debe tratarse como celda vacia.
- Las filas de encabezado, categoria o nota sin cantidad tambien deben
  representarse correctamente; no pueden descartarse de forma silenciosa.
- Antes de publicar, comparar celda por celda la fuente actual contra el
  catalogo generado. Si falta un cuadro, una fila o una celda con informacion,
  la publicacion debe detenerse hasta corregirla.
