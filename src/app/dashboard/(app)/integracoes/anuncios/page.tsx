"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { AnunciosView } from "@/components/dashboard/views/integracoes/AnunciosView";

export default function AnunciosPage() {
  return <AnunciosView v={useTraffik()} />;
}
