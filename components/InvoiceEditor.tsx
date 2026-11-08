"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MAX_ENTRIES, computeTotals } from "@/lib/calc";
import { formatNaira } from "@/lib/format";
import { buildPdf, pdfFilename, preloadPdfAssets, savePdf } from "@/lib/pdf/client";
import {
  getInvoice, newEntry, newInvoiceData, saveInvoice, suggestionPool,
} from "@/lib/storage";
import type { InvoiceData, InvoiceEntry, InvoiceStatus } from "@/lib/types";
import { validateInvoice } from "@/lib/validate";
import EntriesEditor from "./EntriesEditor";
import PdfPreview from "./PdfPreview";

type Tab = "edit" | "preview";
type Notice = { kind: "error" | "success"; text: string } | null;

const EMPTY: InvoiceData = { invoiceNumber: "", invoiceDate: "", recipient: "", locations: "", entries: [] };
const NO_SUGGESTIONS = { staffName: [], destination: [], driverName: [], duration: [] };

export default function InvoiceEditor({ id }: { id: string }) {
  const [data, setData] = useState<InvoiceData | null>(null);
  const [tab, setTab] = useState<Tab>("edit");
  const [attempted, setAttempted] = useState(false);
  const [pdf, setPdf] = useState<Uint8Array | null>(null);
  const [busy, setBusy] = useState<"preview" | "download" | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [suggestions, setSuggestions] = useState<ReturnType<typeof suggestionPool>>(NO_SUGGESTIONS);

  const meta = useRef<{ createdAt: number; status: InvoiceStatus }>({ createdAt: Date.now(), status: "draft" });
  const dirty = useRef(false);
  const latest = useRef<InvoiceData | null>(null);
  latest.current = data;

  const persist = () => {
    if (!dirty.current || !latest.current) return;
    saveInvoice({
      id,
      status: meta.current.status,
      createdAt: meta.current.createdAt,
      updatedAt: Date.now(),
      data: latest.current,
    });
  };

  /* load */
  useEffect(() => {
    const rec = getInvoice(id);
    if (rec) {
      meta.current = { createdAt: rec.createdAt, status: rec.status };
      setData(rec.data);
    } else {
      setData(newInvoiceData());
    }
    setSuggestions(suggestionPool());
    preloadPdfAssets();
  }, [id]);

  /* autosave (debounced) + flush when leaving */
  useEffect(() => {
    if (!data || !dirty.current) return;
    const t = setTimeout(persist, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  useEffect(() => {
    const flush = () => persist();
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = data ?? EMPTY;
  const totals = useMemo(() => computeTotals(d.entries), [d.entries]);
  const validation = useMemo(() => validateInvoice(d), [d]);
  const hasErrors = validation.errors.length > 0;

  const update = (fn: (x: InvoiceData) => InvoiceData) => {
    dirty.current = true;
    meta.current.status = "draft";
    setPdf(null);
    setNotice(null);
    setData((x) => (x ? fn(x) : x));
  };
  const setField = <K extends keyof InvoiceData>(k: K, v: InvoiceData[K]) => update((x) => ({ ...x, [k]: v } as InvoiceData));
  const changeEntry = (eid: string, patch: Partial<InvoiceEntry>) =>
    update((x) => ({ ...x, entries: x.entries.map((e) => (e.id === eid ? { ...e, ...patch } : e)) }));
  const addEntry = () =>
    update((x) => (x.entries.length >= MAX_ENTRIES ? x : { ...x, entries: [...x.entries, newEntry()] }));
  const removeEntry = (eid: string) =>
    update((x) => ({ ...x, entries: x.entries.length <= 1 ? [newEntry()] : x.entries.filter((e) => e.id !== eid) }));
  const resetForm = () => {
    if (!window.confirm("Clear this invoice and start over?")) return;
    update((x) => ({ ...newInvoiceData(), invoiceNumber: x.invoiceNumber }));
    setAttempted(false);
  };

  /* preview: render the real PDF bytes */
  useEffect(() => {
    if (tab !== "preview" || !data) return;
    if (hasErrors) {
      setPdf(null);
      return;
    }
    let cancelled = false;
    setBusy("preview");
    buildPdf(data)
      .then((bytes) => !cancelled && setPdf(bytes))
      .catch((e: Error) => !cancelled && setNotice({ kind: "error", text: e.message || "Could not build the PDF." }))
      .finally(() => !cancelled && setBusy(null));
    return () => {
      cancelled = true;
      setBusy(null);
    };
  }, [tab, data, hasErrors]);

  const goPreview = () => {
    setAttempted(true);
    setTab("preview");
    window.scrollTo({ top: 0 });
  };

  const download = async () => {
    if (!data) return;
    setAttempted(true);
    if (hasErrors) {
      setTab("edit");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy("download");
    setNotice(null);
    try {
      const bytes = pdf ?? (await buildPdf(data));
      const result = await savePdf(bytes, pdfFilename(data.invoiceNumber));
      if (result !== "cancelled") {
        meta.current.status = "generated";
        dirty.current = true;
        persist();
        setNotice({
          kind: "success",
          text: result === "shared" ? "PDF ready. Choose “Save to Files” to keep it." : "PDF downloaded.",
        });
      }
    } catch (e) {
      setNotice({ kind: "error", text: (e as Error).message || "Could not build the PDF." });
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return <div className="mx-auto max-w-3xl p-6"><div className="card h-40 animate-pulse" /></div>;
  }

  const locSentence = d.locations.trim() ? d.locations.trim().replace(/\.+$/, "") : "…";

  return (
    <div className="min-h-screen pb-40">
      {/* header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Link href="/" className="btn-ghost !px-2" aria-label="Back to dashboard">← <span className="hidden sm:inline">Dashboard</span></Link>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-navy-900 sm:text-lg">
            Invoice {d.invoiceNumber || "(new)"}
          </h1>
          <div role="tablist" aria-label="View" className="flex rounded-lg bg-slate-100 p-1">
            {(["edit", "preview"] as const).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                onClick={() => (t === "preview" ? goPreview() : setTab("edit"))}
                className={`min-h-[40px] rounded-md px-4 text-sm font-semibold capitalize transition ${
                  tab === t ? "bg-white text-navy-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5">
        {notice && (
          <div
            role="status"
            className={`rounded-lg p-3 text-sm ${notice.kind === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}
          >
            {notice.text}
          </div>
        )}

        {attempted && hasErrors && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-semibold">Please fix before generating the PDF:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {validation.errors.map((e) => <li key={e}>{e}</li>)}
            </ul>
          </div>
        )}

        {tab === "edit" ? (
          <>
            {/* Section A */}
            <section className="card p-5" aria-labelledby="secA">
              <h2 id="secA" className="text-base font-semibold text-navy-900">A. Invoice Information</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="field-label">Invoice number</span>
                  <input className="field-input" value={d.invoiceNumber} autoComplete="off"
                    onChange={(e) => setField("invoiceNumber", e.target.value)} placeholder="e.g. 017" />
                </label>
                <label className="block">
                  <span className="field-label">Invoice date</span>
                  <input type="date" className="field-input" value={d.invoiceDate}
                    onChange={(e) => setField("invoiceDate", e.target.value)} />
                </label>
                <label className="block">
                  <span className="field-label">Recipient</span>
                  <textarea className="field-input" rows={3} value={d.recipient}
                    onChange={(e) => setField("recipient", e.target.value)} />
                  <span className="mt-1 block text-xs text-slate-500">One line per line of the address, up to 3 lines.</span>
                </label>
                <label className="block">
                  <span className="field-label">Locations</span>
                  <input className="field-input" value={d.locations} autoComplete="off"
                    onChange={(e) => setField("locations", e.target.value)} placeholder="Rivers State and Imo State" />
                  <span className="mt-1 block text-xs text-slate-500">
                    Appears as: “…to various destination in <span className="font-medium">{locSentence}</span>.”
                  </span>
                </label>
              </div>
            </section>

            {/* Section B */}
            <section className="card p-5" aria-labelledby="secB">
              <h2 id="secB" className="mb-4 text-base font-semibold text-navy-900">B. Invoice Entries</h2>
              <EntriesEditor
                entries={d.entries}
                onChange={changeEntry}
                onAdd={addEntry}
                onRemove={removeEntry}
                suggestions={suggestions}
              />
            </section>

            {/* Summary */}
            <section className="card p-5" aria-labelledby="sum">
              <h2 id="sum" className="text-base font-semibold text-navy-900">Summary</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-slate-600">Total</dt><dd className="font-medium tabular-nums">{formatNaira(totals.total)}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-600">VAT (7.5%)</dt><dd className="font-medium tabular-nums">{formatNaira(totals.vat)}</dd></div>
                <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                  <dt className="font-semibold text-navy-900">Grand total</dt>
                  <dd className="font-bold tabular-nums text-navy-900">{formatNaira(totals.payable)}</dd>
                </div>
              </dl>
              {validation.warnings.length > 0 && (
                <ul className="mt-4 list-disc space-y-0.5 rounded-lg bg-amber-50 p-3 pl-7 text-xs text-amber-800">
                  {validation.warnings.slice(0, 6).map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
              <div className="mt-4">
                <button type="button" className="btn-danger" onClick={resetForm}>Reset Form</button>
              </div>
            </section>
          </>
        ) : (
          <section aria-label="PDF preview">
            {hasErrors ? (
              <div className="card p-6 text-center text-sm text-slate-600">
                Fix the highlighted problems on the Edit tab to see the preview.
                <div className="mt-4"><button className="btn-secondary" onClick={() => setTab("edit")}>Back to Edit</button></div>
              </div>
            ) : busy === "preview" && !pdf ? (
              <div className="card flex h-64 items-center justify-center text-sm text-slate-500">Building preview…</div>
            ) : pdf ? (
              <PdfPreview bytes={pdf} />
            ) : null}
          </section>
        )}
      </main>

      {/* sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Grand total</p>
            <p className="truncate text-lg font-bold tabular-nums text-navy-900">{formatNaira(totals.payable)}</p>
          </div>
          {tab === "edit" ? (
            <button className="btn-secondary" onClick={goPreview}>Preview PDF</button>
          ) : (
            <button className="btn-secondary" onClick={() => setTab("edit")}>Edit</button>
          )}
          <button className="btn-primary" onClick={download} disabled={busy === "download"}>
            {busy === "download" ? "Preparing…" : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
