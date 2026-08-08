"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { GerenciadorScreen } from "@/components/dashboard/views/gerenciador/GerenciadorScreen";

export default function GerenciadorPage() {
  return <GerenciadorScreen v={useTraffik()} />;
}
