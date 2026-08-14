const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

const THEMES = {
  noir: {
    name: "Noir",
    header: [0.055, 0.07, 0.08],
    accent: [0.78, 0.64, 0.35],
    soft: [0.96, 0.95, 0.92],
  },
  ivory: {
    name: "Ivory",
    header: [0.97, 0.95, 0.9],
    accent: [0.49, 0.35, 0.15],
    soft: [0.985, 0.98, 0.96],
  },
  executive: {
    name: "Executive",
    header: [0.045, 0.15, 0.22],
    accent: [0.1, 0.55, 0.68],
    soft: [0.94, 0.97, 0.98],
  },
};

function latin(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function escapePdf(value) {
  return latin(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function money(value) {
  return `Q ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTime(value) {
  if (!value) return "Por definir";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-GT", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Guatemala",
  }).format(date);
}

class Canvas {
  constructor() {
    this.commands = [];
  }

  color(rgb) {
    this.commands.push(`${rgb.join(" ")} rg`);
  }

  strokeColor(rgb) {
    this.commands.push(`${rgb.join(" ")} RG`);
  }

  rect(x, y, width, height, fill = true) {
    this.commands.push(`${x} ${y} ${width} ${height} re ${fill ? "f" : "S"}`);
  }

  line(x1, y1, x2, y2) {
    this.commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  }

  text(value, x, y, size = 10, options = {}) {
    const font = options.bold ? "F2" : "F1";
    const color = options.color || [0.12, 0.14, 0.16];
    this.commands.push(
      `BT /${font} ${size} Tf ${color.join(" ")} rg 1 0 0 1 ${x} ${y} Tm (${escapePdf(value)}) Tj ET`,
    );
  }

  wrappedText(value, x, y, width, size = 9, lineHeight = 13, options = {}) {
    const words = latin(value || "Sin observaciones").split(/\s+/);
    const lines = [];
    let line = "";
    const maxChars = Math.max(12, Math.floor(width / (size * 0.52)));

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
    lines.slice(0, options.maxLines || 5).forEach((item, index) => {
      this.text(item, x, y - index * lineHeight, size, options);
    });
    return y - Math.min(lines.length, options.maxLines || 5) * lineHeight;
  }

  output() {
    return this.commands.join("\n");
  }
}

function field(canvas, label, value, x, y, width) {
  canvas.text(label.toUpperCase(), x, y, 7, {
    bold: true,
    color: [0.42, 0.44, 0.46],
  });
  canvas.wrappedText(value || "Por definir", x, y - 14, width, 10, 12, {
    maxLines: 2,
  });
}

export function buildQuotePdf(quote, context = {}, templateName = "noir") {
  const theme = THEMES[templateName] || THEMES.noir;
  const canvas = new Canvas();
  const company = context.settings || {};
  const totals = quote.totals || {};
  const isLightHeader = templateName === "ivory";
  const headerText = isLightHeader ? [0.17, 0.14, 0.1] : [1, 1, 1];

  canvas.color(theme.header);
  canvas.rect(0, 642, PAGE_WIDTH, 150);
  canvas.color(theme.accent);
  canvas.rect(0, 637, PAGE_WIDTH, 5);
  canvas.text("LT", 42, 720, 34, { bold: true, color: theme.accent });
  canvas.text(company.companyName || "LUXURY TRAVEL", 101, 735, 19, {
    bold: true,
    color: headerText,
  });
  canvas.text("TRASLADOS PRIVADOS EN GUATEMALA", 102, 716, 8, {
    color: headerText,
  });
  canvas.text("COTIZACION", 420, 735, 15, { bold: true, color: headerText });
  canvas.text(quote.number || "BORRADOR", 420, 715, 10, {
    color: theme.accent,
    bold: true,
  });
  canvas.text(`Emitida: ${dateTime(quote.createdAt)}`, 420, 697, 7, {
    color: headerText,
  });

  canvas.color(theme.soft);
  canvas.rect(36, 565, 540, 50);
  canvas.text("PREPARADA PARA", 52, 595, 7, {
    bold: true,
    color: theme.accent,
  });
  canvas.text(quote.clientName || "Cliente", 52, 577, 14, { bold: true });
  canvas.text(quote.clientNit ? `NIT ${quote.clientNit}` : "", 310, 606, 9);
  canvas.text(quote.clientPhone || "", 310, 591, 9);
  canvas.text(quote.clientEmail || "", 310, 575, 9);

  canvas.text("DETALLES DEL SERVICIO", 36, 535, 10, {
    bold: true,
    color: theme.accent,
  });
  canvas.strokeColor([0.82, 0.83, 0.84]);
  canvas.line(36, 526, 576, 526);

  field(canvas, "Fecha y salida", `${quote.serviceDate || "Por definir"} · ${quote.departureTime || ""}`, 36, 503, 160);
  field(canvas, "Pasajeros / maletas", `${quote.passengers || 0} pasajeros · ${quote.luggage || 0} maletas`, 220, 503, 150);
  field(
    canvas,
    "Servicio / vehículo",
    `${quote.serviceType || ""}${quote.vehicleName ? ` · ${quote.vehicleName}` : ""}`,
    405,
    503,
    165,
  );
  field(canvas, "Punto de salida", quote.origin, 36, 445, 250);
  field(canvas, "Destino", quote.destination, 315, 445, 255);
  field(canvas, "Finalizacion", quote.endLocation || quote.destination, 36, 387, 250);
  field(canvas, "Horario estimado", `${quote.arrivalTime || "Por definir"} · Regreso ${quote.returnTime || "No aplica"}`, 315, 387, 255);

  canvas.color(theme.soft);
  canvas.rect(36, 292, 338, 65);
  canvas.text("RUTA ESTIMADA", 52, 337, 7, {
    bold: true,
    color: theme.accent,
  });
  canvas.text(quote.destinationRateName || `${totals.kilometers || quote.kilometers || 0} km`, 52, 310, 18, {
    bold: true,
  });
  canvas.text(`${totals.minutes || quote.minutes || 0} minutos`, 190, 313, 11);

  canvas.color(theme.header);
  canvas.rect(395, 272, 181, 85);
  canvas.text("TOTAL", 412, 330, 8, { bold: true, color: headerText });
  canvas.text(money(totals.total), 412, 297, 23, {
    bold: true,
    color: templateName === "ivory" ? theme.accent : [1, 1, 1],
  });
  canvas.text(`IVA ${totals.taxPercent || 0}% incluido`, 412, 280, 7, {
    color: headerText,
  });

  canvas.text("OBSERVACIONES", 36, 239, 8, {
    bold: true,
    color: theme.accent,
  });
  const premiumOptions = [
    quote.hasBed ? "Cama instalada" : "",
    quote.hasPlayStation5 ? "PlayStation 5" : "",
    quote.hasTv ? "TV" : "",
  ].filter(Boolean);
  const notes = [
    premiumOptions.length ? `Opciones premium: ${premiumOptions.join(", ")}.` : "",
    quote.notes || "",
  ]
    .filter(Boolean)
    .join(" ");
  canvas.wrappedText(notes, 36, 221, 540, 9, 13, { maxLines: 5 });

  canvas.strokeColor(theme.accent);
  canvas.line(36, 104, 576, 104);
  canvas.text("Gracias por confiar su viaje a Luxury Travel.", 36, 82, 10, {
    bold: true,
  });
  canvas.text(
    `${company.email || ""}  ${company.phone || ""}  ${company.address || ""}`,
    36,
    63,
    7,
    { color: [0.38, 0.4, 0.42] },
  );
  canvas.text("Validez de la cotizacion: 15 dias.", 430, 82, 7, {
    color: [0.38, 0.4, 0.42],
  });

  return createPdf(canvas.output());
}

function createPdf(content) {
  const stream = Buffer.from(content, "latin1");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];

  let body = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, "latin1"));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, "latin1");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(body, "latin1");
}
