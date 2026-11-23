import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const settingsView = source.slice(source.indexOf("function renderSettings()"), source.indexOf("function templateOptions("));
const recordView = source.slice(source.indexOf("function openRecordModal("), source.indexOf("function serviceTypeOptions("));
const escapeHtml = (value) => String(value ?? "").replace(/[&<>\"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[character]));

test("Luxury corporate settings contain no account management, including for the owner", () => {
  for (const user of [{ role: "administrador" }, { role: "administrador", isDeveloper: true, username: "Dgiant" }]) {
    const content = { innerHTML: "" };
    const handlers = [];
    const saveSettings = () => {};
    const context = vm.createContext({
      state: { user, settings: { companyName: "Empresa sintética", legalName: "Empresa de prueba", defaultPdfTemplate: "noir" } },
      $: (selector) => selector === "#app-content" ? content : { addEventListener: (...args) => handlers.push(args) },
      escapeHtml, saveSettings, templateOptions: () => '<option value="noir">Luxury Premium</option>', bindCommonActions: () => {},
    });
    vm.runInContext(settingsView, context);
    context.renderSettings();
    assert.match(content.innerHTML, /Empresa y documentos/);
    assert.match(content.innerHTML, /name="companyName" value="Empresa sintética"/);
    assert.match(content.innerHTML, /Guardar configuración/);
    assert.doesNotMatch(content.innerHTML, /Usuarios y roles|acceso de usuarios|new-user|edit-user|user-form|name="(?:role|password)"/);
    assert.deepEqual(handlers, [["submit", saveSettings]]);
  }
});

test("Luxury driver editing keeps operational fields without account linking controls", () => {
  let modal;
  const context = vm.createContext({
    escapeHtml, vehicleIsSprinter316: () => false,
    openModal: (title, html) => { modal = { title, html }; },
    $: () => ({ addEventListener() {} }), closeModal() {}, saveRecord() {},
  });
  vm.runInContext(recordView, context);
  context.openRecordModal("drivers", { id: "driver-test", name: "Piloto sintético", userId: "account-test", license: "LIC-001" });
  assert.equal(modal.title, "Editar piloto");
  assert.match(modal.html, /name="name" value="Piloto sintético"/);
  assert.match(modal.html, /name="license" value="LIC-001"/);
  assert.match(modal.html, /name="status"/);
  assert.doesNotMatch(modal.html, /Usuario piloto vinculado|name="userId"|account-test/);
});
