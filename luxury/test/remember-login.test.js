import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const helpers = app.slice(app.indexOf("function rememberedLoginUsername()"), app.indexOf("function showLuxuryLogin()"));
const key = app.match(/const REMEMBERED_USERNAME_KEY = "([^"]+)";/)?.[1];

function fixture({ stored = "", checked = false, blocked = false } = {}) {
  const storage = new Map(stored ? [[key, stored]] : []);
  const writes = [];
  const username = { value: "EmpleadoSintetico" };
  const password = { value: "ClaveSintetica-dePrueba", type: "text" };
  const checkbox = { checked };
  const toggle = { textContent: "Ocultar" };
  const form = {};
  const nodes = {
    "#login-form": form, "input[name='email']": username,
    "#login-remember-user": checkbox, "#login-password": password, "[data-toggle-password]": toggle
  };
  const context = vm.createContext({
    REMEMBERED_USERNAME_KEY: key,
    $: (selector) => nodes[selector],
    localStorage: {
      getItem(name) { if (blocked) throw new Error("Storage blocked"); return storage.get(name) || null; },
      setItem(name, value) { if (blocked) throw new Error("Storage blocked"); writes.push([name, value]); storage.set(name, value); },
      removeItem(name) { if (blocked) throw new Error("Storage blocked"); storage.delete(name); }
    }
  });
  vm.runInContext(helpers, context);
  return { context, username, password, checkbox, toggle, form, storage, writes };
}

test("remembering the Luxury username is opt-in and stores only the username", () => {
  const h = fixture({ checked: false });
  h.context.storeRememberedLoginUsername(h.form);
  assert.deepEqual(h.writes, []);
  assert.equal(h.storage.size, 0);
  h.checkbox.checked = true;
  h.context.storeRememberedLoginUsername(h.form);
  assert.deepEqual(h.writes, [[key, "EmpleadoSintetico"]]);
  assert.equal(JSON.stringify(h.writes).includes(h.password.value), false);
  assert.equal(h.storage.size, 1);
});

test("restoring a remembered username clears the password and resets password visibility", () => {
  const h = fixture({ stored: "UsuarioAnteriorSintetico" });
  h.context.restoreRememberedLoginUsername();
  assert.equal(h.username.value, "UsuarioAnteriorSintetico");
  assert.equal(h.checkbox.checked, true);
  assert.equal(h.password.value, "");
  assert.equal(h.password.type, "password");
  assert.equal(h.toggle.textContent, "Ver");
  assert.deepEqual(h.writes, []);
});

test("forgetting a username removes the stored value and the next login starts empty", () => {
  const h = fixture({ stored: "EmpleadoAnteriorSintetico", checked: false });
  h.context.forgetRememberedLoginUsername();
  h.context.restoreRememberedLoginUsername();
  assert.equal(h.storage.size, 0);
  assert.equal(h.username.value, "");
  assert.equal(h.checkbox.checked, false);
  assert.equal(h.password.value, "");
});

test("malformed stored values are not restored and blocked storage cannot interrupt login", () => {
  for (const stored of ["x".repeat(255), "Usuario\nSintetico", "   "]) {
    const h = fixture({ stored });
    h.context.restoreRememberedLoginUsername();
    assert.equal(h.username.value, "");
    assert.equal(h.checkbox.checked, false);
  }
  const blocked = fixture({ blocked: true, checked: true });
  assert.doesNotThrow(() => blocked.context.storeRememberedLoginUsername(blocked.form));
  assert.doesNotThrow(() => blocked.context.restoreRememberedLoginUsername());
  assert.doesNotThrow(() => blocked.context.forgetRememberedLoginUsername());
});

test("Luxury accepts employee usernames and the remember checkbox does not become an API credential", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const usernameInput = html.match(/<input\s+name="email"[\s\S]+?\/>/)?.[0];
  assert.match(usernameInput, /type="text"/);
  assert.match(usernameInput, /autocomplete="username"/);
  assert.doesNotMatch(usernameInput, /value=/);
  const checkbox = html.match(/<input\s+id="login-remember-user"[^>]+>/)?.[0];
  assert.match(checkbox, /type="checkbox"/);
  assert.doesNotMatch(checkbox, /name=/);
});
