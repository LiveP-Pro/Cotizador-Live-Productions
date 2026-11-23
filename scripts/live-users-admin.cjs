#!/usr/bin/env node
"use strict";

// Server operators only. Never import this entry point from a web application.
const fs = require("node:fs");
const path = require("node:path");
const { createLiveUserStore, normalizeInternalBatch } = require("../live-users.cjs");
const MAX_INPUT_BYTES = 1024 * 1024;
const HELP = `Administración interna de cuentas (solo consola del servidor).

  node scripts/live-users-admin.cjs list --data-dir /ruta/privada
  node scripts/live-users-admin.cjs apply [--dry-run] --data-dir /ruta/privada < lote-privado.json

También puede indicar el directorio mediante COTIZADOR_DATA_DIR.
apply lee un único objeto JSON por STDIN; no acepta contraseñas como argumentos.
Use un directorio privado fuera del repositorio y no conserve archivos con contraseñas.
La autoridad es el acceso al sistema operativo del servidor; no existe ruta web.
Formato: {"version":1,"owner":{"password":"<secreto nuevo>"},"users":[]}
owner solo admite displayName/password; users requiere username y admite
 displayName/password/role/permissions/active. Las cuentas nuevas requieren password.
bootstrapAdministrator solo se usa cuando no existen cuentas ni cotizador-auth.json.
list y los resultados de apply excluyen contraseñas, hashes, sales y secretos de sesión.
`;

function argumentsFor(argv, environment) {
  if (argv.length === 1 && ["--help", "-h"].includes(argv[0])) return { help: true };
  const command = argv[0];
  if (!["list", "apply"].includes(command)) throw new Error("Indique list, apply o --help.");
  let directory = environment.COTIZADOR_DATA_DIR;
  let dryRun = false, explicitDirectory = false;
  for (let index = 1; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run" && command === "apply" && !dryRun) dryRun = true;
    else if (value === "--data-dir" && !explicitDirectory && argv[index + 1] && !argv[index + 1].startsWith("--")) {
      directory = argv[++index]; explicitDirectory = true;
    } else throw new Error("Opción no permitida. Consulte --help; los secretos solo se leen por STDIN.");
  }
  if (typeof directory !== "string" || !directory.trim()) {
    throw new Error("Indique explícitamente --data-dir o COTIZADOR_DATA_DIR.");
  }
  return { command, directory: path.resolve(directory), dryRun };
}

async function readBatch(input) {
  if (input.isTTY) throw new Error("apply requiere un lote JSON por STDIN.");
  const chunks = [];
  let bytes = 0;
  for await (const chunk of input) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_INPUT_BYTES) throw new Error("El lote excede el tamaño permitido.");
    chunks.push(buffer);
  }
  let batch;
  try { batch = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("STDIN debe contener un único objeto JSON válido."); }
  normalizeInternalBatch(batch);
  return batch;
}

function existingAdministrator(directory) {
  // An existing registry is authoritative. Do not open unrelated legacy config.
  try { fs.lstatSync(path.join(directory, "usuarios-live.json")); return undefined; }
  catch (error) { if (error.code !== "ENOENT") throw new Error("No se pudo consultar el registro de cuentas."); }
  try {
    const config = JSON.parse(fs.readFileSync(path.join(directory, "cotizador-auth.json"), "utf8"));
    if (!config || typeof config !== "object" || Array.isArray(config) || typeof config.username !== "string" || !config.username.trim()
      || !config.password || typeof config.password !== "object") throw new Error("invalid");
    return { username: config.username, password: config.password };
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw new Error("No se pudo leer la configuración administradora existente; no se modificaron las cuentas.");
  }
}

async function main(argv = process.argv.slice(2), environment = process.env) {
  const options = argumentsFor(argv, environment);
  if (options.help) { process.stdout.write(HELP); return; }
  if (options.command === "list") {
    const store = createLiveUserStore({ directory: options.directory, readOnly: true });
    process.stdout.write(JSON.stringify({ users: store.list() }, null, 2) + "\n");
    return;
  }
  const batch = await readBatch(process.stdin);
  let lockDescriptor;
  const lockPath = path.join(options.directory, "usuarios-live.lock");
  try {
    // Serialize console writers; an abandoned lock must be inspected by an operator.
    // Dry runs do not create files or directories.
    if (!options.dryRun) {
      fs.mkdirSync(options.directory, { recursive: true, mode: 0o700 });
      try { lockDescriptor = fs.openSync(lockPath, "wx", 0o600); }
      catch (error) {
        if (error.code === "EEXIST") throw new Error("Otra operación mantiene el bloqueo de cuentas; revise el proceso antes de reintentar.");
        throw new Error("No se pudo bloquear el directorio privado de cuentas.");
      }
    }
    const legacyAdmin = existingAdministrator(options.directory);
    const store = createLiveUserStore({ directory: options.directory, legacyAdmin, deferBootstrap: true });
    const result = store.applyInternalBatch(batch, { dryRun: options.dryRun });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } finally {
    if (lockDescriptor !== undefined) {
      fs.closeSync(lockDescriptor);
      fs.unlinkSync(lockPath);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    // Validation errors never interpolate input values. Avoid JSON.parse diagnostics,
    // stacks and filesystem exception objects, which can expose private content.
    const message = error && !error.code && typeof error.message === "string"
      ? error.message : "No se pudo completar la operación interna; no se publicaron credenciales.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, argumentsFor, readBatch };
