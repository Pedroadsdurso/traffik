"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { RulesView } from "@/components/dashboard/views/RulesView";

export default function RegrasPage() {
  // A `RulesView` é autocontida (busca por server action); só a área ativa vem
  // do contexto, porque é ela que define quais contas e regras aparecem.
  const v = useTraffik();
  return <RulesView workspaceId={v.workspaceAtiva} />;
}
