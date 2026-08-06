"use client";

import { DashboardScreen } from "@/components/dashboard/views/dashboard/DashboardScreen";
import { useTraffik } from "@/components/dashboard/TraffikContext";

export default function DashboardPage() {
  const v = useTraffik();
  return <DashboardScreen v={v} />;
}
