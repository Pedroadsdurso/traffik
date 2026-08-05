-- O que aconteceu DEPOIS que a venda foi gravada.
--
-- Os tres efeitos pos-resposta (Purchase na CAPI, InitiateCheckout do gateway e
-- a notificacao) rodavam dentro de try/catch com console.error e mais nada. O
-- webhook respondia 200, a venda entrava certa, e o efeito falhava em silencio:
-- conversao que nunca chegou ao Facebook, checkout que nunca entrou no funil,
-- aviso que nunca tocou. Nenhum deles aparecia em lugar nenhum da tela.
--
-- Mesmo padrao de `AdAccount.lastSyncError` (20260804180000): a coluna guarda o
-- texto CRU e a traducao para linguagem de tela vive em codigo
-- (`lib/webhook/efeitos.ts`), porque a lista de causas e necessariamente
-- incompleta e apagar o original tornaria o erro real irrecuperavel.
--
-- ADITIVA: seis colunas, todas nullable, sem DEFAULT e sem backfill. Nenhum
-- DROP, RENAME ou NOT NULL -- o build antigo que roda em producao ignora coluna
-- que nao conhece e continua funcionando. Ver a licao da 20260728120000.
--
-- 🔴 NULO = "esta venda e anterior a este codigo", NUNCA "falhou". Se nulo
-- alarmasse, toda venda do historico apareceria como quebrada no dia do deploy
-- -- a mesma licao do `effectiveStatus` e do `accountStatus`.
ALTER TABLE "Sale" ADD COLUMN "capiStatus"     TEXT;
ALTER TABLE "Sale" ADD COLUMN "capiErro"       TEXT;
ALTER TABLE "Sale" ADD COLUMN "checkoutStatus" TEXT;
ALTER TABLE "Sale" ADD COLUMN "checkoutErro"   TEXT;
ALTER TABLE "Sale" ADD COLUMN "notifStatus"    TEXT;
ALTER TABLE "Sale" ADD COLUMN "notifErro"      TEXT;

-- O card da aba Testes pergunta "quais vendas falharam nos ultimos N dias?".
-- Sem indice isso e varredura da tabela inteira a cada carregamento.
--
-- ⚠️ Recortado por "userId" na PRIMEIRA posicao de proposito: todo o produto
-- filtra por usuario, e um indice que comece pelo status serviria a uma
-- consulta que nao existe (a regra do origem-venda.mjs -- relatorio sem userId
-- esta medindo outra coisa).
CREATE INDEX "Sale_userId_capiStatus_idx"     ON "Sale" ("userId", "capiStatus");
CREATE INDEX "Sale_userId_checkoutStatus_idx" ON "Sale" ("userId", "checkoutStatus");
CREATE INDEX "Sale_userId_notifStatus_idx"    ON "Sale" ("userId", "notifStatus");
