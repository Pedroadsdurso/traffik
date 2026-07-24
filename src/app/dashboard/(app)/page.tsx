"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { DashboardView } from "@/components/dashboard/views/DashboardView";

export default function DashboardPage() {
  return <DashboardView v={useTraffik()} />;
}
