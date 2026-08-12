"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { NotificacoesScreen } from "@/components/dashboard/views/notificacoes/NotificacoesScreen";

export default function NotificacoesPage() {
  return <NotificacoesScreen v={useTraffik()} />;
}
