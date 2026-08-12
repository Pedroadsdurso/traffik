"use client";

import { useTraffik } from "@/components/dashboard/TraffikContext";
import { WebhooksScreen } from "@/components/dashboard/views/webhooks/WebhooksScreen";

/**
 * ⛔ A ÁREA ATIVA É LIDA DENTRO DA TELA, e não passada daqui.
 *
 * A `WebhooksView` antiga também não recebia prop — mas ela lia `v.webhooks`,
 * uma lista que o layout busca uma vez e o hook mantém. A tela nova chama
 * `listWebhooks(workspaceId)` com `workspaceId` nas deps do efeito, porque o
 * que ela entrega é uma URL que vai para o painel de um gateway: lista velha
 * aqui não é número velho, é endereço de outra operação colado num site que a
 * gente não vê. Ver o cabeçalho da `WebhooksScreen`.
 */
export default function WebhooksPage() {
  return <WebhooksScreen v={useTraffik()} />;
}
