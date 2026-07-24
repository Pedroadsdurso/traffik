"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { CreativesView } from "@/components/dashboard/views/CreativesView";

export default function CriativosPage() {
  return <CreativesView v={useTraffik()} />;
}
