"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { UtmsView } from "@/components/dashboard/views/integracoes/UtmsView";

export default function UtmsPage() {
  // O script de UTM é POR ÁREA (embute o `WS`). Sem a prop, trocar de área
  // deixava na tela o script da área anterior — e ele é feito para ser copiado
  // e instalado, então o erro vira instalação errada, não só número velho.
  const v = useTraffik();
  return <UtmsView workspaceId={v.workspaceAtiva} />;
}
