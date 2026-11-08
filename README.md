# Invoice Generator

Mobile-first invoice generator for Perfect Hand Integrated Services. Produces the same two-page
invoice as the original PDF (Request for Payment + Invoice breakdown), fully in the browser.

## Run locally
```bash
npm install        # also copies the pdf.js worker into /public
npm run dev        # http://localhost:3000
```

## Deploy
Push to GitHub and import the repo in Vercel (framework: Next.js, no environment variables).

## Where things live
- `lib/company.ts` fixed details (bank, account, TIN, signatory) copied from the original PDF
- `lib/pdf/generate.ts` PDF engine (measured coordinates from the original)
- `public/assets/` letterhead and signature images extracted from the original PDF
- `public/fonts/` Liberation Serif (≈ Times New Roman) and Carlito (≈ Calibri), both SIL OFL
- `scripts/test-pdf.ts` generates 1/5/10-row samples: `npm run test:pdf`

Invoices and drafts are stored in the browser's localStorage (per device).
