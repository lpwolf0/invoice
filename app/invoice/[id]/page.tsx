"use client";

import { useParams } from "next/navigation";
import InvoiceEditor from "@/components/InvoiceEditor";

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  return <InvoiceEditor id={String(params.id)} />;
}
