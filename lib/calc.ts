import type { InvoiceEntry } from "./types";

export const VAT_RATE = 0.075;
export const MAX_ENTRIES = 10;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface ParsedNumber {
  empty: boolean;
  valid: boolean;
  value: number;
}

/** Accepts "130,000", "₦130000", "1 500.50". Negative / non-numeric => invalid. */
export function parseNumber(input: string): ParsedNumber {
  const cleaned = (input ?? "").replace(/[₦,\s]/g, "").replace(/^N(?=\d)/i, "");
  if (cleaned === "") return { empty: true, valid: true, value: 0 };
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return { empty: false, valid: false, value: 0 };
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { empty: false, valid: false, value: 0 };
  return { empty: false, valid: true, value };
}

export function entryAmount(e: Pick<InvoiceEntry, "qty" | "rate">): number {
  const q = parseNumber(e.qty);
  const r = parseNumber(e.rate);
  if (!q.valid || !r.valid) return 0;
  return round2(q.value * r.value);
}

export function isBlankEntry(e: InvoiceEntry): boolean {
  return [e.date, e.qty, e.staffName, e.destination, e.driverName, e.duration, e.rate].every(
    (v) => v.trim() === ""
  );
}

export interface Totals {
  total: number;
  vat: number;
  payable: number;
}

export function computeTotals(entries: InvoiceEntry[]): Totals {
  const total = round2(entries.filter((e) => !isBlankEntry(e)).reduce((s, e) => s + entryAmount(e), 0));
  const vat = round2(total * VAT_RATE);
  return { total, vat, payable: round2(total + vat) };
}
