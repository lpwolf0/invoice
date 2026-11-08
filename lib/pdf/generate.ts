import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from "pdf-lib";
import { computeTotals, entryAmount, isBlankEntry, parseNumber } from "../calc";
import { COMPANY } from "../company";
import { groupedCompact, groupedFixed, longDateParts, shortDate } from "../format";
import type { InvoiceData } from "../types";

/**
 * PDF engine. The original invoice is reproduced with measured coordinates
 * (A4 = 595.32 x 841.92 pt, Times New Roman 14.04 on page 1, Calibri 9.96 table
 * on page 2). Fixed text comes from lib/company.ts; the letterhead and signature
 * are the original images extracted from the source PDF.
 */

export interface FontBytes {
  serif: Uint8Array; // Liberation Serif (metric-compatible with Times New Roman)
  serifBold: Uint8Array;
  sans: Uint8Array; // Carlito (metric-compatible with Calibri)
  sansBold: Uint8Array;
}

export interface PdfAssets {
  headerJpg: Uint8Array;
  signaturePng: Uint8Array;
  /** Pass the default export of @pdf-lib/fontkit together with `fonts`. */
  fontkit?: any;
  fonts?: FontBytes;
}

export class PdfLayoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfLayoutError";
  }
}

interface Fonts {
  serif: PDFFont;
  serifBold: PDFFont;
  sans: PDFFont;
  sansBold: PDFFont;
  /** 1 for Carlito (Calibri metrics); <1 when Helvetica stands in so wrapping stays close to the original. */
  sansScale: number;
}

const PAGE_W = 595.32;
const PAGE_H = 841.92;
const BLACK = rgb(0, 0, 0);
const ty = (top: number) => PAGE_H - top; // top-origin -> pdf-lib bottom-origin

/* ---------------------------------------------------------------- text utils */

function clean(font: PDFFont, s: string): string {
  const set = new Set(font.getCharacterSet());
  return Array.from(s.replace(/[\r\n\t]+/g, " "))
    .map((ch) => (set.has(ch.codePointAt(0)!) ? ch : "?"))
    .join("");
}
const width = (f: PDFFont, s: string, size: number) => f.widthOfTextAtSize(clean(f, s), size);

function draw(page: PDFPage, s: string, x: number, y: number, font: PDFFont, size: number) {
  if (!s) return;
  page.drawText(clean(font, s), { x, y, font, size, color: BLACK });
}
const drawCentered = (p: PDFPage, s: string, cx: number, y: number, f: PDFFont, size: number) =>
  draw(p, s, cx - width(f, s, size) / 2, y, f, size);
const drawRight = (p: PDFPage, s: string, rx: number, y: number, f: PDFFont, size: number) =>
  draw(p, s, rx - width(f, s, size), y, f, size);

function wrap(font: PDFFont, text: string, size: number, maxW: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.trim().split(/\s+/).filter(Boolean);
    let line = "";
    for (let word of words) {
      while (width(font, word, size) > maxW && word.length > 1) {
        let cut = word.length;
        while (cut > 1 && width(font, word.slice(0, cut), size) > maxW) cut--;
        if (line) {
          out.push(line);
          line = "";
        }
        out.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const cand = line ? `${line} ${word}` : word;
      if (!line || width(font, cand, size) <= maxW) line = cand;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out;
}

function drawJustified(page: PDFPage, line: string, x: number, y: number, maxW: number, f: PDFFont, size: number) {
  const words = line.split(" ");
  if (words.length < 2) return draw(page, line, x, y, f, size);
  const total = words.reduce((s, w) => s + width(f, w, size), 0);
  const gap = (maxW - total) / (words.length - 1);
  let cx = x;
  for (const w of words) {
    draw(page, w, cx, y, f, size);
    cx += width(f, w, size) + gap;
  }
}

/** "N" with the double strike used by the original document, then the digits. */
function drawNaira(page: PDFPage, digits: string, x: number, y: number, f: PDFFont, size: number) {
  const nW = width(f, "N", size);
  draw(page, "N", x, y, f, size);
  const k = size / 14.04;
  page.drawRectangle({ x, y: y + 2.1 * k, width: nW, height: 0.7 * k, color: BLACK });
  page.drawRectangle({ x, y: y + 3.5 * k, width: nW, height: 0.8 * k, color: BLACK });
  draw(page, digits, x + nW, y, f, size);
}

/* ------------------------------------------------------------------- shared */

interface Ctx {
  fonts: Fonts;
  header: Awaited<ReturnType<PDFDocument["embedJpg"]>>;
  signature: Awaited<ReturnType<PDFDocument["embedPng"]>>;
}

function drawLetterhead(page: PDFPage, ctx: Ctx, invoiceNumber: string) {
  page.drawImage(ctx.header, { x: 72.0, y: ty(122.8), width: 501.2, height: 116.1 });
  drawCentered(page, `INVOICE NO: ${invoiceNumber.trim()}`, 297.66, 688.7, ctx.fonts.serif, 14.04);
}

/* ------------------------------------------------------------------- page 1 */

const P1 = { size: 14.04, left: 72.0, right: 523.4, pitch: 16.1 };

function drawPage1(page: PDFPage, ctx: Ctx, d: InvoiceData, totals: ReturnType<typeof computeTotals>) {
  const { serif: S, serifBold: B } = ctx.fonts;
  const z = P1.size;
  drawLetterhead(page, ctx, d.invoiceNumber);

  // Date, right aligned, ordinal suffix as superscript
  const dp = longDateParts(d.invoiceDate);
  if (dp) {
    const wDay = width(S, dp.day, z);
    const wSup = width(S, dp.suffix, 9);
    const wRest = width(S, dp.rest, z);
    const x0 = P1.right - (wDay + wSup + wRest);
    draw(page, dp.day, x0, 662.0, S, z);
    draw(page, dp.suffix, x0 + wDay, 667.1, S, 9);
    draw(page, dp.rest, x0 + wDay + wSup, 662.0, S, z);
  }

  // Recipient (max 3 lines)
  const recipient = d.recipient.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (recipient.length > 3) throw new PdfLayoutError("Recipient can have at most 3 lines.");
  recipient.forEach((line, i) => {
    if (width(S, line, z) > P1.right - P1.left)
      throw new PdfLayoutError(`Recipient line ${i + 1} is too long. Split it over two lines.`);
    draw(page, line, i === 0 ? 71.3 : 72.0, 616.2 - i * 17.6, S, z);
  });

  draw(page, "Sir/Ma,", 71.3, 554.0, S, z);
  drawCentered(page, "REQUEST FOR PAYMENT", 297.66, 523.7, B, 15.96);

  // Main paragraph (justified), locations inserted
  const loc = d.locations.replace(/\s+/g, " ").trim().replace(/\.+$/, "");
  const para =
    "The above-named company wishes to request for payment for the car hired to you, " +
    "for the conveyance of Staff of FHI 360 Nigeria to various destination in " +
    `${loc}.`;
  const lines = wrap(S, para, z, P1.right - P1.left);
  if (lines.length > 5)
    throw new PdfLayoutError("Locations text is too long for the letter. Shorten it a little.");
  lines.forEach((ln, i) => {
    const y = 498.5 - i * P1.pitch;
    if (i < lines.length - 1) drawJustified(page, ln, P1.left, y, P1.right - P1.left, S, z);
    else draw(page, ln, P1.left, y, S, z);
  });
  draw(page, "The details are in the invoice herein attached alongside with the logistics form.", 71.3,
    498.5 - lines.length * P1.pitch, S, z);

  // Everything below moves with the paragraph length (3 lines = original position)
  const shift = (lines.length - 3) * P1.pitch;
  const Y = (y: number) => y - shift;

  draw(page, "Our particulars are:", 71.3, Y(423.6), S, z);
  draw(page, "Company / Account name:", 71.3, Y(396.9), S, z);
  draw(page, COMPANY.accountName, 340.7, Y(396.9), S, z);
  draw(page, "Bank:", 71.3, Y(370.2), S, z);
  draw(page, COMPANY.bank, 338.5, Y(370.2), S, z);
  draw(page, "Account Number:", 71.3, Y(343.6), S, z);
  draw(page, COMPANY.accountNumber, 338.5, Y(343.6), S, z);
  draw(page, "Tax Identification Number:", 71.3, Y(317.0), S, z);
  draw(page, COMPANY.tin, 338.5, Y(317.0), S, z);

  draw(page, "Total:", 72.0, Y(298.0), B, z);
  drawNaira(page, groupedFixed(totals.total), 337.0, Y(298.0), B, z);
  draw(page, "Vat 7.5%:", 71.3, Y(279.7), S, z);
  drawNaira(page, groupedFixed(totals.vat), 337.7, Y(279.7), S, z);
  draw(page, "Total Amount payable:", 71.3, Y(261.0), S, z);
  drawNaira(page, groupedFixed(totals.payable), 337.0, Y(261.0), B, z);

  const closing =
    "We are grateful for the opportunity given to be of service to you and we look forward, " +
    "to rendering more and quality services to you.";
  const cl = wrap(S, closing, z, P1.right - P1.left);
  cl.forEach((ln, i) => {
    const y = Y(215.8 - i * 17.7);
    if (i < cl.length - 1) drawJustified(page, ln, P1.left, y, P1.right - P1.left, S, z);
    else draw(page, ln, 71.8, y, S, z);
  });

  draw(page, "Yours Sincerely,", 71.3, Y(145.8), S, z);
  page.drawImage(ctx.signature, { x: 53.0, y: Y(94.22), width: 142.7, height: 68.1 });
  draw(page, COMPANY.signatory, 53.1, Y(79.2), B, z);
  draw(page, COMPANY.signatoryTitle, 71.3, Y(60.8), S, z);
}

/* ------------------------------------------------------------------- page 2 */

// Column edges (centre of each 0.5pt rule), measured from the original table.
const X = [17.75, 44.65, 103.2, 130.2, 233.4, 363.35, 427.55, 478.35, 523.35, 588.95];
const [C_SN, C_DATE, C_QTY, C_STAFF, C_DEST, C_DRIVER, C_DUR, C_RATE, C_AMT] = [0, 1, 2, 3, 4, 5, 6, 7, 8];
const colMid = (c: number) => (X[c] + X[c + 1]) / 2;

const T = {
  top: 181.55,
  headerH: 31.1,
  pad: 2.7,
  base: 11.65, // first baseline below a row's top rule
  font: 9.96,
  pitch: 12.2,
  totalH: 20.0,
  vatH: 31.2,
  grandH: 31.3,
  sumPitch: 14.3,
  sigTopOriginal: 578.4,
  sigHeight: 92, // from image top to last text line
};

interface RowLayout {
  sn: string;
  date: string;
  qty: string;
  rate: string;
  amount: string;
  staff: string[];
  dest: string[];
  driver: string[];
  dur: string[];
  height: number;
}

function layoutRows(ctx: Ctx, d: InvoiceData, scale: number): RowLayout[] {
  const f = ctx.fonts.sans;
  const size = T.font * scale * ctx.fonts.sansScale;
  const pitch = T.pitch * scale;
  const used = d.entries.filter((e) => !isBlankEntry(e));
  return used.map((e, i) => {
    const staff = wrap(f, e.staffName, size, X[C_STAFF + 1] - X[C_STAFF] - 2 * T.pad - 0.6);
    const dest = wrap(f, e.destination, size, X[C_DEST + 1] - X[C_DEST] - 2 * T.pad - 0.2);
    const driver = wrap(f, e.driverName, size, X[C_DRIVER + 1] - X[C_DRIVER] - 2 * T.pad - 0.4);
    const dur = wrap(f, e.duration, size, X[C_DUR + 1] - X[C_DUR] - 2 * T.pad - 0.4);
    const n = Math.max(1, staff.length, dest.length, driver.length, dur.length);
    const q = parseNumber(e.qty);
    const r = parseNumber(e.rate);
    const hasAmount = !q.empty || !r.empty;
    return {
      sn: `${i + 1}.`,
      date: shortDate(e.date),
      qty: q.empty ? "" : e.qty.trim(),
      rate: r.empty ? "" : groupedCompact(r.valid ? r.value : 0),
      amount: hasAmount ? groupedCompact(entryAmount(e)) : "",
      staff, dest, driver, dur,
      height: n * pitch + 2.7 + (scale < 1 ? 0 : 0),
    };
  });
}

function tableBottom(rows: RowLayout[]): number {
  return T.top + T.headerH + rows.reduce((s, r) => s + r.height, 0) + T.totalH + T.vatH + T.grandH;
}

function fitNumber(f: PDFFont, s: string, size: number, maxW: number): number {
  let z = size;
  while (z > 5 && width(f, s, z) > maxW) z -= 0.2;
  return z;
}

function drawPage2(page: PDFPage, ctx: Ctx, d: InvoiceData, totals: ReturnType<typeof computeTotals>) {
  const { sans: C, sansBold: CB, serif: S } = ctx.fonts;
  drawLetterhead(page, ctx, d.invoiceNumber);
  drawCentered(page, "INVOICE", 297.66, ty(177.2), CB, 11.04 * ctx.fonts.sansScale);

  // Shrink text a little if many long rows would not fit on the page.
  let scale = 1;
  let rows = layoutRows(ctx, d, scale);
  for (const s of [1, 0.94, 0.88, 0.82, 0.76]) {
    scale = s;
    rows = layoutRows(ctx, d, scale);
    if (tableBottom(rows) + 22 + T.sigHeight <= PAGE_H - 24) break;
  }
  const bottom = tableBottom(rows);
  if (bottom + 22 + T.sigHeight > PAGE_H - 24)
    throw new PdfLayoutError("The entries contain too much text to fit on one page. Shorten the destinations.");

  const k = ctx.fonts.sansScale;
  const size = T.font * scale * k; // sans body text
  const numSize = T.font * scale; // numbers are serif (as in the original)
  const pitch = T.pitch * scale;
  const baseOff = T.base - (T.pitch - pitch); // keeps the bottom padding constant when text shrinks
  const hs = T.font * k; // header text never shrinks with the rows

  /* header */
  const hb = ty(T.top + T.base - 0.0);
  drawCentered(page, "S/N", colMid(C_SN), hb, CB, hs);
  drawCentered(page, "DATE", colMid(C_DATE), hb, CB, hs);
  drawCentered(page, "QTY", colMid(C_QTY), hb, CB, hs);
  drawCentered(page, "STAFF NAME", colMid(C_STAFF), hb, CB, hs);
  drawCentered(page, "DESTINATION", colMid(C_DEST), hb, CB, hs);
  drawCentered(page, "DRIVER", colMid(C_DRIVER), ty(193.1), CB, hs);
  drawCentered(page, "NAME", colMid(C_DRIVER), ty(207.2), CB, hs);
  drawCentered(page, "DURATION", 455.5, hb, CB, hs);
  drawCentered(page, "RATE", colMid(C_RATE), hb, CB, hs);
  {
    const wA = width(CB, "AMOUNT ", hs);
    const wN = width(CB, "N", hs);
    const x0 = 561.5 - (wA + wN) / 2;
    draw(page, "AMOUNT", x0, hb, CB, hs);
    const nx = x0 + wA;
    draw(page, "N", nx, hb, CB, hs);
    page.drawRectangle({ x: nx, y: hb + 1.6, width: wN, height: 0.9, color: BLACK });
    page.drawRectangle({ x: nx, y: hb - 1.7, width: wN, height: 0.6, color: BLACK });
  }

  /* body rows */
  const hLines: number[] = [T.top, T.top + T.headerH];
  let top = T.top + T.headerH;
  for (const r of rows) {
    const b0 = ty(top + baseOff);
    const bNum = ty(top + baseOff - 0.3);
    drawRight(page, r.sn, 40.9, b0, C, size);
    draw(page, r.date, 49.8, b0, C, size);
    drawCentered(page, r.qty, colMid(C_QTY), b0, C, size);
    r.staff.forEach((ln, i) => draw(page, ln, 133.1, b0 - i * pitch, C, size));
    r.dest.forEach((ln, i) => draw(page, ln, 236.3, b0 - i * pitch, C, size));
    r.driver.forEach((ln, i) => draw(page, ln, 366.2, b0 - i * pitch, C, size));
    r.dur.forEach((ln, i) => draw(page, ln, 430.4, b0 - i * pitch, C, size));
    const rz = fitNumber(S, r.rate, numSize, X[C_RATE + 1] - X[C_RATE] - 5);
    drawCentered(page, r.rate, 504.1, bNum, S, rz);
    const az = fitNumber(S, r.amount, numSize, X[C_AMT + 1] - X[C_AMT] - 5);
    drawCentered(page, r.amount, 556.1, bNum, S, az);
    top += r.height;
    hLines.push(top);
  }

  /* summary rows */
  const labelRight = 520.3;
  const sumFont = T.font * k;
  const numFont = T.font;
  const money = (n: number) => groupedCompact(n);
  // Total
  drawRight(page, "Total", labelRight, ty(top + 11.85), CB, sumFont);
  drawCentered(page, money(totals.total), 556.1, ty(top + 11.55), S, numFont);
  top += T.totalH;
  hLines.push(top);
  // VAT
  drawRight(page, "VAT", labelRight, ty(top + T.base), CB, sumFont);
  drawRight(page, "7.5%", labelRight, ty(top + T.base + T.sumPitch), CB, sumFont);
  drawCentered(page, money(totals.vat), 556.1, ty(top + T.base - 0.1), S, numFont);
  top += T.vatH;
  hLines.push(top);
  // Grand total
  drawRight(page, "GRAND", labelRight, ty(top + T.base), CB, sumFont);
  drawRight(page, "TOTAL", labelRight, ty(top + T.base + T.sumPitch), CB, sumFont);
  drawCentered(page, money(totals.payable), 556.1, ty(top + T.base - 0.1), S, numFont);
  top += T.grandH;
  hLines.push(top);

  /* grid */
  const t = 0.5;
  for (const y of hLines)
    page.drawLine({ start: { x: X[0] - t / 2, y: ty(y) }, end: { x: X[9] + t / 2, y: ty(y) }, thickness: t, color: BLACK });
  for (const x of X)
    page.drawLine({ start: { x, y: ty(T.top - t / 2) }, end: { x, y: ty(top + t / 2) }, thickness: t, color: BLACK });

  /* signature block: original position, pushed down only if the table is long */
  const y0 = Math.max(T.sigTopOriginal, bottom + 22);
  page.drawImage(ctx.signature, { x: 383.2, y: ty(y0 + 68.1), width: 142.7, height: 68.1 });
  const ul = ty(y0 + 60.3 + 1.0);
  page.drawLine({ start: { x: 71.3, y: ul }, end: { x: 165.9, y: ul }, thickness: 0.6, color: BLACK });
  page.drawLine({ start: { x: 396.0, y: ul }, end: { x: 490.6, y: ul }, thickness: 0.6, color: BLACK });
  draw(page, COMPANY.clientSignatureLabel, 72.0, ty(y0 + 74.4), CB, 9.48 * k);
  draw(page, COMPANY.clientSignatureLocation, 71.3, ty(y0 + 88.1), C, 9.48 * k);
  draw(page, COMPANY.companySignatureLabel, 396.0, ty(y0 + 74.4), CB, 9.48 * k);
  draw(page, COMPANY.companySignatureSub, 396.0, ty(y0 + 88.1), C, 9.48 * k);
}

/* -------------------------------------------------------------------- entry */

export async function generateInvoicePdf(data: InvoiceData, assets: PdfAssets): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  let fonts: Fonts;
  try {
    if (!assets.fonts || !assets.fontkit) throw new Error("no custom fonts");
    doc.registerFontkit(assets.fontkit);
    fonts = {
      serif: await doc.embedFont(assets.fonts.serif, { subset: true }),
      serifBold: await doc.embedFont(assets.fonts.serifBold, { subset: true }),
      // Not subsetted: fontkit's subsetter dropped glyphs from Carlito (letters missing in the table).
      sans: await doc.embedFont(assets.fonts.sans, { subset: false }),
      sansBold: await doc.embedFont(assets.fonts.sansBold, { subset: false }),
      sansScale: 1,
    };
  } catch {
    // Safe fallback: Times is metric-identical to the original; Helvetica stands in for Calibri.
    fonts = {
      serif: await doc.embedFont(StandardFonts.TimesRoman),
      serifBold: await doc.embedFont(StandardFonts.TimesRomanBold),
      sans: await doc.embedFont(StandardFonts.Helvetica),
      sansBold: await doc.embedFont(StandardFonts.HelveticaBold),
      sansScale: 0.9,
    };
  }

  const ctx: Ctx = {
    fonts,
    header: await doc.embedJpg(assets.headerJpg),
    signature: await doc.embedPng(assets.signaturePng),
  };
  const totals = computeTotals(data.entries);

  drawPage1(doc.addPage([PAGE_W, PAGE_H]), ctx, data, totals);
  drawPage2(doc.addPage([PAGE_W, PAGE_H]), ctx, data, totals);

  doc.setTitle(`Invoice ${data.invoiceNumber.trim()}`);
  doc.setAuthor("Perfect Hand Integrated Services");
  doc.setCreator("Invoice Generator");
  doc.setProducer("Invoice Generator");
  return doc.save();
}
