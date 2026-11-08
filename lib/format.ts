function group(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 610000 -> "610,000.00" (always 2 decimals) */
export function groupedFixed(n: number): string {
  const [i, d] = Math.abs(n).toFixed(2).split(".");
  return `${n < 0 ? "-" : ""}${group(i)}.${d}`;
}

/** 610000 -> "610,000"; 9750.5 -> "9,750.50" (decimals only when needed) */
export function groupedCompact(n: number): string {
  return Number.isInteger(n) ? group(String(Math.abs(n))) : groupedFixed(n);
}

/** UI formatting: ₦610,000.00 */
export function formatNaira(n: number): string {
  return `₦${groupedFixed(n)}`;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return { y, m: mo, d };
}

export function ordinalSuffix(d: number): string {
  if (d % 100 >= 11 && d % 100 <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[d % 10] ?? "th";
}

/** "2026-11-05" -> { day: "05", suffix: "th", rest: " November, 2026" } */
export function longDateParts(iso: string): { day: string; suffix: string; rest: string } | null {
  const p = parseIso(iso);
  if (!p) return null;
  return {
    day: String(p.d).padStart(2, "0"),
    suffix: ordinalSuffix(p.d),
    rest: ` ${MONTHS[p.m - 1]}, ${p.y}`,
  };
}

/** "2026-10-30" -> "30/10/2026" */
export function shortDate(iso: string): string {
  const p = parseIso(iso);
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

export function displayDate(iso: string): string {
  const p = longDateParts(iso);
  return p ? `${Number(p.day)}${p.suffix}${p.rest}` : "";
}

export function todayIso(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** "016" -> "017"; "INV-9" -> "INV-10"; "" -> "" */
export function nextInvoiceNumber(last: string): string {
  const m = /^(.*?)(\d+)(\D*)$/.exec(last.trim());
  if (!m) return "";
  const next = String(Number(m[2]) + 1).padStart(m[2].length, "0");
  return `${m[1]}${next}${m[3]}`;
}
