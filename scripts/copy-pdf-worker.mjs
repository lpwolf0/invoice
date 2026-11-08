// Copies the pdf.js worker into /public so the in-app preview can load it (runs after npm install).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
const src = "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js";
if (existsSync(src)) {
  mkdirSync("public", { recursive: true });
  copyFileSync(src, "public/pdf.worker.min.js");
  console.log("pdf.worker.min.js copied to /public");
} else {
  console.warn("pdfjs-dist worker not found; the PDF preview will not work until it is installed.");
}
