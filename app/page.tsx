"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { computeTotals } from "@/lib/calc";
import { displayDate, formatNaira } from "@/lib/format";
import { deleteInvoice, duplicateInvoice, listInvoices, newId } from "@/lib/storage";
import type { InvoiceRecord } from "@/lib/types";

export default function Dashboard() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<InvoiceRecord[] | null>(null);

  const refresh = () => setInvoices(listInvoices());
  useEffect(refresh, []);

  const onDuplicate = (id: string) => {
    const copy = duplicateInvoice(id);
    if (copy) router.push(`/invoice/${copy}`);
  };
  const onDelete = (r: InvoiceRecord) => {
    if (window.confirm(`Delete invoice ${r.data.invoiceNumber || "(no number)"}? This cannot be undone.`)) {
      deleteInvoice(r.id);
      refresh();
    }
  };

  return (
    <div className="min-h-screen pb-[env(safe-area-inset-bottom)]">
      <header className="bg-navy-900 pt-[env(safe-area-inset-top)] text-white">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-lg font-bold">IG</div>
          <div>
            <h1 className="text-xl font-semibold leading-tight">Invoice Generator</h1>
            <p className="text-sm text-navy-200">Perfect Hand Integrated Services</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-navy-900">New weekly invoice</h2>
            <p className="mt-1 text-sm text-slate-600">
              Fill in the details that change. The letter, bank details and signatures are added for you.
            </p>
          </div>
          <button className="btn-primary w-full sm:w-auto" onClick={() => router.push(`/invoice/${newId()}`)}>
            + Create New Invoice
          </button>
        </div>

        <section className="mt-8" aria-labelledby="recent">
          <h2 id="recent" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent invoices
          </h2>

          {invoices === null ? (
            <div className="card h-24 animate-pulse" />
          ) : invoices.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-500">
              No invoices yet. Drafts and generated invoices will appear here.
            </div>
          ) : (
            <ul className="space-y-3">
              {invoices.slice(0, 20).map((r) => {
                const t = computeTotals(r.data.entries);
                return (
                  <li key={r.id} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-navy-900">
                          Invoice {r.data.invoiceNumber || "(no number)"}
                          <span
                            className={`ml-2 rounded-full px-2 py-0.5 align-middle text-xs font-medium ${
                              r.status === "generated" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {r.status === "generated" ? "Generated" : "Draft"}
                          </span>
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500">{displayDate(r.data.invoiceDate) || "No date"}</p>
                      </div>
                      <p className="shrink-0 text-right font-semibold tabular-nums text-slate-900">{formatNaira(t.payable)}</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href={`/invoice/${r.id}`} className="btn-secondary">Open</Link>
                      <button className="btn-secondary" onClick={() => onDuplicate(r.id)}>Duplicate</button>
                      <button className="btn-danger" onClick={() => onDelete(r)}>Delete</button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Invoices are saved in this browser on this device only. Your phone and laptop keep separate lists.
          </p>
        </section>
      </main>
    </div>
  );
}
