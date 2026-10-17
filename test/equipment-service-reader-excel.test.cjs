const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const test = require('node:test');
const ExcelJS = require('exceljs');
const JSZip = createRequire(require.resolve('exceljs'))('jszip');
const { parseServiceFile, verifyServiceImport } = require('../equipment-service-import.cjs');

async function workbook(sheets, configure) {
  const book = new ExcelJS.Workbook();
  for (const [name, rows] of Object.entries(sheets)) {
    const sheet = book.addWorksheet(name);
    rows.forEach(row => sheet.addRow(row));
  }
  configure?.(book);
  return Buffer.from(await book.xlsx.writeBuffer());
}
const items = preview => preview.services.flatMap(service => service.mainSections.flatMap(section => section.items));
const rows = preview => preview.services.flatMap(service => service.mainSections.flatMap(section => section.rows));
const digest = buffer => crypto.createHash('sha256').update(buffer).digest('hex');

function complete(preview) {
  assert.equal(preview.verification.complete, true, JSON.stringify(preview.verification));
  assert.equal(verifyServiceImport(preview).complete, true);
  assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
  assert.deepEqual(preview.verification.missingRefs, []);
  assert.deepEqual(preview.verification.duplicateRefs, []);
}

test('headerless repeated quantity/description columns retain numeric and text zero, categories, notes, whitespace and order', async () => {
  const file = await workbook({ 'Cuadro sin encabezados': [
    ['Paquete de prueba'], [null, 'Luces sintéticas'], [0, 'Unidad alfa'], ['0', 'Unidad beta'],
    [null, 'Observación: conservar acceso'], [null, 'Estructuras sintéticas'], [2, 'Unidad gamma'], [null, '  ']
  ] }, book => { for (const ref of ['B2', 'B6']) book.worksheets[0].getCell(ref).font = { bold: true }; });
  const preview = await parseServiceFile(file, { fileName: 'sintetico-sin-headers.xlsx' });
  complete(preview);
  assert.equal(preview.services[0].name, 'Paquete de prueba');
  assert.deepEqual(items(preview), [[0, 'Unidad alfa'], [0, 'Unidad beta'], [2, 'Unidad gamma']]);
  assert.equal(preview.sourceCells.length, 11);
  assert.equal(preview.sourceCells.find(cell => cell.address === 'A4').value, '0');
  assert.equal(preview.sourceCells.find(cell => cell.address === 'B8').value, '  ');
  assert.deepEqual(preview.services[0].mainSections.filter(section => section.items.length).map(section => section.title), ['Luces sintéticas', 'Estructuras sintéticas']);
  assert.ok(rows(preview).some(row => row.type === 'note' && row.description === 'Observación: conservar acceso'));
  assert.deepEqual(rows(preview).flatMap(row => row.cells.map(cell => cell.ref)), preview.sourceCells.map(cell => cell.ref));
  assert.ok(!preview.sourceCells.some(cell => ['Cantidad', 'Descripción'].includes(cell.value)), 'No se inventan encabezados en el ledger');
});

test('distinct titles separate safe parallel headerless blocks even when one block has a single item', async () => {
  const preview = await parseServiceFile(await workbook({ 'Cuadros paralelos': [
    ['Servicio paralelo A', null, null, 'Servicio paralelo B'], [null, 'AUDIO', null, null, 'LUCES'],
    [0, 'Unidad A', null, 2, 'Unidad B'], [1, 'Unidad A adicional'],
    [null, 'Nota: origen A', null, null, 'Observación: origen B']
  ] }), { fileName: 'paralelos.xlsx' });
  complete(preview);
  assert.deepEqual(preview.services.map(service => service.name), ['Servicio paralelo A', 'Servicio paralelo B']);
  assert.deepEqual(preview.services.map(service => service.mainSections.flatMap(section => section.items)), [
    [[0, 'Unidad A'], [1, 'Unidad A adicional']], [[2, 'Unidad B']]
  ]);
  assert.equal(new Set(rows(preview).flatMap(row => row.sourceRefs)).size, preview.sourceCells.length);
  assert.ok(preview.services[0].mainSections.some(section => section.notes.includes('Nota: origen A')));
  assert.ok(preview.services[1].mainSections.some(section => section.notes.includes('Observación: origen B')));
});

test('competing headerless numeric/text pairs without distinct titles remain represented and fail closed', async () => {
  for (const data of [
    [['Cuadro ambiguo'], [1, 'Modelo 64', 2, 'Detalle A'], [3, 'Modelo 72', 4, 'Detalle B']],
    [['Otro cuadro ambiguo'], [0, 'Unidad A', 5, 'Posible segundo cuadro'], [2, 'Unidad B']]
  ]) {
    const preview = await parseServiceFile(await workbook({ 'Fuente ambigua': data }), { fileName: 'ambiguo.xlsx' });
    assert.equal(preview.verification.complete, false);
    assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
    assert.deepEqual(preview.verification.missingRefs, []);
    assert.equal(preview.sourceCells.filter(cell => cell.value === 0).length, data[1][0] === 0 ? 1 : 0);
    assert.deepEqual(items(preview), []);
  }
});

test('separate worksheets with the same declared service name retain separate source tables and zero quantities', async () => {
  const preview = await parseServiceFile(await workbook({
    'Hoja sintética A': [['Servicio: Nombre repetido'], ['Cantidad', 'Descripción'], [0, 'Equipo de A']],
    'Hoja sintética B': [['Servicio: Nombre repetido'], ['Cantidad', 'Descripción'], [2, 'Equipo de B']]
  }), { fileName: 'hojas.xlsx' });
  complete(preview);
  assert.equal(preview.services.length, 2);
  assert.deepEqual(preview.services.map(service => service.name), ['Nombre repetido', 'Nombre repetido']);
  assert.deepEqual(preview.services.map(service => service.mainSections.flatMap(section => section.items)), [[[0, 'Equipo de A']], [[2, 'Equipo de B']]]);
  assert.ok(preview.services[0].sourceRefs.every(ref => ref.startsWith('xlsx:1:')));
  assert.ok(preview.services[1].sourceRefs.every(ref => ref.startsWith('xlsx:2:')));
});

test('a literal worksheet name cannot collide with the display label of a parallel source block', async () => {
  const preview = await parseServiceFile(await workbook({
    'Origen': [['Paquete A', null, null, 'Paquete B'], [0, 'Unidad A', null, 2, 'Unidad B'], [1, 'Otra unidad A', null, 3, 'Otra unidad B']],
    'Origen · cuadro 1': [['Servicio: Paquete A'], ['Cantidad', 'Descripción'], [4, 'Unidad de otra hoja']]
  }), { fileName: 'origenes.xlsx' });
  complete(preview);
  assert.equal(preview.services.length, 3);
  assert.deepEqual(preview.services.map(service => service.mainSections.flatMap(section => section.items)), [
    [[0, 'Unidad A'], [1, 'Otra unidad A']], [[2, 'Unidad B'], [3, 'Otra unidad B']], [[4, 'Unidad de otra hoja']]
  ]);
  assert.ok(preview.services.slice(0, 2).every(service => service.sourceRefs.every(ref => ref.startsWith('xlsx:1:'))));
  assert.ok(preview.services[2].sourceRefs.every(ref => ref.startsWith('xlsx:2:')));
});

test('headerless cached formula zero survives while a formula without a result prevents certification', async () => {
  const file = await workbook({ 'Fórmulas sintéticas': [
    ['Servicio con fórmulas'], [{ formula: '1-1', result: 0 }, 'Equipo con cero'], [2, 'Segundo equipo'],
    [{ formula: '1+1' }, 'Equipo pendiente']
  ] });
  const preview = await parseServiceFile(file, { fileName: 'formulas.xlsx' });
  assert.deepEqual(items(preview), [[0, 'Equipo con cero'], [2, 'Segundo equipo']]);
  assert.deepEqual(preview.sourceCells.find(cell => cell.address === 'A2').rawValue, { formula: '1-1', result: 0 });
  assert.equal(preview.verification.complete, false);
  assert.equal(preview.verification.sourceCellCount, preview.verification.representedCellCount);
  assert.match(preview.verification.blockers.join(' '), /fórmula.*resultado/);
});

test('valid namespace-prefixed XLSX loads without altering input bytes, text, styles or cached zero', async () => {
  const base = await workbook({ 'XML sintético': [
    ['Servicio sintético XML'], ['Cantidad', 'Descripción', 'Notas'],
    [{ formula: '1-1', result: 0 }, 'Texto x:literal <x:dato>', 'Conservar espacio ']
  ] }, book => book.worksheets[0].getCell('A1').font = { bold: true });
  for (const prefix of ['x', 'ns0']) {
    const zip = await JSZip.loadAsync(base);
    for (const name of ['xl/workbook.xml', 'xl/styles.xml', 'xl/sharedStrings.xml', 'xl/worksheets/sheet1.xml']) {
      let xml = await zip.file(name).async('string');
      xml = xml.replace('xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', `xmlns:${prefix}="http://schemas.openxmlformats.org/spreadsheetml/2006/main"`)
        .replace(/<(\/?)([A-Za-z][\w-]*)(?=[\s/>])/g, `<$1${prefix}:$2`);
      zip.file(name, xml);
    }
    const file = await zip.generateAsync({ type: 'nodebuffer' });
    const before = digest(file);
    const preview = await parseServiceFile(file, { fileName: 'prefijado.xlsx' });
    complete(preview);
    assert.equal(digest(file), before);
    assert.equal(preview.source.sha256, before);
    assert.deepEqual(items(preview), [[0, 'Texto x:literal <x:dato>']]);
    assert.equal(preview.sourceCells.find(cell => cell.address === 'A1').isHeading, true);
    assert.equal(preview.sourceCells.find(cell => cell.address === 'C3').value, 'Conservar espacio ');
    assert.deepEqual(preview.sourceCells.find(cell => cell.address === 'A3').rawValue, { formula: '1-1', result: 0 });
  }
});
