"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { FeesView } from "@/components/dashboard/views/FeesView";

export default function TaxasPage() {
  return <FeesView v={useTraffik()} />;
}
