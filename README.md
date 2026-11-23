# Cotizador Live Productions

Programa local para generar cotizaciones con los paquetes y precios tomados del archivo `servicios y precios.docx`.
Esta versión guarda cada PDF en una carpeta local y registra el historial en SQLite.

## Uso

1. Abrir `Cotizador Live Productions.app` en Mac o `Cotizador Live Productions - Windows.bat` en Windows.
2. Elegir el paquete.
3. Llenar los datos del cliente y evento.
4. Usar `Guardar PDF en carpeta` para crear el PDF y guardarlo en el historial local.
5. Usar `Imprimir / PDF` solo como respaldo.

Cada PDF se genera en dos hojas tamaño oficio:

- Hoja 1: cotización.
- Hoja 2: tipos de montaje, con las opciones de equipo forrado de blanco y negro.

El modo `Cotizaciones múltiples` guarda cada cotización en un PDF individual y conserva el correlativo ascendente.

## Guardado local

La app usa `server.js` con Node.js y una base local `cotizaciones.sqlite`.
Los PDFs se guardan automáticamente dentro de:

`cotizaciones-generadas/`

En la pantalla `Historial` puede buscar por cliente, número de cotización o fecha. También puede escribir los primeros dígitos del correlativo, por ejemplo `106`, para encontrar cotizaciones guardadas que empiecen con esos números.

## Aplicación local

En macOS se puede abrir `Cotizador Live Productions.app` con doble clic y lanzará el servidor local en:

`http://127.0.0.1:8787/index.html`

La versión para Mac incluye su propio motor Node.js. No necesita instalar Node.js por separado. La base de datos y los PDFs se guardan en:

`~/Documents/Cotizador Live Productions/`

Para Windows, abrir `Cotizador Live Productions - Windows.bat` con doble clic.
Debe mantenerse en la misma carpeta que `index.html`, `app.js`, `styles.css`, `server.js`, `package.json` y `assets/`.

La versión distribuida para Windows también incluye su propio motor Node.js y no requiere instalarlo por separado.

No usa Google Apps Script ni `google.script.run`.

## Sincronización con GitHub

Este proyecto puede sincronizarse con GitHub para trabajar desde varias computadoras.
GitHub debe guardar el codigo del cotizador, pero no debe guardar el historial privado ni los PDFs generados.
Por eso este repositorio ignora automaticamente:

- `cotizaciones.sqlite`
- `cotizaciones.sqlite-shm`
- `cotizaciones.sqlite-wal`
- `cotizaciones-generadas/`
- `cotizador-servidor.log`
- archivos `.zip`, `.app`, `.dmg` y `.exe`

### Subir por primera vez

1. Crear un repositorio en GitHub:

   `https://github.com/new`

2. Nombre recomendado:

   `cotizador-live-productions`

3. Dejarlo como `Private` si solo el equipo de Live Productions debe verlo.

4. Despues de crearlo, GitHub mostrara una URL parecida a:

   `https://github.com/TU_USUARIO/cotizador-live-productions.git`

5. En esta carpeta ejecutar:

   ```bash
   git remote add origin https://github.com/TU_USUARIO/cotizador-live-productions.git
   git branch -M main
   git push -u origin main
   ```

### Problema con GitHub Desktop

Si macOS muestra el mensaje `No puedes abrir la aplicacion GitHub Desktop porque no es compatible con esta Mac`, no use GitHub Desktop.
Este cotizador ya incluye accesos compatibles con macOS 12:

- `Iniciar Cotizador Mac.command`
- `Actualizar Desde GitHub.command`
- `Subir Cambios a GitHub.command`

En Mac, haga doble clic en `Iniciar Cotizador Mac.command`.
Si el proyecto ya esta conectado a GitHub, ese acceso intentara hacer `git pull` antes de abrir el cotizador.

### Usarlo en otra computadora sin GitHub Desktop

1. Instalar Git:

   - Mac: normalmente ya viene instalado. Si Terminal lo pide, aceptar instalar las herramientas de Apple.
   - Windows: `https://git-scm.com/download/win`

2. Clonar el repositorio desde Terminal:

   ```bash
   git clone https://github.com/TU_USUARIO/cotizador-live-productions.git
   cd cotizador-live-productions
   ```

3. En Mac, abrir:

   `Iniciar Cotizador Mac.command`

4. En Windows, abrir:

   `Iniciar Cotizador Windows.bat`

Si la computadora tiene Git instalado, esos accesos intentan actualizar desde GitHub antes de abrir el cotizador.
Si se clona el repositorio en Windows, instale Node.js o use el ZIP completo del cotizador.

### Actualizar cambios

Cuando una computadora sube cambios:

```bash
git add .
git commit -m "Actualizar cotizador"
git push
```

En las demas computadoras:

```bash
git pull
```

Tambien puede usar:

- `Actualizar Desde GitHub.command` en Mac.
- `Actualizar Desde GitHub Windows.bat` en Windows.

Para subir cambios:

- `Subir Cambios a GitHub.command` en Mac.
- `Subir Cambios a GitHub Windows.bat` en Windows.

Para que los cambios aparezcan en todas las computadoras, cada equipo debe hacer `git pull` o abrir el cotizador con los accesos actualizados. GitHub no cambia archivos locales por si solo si la computadora no sincroniza.


## Administración interna de cuentas

Crear cuentas, cambiar contraseñas y asignar permisos requiere acceso a la consola
del servidor. No existe un panel ni una ruta HTTP para administrar cuentas.
Ejecute la herramienta desde el código instalado, con Node.js 22.13 o posterior:

```bash
npm run users:admin -- --help
npm run users:admin -- list --data-dir /ruta/privada/datos
```

Indique siempre el directorio privado que usa el servidor mediante `--data-dir`
o `COTIZADOR_DATA_DIR`. Manténgalo fuera del repositorio. `list` y los resultados
excluyen contraseñas, hashes, sales y secretos de sesión.

`apply` recibe un único objeto JSON por la entrada estándar. No acepta contraseñas
como argumentos. Este ejemplo sintético solicita la contraseña sin mostrarla y
la envía directamente a la herramienta, sin guardarla en un archivo ni en el
historial de comandos:

```bash
python3 -c 'import getpass,json; print(json.dumps({"version":1,"users":[{"username":"empleado.ejemplo","displayName":"Empleado de ejemplo","role":"consulta","password":getpass.getpass("Nueva contraseña: ")}]}))' | npm run users:admin -- apply --data-dir /ruta/privada/datos
```

Puede agregar `--dry-run` para validar y revisar el resultado antes de aplicar.
La simulación no crea directorios ni modifica archivos. Para una operación que
incluya varias cuentas, envíe todas dentro del mismo objeto; se valida el lote
completo y se guarda mediante un reemplazo atómico. Los escritores de consola
se excluyen mediante `usuarios-live.lock`. Si un proceso termina abruptamente,
revise que no siga ejecutándose antes de retirar un bloqueo abandonado.

El formato admite:

- `version`: debe ser `1`.
- `users`: cuentas para crear o actualizar, identificadas por `username`, sin
  distinguir mayúsculas. Cada entrada admite `displayName`, `password`, `role`,
  `permissions` y `active`. Las cuentas nuevas necesitan `password`; las existentes
  conservan los campos omitidos. No se eliminan cuentas por omisión.
- `owner`: activa o actualiza la identidad protegida del propietario y solo admite
  `displayName` y `password`. No permite cambiar su identidad, desactivarla ni
  reducir sus permisos. Una cuenta nueva necesita `password`.
- `bootstrapAdministrator`: cuenta inicial para un directorio sin cuentas ni
  `cotizador-auth.json`. Admite los mismos campos que una entrada de `users` y
  necesita `password`. Al repetir el lote solo puede coincidir con la cuenta
  administradora original. Si ya existe `cotizador-auth.json`, la herramienta
  conserva la cuenta original y su hash; actualícela mediante `users`.

Los perfiles disponibles son `administrador`, `bodega`, `planificacion`, `consulta`
y `personalizado`. El perfil aplica sus permisos iniciales al crear la cuenta.
Al actualizar una cuenta, cambiar solo `role` conserva sus permisos anteriores;
para cambiar accesos, indique expresamente `permissions`. Los identificadores
válidos están en `PERMISSION_DEFINITIONS` de `live-users.cjs`. `users.manage`
está reservado al propietario y se rechaza para otras cuentas, incluso con perfil
`administrador`. Tampoco se aceptan identificadores internos ni banderas de
identidad, exención o privilegios dentro del lote.

El acceso al sistema operativo autoriza estos cambios; no necesita conocer la
contraseña anterior. Repetir los mismos valores conserva hashes, identificadores,
fechas e historial. Los cambios revocan las sesiones de las cuentas afectadas;
el servidor los observa en la siguiente autenticación o solicitud autenticada.
La activación de una identidad protegida previamente registrada conserva su
historial y fecha de creación, asigna su identificador reservado y revoca sus
sesiones anteriores. La herramienta conserva otros usuarios y los datos de los
módulos. Los registros dañados causan un error sin reiniciar cuentas ni sobrescribir
el archivo original. El registro se guarda con permisos `0600`.

No guarde contraseñas en archivos del repositorio, comandos, registros ni ejemplos.
Si prepara un lote privado temporal, manténgalo fuera del repositorio y elimínelo
tras usarlo. No copie `usuarios-live.json` ni `cotizador-auth.json` a una publicación.
