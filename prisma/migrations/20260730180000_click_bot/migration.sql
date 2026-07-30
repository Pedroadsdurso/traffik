-- Marcação de bot no clique.
--
-- ⚠️ ADITIVA, com DEFAULT. O build antigo que ainda roda em produção não conhece
-- estas colunas e simplesmente as ignora — o oposto do incidente da
-- 20260728120000, que dropou coluna ainda selecionada em prod.
--
-- ⚠️ O DEFAULT false faz TODO clique histórico nascer "não é bot", o que está
-- ERRADO para ~16,5% deles. Rode `npm run bot:reclassificar` logo depois desta
-- migration: ele reavalia o `userAgent` já gravado e corrige o histórico.
-- Sem esse passo, a contagem de bot na tela fica zerada e parece que o filtro
-- não está funcionando.
ALTER TABLE "Click" ADD COLUMN "bot" BOOLEAN NOT NULL DEFAULT false;

-- Por que o motivo é guardado, e não só o booleano: o usuário precisa poder
-- auditar se o filtro exagera ou falha. "18 marcados como navegador
-- automatizado" é uma afirmação verificável; "39 bots" não é.
ALTER TABLE "Click" ADD COLUMN "botMotivo" TEXT;

-- As consultas de métrica filtram por (userId, timestamp) E bot=false. Sem o
-- bot no índice, o Postgres traz as linhas de bot do disco só para descartá-las.
CREATE INDEX "Click_userId_bot_timestamp_idx" ON "Click"("userId", "bot", "timestamp");
