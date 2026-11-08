import { MAX_ENTRIES } from "./calc";
import { DEFAULT_LOCATIONS, DEFAULT_RECIPIENT, SEED_LAST_INVOICE_NUMBER } from "./company";
import { nextInvoiceNumber, todayIso } from "./format";
import type { InvoiceData, InvoiceEntry, InvoiceRecord } from "./types";

/**
 * Everything is stored in this browser's localStorage (per device). Every access is
 * wrapped in try/catch because Safari private mode and storage limits can throw.
 */
const KEY = "invoice-generator:v1:invoices";

export function newId(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  } catch {}
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newEntry(): InvoiceEntry {
  return { id: newId(), date: "", qty: "", staffName: "", destination: "", driverName: "", duration: "", rate: "" };
}

function numericValue(s: string): number {
  const m = /(\d+)\D*$/.exec(s.trim());
  return m ? Number(m[1]) : -1;
}

export function listInvoices(): InvoiceRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as InvoiceRecord[])
      .filter((r) => r && typeof r.id === "string" && r.data && Array.isArray(r.data.entries))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function writeAll(list: InvoiceRecord[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function getInvoice(id: string): InvoiceRecord | null {
  return listInvoices().find((r) => r.id === id) ?? null;
}

export function saveInvoice(rec: InvoiceRecord): boolean {
  const list = listInvoices().filter((r) => r.id !== rec.id);
  list.push(rec);
  return writeAll(list);
}

export function deleteInvoice(id: string): void {
  writeAll(listInvoices().filter((r) => r.id !== id));
}

/** Next number after the highest one already used (starts after the sample invoice, 016). */
export function suggestedInvoiceNumber(): string {
  let best = SEED_LAST_INVOICE_NUMBER;
  for (const r of listInvoices()) {
    if (numericValue(r.data.invoiceNumber) > numericValue(best)) best = r.data.invoiceNumber;
  }
  return nextInvoiceNumber(best);
}

export function newInvoiceData(): InvoiceData {
  return {
    invoiceNumber: suggestedInvoiceNumber(),
    invoiceDate: todayIso(),
    recipient: DEFAULT_RECIPIENT,
    locations: DEFAULT_LOCATIONS,
    entries: [newEntry()],
  };
}

export function duplicateInvoice(id: string): string | null {
  const src = getInvoice(id);
  if (!src) return null;
  const copyId = newId();
  const now = Date.now();
  saveInvoice({
    id: copyId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    data: {
      ...src.data,
      invoiceNumber: suggestedInvoiceNumber(),
      invoiceDate: todayIso(),
      entries: src.data.entries.slice(0, MAX_ENTRIES).map((e) => ({ ...e, id: newId() })),
    },
  });
  return copyId;
}

/** Previously used values for autocomplete (most recent first). */
export function suggestionPool(): Record<"staffName" | "destination" | "driverName" | "duration", string[]> {
  const pool = { staffName: new Set<string>(), destination: new Set<string>(), driverName: new Set<string>(), duration: new Set<string>() };
  for (const r of listInvoices())
    for (const e of r.data.entries)
      (Object.keys(pool) as (keyof typeof pool)[]).forEach((k) => {
        const v = e[k].trim();
        if (v) pool[k].add(v);
      });
  return {
    staffName: [...pool.staffName].slice(0, 40),
    destination: [...pool.destination].slice(0, 40),
    driverName: [...pool.driverName].slice(0, 40),
    duration: [...pool.duration].slice(0, 40),
  };
}
