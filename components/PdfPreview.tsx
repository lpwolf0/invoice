"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders the exact bytes that will be downloaded, page by page, with pdf.js.
 * (iOS Safari only shows the first page of an embedded PDF, so canvases are used.)
 */
export default function PdfPreview({ bytes }: { bytes: Uint8Array }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let doc: any = null;
    setError(null);

    (async () => {
      try {
        const mod: any = await import("pdfjs-dist/legacy/build/pdf");
        const pdfjs = mod.getDocument ? mod : mod.default;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
        doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
        if (cancelled || !host.current) return;

        const container = host.current;
        container.replaceChildren();
        const cssWidth = Math.min(container.clientWidth || 600, 900);
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.style.width = "100%";
          canvas.style.height = "auto";
          canvas.className = "block rounded-md border border-slate-200 bg-white shadow-sm";
          canvas.setAttribute("aria-label", `Invoice page ${i}`);
          const wrap = document.createElement("div");
          wrap.className = "mb-4 last:mb-0";
          wrap.appendChild(canvas);
          container.appendChild(wrap);
          await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message || "Could not render the preview.");
      }
    })();

    return () => {
      cancelled = true;
      try { doc?.destroy(); } catch {}
    };
  }, [bytes]);

  return (
    <>
      <div ref={host} className="mx-auto w-full max-w-[900px]" />
      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Preview could not be displayed ({error}). You can still download the PDF.
        </p>
      )}
    </>
  );
}
