"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { TestesView } from "@/components/dashboard/views/integracoes/TestesView";

export default function TestesPage() {
  return <TestesView v={useTraffik()} />;
}
