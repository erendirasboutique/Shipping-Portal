/**
 * A 2.25 x 1.25 inch thermal pickup label, as a PDF, with no dependencies.
 *
 * pdf-lib or reportlab would both work, but this page is a black bar, a
 * name, and a sub-line — small enough to emit the PDF operators directly
 * and not add a dependency to the shipping portal for it. Helvetica is one
 * of the 14 standard PDF fonts, so there's no font to embed.
 *
 * 1 inch = 72 points. 2.25 x 1.25" = 162 x 90 pt. The page IS the label:
 * thermal printers treat the whole media as printable, so no margins.
 */

const PT = 72;
const W = 2.25 * PT; // 162
const H = 1.25 * PT; // 90

// Helvetica advance widths (per 1000 units) for the glyphs we measure.
// Enough to size and centre text without a font library.
const HELV: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556,
  '@': 1015, '[': 278, '\\': 278, ']': 278, '^': 469, '_': 556, '`': 333, '{': 334,
  '|': 260, '}': 334, '~': 584,
};
const HELV_BOLD: Record<string, number> = { ...HELV };

// Upper/lowercase letter widths (Helvetica and Helvetica-Bold differ).
const REG_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const REG_UPPER_W = [667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611];
const REG_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const REG_LOWER_W = [556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500];
const BOLD_UPPER_W = [722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611];
const BOLD_LOWER_W = [556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500];

for (let i = 0; i < REG_UPPER.length; i++) {
  HELV[REG_UPPER[i]] = REG_UPPER_W[i];
  HELV_BOLD[REG_UPPER[i]] = BOLD_UPPER_W[i];
}
for (let i = 0; i < REG_LOWER.length; i++) {
  HELV[REG_LOWER[i]] = REG_LOWER_W[i];
  HELV_BOLD[REG_LOWER[i]] = BOLD_LOWER_W[i];
}

function width(text: string, size: number, bold: boolean): number {
  const table = bold ? HELV_BOLD : HELV;
  let w = 0;
  for (const ch of text) w += table[ch] ?? 556;
  return (w / 1000) * size;
}

/** PDF strings escape these three. */
function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Greedy wrap to a max width, at most `maxLines` lines. */
function wrap(text: string, size: number, bold: boolean, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (width(trial, size, bold) <= maxW || !line) {
      line = trial;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

export async function buildPickupLabel(opts: {
  tagline: string;
  name: string;
  sub?: string;
}): Promise<Uint8Array> {
  const pad = 0.12 * PT;
  const barH = 0.34 * PT;
  const tag = opts.tagline.toUpperCase();

  // Name: shrink until it fits in at most two lines.
  let nameSize = 20;
  let nameLines: string[] = [];
  for (; nameSize >= 9; nameSize--) {
    nameLines = wrap(opts.name, nameSize, true, W - 2 * pad, 2);
    const fits = nameLines.every((l) => width(l, nameSize, true) <= W - 2 * pad);
    if (fits && nameLines.length <= 2) break;
  }

  // Build the content stream. PDF origin is bottom-left.
  const ops: string[] = [];

  // Black tagline bar across the top.
  ops.push('0 g');
  ops.push(`0 ${H - barH} ${W} ${barH} re f`);

  // Tagline text, white, centred in the bar.
  ops.push('1 g');
  ops.push('BT /F2 15 Tf');
  const tagW = width(tag, 15, true);
  ops.push(`${((W - tagW) / 2).toFixed(2)} ${(H - barH + 0.1 * PT).toFixed(2)} Td (${esc(tag)}) Tj`);
  ops.push('ET');

  // Name, black, centred, one or two lines.
  ops.push('0 g');
  let y = nameLines.length > 1 ? 0.56 * PT : 0.46 * PT;
  for (const line of nameLines) {
    const lw = width(line, nameSize, true);
    ops.push('BT /F2 ' + nameSize + ' Tf');
    ops.push(`${((W - lw) / 2).toFixed(2)} ${y.toFixed(2)} Td (${esc(line)}) Tj ET`);
    y -= nameSize * 1.05;
  }

  // Sub line, smaller, centred at the bottom.
  if (opts.sub) {
    const sw = width(opts.sub, 9, false);
    ops.push('BT /F1 9 Tf');
    ops.push(`${((W - sw) / 2).toFixed(2)} ${pad.toFixed(2)} Td (${esc(opts.sub)}) Tj ET`);
  }

  const content = ops.join('\n');

  // Assemble the PDF: five objects, standard cross-reference table.
  const enc = new TextEncoder();
  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
      `/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(enc.encode(pdf).length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefStart = enc.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefStart}\n%%EOF`;

  return enc.encode(pdf);
}
