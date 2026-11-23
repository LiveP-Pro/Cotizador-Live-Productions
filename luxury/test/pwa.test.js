import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC = path.join(ROOT, "public");

function pngSize(buffer) {
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", "El archivo debe ser PNG");
  return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
}

test("el manifiesto PWA instala Luxury con accesos a Resumen y Cotizador", async () => {
  const [manifestSource, indexSource, appSource, stylesSource] = await Promise.all([
    readFile(path.join(PUBLIC, "manifest.webmanifest"), "utf8"),
    readFile(path.join(PUBLIC, "index.html"), "utf8"),
    readFile(path.join(PUBLIC, "app.js"), "utf8"),
    readFile(path.join(PUBLIC, "styles.css"), "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.equal(manifest.id, "./");
  assert.equal(manifest.scope, "./");
  assert.match(manifest.start_url, /module=dashboard/);
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(
    manifest.shortcuts.map((shortcut) => new URL(shortcut.url, "https://example.com/luxury/").searchParams.get("module")),
    ["dashboard", "quotes"],
  );

  const requiredIcons = new Map([
    ["assets/pwa-icon-192.png", [192, 192]],
    ["assets/pwa-icon-512.png", [512, 512]],
    ["assets/pwa-maskable-512.png", [512, 512]],
  ]);
  for (const [relativePath, expectedSize] of requiredIcons) {
    const icon = await readFile(path.join(PUBLIC, relativePath));
    assert.deepEqual(pngSize(icon), expectedSize);
  }

  assert.match(indexSource, /id="install-button"/);
  assert.match(stylesSource, /\.topbar-actions \.button \{\s*display: inline-flex;/);
  assert.match(appSource, /body\.hasTv = formUsesFleetTelevision\(form\);/);
  assert.doesNotMatch(appSource, /name="hasTv"/);
  assert.doesNotMatch(appSource, /name="hasBed"/);
});

test("el service worker elimina solo cachés anteriores de Luxury Travel", async () => {
  const [source, appSource, indexSource] = await Promise.all([
    readFile(path.join(PUBLIC, "sw.js"), "utf8"),
    readFile(path.join(PUBLIC, "app.js"), "utf8"),
    readFile(path.join(PUBLIC, "index.html"), "utf8"),
  ]);
  const version = source.match(/const VERSION = "(\d+)";/)?.[1];
  assert.match(version, /^\d+$/);
  assert.equal(appSource.match(/const APP_VERSION = "(\d+)";/)?.[1], version);
  assert.ok(indexSource.includes(`href="styles.css?v=${version}"`));
  assert.ok(indexSource.includes(`src="app.js?v=${version}"`));
  const listeners = {};
  const deleted = [];
  let navigationPreloadEnabled = false;
  let clientsClaimed = false;

  const context = vm.createContext({
    URL,
    Response,
    fetch,
    caches: {
      keys: async () => [
        "live-productions-shell-v12",
        "luxury-travel-shell-v77",
        "luxury-travel-shell-v78",
        "luxury-travel-runtime-v78",
        "luxury-travel-shell-v79",
        "luxury-travel-runtime-v79",
        "luxury-travel-shell-v80",
        "luxury-travel-runtime-v80",
        "luxury-travel-shell-v96",
        "luxury-travel-runtime-v96",
        `luxury-travel-shell-v${version}`,
        `luxury-travel-runtime-v${version}`,
      ],
      delete: async (key) => {
        deleted.push(key);
        return true;
      },
      open: async () => ({ addAll: async () => {}, put: async () => {} }),
      match: async () => undefined,
    },
    self: {
      registration: {
        scope: "https://liveproductionsgt.com/luxury/",
        navigationPreload: {
          enable: async () => {
            navigationPreloadEnabled = true;
          },
        },
      },
      location: { origin: "https://liveproductionsgt.com" },
      clients: {
        claim: async () => {
          clientsClaimed = true;
        },
      },
      addEventListener: (name, listener) => {
        listeners[name] = listener;
      },
      skipWaiting: () => {},
    },
  });

  vm.runInContext(source, context);
  let activation;
  listeners.activate({ waitUntil: (promise) => (activation = promise) });
  await activation;

  assert.deepEqual(deleted, [
    "luxury-travel-shell-v77",
    "luxury-travel-shell-v78",
    "luxury-travel-runtime-v78",
    "luxury-travel-shell-v79",
    "luxury-travel-runtime-v79",
    "luxury-travel-shell-v80",
    "luxury-travel-runtime-v80",
    "luxury-travel-shell-v96",
    "luxury-travel-runtime-v96",
  ]);
  assert.equal(navigationPreloadEnabled, true);
  assert.equal(clientsClaimed, true);
});
