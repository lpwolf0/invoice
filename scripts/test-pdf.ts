/* Run: npx tsx scripts/test-pdf.ts [outDir]  — generates sample PDFs for visual checks. */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { generateInvoicePdf } from "../lib/pdf/generate";
import { computeTotals } from "../lib/calc";
import type { InvoiceData, InvoiceEntry } from "../lib/types";

const out = process.argv[2] ?? "test-output";
mkdirSync(out, { recursive: true });
const assets = {
  headerJpg: new Uint8Array(readFileSync("public/assets/header.jpg")),
  signaturePng: new Uint8Array(readFileSync("public/assets/signature.png")),
};

let n = 0;
const row = (o: Partial<InvoiceEntry>): InvoiceEntry => ({
  id: String(++n), date: "", qty: "", staffName: "", destination: "", driverName: "", duration: "", rate: "", ...o,
});
const MOH = "MOH PORT HARCOURT TO UPTH, OBIO AKPOR TO MINISTRY OF HEALTH, PORT HARCOURT, RIVERS STATE (Saloon)";
const base = (entries: InvoiceEntry[], extra: Partial<InvoiceData> = {}): InvoiceData => ({
  invoiceNumber: "016", invoiceDate: "2026-11-05",
  recipient: "The Procurement Officer,\nFHI 360 Nigeria.", locations: "Rivers State and Imo State", entries, ...extra,
});

const original = base([
  row({ date: "2026-10-30", qty: "1", staffName: "IFEANYI ANYANWU", destination: MOH, driverName: "MR. OLA", duration: "Full Day", rate: "130000" }),
  row({ date: "2026-10-31", qty: "1", staffName: "OGHENEOCHUKO DIAKPAROMRE", destination: "PORT HARCOURT, RIVERS STATE TO OWERRI, IMO STATE (Saloon)", driverName: "MR. OLA", duration: "Full Day", rate: "220000" }),
  row({ date: "2026-11-02", qty: "1", staffName: "IFEANYI ANYANWU", destination: MOH, driverName: "MR. OLA", duration: "Full Day", rate: "130000" }),
  row({ date: "2026-11-03", qty: "1", staffName: "IFEANYI ANYANWU", destination: "MOH PORT HARCOURT TO UPTH, OBIO AKPOR TO ALUU ANNEX TO FED. SEC. ANNEX TO UPTH OBIO AKPOR TO MINISTRY OF HEALTH, PORT HARCOURT, RIVERS STATE (Saloon)", driverName: "MR. OLA", duration: "Full Day", rate: "130000" }),
]);

const many = (k: number, dest = MOH) =>
  Array.from({ length: k }, (_, i) =>
    row({ date: `2026-11-${String(i + 1).padStart(2, "0")}`, qty: String((i % 3) + 1), staffName: `STAFF MEMBER NUMBER ${i + 1}`, destination: dest, driverName: "MR. OLA", duration: "Full Day", rate: String(125000 + i * 7500) }));

const cases: Record<string, InvoiceData> = {
  original,
  one: base([row({ date: "2026-11-05", qty: "2", staffName: "A. PERSON", destination: "PORT HARCOURT TO OWERRI", driverName: "MR. OLA", duration: "Full Day", rate: "150,000" })]),
  five: base(many(5)),
  ten: base(many(10)),
  ten_short: base(many(10, "PORT HARCOURT TO OWERRI")),
  ten_long: base(many(10, MOH + " AND BACK TO THE HOTEL VIA THE AIRPORT ROAD (Saloon)")),
  fractional: base([row({ date: "2026-11-05", qty: "3", destination: "X", rate: "33333.33" })]),
  long_locations: base(many(1), { locations: "Rivers State, Imo State, Abia State, Anambra State, Enugu State, Bayelsa State, Akwa Ibom State and Delta State" }),
  empty_optional: base([row({ qty: "1", rate: "10000" })]),
};

(async () => {
  for (const [name, data] of Object.entries(cases)) {
    try {
      const bytes = await generateInvoicePdf(data, assets);
      writeFileSync(`${out}/${name}.pdf`, bytes);
      const t = computeTotals(data.entries);
      console.log(name.padEnd(16), "OK", `total=${t.total} vat=${t.vat} payable=${t.payable}`);
    } catch (e) {
      console.log(name.padEnd(16), "ERROR:", (e as Error).message);
    }
  }
})();
