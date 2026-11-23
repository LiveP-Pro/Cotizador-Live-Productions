const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

test("the web app has no user administration page, assets, or API calls", () => {
  assert.doesNotMatch(html, /data-page(?:-link)?=["']usuarios["']|liveUsers|live-users\.(?:js|css)|Usuarios y permisos/i);
  assert.doesNotMatch(app, /LiveUsers|liveUsers|["']usuarios["']|\/api\/users\b/);
  assert.equal(fs.existsSync(path.join(root, "live-users.js")), false);
  assert.equal(fs.existsSync(path.join(root, "live-users.css")), false);
});

test("login and remembered username remain available", () => {
  assert.match(html, /id="loginForm"/);
  assert.match(html, /id="loginUser"[^>]+autocomplete="username"/);
  assert.match(html, /id="loginPassword"[^>]+autocomplete="current-password"/);
  assert.match(html, /id="loginRememberUser"[^>]+type="checkbox"/);
  assert.match(app, /fetch\("\/api\/login"/);
  assert.match(app, /localStorage\.setItem\("live\.rememberedUsername", session\.user\)/);
  assert.match(app, /localStorage\.getItem\("live\.rememberedUsername"\)/);
  assert.match(app, /localStorage\.removeItem\("live\.rememberedUsername"\)/);
});

test("regular modules still apply session permissions", () => {
  assert.match(html, /src="live-access\.js\?/);
  assert.match(app, /LiveAccess\?\.canPage\(window\.LIVE_SESSION, page\)/);
  assert.match(app, /LiveAccess\?\.applyUi\(document, window\.LIVE_SESSION\)/);
  assert.match(app, /new CustomEvent\("live:session-updated", \{ detail: window\.LIVE_SESSION \}\)/);
});
