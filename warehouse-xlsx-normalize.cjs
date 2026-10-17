const { createRequire } = require("node:module");

// ExcelJS's SAX readers recognize the conventional unprefixed OOXML names.
// A namespace prefix is only an XML spelling choice; normalize that spelling
// in a temporary workbook while keeping the uploaded source bytes untouched.
const excelDependencies = createRequire(require.resolve("exceljs"));
const JSZip = excelDependencies("jszip");
const { SaxesParser } = excelDependencies("saxes");
const SPREADSHEET_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
  "http://purl.oclc.org/ooxml/spreadsheetml/main",
  "http://schemas.openxmlformats.org/package/2006/relationships",
  "http://schemas.openxmlformats.org/package/2006/content-types"
]);

function attribute(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function defaultNamespace(tag, uri) {
  const declaration = /(\sxmlns\s*=\s*)(["'])([\s\S]*?)\2/;
  if (declaration.test(tag)) return tag.replace(declaration, (_, before) => `${before}"${attribute(uri)}"`);
  return tag.replace(/\/?>$/, (ending) => ` xmlns="${attribute(uri)}"${ending}`);
}

function normalizeXmlNamespaces(xml) {
  const parser = new SaxesParser({ xmlns: true });
  let opened;
  parser.on("opentag", (tag) => { opened = tag; });
  parser.on("error", (error) => { throw error; });
  const stack = [];
  const pieces = [];
  let cursor = 0;
  let count = 0;
  while (cursor < xml.length) {
    const start = xml.indexOf("<", cursor);
    if (start < 0) { const rest = xml.slice(cursor); parser.write(rest); pieces.push(rest); break; }
    const preceding = xml.slice(cursor, start);
    parser.write(preceding);
    pieces.push(preceding);
    let end;
    let element = true;
    if (xml.startsWith("<!--", start)) { end = xml.indexOf("-->", start + 4); end = end < 0 ? -1 : end + 3; element = false; }
    else if (xml.startsWith("<![CDATA[", start)) { end = xml.indexOf("]]>", start + 9); end = end < 0 ? -1 : end + 3; element = false; }
    else if (xml.startsWith("<?", start)) { end = xml.indexOf("?>", start + 2); end = end < 0 ? -1 : end + 2; element = false; }
    else {
      if (/^<!DOCTYPE\b/i.test(xml.slice(start, start + 10))) throw new Error("El Excel contiene una declaración XML externa no admitida.");
      let quote = "";
      for (let index = start + 1; index < xml.length; index += 1) {
        const character = xml[index];
        if (quote) { if (character === quote) quote = ""; }
        else if (character === '"' || character === "'") quote = character;
        else if (character === ">") { end = index + 1; break; }
      }
    }
    if (end === undefined || end < 0) throw new Error("El Excel contiene XML incompleto.");
    const original = xml.slice(start, end);
    opened = null;
    parser.write(original);
    let normalized = original;
    if (element && original.startsWith("</")) {
      const current = stack.pop();
      if (!current) throw new Error("El Excel contiene una estructura XML inválida.");
      normalized = original.replace(/^<\/[^\s>]+/, `</${current.outputName}`);
    } else if (element && opened) {
      if (++count > 2000000) throw new Error("El Excel contiene demasiados elementos XML.");
      const tag = opened;
      const canonical = SPREADSHEET_NAMESPACES.has(tag.uri);
      const outputName = canonical ? tag.local : tag.name;
      if (outputName !== tag.name) normalized = original.replace(/^<[^\s/>]+/, `<${outputName}`);
      const declared = tag.attributes.xmlns;
      let outputDefault = declared ? declared.value : stack.at(-1)?.outputDefault || "";
      // Preserve the namespace of other unprefixed extension elements too.
      // Attribute prefixes such as r:id and all values remain unchanged.
      if ((canonical || !tag.prefix) && outputDefault !== tag.uri) {
        normalized = defaultNamespace(normalized, tag.uri);
        outputDefault = tag.uri;
      }
      if (!tag.isSelfClosing) stack.push({ outputName, outputDefault });
    }
    pieces.push(normalized);
    cursor = end;
  }
  parser.close();
  return pieces.join("");
}

async function normalizeXlsxNamespaces(buffer, { maxExpandedBytes = 100 * 1024 * 1024, maxEntries = 2000 } = {}) {
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files);
  if (entries.length > maxEntries) throw new Error("El Excel contiene demasiados archivos internos.");
  let expanded = 0;
  let changed = false;
  for (const entry of entries) {
    if (entry.dir || !/\.(?:xml|rels)$/i.test(entry.name)) continue;
    const bytes = await entry.async("nodebuffer");
    expanded += bytes.length;
    if (expanded > maxExpandedBytes) throw new Error("El Excel supera el límite de datos descomprimidos.");
    const original = bytes.toString("utf8");
    const normalized = normalizeXmlNamespaces(original);
    if (normalized !== original) { zip.file(entry.name, normalized); changed = true; }
  }
  return changed ? zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } }) : buffer;
}

module.exports = { normalizeXlsxNamespaces, normalizeXmlNamespaces };
