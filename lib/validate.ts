import { isBlankEntry, parseNumber, MAX_ENTRIES } from "./calc";
import { parseIso } from "./format";
import type { InvoiceData } from "./types";

export interface Validation {
  /** Blocking problems: PDF cannot be produced. */
  errors: string[];
  /** Non-blocking hints. */
  warnings: string[];
}

export function validateInvoice(d: InvoiceData): Validation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!d.invoiceNumber.trim()) errors.push("Enter an invoice number.");
  if (!parseIso(d.invoiceDate)) errors.push("Choose the invoice date.");
  const recipientLines = d.recipient.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (recipientLines.length === 0) errors.push("Enter the recipient.");
  if (recipientLines.length > 3) errors.push("Recipient can have at most 3 lines.");
  if (!d.locations.trim()) errors.push("Enter the locations.");

  const used = d.entries.filter((e) => !isBlankEntry(e));
  if (d.entries.length > MAX_ENTRIES) errors.push(`At most ${MAX_ENTRIES} entries are supported.`);
  if (used.length === 0) errors.push("Add at least one invoice entry.");

  used.forEach((e, i) => {
    const n = i + 1;
    const q = parseNumber(e.qty);
    const r = parseNumber(e.rate);
    if (!q.valid) errors.push(`Entry ${n}: quantity is not a valid number.`);
    if (!r.valid) errors.push(`Entry ${n}: rate is not a valid number.`);
    if (q.valid && q.empty) warnings.push(`Entry ${n}: quantity is empty, so its amount is ₦0.`);
    if (r.valid && r.empty) warnings.push(`Entry ${n}: rate is empty, so its amount is ₦0.`);
    if (!e.date) warnings.push(`Entry ${n}: no date.`);
    if (!e.staffName.trim()) warnings.push(`Entry ${n}: no staff name.`);
  });

  return { errors, warnings };
}
