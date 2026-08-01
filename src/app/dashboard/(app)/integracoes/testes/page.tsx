"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { TestesView } from "@/components/dashboard/views/integracoes/TestesView";

export default function TestesPage() {
  // O checklist é o indicador de progresso DA ÁREA ativa. Sem a prop, ele caía
  // no `getLastWorkspaceId()` do servidor e continuava mostrando a área anterior
  // depois de uma troca — `router.refresh()` não remonta componente cliente.
  const v = useTraffik();
  return <TestesView workspaceId={v.workspaceAtiva} />;
}
