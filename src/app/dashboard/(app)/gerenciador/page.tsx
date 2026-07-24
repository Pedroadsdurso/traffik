"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { AdsManagerView } from "@/components/dashboard/views/AdsManagerView";

export default function GerenciadorPage() {
  return <AdsManagerView v={useTraffik()} />;
}
