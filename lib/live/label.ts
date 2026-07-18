/**
 * A 2.25 x 1.25 inch thermal pickup label, as a PDF, with no dependencies.
 *
 * Embeds the boutique's Recoleta font by parsing the TTF and writing a
 * CIDFontType2 with Identity-H encoding by hand. pdf-lib would do this too,
 * but it isn't installable in this build environment, and a hand-rolled
 * embed adds nothing to the dependency tree — which matters for a repo
 * that has to stay buildable.
 *
 * If the font can't be read or parsed for any reason, it falls back to
 * Helvetica (a standard PDF font, no embedding). A missing font must never
 * stop a label printing mid-live.
 *
 * 1 inch = 72 pt. 2.25 x 1.25" = 162 x 90 pt. The page IS the label:
 * thermal printers treat the whole media as printable, so no margins.
 */

import { readFile } from 'fs/promises';
import path from 'path';

const PT = 72;
const W = 2.25 * PT; // 162
const H = 1.25 * PT; // 90

// ---- Helvetica widths, for the fallback path ----
const HELV: Record<string, number> = {
  ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191,
  '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278,
  '0': 556, '1': 556, '2': 556, '3': 556, '4': 556, '5': 556, '6': 556, '7': 556,
  '8': 556, '9': 556, ':': 278, ';': 278, '·': 333,
};
const REG_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const REG_UPPER_W = [667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611];
const BOLD_UPPER_W = [722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611];
const REG_LOWER = 'abcdefghijklmnopqrstuvwxyz';
const REG_LOWER_W = [556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500];
const BOLD_LOWER_W = [556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500];
const HELV_BOLD: Record<string, number> = { ...HELV };
for (let i = 0; i < 26; i++) {
  HELV[REG_UPPER[i]] = REG_UPPER_W[i]; HELV_BOLD[REG_UPPER[i]] = BOLD_UPPER_W[i];
  HELV[REG_LOWER[i]] = REG_LOWER_W[i]; HELV_BOLD[REG_LOWER[i]] = BOLD_LOWER_W[i];
}

// ---- minimal TTF parser: units/em, advance widths, unicode cmap ----
type Font = { unitsPerEm: number; adv: number[]; map: Record<number, number>; bytes: Buffer };

function u16(b: Buffer, o: number) { return (b[o] << 8) | b[o + 1]; }
function u32(b: Buffer, o: number) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }

function parseTTF(buf: Buffer): Font | null {
  try {
    const numTables = u16(buf, 4);
    const tables: Record<string, { off: number }> = {};
    for (let i = 0; i < numTables; i++) {
      const o = 12 + i * 16;
      const tag = String.fromCharCode(buf[o], buf[o + 1], buf[o + 2], buf[o + 3]);
      tables[tag] = { off: u32(buf, o + 8) };
    }
    if (!tables.head || !tables.maxp || !tables.hhea || !tables.hmtx || !tables.cmap) return null;

    const unitsPerEm = u16(buf, tables.head.off + 18);
    const numGlyphs = u16(buf, tables.maxp.off + 4);
    const numHM = u16(buf, tables.hhea.off + 34);
    const hmtx = tables.hmtx.off;
    const adv: number[] = [];
    let last = 0;
    for (let i = 0; i < numGlyphs; i++) { if (i < numHM) last = u16(buf, hmtx + i * 4); adv.push(last); }

    const cmap = tables.cmap.off;
    const nSub = u16(buf, cmap + 2);
    let sub4 = 0;
    for (let i = 0; i < nSub; i++) {
      const o = cmap + 4 + i * 8;
      const pid = u16(buf, o), eid = u16(buf, o + 2), off = u32(buf, o + 4);
      if ((pid === 3 && (eid === 1 || eid === 0)) || pid === 0) sub4 = cmap + off;
    }
    const map: Record<number, number> = {};
    if (sub4 && u16(buf, sub4) === 4) {
      const segX2 = u16(buf, sub4 + 6), segCount = segX2 / 2;
      const endO = sub4 + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
      for (let s = 0; s < segCount; s++) {
        const end = u16(buf, endO + s * 2), start = u16(buf, startO + s * 2);
        const delta = u16(buf, deltaO + s * 2), ro = u16(buf, rangeO + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g: number;
          if (ro === 0) g = (c + delta) & 0xffff;
          else { const gi = rangeO + s * 2 + ro + (c - start) * 2; g = u16(buf, gi); if (g) g = (g + delta) & 0xffff; }
          if (g) map[c] = g;
        }
      }
    }
    return { unitsPerEm, adv, map, bytes: buf };
  } catch {
    return null;
  }
}

let fontCache: Font | null | undefined;

async function loadRecoleta(): Promise<Font | null> {
  if (fontCache !== undefined) return fontCache;
  try {
    const p = path.join(process.cwd(), 'public', 'fonts', 'recoleta-regular.ttf');
    fontCache = parseTTF(await readFile(p));
  } catch {
    fontCache = null;
  }
  return fontCache;
}

function esc(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// ---- text width, for both paths ----
function widthEmbedded(str: string, size: number, f: Font) {
  let w = 0;
  for (const ch of str) { const g = f.map[ch.charCodeAt(0)] || 0; w += (f.adv[g] || 0) * size / f.unitsPerEm; }
  return w;
}
function widthHelv(str: string, size: number, bold: boolean) {
  const t = bold ? HELV_BOLD : HELV;
  let w = 0;
  for (const ch of str) w += (t[ch] ?? 556) * size / 1000;
  return w;
}

function wrap(text: string, measure: (s: string) => number, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (measure(trial) <= maxW || !line) line = trial;
    else { lines.push(line); line = word; if (lines.length === maxLines - 1) break; }
  }
  if (line) lines.push(line);
  return lines.slice(0, maxLines);
}

function glyphHex(str: string, map: Record<number, number>) {
  let h = '';
  for (const ch of str) h += ((map[ch.charCodeAt(0)] || 0).toString(16)).padStart(4, '0');
  return '<' + h + '>';
}

export async function buildPickupLabel(opts: {
  tagline: string;
  name: string;
  sub?: string;
}): Promise<Uint8Array> {
  const font = await loadRecoleta();
  return font ? embeddedPDF(opts, font) : helveticaPDF(opts);
}

// ---- path A: Recoleta embedded ----
function embeddedPDF(opts: { tagline: string; name: string; sub?: string }, f: Font): Uint8Array {
  const pad = 0.12 * PT, barH = 0.34 * PT;
  const tag = opts.tagline.toUpperCase();
  const maxW = W - 2 * pad;
  const measure = (size: number) => (s: string) => widthEmbedded(s, size, f);

  let size = 20, lines: string[] = [];
  for (; size >= 9; size--) {
    lines = wrap(opts.name, measure(size), maxW, 2);
    if (lines.length <= 2 && lines.every((l) => widthEmbedded(l, size, f) <= maxW)) break;
  }

  const ops: string[] = [];
  ops.push('0 g', `0 ${H - barH} ${W} ${barH} re f`);
  ops.push('1 g', 'BT /F1 15 Tf',
    `${((W - widthEmbedded(tag, 15, f)) / 2).toFixed(2)} ${(H - barH + 0.11 * PT).toFixed(2)} Td ${glyphHex(tag, f.map)} Tj ET`);
  ops.push('0 g');
  let y = lines.length > 1 ? 0.60 * PT : 0.48 * PT;
  for (const ln of lines.slice(0, 2)) {
    ops.push('BT /F1 ' + size + ' Tf',
      `${((W - widthEmbedded(ln, size, f)) / 2).toFixed(2)} ${y.toFixed(2)} Td ${glyphHex(ln, f.map)} Tj ET`);
    y -= size * 1.05;
  }
  if (opts.sub) {
    ops.push('BT /F1 9 Tf',
      `${((W - widthEmbedded(opts.sub, 9, f)) / 2).toFixed(2)} ${pad.toFixed(2)} Td ${glyphHex(opts.sub, f.map)} Tj ET`);
  }
  const content = ops.join('\n');

  const scale = 1000 / f.unitsPerEm;
  const wArr = '[0[' + f.adv.map((a) => Math.round(a * scale)).join(' ') + ']]';

  const objs: (string | { fontStream: true; body: string })[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type0 /BaseFont /Recoleta /Encoding /Identity-H /DescendantFonts [6 0 R] >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Recoleta /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 7 0 R /CIDToGIDMap /Identity /W ${wArr} >>`,
    '<< /Type /FontDescriptor /FontName /Recoleta /Flags 4 /FontBBox [0 -300 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 /FontFile2 8 0 R >>',
    { fontStream: true, body: `<< /Length ${f.bytes.length} /Length1 ${f.bytes.length} >>\nstream\n<<FONT>>\nendstream` },
  ];

  const parts: Buffer[] = [];
  const offsets: number[] = [];
  const head = Buffer.from('%PDF-1.5\n', 'latin1');
  parts.push(head);
  let pos = head.length;

  objs.forEach((o, i) => {
    offsets.push(pos);
    if (typeof o !== 'string') {
      const [a, b] = o.body.split('<<FONT>>');
      const chunk = Buffer.concat([
        Buffer.from(`${i + 1} 0 obj\n${a}`, 'latin1'),
        f.bytes,
        Buffer.from(`${b}\nendobj\n`, 'latin1'),
      ]);
      parts.push(chunk); pos += chunk.length;
    } else {
      const chunk = Buffer.from(`${i + 1} 0 obj\n${o}\nendobj\n`, 'latin1');
      parts.push(chunk); pos += chunk.length;
    }
  });

  const xrefStart = pos;
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += String(off).padStart(10, '0') + ' 00000 n \n';
  xref += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  parts.push(Buffer.from(xref, 'latin1'));

  return new Uint8Array(Buffer.concat(parts));
}

// ---- path B: Helvetica fallback (no font file) ----
function helveticaPDF(opts: { tagline: string; name: string; sub?: string }): Uint8Array {
  const pad = 0.12 * PT, barH = 0.34 * PT;
  const tag = opts.tagline.toUpperCase();
  const maxW = W - 2 * pad;

  let size = 20, lines: string[] = [];
  for (; size >= 9; size--) {
    lines = wrap(opts.name, (s) => widthHelv(s, size, true), maxW, 2);
    if (lines.length <= 2 && lines.every((l) => widthHelv(l, size, true) <= maxW)) break;
  }

  const ops: string[] = [];
  ops.push('0 g', `0 ${H - barH} ${W} ${barH} re f`);
  ops.push('1 g', 'BT /F2 15 Tf',
    `${((W - widthHelv(tag, 15, true)) / 2).toFixed(2)} ${(H - barH + 0.1 * PT).toFixed(2)} Td (${esc(tag)}) Tj ET`);
  ops.push('0 g');
  let y = lines.length > 1 ? 0.56 * PT : 0.46 * PT;
  for (const ln of lines.slice(0, 2)) {
    ops.push('BT /F2 ' + size + ' Tf',
      `${((W - widthHelv(ln, size, true)) / 2).toFixed(2)} ${y.toFixed(2)} Td (${esc(ln)}) Tj ET`);
    y -= size * 1.05;
  }
  if (opts.sub) {
    ops.push('BT /F1 9 Tf',
      `${((W - widthHelv(opts.sub, 9, false)) / 2).toFixed(2)} ${pad.toFixed(2)} Td (${esc(opts.sub)}) Tj ET`);
  }
  const content = ops.join('\n');

  const enc = new TextEncoder();
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, i) => { offsets.push(enc.encode(pdf).length); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xrefStart = enc.encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += String(off).padStart(10, '0') + ' 00000 n \n';
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return enc.encode(pdf);
}
