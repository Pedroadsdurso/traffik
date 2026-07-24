"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { PixelView } from "@/components/dashboard/views/integracoes/PixelView";

export default function PixelPage() {
  return <PixelView v={useTraffik()} />;
}
