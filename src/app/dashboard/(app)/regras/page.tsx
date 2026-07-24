"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { RulesView } from "@/components/dashboard/views/RulesView";

export default function RegrasPage() {
  return <RulesView v={useTraffik()} />;
}
