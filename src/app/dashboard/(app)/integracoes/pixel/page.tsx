"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { PixelView } from "@/components/dashboard/views/integracoes/PixelView";

export default function PixelPage() {
  // `listPixels` é escopado por área: sem a prop, a lista ficava na área
  // anterior depois de uma troca (`router.refresh()` não remonta cliente).
  const v = useTraffik();
  return <PixelView workspaceId={v.workspaceAtiva} />;
}
