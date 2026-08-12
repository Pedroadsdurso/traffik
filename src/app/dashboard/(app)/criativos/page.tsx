"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { CriativosScreen } from "@/components/dashboard/views/criativos/CriativosScreen";

export default function CriativosPage() {
  return <CriativosScreen v={useTraffik()} />;
}
