export interface InvoiceEntry {
  id: string;
  /** ISO date, yyyy-mm-dd (as produced by <input type="date">) */
  date: string;
  qty: string;
  staffName: string;
  destination: string;
  driverName: string;
  duration: string;
  rate: string;
}

export interface InvoiceData {
  invoiceNumber: string;
  /** ISO date, yyyy-mm-dd */
  invoiceDate: string;
  /** Multi-line: one line per line of the address block (max 3). */
  recipient: string;
  /** Inserted into: "...to various destination in {locations}." */
  locations: string;
  /** Organization named in the payment-request letter body. */
  clientOrganization?: string;
  /** Editable location/organization shown beneath the client signature line. */
  clientSignatureLocation?: string;
  entries: InvoiceEntry[];
}

export type InvoiceStatus = "draft" | "generated";

export interface InvoiceRecord {
  id: string;
  status: InvoiceStatus;
  createdAt: number;
  updatedAt: number;
  data: InvoiceData;
}
