import { generateInvoicePdf, type PdfAssets } from "./generate";
import type { InvoiceData } from "../types";

let assetsPromise: Promise<PdfAssets> | null = null;

async function fetchBytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function loadAssets(): Promise<PdfAssets> {
  const [headerJpg, signaturePng] = await Promise.all([
    fetchBytes("/assets/header.jpg"),
    fetchBytes("/assets/signature.png"),
  ]);
  const assets: PdfAssets = { headerJpg, signaturePng };
  try {
    const [fontkitMod, serif, serifBold, sans, sansBold] = await Promise.all([
      import("@pdf-lib/fontkit"),
      fetchBytes("/fonts/LiberationSerif-Regular.ttf"),
      fetchBytes("/fonts/LiberationSerif-Bold.ttf"),
      fetchBytes("/fonts/Carlito-Regular.ttf"),
      fetchBytes("/fonts/Carlito-Bold.ttf"),
    ]);
    assets.fontkit = (fontkitMod as any).default ?? fontkitMod;
    assets.fonts = { serif, serifBold, sans, sansBold };
  } catch {
    // The engine falls back to built-in PDF fonts.
  }
  return assets;
}

function getAssets(): Promise<PdfAssets> {
  if (!assetsPromise) {
    assetsPromise = loadAssets().catch((e) => {
      assetsPromise = null;
      throw e;
    });
  }
  return assetsPromise;
}

/** Warm the cache so the first Download tap is fast (iOS needs the share call soon after the tap). */
export function preloadPdfAssets(): void {
  getAssets().catch(() => {});
}

export function buildPdf(data: InvoiceData): Promise<Uint8Array> {
  return getAssets().then((a) => generateInvoicePdf(data, a));
}

export function pdfFilename(invoiceNumber: string): string {
  const safe = invoiceNumber.trim().replace(/[^\w.-]+/g, "-").replace(/^-+|-+$/g, "") || "invoice";
  return `Invoice-${safe}.pdf`;
}

export type SaveResult = "downloaded" | "shared" | "cancelled";

/** iOS Safari: use the share sheet ("Save to Files") when possible, else a normal download. */
export async function savePdf(bytes: Uint8Array, filename: string): Promise<SaveResult> {
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  const isIOS =
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS && typeof File !== "undefined" && typeof navigator.canShare === "function") {
    try {
      const file = new File([blob], filename, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return "shared";
      }
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "cancelled";
      // otherwise fall through to the normal download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return "downloaded";
}
