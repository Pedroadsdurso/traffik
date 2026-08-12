"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { TaxasScreen } from "@/components/dashboard/views/taxas/TaxasScreen";

export default function TaxasPage() {
  return <TaxasScreen v={useTraffik()} />;
}
