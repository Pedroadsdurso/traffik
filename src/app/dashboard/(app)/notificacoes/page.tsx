"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { NotificationsView } from "@/components/dashboard/views/NotificationsView";

export default function NotificacoesPage() {
  return <NotificationsView v={useTraffik()} />;
}
