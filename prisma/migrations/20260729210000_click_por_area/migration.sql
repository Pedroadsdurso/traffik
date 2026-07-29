-- Área declarada pelo script de UTM instalado na página.
--
-- ⚠️ ADITIVA E NULLABLE. Script já instalado não manda o parâmetro, a coluna
-- fica NULA, e o comportamento é idêntico ao de antes — nenhum clique
-- histórico muda de área.
--
-- ⚠️ A rota `/api/track/click` lê apenas chaves conhecidas do corpo, então um
-- script novo apontando para código antigo também não quebra: o `ws` é
-- ignorado. Script e rota podem subir em qualquer ordem.
--
-- ⚠️ Esta coluna NÃO vence a conta de anúncio na atribuição. Se o clique tem
-- `utm_campaign` atribuível, a área é a da conta que pagou por ele — senão o
-- gasto ficaria numa área e a visita em outra, quebrando as duas.
ALTER TABLE "Click" ADD COLUMN "workspaceId" TEXT;

-- SET NULL, nunca CASCADE: excluir uma área não pode apagar o histórico de
-- cliques dela — o dado passa a ser da Principal (catch-all), não some.
ALTER TABLE "Click" ADD CONSTRAINT "Click_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Click_workspaceId_idx" ON "Click"("workspaceId");
