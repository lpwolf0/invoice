"use client";

import { MAX_ENTRIES, entryAmount, parseNumber } from "@/lib/calc";
import { formatNaira } from "@/lib/format";
import type { InvoiceEntry } from "@/lib/types";

interface Props {
  entries: InvoiceEntry[];
  onChange: (id: string, patch: Partial<InvoiceEntry>) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  suggestions: Record<"staffName" | "destination" | "driverName" | "duration", string[]>;
}

const numberProblem = (v: string) => (parseNumber(v).valid ? undefined : "Enter a valid number");

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export default function EntriesEditor({ entries, onChange, onAdd, onRemove, suggestions }: Props) {
  const atMax = entries.length >= MAX_ENTRIES;
  const only = entries.length === 1;

  const text = (e: InvoiceEntry, k: "staffName" | "destination" | "driverName" | "duration", extra?: object) => ({
    value: e[k],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => onChange(e.id, { [k]: ev.target.value } as Partial<InvoiceEntry>),
    list: `dl-${k}`,
    className: "field-input",
    ...extra,
  });
  const num = (e: InvoiceEntry, k: "qty" | "rate") => ({
    value: e[k],
    onChange: (ev: React.ChangeEvent<HTMLInputElement>) => onChange(e.id, { [k]: ev.target.value } as Partial<InvoiceEntry>),
    inputMode: "decimal" as const,
    autoComplete: "off",
    "aria-invalid": !!numberProblem(e[k]),
    className: "field-input",
  });
  const caps = { autoCapitalize: "characters", autoComplete: "off" };

  return (
    <div>
      {(["staffName", "destination", "driverName", "duration"] as const).map((k) => (
        <datalist key={k} id={`dl-${k}`}>
          {suggestions[k].map((s) => <option key={s} value={s} />)}
        </datalist>
      ))}

      {/* Mobile & tablet: cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:hidden">
        {entries.map((e, i) => (
          <div key={e.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-navy-900">Entry {i + 1}</h3>
              <button type="button" className="btn-danger !min-h-[40px] px-3" onClick={() => onRemove(e.id)}
                aria-label={only ? "Clear entry" : `Remove entry ${i + 1}`}>
                {only ? "Clear" : "Remove"}
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date">
                  <input type="date" value={e.date} onChange={(ev) => onChange(e.id, { date: ev.target.value })} className="field-input" />
                </Field>
                <Field label="Quantity" error={numberProblem(e.qty)}><input {...num(e, "qty")} placeholder="1" /></Field>
              </div>
              <Field label="Staff name"><input {...text(e, "staffName", caps)} placeholder="Full name" /></Field>
              <Field label="Destination"><input {...text(e, "destination", caps)} placeholder="From … to …" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Driver name"><input {...text(e, "driverName", caps)} /></Field>
                <Field label="Duration"><input {...text(e, "duration")} placeholder="Full Day" /></Field>
              </div>
              <Field label="Rate (₦)" error={numberProblem(e.rate)}><input {...num(e, "rate")} placeholder="0" /></Field>
              <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                <span className="text-slate-500">Amount</span>
                <span className="font-semibold tabular-nums text-navy-900">{formatNaira(entryAmount(e))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full table-fixed border-separate border-spacing-y-1 text-left">
          <colgroup>
            <col style={{ width: 40 }} /><col style={{ width: 150 }} /><col style={{ width: 70 }} />
            <col /><col style={{ width: "22%" }} /><col style={{ width: 130 }} />
            <col style={{ width: 110 }} /><col style={{ width: 110 }} /><col style={{ width: 130 }} /><col style={{ width: 44 }} />
          </colgroup>
          <thead>
            <tr className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th className="px-1">S/N</th><th className="px-1">Date</th><th className="px-1">Qty</th>
              <th className="px-1">Staff name</th><th className="px-1">Destination</th><th className="px-1">Driver name</th>
              <th className="px-1">Duration</th><th className="px-1">Rate (₦)</th><th className="px-1 text-right">Amount (₦)</th><th />
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.id} className="align-top">
                <td className="px-1 pt-3 text-sm font-medium text-slate-500">{i + 1}.</td>
                <td className="px-1"><input type="date" aria-label={`Entry ${i + 1} date`} value={e.date} onChange={(ev) => onChange(e.id, { date: ev.target.value })} className="field-input" /></td>
                <td className="px-1"><input aria-label={`Entry ${i + 1} quantity`} {...num(e, "qty")} /></td>
                <td className="px-1"><input aria-label={`Entry ${i + 1} staff name`} {...text(e, "staffName", caps)} /></td>
                <td className="px-1"><input aria-label={`Entry ${i + 1} destination`} {...text(e, "destination", caps)} /></td>
                <td className="px-1"><input aria-label={`Entry ${i + 1} driver name`} {...text(e, "driverName", caps)} /></td>
                <td className="px-1"><input aria-label={`Entry ${i + 1} duration`} {...text(e, "duration")} /></td>
                <td className="px-1"><input aria-label={`Entry ${i + 1} rate`} {...num(e, "rate")} /></td>
                <td className="px-1 pt-3 text-right text-sm font-semibold tabular-nums text-navy-900">{formatNaira(entryAmount(e))}</td>
                <td className="px-1">
                  <button type="button" className="btn-danger !min-h-[44px] !px-0 w-full"
                    onClick={() => onRemove(e.id)} aria-label={only ? "Clear entry" : `Remove entry ${i + 1}`} title={only ? "Clear" : "Remove"}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" className="btn-secondary" onClick={onAdd} disabled={atMax}>+ Add Row</button>
        <span className="text-sm text-slate-500">{entries.length} of {MAX_ENTRIES} rows</span>
      </div>
    </div>
  );
}
