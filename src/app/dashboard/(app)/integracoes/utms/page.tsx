"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { UtmView } from "@/components/dashboard/views/UtmView";

export default function UtmsPage() {
  return <UtmView v={useTraffik()} />;
}
