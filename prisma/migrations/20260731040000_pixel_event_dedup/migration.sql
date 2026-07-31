-- Deduplicação de PixelEvent, agora que o `eventId` é DETERMINÍSTICO.
--
-- POR QUE SÓ AGORA: até 31/07/2026 o script gerava
-- `nome + Date.now() + Math.random()` — um id novo a cada chamada. Um índice
-- único aqui existiria e não seguraria nada, porque não havia duas linhas com o
-- mesmo id nem quando o evento era o mesmo. Primeiro o id passou a ser derivado
-- da AÇÃO (pixel + evento + página + visitante + janela de 10s); só então a
-- restrição tem o que recusar.
--
-- PARCIAL, e isso é obrigatório: `eventId` é nullable, e evento sem id não pode
-- colidir com outro sem id. Um índice comum trataria todos os NULL como
-- distintos no Postgres — funcionaria por acidente — mas declarar a intenção
-- evita que alguém "conserte" isso depois.
--
-- ⚠️ NÃO limpa as linhas duplicadas já existentes, de propósito. Elas têm ids
-- aleatórios e portanto não colidem; o histórico fica como está (decisão do
-- usuário em 31/07: o funil já deduplica por fbclid no tráfego pago, que é o
-- que ele usa para decidir, e apagar é irreversível sem PITR).
CREATE UNIQUE INDEX IF NOT EXISTS "PixelEvent_userId_event_eventId_key"
  ON "PixelEvent" ("userId", "event", "eventId")
  WHERE "eventId" IS NOT NULL;
