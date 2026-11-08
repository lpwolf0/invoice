/**
 * Fixed details, copied verbatim from the original invoice PDF
 * (INVOICE_FHI_360_RIVERS__IMO_STATE.pdf). Change them here if they ever change.
 * The letterhead (logo + address block) lives in /public/assets/header.jpg.
 */
export const COMPANY = {
  accountName: "Perfect Hand Integrated service",
  bank: "GTB",
  accountNumber: "0153023517",
  tin: "18234768",
  signatory: "UBONG UDOH",
  signatoryTitle: "(Manager)",
  clientSignatureLabel: "CLIENT SIGNATURE",
  clientSignatureLocation: "PALLADIUM ABUJA.",
  companySignatureLabel: "PERFECT HAND",
  companySignatureSub: "INTEGRATED SERVICES",
} as const;

/** Defaults taken from the sample invoice; both remain editable. */
export const DEFAULT_RECIPIENT = "The Procurement Officer,\nFHI 360 Nigeria.";
export const DEFAULT_LOCATIONS = "Rivers State and Imo State";
/** Last invoice number in the sample PDF; the next suggestion is this + 1. */
export const SEED_LAST_INVOICE_NUMBER = "016";
