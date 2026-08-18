"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { AnunciosScreen } from "@/components/dashboard/views/anuncios/AnunciosScreen";

export default function AnunciosPage() {
  return <AnunciosScreen v={useTraffik()} />;
}
