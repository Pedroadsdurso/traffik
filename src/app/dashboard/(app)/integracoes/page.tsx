"use client";

/**
 * Integrações › Visão geral.
 *
 * ⚠️ Esta rota era um `redirect("/dashboard/integracoes/anuncios")`. A tela não
 * existia — e por isso "Visão geral" não estava na navegação, o que ficou
 * registrado como pendência quando o shell foi reescrito.
 */
import { useTraffik } from "@/components/dashboard/TraffikContext";
import { VisaoGeralScreen } from "@/components/dashboard/views/integracoes/VisaoGeralScreen";

export default function IntegracoesVisaoGeralPage() {
  const v = useTraffik();
  return <VisaoGeralScreen v={v} />;
}
