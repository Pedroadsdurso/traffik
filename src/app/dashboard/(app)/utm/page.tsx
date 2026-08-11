"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { UtmSnippetsScreen } from "@/components/dashboard/views/utm/UtmSnippetsScreen";

/**
 * UTM & Snippets — área de primeiro nível desde 11/08/2026.
 *
 * ⚠️ Esta rota é a que existia como `dashboard/utm/page.tsx`, um `redirect` para
 * `integracoes/utms`. Os dois caminhos resolvem para `/dashboard/utm` (o grupo
 * `(app)` não entra na URL), então o arquivo antigo teve de sair — dois
 * `page.tsx` para a mesma rota é erro de build, não precedência.
 *
 * 🔴 A tela lê `v.workspaceAtiva` por dentro, não por prop, porque ela precisa
 * do valor ATUAL a cada troca de área: as duas abas entregam texto que vai para
 * o site do cliente, e o script embute a área.
 */
export default function UtmSnippetsPage() {
  return <UtmSnippetsScreen v={useTraffik()} />;
}
